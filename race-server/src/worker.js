// AI 食農大使｜雙人競賽房間服務（Cloudflare Worker + Durable Object）
// - 不使用任何持久化儲存：不呼叫 ctx.storage、KV、D1；房間狀態只在記憶體與「活躍 WebSocket 的 attachment」裡。
// - 使用 WebSocket Hibernation API：休眠後由 attachment 復原房間。
// - 不記錄訊息內容（不 console.log 學生資料）。
import { DurableObject } from 'cloudflare:workers';
import { RoomEngine, isRoomCode, cleanNickname, validSnapshot } from '../../src/race/room-core.js';

const MAX_MSG = 1024;            // 單則訊息最大位元組
const MAX_SOCKETS = 8;           // 每房最多同時連線（含尚未表明身分者）
const IDENTIFY_MS = 15000;       // 連上後 15 秒內要送 join／resume
const ROOM_MAX_AGE = 4 * 3600e3; // 房間最長 4 小時
const SOCKET_RATE = 25;          // 每條連線每秒最多 25 則
const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });

function randomToken() {
  const b = new Uint8Array(24); crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function randomCode() {
  const b = new Uint32Array(1); crypto.getRandomValues(b);
  return String(100000 + (b[0] % 900000));
}

// ---------- Worker：檢查來源、限流、把連線送到對應房間 ----------
const ipHits = new Map(); // 每個 isolate 自己的粗略計數（不保存）
function limited(ip, kind, max) {
  const now = Date.now(), key = kind + ':' + ip;
  let h = ipHits.get(key);
  if (!h || now - h.at > 60000) h = { at: now, n: 0 };
  h.n++; ipHits.set(key, h);
  if (ipHits.size > 5000) for (const [k, v] of ipHits) if (now - v.at > 60000) ipHits.delete(k);
  return h.n > max;
}

export function originAllowed(origin, env) {
  if (!origin) return false;
  const list = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (list.includes(origin)) return true;
  if (env.ALLOW_LOCALHOST === 'true' && /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)) return true;
  return false;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    if (url.pathname === '/' || url.pathname === '/health') {
      const cors = originAllowed(origin, env) ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {};
      return json({ ok: true, service: 'ai-food-race', time: Date.now() }, 200, { ...cors, 'cache-control': 'no-store' });
    }
    if (url.pathname !== '/ws') return json({ error: 'not_found' }, 404);
    if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'upgrade_required' }, 426);
    if (!originAllowed(origin, env)) return json({ error: 'origin' }, 403);
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    const room = url.searchParams.get('room') || '';

    if (room === 'new') {
      if (limited(ip, 'create', Number(env.CREATE_PER_MIN || 20))) return json({ error: 'rate_limited' }, 429);
      const nick = cleanNickname(url.searchParams.get('nick') || '');
      if (!nick) return json({ error: 'bad_nick' }, 400);
      // 由伺服器挑房號，並請房間確認沒有人使用中
      for (let i = 0; i < 8; i++) {
        const code = randomCode();
        const stub = env.RACE_ROOM.get(env.RACE_ROOM.idFromName('room:' + code));
        const res = await stub.fetch(new Request(`https://room/create?code=${code}&nick=${encodeURIComponent(nick)}`, { headers: request.headers }));
        if (res.status !== 409) return res;
      }
      return json({ error: 'server_busy' }, 503);
    }
    if (!isRoomCode(room)) return json({ error: 'bad_room' }, 400);
    if (limited(ip, 'join', Number(env.JOIN_PER_MIN || 60))) return json({ error: 'rate_limited' }, 429);
    const stub = env.RACE_ROOM.get(env.RACE_ROOM.idFromName('room:' + room));
    return stub.fetch(new Request(`https://room/join?code=${room}`, { headers: request.headers }));
  },
};

// ---------- Durable Object：一個房間一個 ----------
export class RaceRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.engine = null;
    this.timer = null;
    this.rates = new WeakMap();
    // 心跳由執行環境自動回覆，不會叫醒休眠中的房間
    try { ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong"}')); } catch {}
    this.restore();
  }

  sockets(except) { return this.ctx.getWebSockets().filter(ws => ws !== except && ws.readyState !== 3 /* CLOSED */); }
  att(ws) { try { return ws.deserializeAttachment() || {}; } catch { return {}; } }

  // 休眠或重啟後：從活躍連線的 attachment 找回最新的房間狀態
  restore() {
    let best = null;
    for (const ws of this.sockets()) { const a = this.att(ws); if (a.snap && (!best || a.snap.ver > best.ver)) best = a.snap; }
    if (!best) return;
    // 無法可信復原：安全結束，不判勝負
    if (!validSnapshot(best)) { this.engine = null; for (const ws of this.sockets()) { this.send(ws, { type: 'error', code: 'restore_failed', fatal: true }); this.safeClose(ws, 4500, 'restore_failed'); } return; }
    this.engine = RoomEngine.fromJSON(best);
    const now = Date.now();
    const live = new Set(this.sockets().map(ws => this.att(ws)).filter(a => a.team && this.ownsSeat(a)).map(a => a.team));
    for (const t of ['red', 'green']) if (this.engine.s.players[t]?.online && !live.has(t)) this.engine.disconnect(t, now);
    this.engine.tick(now);
    this.commit(now);
  }

  ownsSeat(a) { const p = this.engine?.s.players[a.team]; return !!(p && a.tk && p.token === a.tk); }

  async fetch(request) {
    const url = new URL(request.url);
    const now = Date.now();
    if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'upgrade_required' }, 426);
    this.sweep(now);

    if (url.pathname === '/create') {
      if (this.engine && this.engine.alive) return new Response('taken', { status: 409 });
      const { engine, token, team } = RoomEngine.create(url.searchParams.get('code'), cleanNickname(url.searchParams.get('nick')), now, randomToken);
      this.engine = engine;
      const { client, server } = this.pair();
      this.attach(server, { team, tk: token, at: now });
      this.send(server, { type: 'welcome', team, token, code: engine.s.code });
      this.commit(now);
      return new Response(null, { status: 101, webSocket: client });
    }

    // 加入：先接受連線，再用訊息告知錯誤（瀏覽器讀不到握手失敗的原因）
    const { client, server } = this.pair();
    if (!this.engine || !this.engine.alive) {
      this.send(server, { type: 'error', code: 'room_not_found', fatal: true });
      this.safeClose(server, 4004, 'room_not_found');
    } else if (this.sockets(server).length > MAX_SOCKETS) {
      this.send(server, { type: 'error', code: 'too_many', fatal: true });
      this.safeClose(server, 4029, 'too_many');
    } else {
      this.attach(server, { team: null, at: now });
      this.send(server, { type: 'hello', code: this.engine.s.code });
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  pair() {
    const p = new WebSocketPair();
    const [client, server] = Object.values(p);
    this.ctx.acceptWebSocket(server);
    return { client, server };
  }

  async webSocketMessage(ws, data) {
    const now = Date.now();
    if (typeof data !== 'string' || data.length > MAX_MSG) return this.send(ws, { type: 'error', code: 'bad_message' });
    // 每條連線的訊息頻率限制
    let r = this.rates.get(ws);
    if (!r || now - r.at >= 1000) r = { at: now, n: 0, warned: false };
    r.n++; this.rates.set(ws, r);
    if (r.n > SOCKET_RATE) { if (!r.warned) { r.warned = true; this.send(ws, { type: 'error', code: 'rate_limited' }); } return; }

    let msg;
    try { msg = JSON.parse(data); } catch { return this.send(ws, { type: 'error', code: 'bad_message' }); }
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'sync') return this.send(ws, { type: 'sync', t: Number(msg.t) || 0, serverNow: now });
    if (msg.type === 'ping') return this.send(ws, { type: 'pong' });

    if (!this.engine || !this.engine.alive) { this.send(ws, { type: 'error', code: 'room_not_found', fatal: true }); return this.safeClose(ws, 4004, 'room_not_found'); }
    if (now - this.engine.s.createdAt > ROOM_MAX_AGE) return this.expire();

    const a = this.att(ws);
    if (!a.team) {
      let res;
      if (msg.type === 'join') res = this.engine.join(msg.nickname, now, randomToken);
      else if (msg.type === 'resume') res = this.engine.resume(msg.token, now);
      else return this.send(ws, { type: 'error', code: 'bad_message' });
      if (res.error) {
        this.send(ws, { type: 'error', code: res.error, fatal: true });
        this.safeClose(ws, 4001, res.error);
        return this.commit(now);
      }
      const token = res.token || msg.token;
      // 同一位選手重複連線：保留最新的，舊的分頁關閉
      for (const other of this.sockets(ws)) { const oa = this.att(other); if (oa.team === res.team) { this.send(other, { type: 'error', code: 'replaced', fatal: true }); this.attach(other, { team: null, at: 0, dead: true }); this.safeClose(other, 4009, 'replaced'); } }
      this.attach(ws, { team: res.team, tk: token, at: now });
      this.send(ws, { type: 'welcome', team: res.team, token: res.token || undefined, code: this.engine.s.code });
      return this.commit(now);
    }

    if (!this.ownsSeat(a)) { this.send(ws, { type: 'error', code: 'bad_token', fatal: true }); return this.safeClose(ws, 4001, 'bad_token'); }
    const out = this.engine.handle(a.team, msg, now);
    if (out.error) this.send(ws, { type: 'error', code: out.error });
    if (msg.type === 'leave') { this.attach(ws, { team: null, at: 0, dead: true }); this.safeClose(ws, 1000, 'left'); }
    if (out.changed) this.commit(now);
  }

  async webSocketClose(ws, code) { this.onGone(ws); this.safeClose(ws, 1000, 'closed'); }
  async webSocketError(ws) { this.onGone(ws); }

  onGone(ws) {
    if (!this.engine) return;
    const a = this.att(ws);
    if (!a.team || !this.ownsSeat(a)) return;
    const stillHere = this.sockets(ws).some(o => { const oa = this.att(o); return oa.team === a.team && oa.tk === a.tk; });
    if (stillHere) return;
    this.engine.disconnect(a.team, Date.now());
    this.commit(Date.now(), ws);
  }

  // 狀態改變後：寫進每條連線的 attachment、廣播、排下一次檢查
  commit(now, except) {
    if (!this.engine) return;
    if (!this.engine.alive) { this.engine = null; this.clearTimer(); return; }
    const snap = this.engine.toJSON();
    const view = JSON.stringify(this.engine.view(now));
    for (const ws of this.sockets(except)) {
      const a = this.att(ws);
      if (a.dead) continue;
      if (a.team) { this.attach(ws, { ...a, snap }); try { ws.send(view); } catch {} }
    }
    this.schedule();
  }

  attach(ws, a) { try { ws.serializeAttachment(a); } catch {} }
  send(ws, o) { try { ws.send(JSON.stringify(o)); } catch {} }
  safeClose(ws, code, reason) { try { ws.close(code, reason); } catch {} }
  clearTimer() { if (this.timer) clearTimeout(this.timer); this.timer = null; }

  schedule() {
    this.clearTimer();
    const d = this.engine?.nextDeadline();
    if (d == null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.engine) return;
      const now = Date.now();
      this.engine.tick(now);
      this.commit(now);
    }, Math.max(0, d - Date.now()) + 25);
  }

  // 清掉連上卻遲遲不表明身分的連線
  sweep(now) {
    for (const ws of this.sockets()) { const a = this.att(ws); if (!a.team && !a.dead && a.at && now - a.at > IDENTIFY_MS) this.safeClose(ws, 4008, 'identify_timeout'); }
  }

  expire() {
    for (const ws of this.sockets()) { this.send(ws, { type: 'error', code: 'room_expired', fatal: true }); this.safeClose(ws, 4010, 'expired'); }
    this.engine = null; this.clearTimer();
  }
}
