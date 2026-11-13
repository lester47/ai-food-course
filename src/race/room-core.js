// 雙人競賽房間：共用的純邏輯（瀏覽器與 Cloudflare Durable Object 都使用這一份）
// 不碰網路、不碰儲存；所有時間都由呼叫端傳入 now（毫秒），方便測試。

export const TARGET = 20;            // 先到 20 步獲勝
export const COUNTDOWN_MS = 3000;    // 倒數 3 秒
export const RECONNECT_MS = 60000;   // 斷線保留席位 60 秒
export const MAX_STEP_JUMP = 3;      // 一則訊息最多加 3 步（容忍漏掉的行）
export const STEP_RATE = 8;          // 每秒最多 8 步
export const STEP_BURST = 4;         // 瞬間最多累積 4 步額度
export const TEAMS = ['red', 'green'];
export const TEAM_NAME = { red: '紅隊', green: '綠隊' };
export const PHASES = ['waiting', 'ready', 'countdown', 'racing', 'paused', 'finished'];

export const isRoomCode = s => typeof s === 'string' && /^\d{6}$/.test(s);
export const isTeam = t => t === 'red' || t === 'green';
export const otherTeam = t => (t === 'red' ? 'green' : 'red');

// 暱稱：最多 10 個字，去掉控制字元與 HTML 符號；空白回傳 null
export function cleanNickname(s) {
  if (typeof s !== 'string') return null;
  const t = Array.from(s.replace(/[\u0000-\u001f\u007f<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim()).slice(0, 10).join('');
  return t || null;
}

// ---------- micro:bit 序列資料 ----------
// 接受 STEP:12（規格 v1）與 STEP,12（第一週課程格式）；RESET。其他一律視為雜訊（回傳 null）。
export function parseSerialLine(line) {
  if (typeof line !== 'string') return null;
  const s = line.trim();
  if (!s || s.length > 32) return null;
  if (/^RESET$/i.test(s)) return { type: 'reset' };
  const m = /^STEP\s*[:,]\s*(\d{1,5})$/i.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) && n <= 99999 ? { type: 'step', count: n } : null;
}

// 把一段一段讀進來的文字切成完整的行（不能假設一次 read 就是一整行）
export class LineSplitter {
  constructor(maxLen = 128) { this.buf = ''; this.maxLen = maxLen; this.dropped = 0; }
  push(chunk) {
    this.buf += chunk;
    const parts = this.buf.split(/\r?\n|\r/);
    this.buf = parts.pop();
    if (this.buf.length > this.maxLen) { this.buf = ''; this.dropped++; }
    return parts.filter(p => { if (p.length > this.maxLen) { this.dropped++; return false; } return p.trim().length > 0; });
  }
  clear() { this.buf = ''; }
}

// 把 micro:bit 的累積步數換算成「新增了幾步」。
// 這樣不論板子現在數到幾，都只看比賽期間新增的搖晃；板子按 A 歸零也不會影響對手。
export class StepTracker {
  constructor() { this.last = null; }
  feed(msg) {
    if (!msg) return 0;
    if (msg.type === 'reset') { this.last = 0; return 0; }
    const n = msg.count;
    if (this.last === null || n < this.last) { this.last = n; return n > 0 ? 1 : 0; } // 第一次讀到或板子重開
    const d = Math.min(n - this.last, MAX_STEP_JUMP);
    this.last = n;
    return d;
  }
}

// 檢查（休眠後復原用的）房間狀態是否完整可信
export function validSnapshot(s) {
  try {
    if (!s || typeof s !== 'object' || !isRoomCode(s.code) && s.code !== '示範') return false;
    if (!Number.isSafeInteger(s.round) || s.round < 1 || !Number.isSafeInteger(s.ver) || !PHASES.includes(s.phase)) return false;
    if (!isTeam(s.host) || !s.players || typeof s.players !== 'object') return false;
    let seated = 0;
    for (const t of TEAMS) {
      const p = s.players[t];
      if (p === null) continue;
      if (typeof p !== 'object' || typeof p.token !== 'string' || p.token.length < 16 || typeof p.nick !== 'string') return false;
      if (!Number.isSafeInteger(p.score) || p.score < 0 || p.score > TARGET || typeof p.online !== 'boolean') return false;
      seated++;
    }
    if (!seated) return false;
    if (['countdown', 'racing', 'paused'].includes(s.phase) && seated !== 2) return false;
    if (s.phase === 'countdown' && !Number.isFinite(s.startAt)) return false;
    if (s.phase === 'paused' && !Number.isFinite(s.pausedAt)) return false;
    if (s.winner !== null && !isTeam(s.winner)) return false;
    return true;
  } catch { return false; }
}

// ---------- 房間引擎 ----------
const newSeat = (nick, token, now) => ({ nick, token, score: 0, ready: false, input: null, device: false, rematch: false, seq: 0, online: true, goneAt: null, joinedAt: now });

export class RoomEngine {
  constructor(state) {
    this.s = state;
    this.buckets = { red: { tokens: STEP_BURST, at: 0 }, green: { tokens: STEP_BURST, at: 0 } }; // 只在記憶體，不必保存
  }

  static create(code, nick, now, genToken) {
    const token = genToken();
    const s = {
      v: 1, code, round: 1, phase: 'waiting', host: 'red',
      players: { red: newSeat(nick, token, now), green: null },
      startAt: null, pausedAt: null, winner: null, finishedAt: null,
      notice: null, noticeId: 0, ver: 1, createdAt: now,
    };
    return { engine: new RoomEngine(s), token, team: 'red' };
  }

  static fromJSON(s) { return new RoomEngine(JSON.parse(JSON.stringify(s))); }
  toJSON() { return this.s; }

  get seated() { return TEAMS.filter(t => this.s.players[t]); }
  get alive() { return this.seated.length > 0; }

  teamOfToken(token) {
    if (typeof token !== 'string' || token.length < 16) return null;
    return TEAMS.find(t => this.s.players[t] && this.s.players[t].token === token) || null;
  }

  // ---- 進出房間 ----
  join(nick, now, genToken) {
    nick = cleanNickname(nick);
    if (!nick) return { error: 'bad_nick' };
    this.tick(now);
    const free = ['green', 'red'].find(t => !this.s.players[t]);
    if (!free) return { error: 'room_full' };
    const token = genToken();
    this.s.players[free] = newSeat(nick, token, now);
    if (!this.s.players[this.s.host]) this.s.host = free;
    this.notify('joined_' + free);
    this.recomputeLobby();
    this.bump();
    return { ok: true, team: free, token };
  }

  resume(token, now) {
    this.tick(now);
    const team = this.teamOfToken(token);
    if (!team) return { error: 'bad_token' };
    const p = this.s.players[team];
    p.online = true; p.goneAt = null;
    if (this.s.phase === 'paused' && this.bothOnline() && this.devicesOk()) {
      // 兩人都回來了：重新倒數後繼續（分數保留）
      this.s.phase = 'countdown'; this.s.startAt = now + COUNTDOWN_MS; this.s.pausedAt = null;
      this.notify('resumed');
    } else this.recomputeLobby();
    this.bump();
    return { ok: true, team };
  }

  disconnect(team, now) {
    const p = this.s.players[team];
    if (!p || !p.online) return false;
    this.tick(now);
    p.online = false; p.goneAt = now; p.device = false;
    if (['countdown', 'racing'].includes(this.s.phase)) {
      this.s.phase = 'paused'; this.s.pausedAt = now; this.s.startAt = null;
      this.notify('paused_' + team);
    } else this.recomputeLobby();
    this.bump();
    return true;
  }

  leave(team, now) {
    if (!this.s.players[team]) return false;
    this.tick(now);
    const midRace = ['countdown', 'racing', 'paused'].includes(this.s.phase);
    this.s.players[team] = null;
    if (this.s.host === team) this.s.host = otherTeam(team);
    if (midRace || this.s.phase === 'finished') this.newRound(false);
    this.notify((midRace ? 'left_mid_' : 'left_') + team);
    this.recomputeLobby();
    this.bump();
    return true;
  }

  // ---- 時間推進（倒數結束、斷線逾時） ----
  tick(now) {
    let changed = false;
    const s = this.s;
    if (s.phase === 'countdown' && now >= s.startAt) { s.phase = 'racing'; changed = true; }
    if (s.phase === 'paused' && now - s.pausedAt >= RECONNECT_MS) {
      // 逾時：本局取消，不判勝負；離線的人釋放席位
      for (const t of TEAMS) if (s.players[t] && !s.players[t].online) this.release(t);
      this.newRound(false);
      this.notify('timeout_cancel');
      this.recomputeLobby();
      changed = true;
    }
    if (s.phase !== 'paused') {
      for (const t of TEAMS) {
        const p = s.players[t];
        if (p && !p.online && p.goneAt !== null && now - p.goneAt >= RECONNECT_MS) {
          this.release(t);
          if (s.phase === 'finished') this.newRound(false);
          this.notify('released_' + t);
          this.recomputeLobby();
          changed = true;
        }
      }
    }
    if (changed) this.bump();
    return changed;
  }

  nextDeadline() {
    const s = this.s, ds = [];
    if (s.phase === 'countdown') ds.push(s.startAt);
    if (s.phase === 'paused') ds.push(s.pausedAt + RECONNECT_MS);
    else for (const t of TEAMS) { const p = s.players[t]; if (p && !p.online && p.goneAt !== null) ds.push(p.goneAt + RECONNECT_MS); }
    return ds.length ? Math.min(...ds) : null;
  }

  // ---- 玩家訊息 ----
  // 回傳 { changed, error? }；error 是給該玩家看的代碼，不廣播
  handle(team, msg, now) {
    const s = this.s, p = s.players[team];
    if (!p || !msg || typeof msg !== 'object') return { changed: false, error: 'bad_message' };
    const ticked = this.tick(now);
    const r = this.dispatch(team, p, msg, now);
    return { changed: ticked || !!r.changed, error: r.error };
  }

  dispatch(team, p, msg, now) {
    const s = this.s;
    switch (msg.type) {
      case 'ready': {
        if (!['waiting', 'ready'].includes(s.phase)) return { error: 'not_now' };
        const input = msg.input === 'sim' ? 'sim' : msg.input === 'microbit' ? 'microbit' : null;
        const ready = msg.ready === true;
        if (ready && !input) return { error: 'bad_message' };
        if (ready && input === 'microbit' && !p.device) return { error: 'no_device' };
        p.ready = ready; p.input = ready ? input : p.input;
        this.recomputeLobby(); this.bump();
        return { changed: true };
      }
      case 'device': {
        const d = msg.connected === true;
        if (p.device === d) return {};
        p.device = d;
        // 比賽前拔掉板子：取消準備
        if (!d && p.input === 'microbit' && ['waiting', 'ready'].includes(s.phase)) { p.ready = false; this.recomputeLobby(); }
        // 比賽中拔掉板子：暫停，等插回去
        if (!d && p.input === 'microbit' && ['countdown', 'racing'].includes(s.phase)) {
          s.phase = 'paused'; s.pausedAt = now; s.startAt = null; this.notify('unplugged_' + team);
        }
        if (d && s.phase === 'paused' && this.bothOnline() && this.devicesOk()) {
          s.phase = 'countdown'; s.startAt = now + COUNTDOWN_MS; s.pausedAt = null; this.notify('resumed');
        }
        this.bump();
        return { changed: true };
      }
      case 'start_request': {
        if (s.host !== team) return { error: 'not_host' };
        if (s.phase !== 'ready') return { error: 'not_ready' };
        for (const t of TEAMS) { const q = s.players[t]; q.score = 0; q.seq = 0; q.rematch = false; }
        s.phase = 'countdown'; s.startAt = now + COUNTDOWN_MS; s.winner = null; s.finishedAt = null;
        this.buckets = { red: { tokens: STEP_BURST, at: 0 }, green: { tokens: STEP_BURST, at: 0 } };
        this.notify('countdown'); this.bump();
        return { changed: true };
      }
      case 'step': {
        if (msg.round !== s.round) return { error: 'old_round' };
        if (s.phase !== 'racing') return { error: s.phase === 'countdown' ? 'not_started' : 'not_racing' };
        const seq = msg.sequence ?? msg.seq, count = msg.count;
        if (!Number.isSafeInteger(seq) || !Number.isSafeInteger(count) || seq < 1 || count < 0 || count > 100000) return { error: 'bad_message' };
        if (seq <= p.seq) return {}; // 重複或亂序，忽略
        p.seq = seq;
        if (count <= p.score) return {};
        let inc = Math.min(count - p.score, MAX_STEP_JUMP);
        const b = this.buckets[team];
        b.tokens = Math.min(STEP_BURST, b.tokens + (b.at ? (now - b.at) / 1000 * STEP_RATE : STEP_BURST));
        b.at = now;
        inc = Math.min(inc, Math.floor(b.tokens));
        if (inc <= 0) return { error: 'too_fast' };
        b.tokens -= inc;
        p.score = Math.min(TARGET, p.score + inc);
        if (p.score >= TARGET && !s.winner) {
          s.winner = team; s.phase = 'finished'; s.finishedAt = now; this.notify('win_' + team);
        }
        this.bump();
        return { changed: true };
      }
      case 'rematch_request': {
        if (s.phase !== 'finished') return { error: 'not_now' };
        p.rematch = true;
        if (this.seated.length === 2 && TEAMS.every(t => s.players[t].rematch)) { this.newRound(true); this.notify('rematch'); }
        this.recomputeLobby(); this.bump();
        return { changed: true };
      }
      case 'leave': return { changed: this.leave(team, now) };
      default: return { error: 'bad_message' };
    }
  }

  // ---- 內部工具 ----
  bothOnline() { return this.seated.length === 2 && TEAMS.every(t => this.s.players[t].online); }
  devicesOk() { return TEAMS.every(t => { const p = this.s.players[t]; return p && (p.input !== 'microbit' || p.device); }); }
  release(t) { this.s.players[t] = null; if (this.s.host === t) this.s.host = otherTeam(t); }
  notify(code) { this.s.notice = code; this.s.noticeId++; }
  bump() { this.s.ver++; }

  newRound(keepReady) {
    const s = this.s;
    s.round++; s.winner = null; s.finishedAt = null; s.startAt = null; s.pausedAt = null; s.phase = 'waiting';
    for (const t of TEAMS) {
      const p = s.players[t]; if (!p) continue;
      p.score = 0; p.seq = 0; p.rematch = false;
      p.ready = keepReady && (p.input !== 'microbit' || p.device);
    }
  }

  recomputeLobby() {
    const s = this.s;
    if (!['waiting', 'ready'].includes(s.phase)) return;
    s.phase = this.bothOnline() && TEAMS.every(t => s.players[t].ready) && this.devicesOk() ? 'ready' : 'waiting';
  }

  // 廣播給兩位玩家的公開狀態（不含 token）
  view(now) {
    const s = this.s, pub = p => p && { nick: p.nick, score: p.score, ready: p.ready, input: p.input, device: p.device, online: p.online, rematch: p.rematch, goneAt: p.goneAt };
    return {
      type: 'room_state', code: s.code, round: s.round, phase: s.phase, host: s.host, target: TARGET,
      startAt: s.startAt, pausedAt: s.pausedAt, reconnectMs: RECONNECT_MS, winner: s.winner,
      notice: s.notice, noticeId: s.noticeId, ver: s.ver, serverNow: now,
      players: { red: pub(s.players.red), green: pub(s.players.green) },
    };
  }
}

// 讓錯誤代碼變成學生看得懂的話
export const MESSAGES = {
  room_not_found: '找不到這個房號。請確認 6 位數字是否正確，或請同學重新建立房間。',
  room_full: '這個房間已經有兩位選手了，請換一個房號。',
  bad_nick: '請先輸入暱稱（不要寫真實姓名）。',
  bad_token: '無法回到原本的房間（可能已逾時）。請重新加入。',
  bad_room: '房號要是 6 位數字。',
  not_host: '只有房主（建立房間的人）可以按「開始比賽」。',
  not_ready: '兩位選手都要按「準備好了」才能開始。',
  not_now: '現在不能做這件事。',
  no_device: '請先連接 micro:bit，或改選「模擬按鈕」。',
  not_started: '還在倒數，現在搖不算分喔！',
  not_racing: '比賽還沒開始或已經結束。',
  old_round: '這是上一局的訊號，不算分。',
  too_fast: '步數來得太快，部分訊號不計分。',
  bad_message: '收到看不懂的訊息。',
  rate_limited: '動作太頻繁了，請稍等一下再試。',
  origin: '這個網頁沒有權限連到競賽伺服器。',
  replaced: '你在另一個分頁或視窗打開了同一個選手，這個畫面已停止。',
  server_busy: '伺服器忙碌中，請稍後再試。',
  too_many: '這個房間的連線太多了，請稍後再試。',
};

export const NOTICES = {
  joined_green: '綠隊選手加入了！', joined_red: '紅隊選手加入了！',
  countdown: '準備……開始倒數！', resumed: '兩位選手都回來了，重新倒數後繼續！',
  paused_red: '紅隊斷線了，比賽暫停，等待重新連線……', paused_green: '綠隊斷線了，比賽暫停，等待重新連線……',
  unplugged_red: '紅隊的 micro:bit 拔掉了，比賽暫停。', unplugged_green: '綠隊的 micro:bit 拔掉了，比賽暫停。',
  timeout_cancel: '等太久沒有回來，本局取消，不計勝負。',
  left_red: '紅隊選手離開了房間。', left_green: '綠隊選手離開了房間。',
  left_mid_red: '紅隊選手在比賽中離開，本局取消，不計勝負。', left_mid_green: '綠隊選手在比賽中離開，本局取消，不計勝負。',
  released_red: '紅隊選手太久沒回來，席位已釋放。', released_green: '綠隊選手太久沒回來，席位已釋放。',
  win_red: '紅隊先到終點！', win_green: '綠隊先到終點！', rematch: '雙方同意重賽，分數歸零！',
};
