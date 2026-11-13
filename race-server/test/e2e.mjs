// 房間服務端對端測試：先 `npx wrangler dev --port 8787`，再 `node test/e2e.mjs`
import WebSocket from 'ws';
import assert from 'node:assert/strict';

const BASE = process.env.RACE_WS || 'ws://127.0.0.1:8787/ws';
const ORIGIN = process.env.RACE_ORIGIN || 'http://localhost:4173';
const sleep = ms => new Promise(r => setTimeout(r, ms));

class Client {
  constructor(name) { this.name = name; this.msgs = []; this.state = null; this.errors = []; this.welcome = null; this.closed = null; }
  open(query, origin = ORIGIN) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${BASE}?${query}`, { headers: { Origin: origin } });
      this.ws.on('message', d => {
        const m = JSON.parse(d.toString()); this.msgs.push(m);
        if (m.type === 'room_state') this.state = m;
        if (m.type === 'error') this.errors.push(m.code);
        if (m.type === 'welcome') this.welcome = m;
      });
      this.ws.on('open', () => resolve(this));
      this.ws.on('unexpected-response', (req, res) => reject(new Error('HTTP ' + res.statusCode)));
      this.ws.on('error', reject);
      this.ws.on('close', c => { this.closed = c; });
    });
  }
  send(o) { this.ws.send(JSON.stringify(o)); }
  async until(pred, label, ms = 5000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (pred(this)) return; await sleep(20); }
    throw new Error(`${this.name} 等不到：${label}；最後狀態 ${JSON.stringify(this.state)} 錯誤 ${this.errors}`);
  }
  close() { try { this.ws.close(); } catch {} }
}

async function makeRoom(tag) {
  const red = await new Client('紅' + tag).open('room=new&nick=' + encodeURIComponent('紅' + tag));
  await red.until(c => c.welcome && c.state, 'welcome');
  const code = red.welcome.code;
  const green = await new Client('綠' + tag).open('room=' + code);
  await green.until(c => c.msgs.some(m => m.type === 'hello'), 'hello');
  green.send({ type: 'join', nickname: '綠' + tag });
  await green.until(c => c.welcome && c.state, 'join welcome');
  return { red, green, code };
}
async function readyAndStart(r) {
  for (const c of [r.red, r.green]) c.send({ type: 'ready', ready: true, input: 'sim' });
  await r.red.until(c => c.state.phase === 'ready', 'phase ready');
  r.red.send({ type: 'start_request' });
  await r.green.until(c => c.state.phase === 'countdown', 'countdown');
}
async function stepTo(c, n, round, seq0 = 1) {
  for (let i = 1; i <= n; i++) { c.send({ type: 'step', round, sequence: seq0 + i, count: i }); await sleep(160); }
}

const results = [];
async function check(name, fn) {
  try { await fn(); results.push(['✅', name]); }
  catch (e) { results.push(['❌', name + '：' + e.message]); }
}

await check('健康檢查與來源限制（未授權網站 403）', async () => {
  const h = await (await fetch(BASE.replace('ws', 'http').replace('/ws', '/health'))).json();
  assert.equal(h.ok, true);
  await assert.rejects(new Client('壞').open('room=new&nick=x', 'https://evil.example'), /403/);
  await assert.rejects(new Client('壞').open('room=12ab&nick=x'), /400/);
});

await check('建立／加入／完整比賽／兩端結果一致／token 不外洩', async () => {
  const r = await makeRoom('A');
  assert.match(r.code, /^\d{6}$/);
  assert.equal(r.red.welcome.team, 'red');
  assert.equal(r.green.welcome.team, 'green');
  assert.ok(r.red.welcome.token.length >= 20);
  await readyAndStart(r);
  // 倒數期間送步數不算
  r.red.send({ type: 'step', round: 1, sequence: 1, count: 1 });
  await r.red.until(c => c.errors.includes('not_started'), 'not_started');
  const wait = r.red.state.startAt - r.red.state.serverNow;
  await sleep(wait + 100);
  await r.red.until(c => c.state.phase === 'racing', 'racing');
  assert.equal(r.red.state.players.red.score, 0);
  await Promise.all([stepTo(r.red, 20, 1, 10), stepTo(r.green, 12, 1, 10)]);
  await r.green.until(c => c.state.phase === 'finished', 'finished');
  assert.equal(r.red.state.winner, 'red');
  assert.equal(r.green.state.winner, 'red');
  assert.deepEqual(r.red.state.players, r.green.state.players);
  const all = JSON.stringify(r.green.msgs.filter(m => m.type === 'room_state'));
  assert.ok(!all.includes(r.red.welcome.token) && !all.includes(r.green.welcome.token), 'room_state 不可含 token');
  // 重賽
  r.red.send({ type: 'rematch_request' }); r.green.send({ type: 'rematch_request' });
  await r.red.until(c => c.state.round === 2 && c.state.phase === 'ready', 'rematch');
  assert.equal(r.red.state.players.red.score, 0);
  r.red.send({ type: 'start_request' });
  await r.red.until(c => c.state.phase === 'countdown', 'countdown2');
  await sleep(r.red.state.startAt - r.red.state.serverNow + 100);
  r.red.send({ type: 'step', round: 1, sequence: 500, count: 5 });
  await r.red.until(c => c.errors.includes('old_round'), 'old_round 被拒');
  r.red.close(); r.green.close();
});

await check('第三人無法擠入滿房、房號不存在有提示', async () => {
  const r = await makeRoom('B');
  const third = await new Client('第三人').open('room=' + r.code);
  await third.until(c => c.msgs.some(m => m.type === 'hello'), 'hello');
  third.send({ type: 'join', nickname: '第三人' });
  await third.until(c => c.errors.includes('room_full'), 'room_full');
  const ghost = await new Client('幽靈').open('room=' + (r.code === '999999' ? '999998' : '999999'));
  await ghost.until(c => c.errors.includes('room_not_found'), 'room_not_found');
  r.red.close(); r.green.close();
});

await check('3 個房間同時比賽，分數不交叉', async () => {
  const rooms = await Promise.all(['C', 'D', 'E'].map(makeRoom));
  assert.equal(new Set(rooms.map(r => r.code)).size, 3);
  await Promise.all(rooms.map(readyAndStart));
  await sleep(3200);
  await Promise.all(rooms.map((r, i) => stepTo(r.red, 3 + i, 1)));
  await sleep(300);
  rooms.forEach((r, i) => { assert.equal(r.green.state.players.red.score, 3 + i); assert.equal(r.green.state.players.green.score, 0); });
  rooms.forEach(r => { r.red.close(); r.green.close(); });
});

await check('比賽中斷線 → 暫停；用 token 重連（重新整理）→ 重新倒數、分數保留；重複分頁會被取代', async () => {
  const r = await makeRoom('F');
  await readyAndStart(r);
  await sleep(3200);
  await stepTo(r.red, 4, 1);
  await r.green.until(c => c.state.players.red.score === 4, '紅 4 分');
  const tok = r.green.welcome.token;
  r.green.ws.terminate();
  await r.red.until(c => c.state.phase === 'paused', 'paused');
  assert.equal(r.red.state.players.green.online, false);
  r.red.send({ type: 'step', round: 1, sequence: 99, count: 5 });
  await r.red.until(c => c.errors.includes('not_racing'), '暫停時不計分');
  const back = await new Client('綠F回來').open('room=' + r.code);
  await back.until(c => c.msgs.some(m => m.type === 'hello'), 'hello');
  back.send({ type: 'resume', token: tok });
  await back.until(c => c.state && c.state.phase === 'countdown', '重新倒數');
  assert.equal(back.state.players.red.score, 4);
  assert.equal(back.welcome.team, 'green');
  // 同一個選手又開一個分頁
  const dup = await new Client('綠F分身').open('room=' + r.code);
  await dup.until(c => c.msgs.some(m => m.type === 'hello'), 'hello');
  dup.send({ type: 'resume', token: tok });
  await back.until(c => c.errors.includes('replaced'), '舊分頁被取代');
  await dup.until(c => c.state && c.state.players.green.online, '新分頁接手');
  // 假 token 不能接管
  const fake = await new Client('冒充').open('room=' + r.code);
  await fake.until(c => c.msgs.some(m => m.type === 'hello'), 'hello');
  fake.send({ type: 'resume', token: 'x'.repeat(32) });
  await fake.until(c => c.errors.includes('bad_token'), 'bad_token');
  r.red.close(); dup.close();
});

await check('主動離開：席位釋放，可由新同學加入', async () => {
  const r = await makeRoom('G');
  r.green.send({ type: 'leave' });
  await r.red.until(c => c.state.players.green === null, '綠隊席位釋放');
  const n = await new Client('新綠').open('room=' + r.code);
  await n.until(c => c.msgs.some(m => m.type === 'hello'), 'hello');
  n.send({ type: 'join', nickname: '新綠' });
  await n.until(c => c.welcome && c.welcome.team === 'green', '新同學加入');
  r.red.close(); n.close();
});

await check('訊息過大與洪水訊息會被擋下', async () => {
  const r = await makeRoom('H');
  r.red.ws.send('x'.repeat(5000));
  await r.red.until(c => c.errors.includes('bad_message'), '過大訊息');
  for (let i = 0; i < 60; i++) r.red.send({ type: 'sync', t: i });
  await r.red.until(c => c.errors.includes('rate_limited'), '頻率限制');
  r.red.close(); r.green.close();
});

if (process.env.SLOW) await check('斷線超過 60 秒：伺服器自動取消本局、釋放席位、不判勝負（實際等待 61 秒）', async () => {
  const r = await makeRoom('T');
  await readyAndStart(r);
  await sleep(3200);
  await stepTo(r.red, 15, 1);
  r.green.ws.terminate();
  await r.red.until(c => c.state.phase === 'paused', 'paused');
  await r.red.until(c => c.state.notice === 'timeout_cancel', '逾時取消', 70000);
  assert.equal(r.red.state.winner, null);
  assert.equal(r.red.state.players.green, null);
  assert.equal(r.red.state.players.red.score, 0);
  assert.equal(r.red.state.phase, 'waiting');
  r.red.close();
});

for (const [s, n] of results) console.log(s, n);
const failed = results.filter(r => r[0] === '❌').length;
console.log(failed ? `\n${failed} 項失敗` : `\n全部 ${results.length} 項通過`);
process.exit(failed ? 1 : 0);
