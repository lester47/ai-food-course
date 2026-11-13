// 雙人競賽實驗室：畫面與流程
import { TARGET, TEAMS, TEAM_NAME, MESSAGES, NOTICES, StepTracker, isRoomCode, cleanNickname, otherTeam } from './room-core.js';
import { RaceClient, LocalRoom } from './client.js';
import { SerialReader, serialSupported } from './serial-reader.js';
import { RACE_SERVER } from '../config/race.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const main = $('#race-main');
const EXTRA = {
  connect_failed: '連不上競賽伺服器。請檢查網路，或請老師確認伺服器已經啟用。',
  room_expired: '這個房間已超過使用時間，請重新建立房間。',
  restore_failed: '伺服器重新啟動，這一局無法安全接續，所以取消了（不計勝負）。請重新建立房間。',
  no_server: '競賽伺服器還沒設定好（老師要先完成部署）。現在可以先用老師專區的「單機示範」。',
};
const msgText = code => MESSAGES[code] || EXTRA[code] || '發生問題，請再試一次。';

// ---------- 伺服器網址 ----------
function pickServer() {
  const q = new URLSearchParams(location.search).get('server');
  if (q) {
    try {
      const u = new URL(q);
      const okHost = /^(localhost|127\.0\.0\.1)$/.test(u.hostname) || u.hostname.endsWith('.workers.dev');
      if (okHost && /^https?:$/.test(u.protocol)) return u.origin;
    } catch {}
  }
  return RACE_SERVER ? RACE_SERVER.replace(/\/$/, '') : '';
}
const SERVER = pickServer();

// ---------- 分頁暫存（只存在這個分頁，關掉就消失；不寫進網址） ----------
const SKEY = 'ai-food-race-session';
const loadSession = () => { try { const s = JSON.parse(sessionStorage.getItem(SKEY) || 'null'); return s && s.server === SERVER && isRoomCode(s.code) && s.token ? s : null; } catch { return null; } };
const saveSession = s => { try { sessionStorage.setItem(SKEY, JSON.stringify(s)); } catch {} };
const clearSession = () => { try { sessionStorage.removeItem(SKEY); } catch {} };
const loadNick = () => { try { return sessionStorage.getItem(SKEY + '-nick') || ''; } catch { return ''; } };
const saveNick = n => { try { sessionStorage.setItem(SKEY + '-nick', n); } catch {} };

// ---------- 狀態 ----------
const st = {
  serverOk: null, client: null, local: null, room: null, me: null, link: 'closed',
  input: serialSupported() ? 'microbit' : 'sim', serialText: '', serialErr: false, signal: '', signalAt: 0,
  localCount: 0, countRound: 0, seq: 0, screen: null, msg: '', msgErr: false, lastNotice: 0,
  fatal: null, session: null,
};
const tracker = new StepTracker();
const serial = new SerialReader(onSerialMessage, onSerialStatus);

// ---------- 小工具 ----------
function setMsg(text, isErr = false) {
  st.msg = text; st.msgErr = isErr;
  for (const el of $$('[data-b="msg"]')) { el.textContent = text; el.classList.toggle('err', isErr); }
}
const myPlayer = () => (st.room && st.me ? st.room.players[st.me] : null);
const serverNow = () => (st.client ? st.client.now() : Date.now());
function phaseScreen() {
  if (st.local) return 'local';
  if (st.fatal) return 'fatal';
  if (!st.room) return st.session ? 'joining' : 'lobby';
  return ['waiting', 'ready'].includes(st.room.phase) ? 'room' : 'race';
}

// ---------- 畫面 ----------
function render() {
  const key = phaseScreen();
  if (key !== st.screen) {
    st.screen = key;
    main.innerHTML = ({ lobby: lobbyHTML, joining: joiningHTML, room: roomHTML, race: raceHTML, local: localHTML, fatal: fatalHTML })[key]();
    bind(key);
  }
  update();
}

function lobbyHTML() {
  return `
  <section class="race-hero">
    <p class="race-eyebrow">第 3 週｜雙人競賽實驗室</p>
    <h1>🏁 雙人競賽實驗室</h1>
    <p>兩個人、兩台電腦、各一塊 micro:bit。搖一搖，看誰先走到 <b>${TARGET} 步</b>！</p>
    <a class="race-btn blue race-lesson-link" href="./lesson.html">📡 第一次玩？先看課程：micro:bit 會說話</a>
  </section>
  <ul class="race-checks" aria-label="使用環境檢查">
    <li data-check="serial"></li>
    <li data-check="server"></li>
  </ul>
  <section class="race-lobby">
    <label class="race-nick"><span>你的暱稱 <small>（不要寫真實姓名，最多 10 個字）</small></span>
      <input id="nick" maxlength="10" autocomplete="off" placeholder="例如：茶園小勇士" value="${esc(loadNick())}"></label>
    <div class="race-cards">
      <article class="race-card is-red">
        <h2>🔴 建立房間</h2>
        <p>你會是 <b>紅隊</b>。建立後會拿到 6 位數房號，告訴旁邊的同學。</p>
        <button id="create" class="race-btn red" type="button">建立房間</button>
      </article>
      <article class="race-card is-green">
        <h2>🟢 加入房間</h2>
        <p>輸入同學給你的 6 位數房號，你會是 <b>綠隊</b>。</p>
        <input id="code" class="race-code-input" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="6 位數房號" aria-label="6 位數房號">
        <button id="join" class="race-btn green" type="button">加入房間</button>
      </article>
    </div>
    <p class="race-msg" data-b="msg" role="alert"></p>
  </section>
  ${helpHTML()}
  <details class="race-help">
    <summary>🧑‍🏫 老師專區：單機示範與測試方式</summary>
    <p><b>單機示範</b>：一台電腦同時扮演紅綠兩隊，用按鈕（或鍵盤 <kbd>A</kbd>／<kbd>L</kbd>）走路，不需要網路與 micro:bit，適合上課示範規則。</p>
    <button id="local" class="race-btn ghost" type="button">開始單機示範</button>
    <p><b>兩台電腦連線測試（沒有 micro:bit 也可以）</b>：兩台電腦都打開這一頁，一台建立房間、一台輸入房號加入，兩邊都選「模擬按鈕」再按準備。畫面會清楚標示誰在用模擬按鈕。</p>
    <p class="race-small">競賽伺服器：<span data-b="server-url"></span></p>
    <p class="race-small">本頁不使用資料庫：房間只在比賽期間存在，所有人離開後就清除，不保留成績，也不記錄真實姓名。</p>
  </details>`;
}

function helpHTML() {
  return `
  <details class="race-help">
    <summary>📘 micro:bit 要寫什麼程式？（MakeCode 積木）</summary>
    <ol class="race-steps">
      <li>建立變數 <b>步數</b>。</li>
      <li><b>當 晃動（搖晃）時</b>：<b>步數 改變 1</b>，再用「序列埠 寫入一行」送出 <code>STEP,</code> 合併 <b>步數</b>（例如 <code>STEP,12</code>）。</li>
      <li><b>當 按鈕 A 被按下時</b>：<b>步數 設為 0</b>，再寫入一行 <code>RESET</code>。</li>
      <li>下載到 micro:bit 後，<b>關掉 MakeCode 的「顯示資料」視窗</b>，不然這一頁會連不上板子。</li>
    </ol>
    <p><a href="./lesson.html">📡 看完整課程：序列、字串組合、長條圖的練習與遊戲 →</a></p>
    <p class="race-small">和第 2 週一樣用逗號；寫成冒號 <code>STEP:12</code> 也能使用。比賽只計算「比賽開始後新增的步數」，所以不用先把板子歸零。</p>
  </details>`;
}

function joiningHTML() {
  return `<section class="race-panel race-center-panel"><h1>🔄 正在回到房間 ${esc(st.session?.code || '')}…</h1>
    <p>如果一直沒有反應，可以按下面的按鈕回到大廳。</p><p class="race-msg" data-b="msg" role="status"></p>
    <button id="giveup" class="race-btn ghost" type="button">回到大廳</button></section>`;
}

function fatalHTML() {
  const replaced = st.fatal === 'replaced';
  return `<section class="race-panel race-center-panel"><h1>${replaced ? '📑 這個選手在別的分頁' : '⚠️ 無法繼續'}</h1>
    <p>${esc(msgText(st.fatal))}</p>
    ${replaced ? '<button id="takeover" class="race-btn green" type="button">改在這個分頁繼續</button>' : ''}
    <button id="giveup" class="race-btn ghost" type="button">回到大廳</button></section>`;
}

const topBar = () => `
  <div class="race-top">
    <div class="race-roomcode">房號 <b data-b="code"></b>
      <button id="copy" class="race-btn tiny" type="button" title="複製房號">複製</button></div>
    <span class="race-link" data-b="link" role="status"></span>
    <button id="leave" class="race-btn ghost tiny" type="button">離開房間</button>
  </div>`;

const seatHTML = t => `
  <article class="race-seat is-${t}" data-seat="${t}">
    <h2><span class="race-dot"></span>${TEAM_NAME[t]} <span class="race-you" data-b="you-${t}"></span></h2>
    <p class="race-seat-nick" data-b="nick-${t}"></p>
    <ul class="race-seat-status">
      <li data-b="online-${t}"></li><li data-b="input-${t}"></li><li data-b="ready-${t}"></li>
    </ul>
  </article>`;

function roomHTML() {
  return `${topBar()}
  <div class="race-seats">${seatHTML('red')}${seatHTML('green')}</div>
  <p class="race-msg" data-b="msg" role="status"></p>
  <section class="race-panel race-mine">
    <h2>① 選擇走路的方式</h2>
    <div class="race-choice" role="radiogroup" aria-label="走路的方式">
      <button type="button" role="radio" data-input="microbit">🔌 用 micro:bit 搖晃<small>正式比賽</small></button>
      <button type="button" role="radio" data-input="sim">🖐 模擬按鈕<small>沒有板子時測試用</small></button>
    </div>
    <div class="race-device" data-show="microbit">
      <button id="serial" class="race-btn blue" type="button">連接 micro:bit</button>
      <p class="race-serial" data-b="serial" role="status"></p>
      <p class="race-signal">訊號測試：<b data-b="signal">搖一搖 micro:bit，這裡會出現 STEP</b></p>
    </div>
    <p class="race-device" data-show="sim">模擬模式：比賽時按大按鈕（或空白鍵）走一步。<b>對手會看到你用的是模擬按鈕。</b></p>
    <h2>② 準備</h2>
    <button id="ready" class="race-btn big" type="button"></button>
    <h2>③ 開始</h2>
    <div data-b="start-area"></div>
  </section>
  ${helpHTML()}`;
}

const trackHTML = t => `
  <div class="race-track is-${t}" data-track="${t}">
    <div class="race-track-head"><b>${TEAM_NAME[t]}</b> <span data-b="tnick-${t}"></span> <span class="race-badge" data-b="tbadge-${t}"></span>
      <span class="race-score"><b data-b="score-${t}">0</b> / ${TARGET}</span></div>
    <div class="race-lane" role="progressbar" aria-label="${TEAM_NAME[t]}進度" aria-valuemin="0" aria-valuemax="${TARGET}" data-b="lane-${t}">
      <div class="race-fill" data-b="fill-${t}"></div><span class="race-runner" data-b="runner-${t}">👟</span><span class="race-flag">🏁</span>
    </div>
  </div>`;

function raceHTML() {
  return `${topBar()}
  <section class="race-arena">
    ${trackHTML('red')}${trackHTML('green')}
    <div class="race-center" data-b="center" aria-live="polite"></div>
    <p class="race-msg" data-b="msg" role="status"></p>
    <div class="race-controls">
      <button id="sim-step" class="race-step" type="button" data-show-sim>👟 走一步<small>（模擬按鈕・也可按空白鍵）</small></button>
      <p class="race-hint" data-show-mb>搖一搖 micro:bit 就會往前走！</p>
      <button id="re-serial" class="race-btn blue big" type="button" data-show-reserial>🔌 重新連接 micro:bit</button>
      <div class="race-result" data-b="result"></div>
    </div>
  </section>`;
}

function localHTML() {
  return `
  <div class="race-top"><b class="race-roomcode">🧑‍🏫 單機示範（不連網路，不是正式比賽）</b>
    <button id="local-exit" class="race-btn ghost tiny" type="button">回到大廳</button></div>
  <section class="race-arena">
    ${trackHTML('red')}${trackHTML('green')}
    <div class="race-center" data-b="center" aria-live="polite"></div>
    <div class="race-controls race-local-controls">
      <button class="race-step is-red" data-local-step="red" type="button">🔴 紅隊走一步<small>鍵盤 A</small></button>
      <button class="race-step is-green" data-local-step="green" type="button">🟢 綠隊走一步<small>鍵盤 L</small></button>
    </div>
    <div class="race-result" data-b="result"></div>
  </section>`;
}

// ---------- 綁定事件 ----------
function bind(key) {
  if (key === 'lobby') {
    const nick = $('#nick'), code = $('#code');
    code.addEventListener('input', () => { code.value = code.value.replace(/\D/g, '').slice(0, 6); });
    code.addEventListener('keydown', e => { if (e.key === 'Enter') $('#join').click(); });
    $('#create').addEventListener('click', () => {
      const n = cleanNickname(nick.value); if (!n) return setMsg(msgText('bad_nick'), true), nick.focus();
      if (!SERVER || st.serverOk === false) return setMsg(msgText(SERVER ? 'connect_failed' : 'no_server'), true);
      saveNick(n); setMsg('建立房間中…'); startClient(c => c.create(n));
    });
    $('#join').addEventListener('click', () => {
      const n = cleanNickname(nick.value); if (!n) return setMsg(msgText('bad_nick'), true), nick.focus();
      if (!isRoomCode(code.value)) return setMsg(msgText('bad_room'), true), code.focus();
      if (!SERVER || st.serverOk === false) return setMsg(msgText(SERVER ? 'connect_failed' : 'no_server'), true);
      saveNick(n); setMsg('加入房間中…'); startClient(c => c.join(code.value, n));
    });
    $('#local').addEventListener('click', startLocal);
  }
  if (key === 'joining' || key === 'fatal') {
    $('#giveup')?.addEventListener('click', backToLobby);
    $('#takeover')?.addEventListener('click', () => { const s = st.session; st.fatal = null; if (s) startClient(c => c.resume(s.code, s.token)); render(); });
  }
  if (key === 'room' || key === 'race') {
    $('#copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(st.room.code); setMsg('已複製房號 ' + st.room.code + '，告訴你的對手吧！'); }
      catch { setMsg('請把房號 ' + st.room.code + ' 唸給對手聽。'); }
    });
    $('#leave').addEventListener('click', () => {
      const midRace = ['countdown', 'racing', 'paused'].includes(st.room?.phase);
      if (midRace && !confirmLeave()) return;
      st.client?.leave(); backToLobby('你已離開房間。');
    });
  }
  if (key === 'room') {
    for (const b of $$('[data-input]')) b.addEventListener('click', () => {
      const p = myPlayer(); st.input = b.dataset.input; persistInput();
      if (p?.ready && p.input !== st.input) st.client.send({ type: 'ready', ready: false });
      update();
    });
    $('#serial').addEventListener('click', async () => { if (serial.connected) await serial.disconnect(); else await serial.connect(); update(); });
    $('#ready').addEventListener('click', () => {
      const p = myPlayer(); if (!p) return;
      if (p.ready) return void st.client.send({ type: 'ready', ready: false });
      if (st.input === 'microbit' && !serial.connected) return setMsg(msgText('no_device'), true);
      st.client.send({ type: 'ready', ready: true, input: st.input });
    });
  }
  if (key === 'race') {
    const b = $('#sim-step');
    b.addEventListener('pointerdown', e => { e.preventDefault(); addSteps(1, 'sim'); });
    b.addEventListener('keydown', e => { if ((e.key === 'Enter') && !e.repeat) { e.preventDefault(); addSteps(1, 'sim'); } });
    $('#re-serial').addEventListener('click', async () => { await serial.connect(); update(); });
  }
  if (key === 'local') {
    for (const b of $$('[data-local-step]')) b.addEventListener('pointerdown', e => { e.preventDefault(); st.local.step(b.dataset.localStep); });
    $('#local-exit').addEventListener('click', () => { st.local.close(); st.local = null; st.room = null; render(); });
  }
}

// 「離開」用自訂確認（避免瀏覽器彈窗擋住畫面）
let leaveArmed = 0;
function confirmLeave() {
  if (Date.now() - leaveArmed < 4000) return true;
  leaveArmed = Date.now();
  setMsg('比賽進行中！離開會讓這局取消。確定要離開，請在 4 秒內再按一次「離開房間」。', true);
  return false;
}

// 鍵盤：空白鍵＝模擬走一步；單機示範用 A／L
document.addEventListener('keydown', e => {
  if (e.repeat || e.target?.matches?.('input, textarea')) return;
  if (st.local) {
    if (e.key === 'a' || e.key === 'A') st.local.step('red');
    if (e.key === 'l' || e.key === 'L') st.local.step('green');
    return;
  }
  if (e.code === 'Space' && st.screen === 'race' && myPlayer()?.input === 'sim' && e.target?.id !== 'sim-step') { e.preventDefault(); addSteps(1, 'sim'); }
});

// ---------- 更新畫面上的數值 ----------
const set = (b, text) => { for (const el of $$(`[data-b="${b}"]`)) if (el.textContent !== text) el.textContent = text; };
function secsLeft(at) { return Math.max(0, Math.ceil((at - serverNow()) / 1000)); }

function update() {
  const r = st.room;
  set('msg', st.msg); $$('[data-b="msg"]').forEach(el => el.classList.toggle('err', st.msgErr));
  if (st.screen === 'lobby') {
    const sOk = serialSupported();
    const cs = $('[data-check="serial"]');
    if (cs) { cs.className = sOk ? 'ok' : 'warn'; cs.textContent = sOk ? '✅ 這個瀏覽器可以連接 micro:bit（Web Serial）' : '⚠️ 這個瀏覽器不能連 micro:bit：請用電腦上的 Chrome 或 Edge（平板只能用模擬按鈕）'; }
    const cv = $('[data-check="server"]');
    if (cv) {
      const ok = st.serverOk;
      cv.className = !SERVER ? 'warn' : ok ? 'ok' : ok === false ? 'warn' : '';
      cv.textContent = !SERVER ? '⚠️ 競賽伺服器尚未設定：目前只能使用老師專區的單機示範' : ok ? '✅ 競賽伺服器連線正常' : ok === false ? '⚠️ 連不上競賽伺服器：請檢查網路，或請老師確認伺服器狀態' : '⏳ 正在檢查競賽伺服器…';
    }
    set('server-url', SERVER || '（尚未設定）');
    const disabled = !SERVER || st.serverOk === false;
    for (const id of ['create', 'join']) { const b = $('#' + id); if (b) b.disabled = disabled; }
    return;
  }
  if (st.screen === 'local') return updateArena(r, null);
  if (!r) return;
  set('code', r.code);
  const link = { online: '🟢 已連線', connecting: '🟡 連線中…', reconnecting: '🟡 網路不穩，重新連線中…', closed: '🔴 已離線' }[st.link] || '';
  set('link', link);
  for (const t of TEAMS) {
    const p = r.players[t];
    set('you-' + t, t === st.me ? '（你）' : '');
    set('nick-' + t, p ? p.nick : '等待同學加入…');
    set('online-' + t, !p ? '' : p.online ? '🟢 在線上' : `🔴 離線（${secsLeft(p.goneAt + r.reconnectMs)} 秒內可回來）`);
    set('input-' + t, !p ? '' : p.input === 'sim' ? '🖐 模擬按鈕' : p.device ? '🔌 micro:bit 已連接' : p.input === 'microbit' ? '🔌 micro:bit 未連接' : (p.device ? '🔌 micro:bit 已連接' : '尚未選擇'));
    set('ready-' + t, !p ? '' : p.ready ? '✋ 準備好了' : '… 還沒準備');
    const seat = $(`[data-seat="${t}"]`); if (seat) { seat.classList.toggle('empty', !p); seat.classList.toggle('ready', !!p?.ready); seat.classList.toggle('me', t === st.me); }
  }
  if (st.screen === 'room') {
    const p = myPlayer();
    const locked = !!p?.ready;
    for (const b of $$('[data-input]')) { const on = b.dataset.input === st.input; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); }
    for (const el of $$('[data-show]')) el.hidden = el.dataset.show !== st.input;
    const sb = $('#serial'); if (sb) sb.textContent = serial.connected ? '中斷 micro:bit 連線' : '連接 micro:bit';
    set('serial', st.serialText || (serialSupported() ? '還沒連接。按上面的按鈕，選擇你的 micro:bit。' : '這個瀏覽器不能連 micro:bit，請改用模擬按鈕。'));
    $('[data-b="serial"]')?.classList.toggle('err', st.serialErr);
    set('signal', st.signal || '搖一搖 micro:bit，這裡會出現 STEP');
    const rb = $('#ready'); if (rb) { rb.textContent = locked ? '✅ 已準備（按這裡取消）' : '✋ 我準備好了'; rb.classList.toggle('on', locked); }
    const area = $('[data-b="start-area"]');
    if (area) {
      const html = r.host === st.me
        ? `<button id="start" class="race-btn big red" type="button" ${r.phase === 'ready' ? '' : 'disabled'}>🚩 開始比賽</button><p class="race-small">${r.phase === 'ready' ? '兩位都準備好了，按下去就會開始倒數！' : !r.players[otherTeam(st.me)] ? '等待對手輸入房號加入…' : '等兩位都按「準備好了」，這個按鈕才會亮。'}</p>`
        : `<p class="race-wait">${r.phase === 'ready' ? '兩位都準備好了！等房主按「開始比賽」…' : '等兩位都按「準備好了」，再由房主按開始。'}</p>`;
      if (area.dataset.html !== html) { area.dataset.html = html; area.innerHTML = html; $('#start')?.addEventListener('click', () => st.client.send({ type: 'start_request' })); }
    }
    return;
  }
  updateArena(r, st.me);
}

function updateArena(r, me) {
  if (!r) return;
  for (const t of TEAMS) {
    const p = r.players[t];
    const score = p ? p.score : 0;
    set('tnick-' + t, p ? p.nick + (t === me ? '（你）' : '') : '（空位）');
    set('tbadge-' + t, !p ? '' : !p.online ? '離線' : p.input === 'sim' && !st.local ? '模擬按鈕' : '');
    set('score-' + t, String(score));
    const pct = (score / TARGET) * 100;
    const fill = $(`[data-b="fill-${t}"]`); if (fill) fill.style.width = pct + '%';
    const run = $(`[data-b="runner-${t}"]`); if (run) run.style.left = `calc(${pct}% - ${pct / 100 * 34}px)`;
    const lane = $(`[data-b="lane-${t}"]`); if (lane) lane.setAttribute('aria-valuenow', score);
    $(`[data-track="${t}"]`)?.classList.toggle('winner', r.winner === t);
  }
  const now = serverNow();
  let center = '';
  if (r.phase === 'countdown') { const s = Math.ceil((r.startAt - now) / 1000); center = s > 0 ? String(s) : '出發！'; }
  else if (r.phase === 'racing') center = now - (r.startAt || 0) < 900 ? '出發！' : '';
  else if (r.phase === 'paused') {
    const gone = TEAMS.find(t => r.players[t] && !r.players[t].online);
    const left = secsLeft(r.pausedAt + r.reconnectMs);
    center = gone ? `⏸ 暫停：等 ${TEAM_NAME[gone]} 回來（${left} 秒）` : `⏸ 暫停：等 micro:bit 插回去（${left} 秒）`;
  } else if (r.phase === 'finished') center = r.winner ? `🏆 ${TEAM_NAME[r.winner]} 獲勝！` : '本局取消';
  else if (st.local) center = '按「開始」倒數';
  const c = $('[data-b="center"]');
  if (c) { if (c.textContent !== center) c.textContent = center; c.className = 'race-center' + (r.phase === 'countdown' ? ' big' : '') + (r.phase === 'paused' ? ' paused' : ''); }

  // 控制區
  const p = me ? r.players[me] : null;
  const racing = r.phase === 'racing' || r.phase === 'countdown';
  for (const el of $$('[data-show-sim]')) { el.hidden = !(p && p.input === 'sim' && racing); el.disabled = !racing; }
  for (const el of $$('[data-show-mb]')) el.hidden = !(p && p.input === 'microbit' && racing && serial.connected);
  for (const el of $$('[data-show-reserial]')) el.hidden = !(p && p.input === 'microbit' && !serial.connected && r.phase !== 'finished');
  for (const el of $$('[data-local-step]')) el.disabled = r.phase !== 'racing' && r.phase !== 'countdown';
  const res = $('[data-b="result"]');
  if (res) {
    let html = '';
    if (st.local) {
      html = r.phase === 'finished' ? `<p class="race-win">🏆 ${TEAM_NAME[r.winner] || ''} 先走到 ${TARGET} 步！</p><button id="local-again" class="race-btn big" type="button">🔁 再比一次</button>`
        : ['waiting', 'ready'].includes(r.phase) ? `<button id="local-start" class="race-btn big red" type="button">🚩 開始倒數</button>` : '';
    } else if (r.phase === 'finished') {
      const won = r.winner && r.winner === me;
      const opp = r.players[otherTeam(me)];
      html = `<p class="race-win">${!r.winner ? '本局取消，不計勝負。' : won ? '🎉 你贏了！好厲害！' : '💪 差一點點！再接再厲！'}</p>
        ${p?.rematch ? `<p class="race-wait">已按「再比一次」，等${opp ? '對手' : '新對手'}同意…</p>` : `<button id="rematch" class="race-btn big green" type="button">🔁 再比一次</button>`}
        ${opp?.rematch && !p?.rematch ? '<p class="race-small">對手想再比一次！</p>' : ''}`;
    }
    if (res.dataset.html !== html) {
      res.dataset.html = html; res.innerHTML = html;
      $('#rematch')?.addEventListener('click', () => st.client.send({ type: 'rematch_request' }));
      $('#local-again')?.addEventListener('click', () => { st.local.rematch(); });
      $('#local-start')?.addEventListener('click', () => st.local.start());
    }
  }
}

// 倒數、離線秒數需要持續更新
function frame() { if (['race', 'room', 'local'].includes(st.screen)) update(); requestAnimationFrame(frame); }

// ---------- 連線 ----------
function startClient(go) {
  st.client?.close();
  st.fatal = null;
  const c = new RaceClient(SERVER, {
    onLink: s => { st.link = s; if (s === 'reconnecting' && st.room) setMsg('網路不穩，正在重新連線…（比賽會先暫停）', true); update(); },
    onWelcome: m => {
      st.me = m.team;
      st.session = { server: SERVER, code: m.code, token: c.token, team: m.team, nick: c.nick || st.session?.nick };
      saveSession(st.session);
      setMsg('');
      sendDevice();
    },
    onState: s => onRoomState(s),
    onError: (code, fatal) => {
      if (!fatal) { if (!['not_started', 'old_round', 'not_racing'].includes(code)) setMsg(msgText(code), code !== 'too_fast'); return; }
      if (code === 'replaced') { st.fatal = 'replaced'; render(); return; }
      // 房間不存在、token 失效、房滿等：回大廳
      const wasIn = !!st.room;
      clearSession(); st.session = null; st.room = null; st.me = null; st.client = null;
      if (wasIn && (code === 'room_not_found' || code === 'bad_token')) backToLobby('房間已經結束了（可能太久沒有回來）。請重新建立或加入房間。', true);
      else backToLobby(msgText(code), true);
    },
  });
  st.client = c;
  go(c);
}

function onRoomState(s) {
  const prev = st.room;
  st.room = s;
  if (s.noticeId !== st.lastNotice) {
    st.lastNotice = s.noticeId;
    if (s.notice && NOTICES[s.notice] && prev) setMsg(NOTICES[s.notice], /paused|unplugged|left_mid|timeout|released/.test(s.notice));
  }
  // 新的倒數開始：清掉序列緩衝，本局計數從伺服器分數接續
  if (s.phase === 'countdown' && (!prev || prev.phase !== 'countdown')) { serial.flush(); const p = s.players[st.me]; st.localCount = p ? p.score : 0; st.countRound = s.round; }
  if (s.round !== st.countRound) { st.countRound = s.round; st.localCount = 0; }
  const p = s.players[st.me];
  if (p?.input && ['countdown', 'racing', 'paused', 'finished'].includes(s.phase)) st.input = p.input;
  render();
}

function backToLobby(text = '', isErr = false) {
  st.client?.close(); st.client = null; st.room = null; st.me = null; st.fatal = null; st.session = null; st.link = 'closed';
  clearSession();
  st.screen = null; render(); setMsg(text, isErr);
}

function startLocal() {
  st.local = new LocalRoom(s => { st.room = s; render(); });
  st.room = st.local.engine.view(Date.now());
  setMsg('');
  render();
}

// ---------- micro:bit 與步數 ----------
function persistInput() { if (st.session) { st.session.input = st.input; saveSession(st.session); } }
function sendDevice() { st.client?.send({ type: 'device', connected: serial.connected }); }

function onSerialStatus(connected, text, isErr) {
  st.serialText = text; st.serialErr = isErr;
  if (!connected) st.signal = '';
  sendDevice();
  if (isErr && st.screen === 'race') setMsg(text, true);
  update();
}

function onSerialMessage(msg, line) {
  const d = tracker.feed(msg);
  st.signal = msg.type === 'reset' ? `收到 RESET（板子歸零）` : `收到 ${line}${d ? ' 👟' : ''}`;
  if (st.screen === 'room') set('signal', st.signal);
  if (d > 0) addSteps(d, 'microbit');
}

function addSteps(d, source) {
  const r = st.room, p = myPlayer();
  if (!r || !p || !st.client || p.input !== source) return; // 只採用公開登記的輸入方式
  const started = r.phase === 'racing' || (r.phase === 'countdown' && r.startAt && serverNow() >= r.startAt);
  if (!started) return; // 比賽開始前、暫停中都不計
  if (st.countRound !== r.round) { st.countRound = r.round; st.localCount = p.score; }
  st.localCount = Math.max(st.localCount, p.score) + d;
  st.seq = Math.max(st.seq + 1, Date.now());
  st.client.send({ type: 'step', round: r.round, sequence: st.seq, count: st.localCount });
}

// ---------- 啟動 ----------
async function checkServer() {
  if (!SERVER) { st.serverOk = false; return update(); }
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch(SERVER + '/health', { cache: 'no-store', signal: ctl.signal });
    clearTimeout(t);
    st.serverOk = res.ok;
  } catch { st.serverOk = false; }
  update();
}

window.addEventListener('online', () => st.client?.kick());
window.addEventListener('offline', () => { if (st.room) setMsg('這台電腦的網路斷了，請檢查 Wi-Fi。恢復後會自動重新連線。', true); });

st.session = loadSession();
render();
requestAnimationFrame(frame);
if (st.session) {
  st.input = st.session.input || 'microbit';
  startClient(c => { c.nick = st.session.nick; c.resume(st.session.code, st.session.token); });
  if (st.input === 'microbit') serial.reopenGranted().then(update);
}
checkServer();
