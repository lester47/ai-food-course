// 連線層：RaceClient（連 Cloudflare 房間服務）與 LocalRoom（單機示範，不連網路）
import { RoomEngine, TEAMS } from './room-core.js';

const PING = '{"type":"ping"}';

export function wsUrl(server) {
  const u = new URL(server);
  u.protocol = u.protocol === 'http:' ? 'ws:' : 'wss:';
  u.pathname = u.pathname.replace(/\/$/, '') + '/ws';
  return u;
}

// 連線事件：
//  onWelcome({team, token, code})、onState(room_state)、onError(code, fatal)、onLink(status)
//  status: 'connecting' | 'online' | 'reconnecting' | 'closed'
export class RaceClient {
  constructor(server, handlers) {
    this.server = server; this.h = handlers;
    this.ws = null; this.mode = null; this.code = null; this.token = null; this.nick = null;
    this.offset = 0; this.bestRtt = Infinity; this.retry = 0; this.stopped = false;
    this.lastHeard = 0; this.hb = null; this.retryTimer = null;
  }
  now() { return Date.now() + this.offset; } // 估計的伺服器時間

  create(nick) { this.mode = 'create'; this.nick = nick; this.open(); }
  join(code, nick) { this.mode = 'join'; this.code = code; this.nick = nick; this.open(); }
  resume(code, token) { this.mode = 'resume'; this.code = code; this.token = token; this.open(); }

  open() {
    this.stopped = false;
    clearTimeout(this.retryTimer);
    const u = wsUrl(this.server);
    if (this.mode === 'create') { u.searchParams.set('room', 'new'); u.searchParams.set('nick', this.nick); }
    else u.searchParams.set('room', this.code); // 房號不是秘密；token 只放在訊息裡，不放網址
    this.h.onLink(this.retry ? 'reconnecting' : 'connecting');
    let ws;
    try { ws = new WebSocket(u); } catch { return this.scheduleRetry(); }
    this.ws = ws;
    let welcomed = false;
    ws.onmessage = ev => {
      this.lastHeard = Date.now();
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === 'hello') {
        if (this.mode === 'resume') ws.send(JSON.stringify({ type: 'resume', token: this.token }));
        else ws.send(JSON.stringify({ type: 'join', nickname: this.nick }));
      } else if (m.type === 'welcome') {
        welcomed = true; this.retry = 0;
        if (m.token) this.token = m.token;
        this.code = m.code; this.mode = 'resume'; // 之後斷線一律用 token 回來
        this.h.onWelcome(m);
        this.h.onLink('online');
        this.syncClock();
      } else if (m.type === 'room_state') {
        if (Number.isFinite(m.serverNow) && this.bestRtt === Infinity) this.offset = m.serverNow - Date.now();
        this.h.onState(m);
      } else if (m.type === 'sync') {
        const rtt = Date.now() - m.t;
        if (rtt >= 0 && rtt < this.bestRtt) { this.bestRtt = rtt; this.offset = m.serverNow + rtt / 2 - Date.now(); }
      } else if (m.type === 'error') {
        if (m.fatal) this.stopped = true;
        this.h.onError(m.code, !!m.fatal);
      }
    };
    ws.onopen = () => { this.lastHeard = Date.now(); this.startHeartbeat(); };
    ws.onclose = () => {
      this.stopHeartbeat();
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.stopped) { this.h.onLink('closed'); return; }
      if (!welcomed && this.mode === 'create') { this.h.onLink('closed'); this.h.onError('connect_failed', true); return; }
      this.scheduleRetry();
    };
    ws.onerror = () => {};
  }

  scheduleRetry() {
    if (this.stopped) return;
    if (!this.code || (this.mode !== 'resume' && this.mode !== 'join')) { this.h.onLink('closed'); this.h.onError('connect_failed', true); return; }
    if (this.mode === 'join' && !this.token) { this.h.onLink('closed'); this.h.onError('connect_failed', true); return; }
    this.retry++;
    this.h.onLink('reconnecting');
    const wait = Math.min(8000, 600 * 2 ** Math.min(this.retry - 1, 4)) + Math.random() * 400;
    this.retryTimer = setTimeout(() => this.open(), wait);
  }

  syncClock() {
    this.bestRtt = Infinity;
    for (let i = 0; i < 5; i++) setTimeout(() => this.send({ type: 'sync', t: Date.now() }), i * 250);
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.hb = setInterval(() => {
      if (!this.ws || this.ws.readyState !== 1) return;
      if (Date.now() - this.lastHeard > 45000) { try { this.ws.close(); } catch {} return; } // 太久沒消息：重連
      try { this.ws.send(PING); } catch {}
    }, 15000);
  }
  stopHeartbeat() { clearInterval(this.hb); this.hb = null; }

  send(o) { if (this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify(o)); return true; } return false; }

  // 網路恢復時立刻重試
  kick() { if (!this.ws && !this.stopped && this.code && this.token) { this.retry = 0; this.open(); } }

  leave() { this.send({ type: 'leave' }); this.close(); }
  close() { this.stopped = true; clearTimeout(this.retryTimer); this.stopHeartbeat(); const ws = this.ws; this.ws = null; try { ws?.close(); } catch {} }
}

// 單機示範：同一台電腦同時扮演紅綠兩隊，使用同一份房間規則，但不連網路
export class LocalRoom {
  constructor(onState) {
    this.onState = onState; this.timer = null;
    let i = 0; const gen = () => 'local-token-' + (++i) + '-xxxxxxxx';
    const now = Date.now();
    this.engine = RoomEngine.create('示範', '紅隊', now, gen).engine;
    this.engine.join('綠隊', now, gen);
    for (const t of TEAMS) this.engine.handle(t, { type: 'ready', ready: true, input: 'sim' }, now);
    this.seq = { red: 0, green: 0 }; this.count = { red: 0, green: 0 };
  }
  now() { return Date.now(); }
  emit() {
    const now = Date.now();
    this.onState(this.engine.view(now));
    clearTimeout(this.timer);
    const d = this.engine.nextDeadline();
    if (d != null) this.timer = setTimeout(() => { this.engine.tick(Date.now()); this.emit(); }, Math.max(0, d - now) + 10);
  }
  start() { this.count = { red: 0, green: 0 }; this.engine.handle('red', { type: 'start_request' }, Date.now()); this.emit(); }
  step(team) {
    const s = this.engine.s; const now = Date.now();
    this.engine.tick(now);
    if (s.phase !== 'racing') return;
    this.count[team] = Math.max(this.count[team], s.players[team].score) + 1;
    const r = this.engine.handle(team, { type: 'step', round: s.round, sequence: ++this.seq[team], count: this.count[team] }, now);
    this.emit(); // 就算這一步先欠著，也要排好稍後補記的時間
  }
  rematch() { for (const t of TEAMS) this.engine.handle(t, { type: 'rematch_request' }, Date.now()); this.emit(); }
  close() { clearTimeout(this.timer); }
}
