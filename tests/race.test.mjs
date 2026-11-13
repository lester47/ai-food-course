import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomEngine, parseSerialLine, LineSplitter, StepTracker, cleanNickname, isRoomCode, TARGET, COUNTDOWN_MS, RECONNECT_MS, MESSAGES, NOTICES } from '../src/race/room-core.js';

let n = 0;
const gen = () => 'tok_' + (++n).toString().padStart(20, '0');

// 建好一個兩人都準備好的房間
function setup(input = 'sim') {
  let now = 1_000_000;
  const { engine: e, token: redTok } = RoomEngine.create('583216', '小紅', now, gen);
  const j = e.join('小綠', now, gen);
  for (const t of ['red', 'green']) {
    if (input === 'microbit') e.handle(t, { type: 'device', connected: true }, now);
    e.handle(t, { type: 'ready', ready: true, input }, now);
  }
  return { e, redTok, greenTok: j.token, now };
}
// 開始並跑到比賽階段
function race(input) {
  const ctx = setup(input);
  assert.equal(ctx.e.s.phase, 'ready');
  ctx.e.handle('red', { type: 'start_request' }, ctx.now);
  ctx.now += COUNTDOWN_MS;
  ctx.e.tick(ctx.now);
  assert.equal(ctx.e.s.phase, 'racing');
  return ctx;
}
// 以合理速度送步數
function walk(ctx, team, steps, seqStart = 1) {
  for (let i = 0; i < steps; i++) { ctx.now += 200; ctx.e.handle(team, { type: 'step', round: ctx.e.s.round, sequence: seqStart + i, count: ctx.e.s.players[team].score + 1 }, ctx.now); }
}

test('序列資料解析：STEP:n、STEP,n、RESET，其餘為雜訊', () => {
  assert.deepEqual(parseSerialLine('STEP:12'), { type: 'step', count: 12 });
  assert.deepEqual(parseSerialLine('STEP,3\r'), { type: 'step', count: 3 });
  assert.deepEqual(parseSerialLine(' RESET '), { type: 'reset' });
  for (const bad of ['', 'STEP:', 'STEP:-1', 'STEP:1.5', 'STEP:abc', 'R,3', 'WIN', 'STEP:123456', '<script>', 'x'.repeat(40), 'STEP:12 RED']) assert.equal(parseSerialLine(bad), null, bad);
});

test('逐行切割：資料分段到達、CRLF、過長的行會被丟掉', () => {
  const sp = new LineSplitter(20);
  assert.deepEqual(sp.push('STE'), []);
  assert.deepEqual(sp.push('P:1\r\nSTEP:2\nRES'), ['STEP:1', 'STEP:2']);
  assert.deepEqual(sp.push('ET\n'), ['RESET']);
  assert.deepEqual(sp.push('A'.repeat(30) + '\nSTEP:3\n'), ['STEP:3']);
  assert.equal(sp.dropped, 1);
});

test('步數追蹤：只算新增步數，RESET／重開機不會倒扣', () => {
  const t = new StepTracker();
  assert.equal(t.feed({ type: 'step', count: 37 }), 1); // 中途接上：只算一步
  assert.equal(t.feed({ type: 'step', count: 38 }), 1);
  assert.equal(t.feed({ type: 'step', count: 38 }), 0); // 重複
  assert.equal(t.feed({ type: 'step', count: 45 }), 3); // 跳太多：最多 3
  assert.equal(t.feed({ type: 'reset' }), 0);
  assert.equal(t.feed({ type: 'step', count: 1 }), 1);
  assert.equal(t.feed({ type: 'step', count: 0 }), 0);
});

test('暱稱與房號檢查', () => {
  assert.equal(cleanNickname('  <b>阿明</b>  '), 'b阿明/b');
  assert.equal(cleanNickname('一二三四五六七八九十十一'), '一二三四五六七八九十');
  assert.equal(cleanNickname('   '), null);
  assert.ok(isRoomCode('012345'));
  for (const c of ['12345', '1234567', 'abcdef', 123456]) assert.ok(!isRoomCode(c));
});

test('建立、加入、第三人無法擠入滿房；廣播狀態不含 token', () => {
  const { e, redTok, greenTok, now } = setup();
  assert.equal(e.s.players.red.nick, '小紅');
  assert.equal(e.s.players.green.nick, '小綠');
  assert.deepEqual(e.join('第三人', now, gen), { error: 'room_full' });
  assert.notEqual(redTok, greenTok);
  const json = JSON.stringify(e.view(now));
  assert.ok(!json.includes(redTok) && !json.includes(greenTok) && !json.includes('token'));
});

test('只有房主能開始；未準備不能開始；倒數期間的步數不計分', () => {
  const { e, now } = setup();
  assert.equal(e.handle('green', { type: 'start_request' }, now).error, 'not_host');
  e.handle('green', { type: 'ready', ready: false }, now);
  assert.equal(e.s.phase, 'waiting');
  assert.equal(e.handle('red', { type: 'start_request' }, now).error, 'not_ready');
  e.handle('green', { type: 'ready', ready: true, input: 'sim' }, now);
  e.handle('red', { type: 'start_request' }, now);
  assert.equal(e.s.phase, 'countdown');
  assert.equal(e.s.startAt, now + COUNTDOWN_MS);
  assert.equal(e.handle('red', { type: 'step', round: 1, sequence: 1, count: 1 }, now + 1000).error, 'not_started');
  assert.equal(e.s.players.red.score, 0);
  e.handle('red', { type: 'step', round: 1, sequence: 2, count: 1 }, now + COUNTDOWN_MS + 10);
  assert.equal(e.s.phase, 'racing');
  assert.equal(e.s.players.red.score, 1);
});

test('選 micro:bit 卻沒連板子不能準備', () => {
  let now = 0;
  const { engine: e } = RoomEngine.create('111111', 'A', now, gen);
  assert.equal(e.handle('red', { type: 'ready', ready: true, input: 'microbit' }, now).error, 'no_device');
  e.handle('red', { type: 'device', connected: true }, now);
  assert.equal(e.handle('red', { type: 'ready', ready: true, input: 'microbit' }, now).error, undefined);
  e.handle('red', { type: 'device', connected: false }, now);
  assert.equal(e.s.players.red.ready, false);
});

test('分數單調遞增、去重、一次最多 +3、速度限制、不可替對手加分', () => {
  const ctx = race();
  const { e } = ctx;
  e.handle('red', { type: 'step', round: 1, sequence: 1, count: 10 }, ctx.now + 1);
  assert.equal(e.s.players.red.score, 3);
  e.handle('red', { type: 'step', round: 1, sequence: 1, count: 10 }, ctx.now + 2); // 重複序號
  assert.equal(e.s.players.red.score, 3);
  e.handle('red', { type: 'step', round: 1, sequence: 2, count: 2 }, ctx.now + 3); // 倒退
  assert.equal(e.s.players.red.score, 3);
  // 連發 50 則：受速度限制
  for (let i = 0; i < 50; i++) e.handle('red', { type: 'step', round: 1, sequence: 10 + i, count: 999 }, ctx.now + 4);
  assert.ok(e.s.players.red.score <= 4, '瞬間不可超過額度');
  // 客戶端送「勝利」或「紅隊加分」都無效
  assert.equal(e.handle('green', { type: 'win' }, ctx.now).error, 'bad_message');
  assert.equal(e.handle('green', { type: 'step', team: 'red', round: 1, sequence: 1, count: 1 }, ctx.now + 500).error, undefined);
  assert.equal(e.s.players.green.score, 1);
  for (const bad of [{ sequence: 'x', count: 1 }, { sequence: 1.5, count: 1 }, { sequence: 99, count: -1 }]) assert.equal(e.handle('green', { type: 'step', round: 1, ...bad }, ctx.now).error, 'bad_message');
});

test('先到 20 步獲勝；之後的訊號不改變結果（幾乎同時以收到順序為準）', () => {
  const ctx = race();
  walk(ctx, 'red', TARGET - 1);
  walk(ctx, 'green', TARGET - 1);
  ctx.now += 200;
  ctx.e.handle('green', { type: 'step', round: 1, sequence: 100, count: 20 }, ctx.now);
  ctx.e.handle('red', { type: 'step', round: 1, sequence: 100, count: 20 }, ctx.now);
  assert.equal(ctx.e.s.winner, 'green');
  assert.equal(ctx.e.s.phase, 'finished');
  assert.equal(ctx.e.s.players.red.score, TARGET - 1);
  assert.equal(ctx.e.s.players.green.score, TARGET);
});

test('重賽：兩人都同意才歸零，上一局的訊號不計入新局', () => {
  const ctx = race();
  walk(ctx, 'red', TARGET);
  assert.equal(ctx.e.s.winner, 'red');
  ctx.e.handle('red', { type: 'rematch_request' }, ctx.now);
  assert.equal(ctx.e.s.round, 1);
  ctx.e.handle('green', { type: 'rematch_request' }, ctx.now);
  assert.equal(ctx.e.s.round, 2);
  assert.equal(ctx.e.s.phase, 'ready');
  assert.equal(ctx.e.s.players.red.score, 0);
  ctx.e.handle('red', { type: 'start_request' }, ctx.now);
  ctx.now += COUNTDOWN_MS + 500;
  assert.equal(ctx.e.handle('red', { type: 'step', round: 1, sequence: 1, count: 1 }, ctx.now).error, 'old_round');
  assert.equal(ctx.e.s.players.red.score, 0);
  ctx.e.handle('red', { type: 'step', round: 2, sequence: 1, count: 1 }, ctx.now);
  assert.equal(ctx.e.s.players.red.score, 1);
});

test('比賽中斷線：暫停、不計分、重連後重新倒數並保留分數', () => {
  const ctx = race();
  walk(ctx, 'red', 5); walk(ctx, 'green', 4);
  ctx.e.disconnect('green', ctx.now);
  assert.equal(ctx.e.s.phase, 'paused');
  ctx.now += 1000;
  assert.equal(ctx.e.handle('red', { type: 'step', round: 1, sequence: 50, count: 6 }, ctx.now).error, 'not_racing');
  assert.equal(ctx.e.s.winner, null);
  assert.deepEqual(ctx.e.resume('bad-token-xxxxxxxxxxxxxx', ctx.now), { error: 'bad_token' });
  assert.equal(ctx.e.resume(ctx.greenTok, ctx.now).team, 'green');
  assert.equal(ctx.e.s.phase, 'countdown');
  assert.equal(ctx.e.s.players.red.score, 5);
  assert.equal(ctx.e.s.players.green.score, 4);
});

test('斷線逾時：本局取消、不出現幽靈勝利、席位釋放後可再加入', () => {
  const ctx = race();
  walk(ctx, 'red', 15);
  ctx.e.disconnect('green', ctx.now);
  assert.equal(ctx.e.nextDeadline(), ctx.now + RECONNECT_MS);
  ctx.now += RECONNECT_MS;
  assert.ok(ctx.e.tick(ctx.now));
  assert.equal(ctx.e.s.winner, null);
  assert.equal(ctx.e.s.phase, 'waiting');
  assert.equal(ctx.e.s.players.green, null);
  assert.equal(ctx.e.s.players.red.score, 0);
  assert.equal(ctx.e.s.notice, 'timeout_cancel');
  assert.equal(ctx.e.join('新同學', ctx.now, gen).team, 'green');
});

test('比賽中拔掉 micro:bit：暫停；插回去後重新倒數', () => {
  const ctx = race('microbit');
  walk(ctx, 'red', 3);
  ctx.e.handle('green', { type: 'device', connected: false }, ctx.now);
  assert.equal(ctx.e.s.phase, 'paused');
  ctx.e.handle('green', { type: 'device', connected: true }, ctx.now + 500);
  assert.equal(ctx.e.s.phase, 'countdown');
  assert.equal(ctx.e.s.players.red.score, 3);
});

test('重新整理頁面（斷線後立即用 token 回來）與主動離開', () => {
  const { e, redTok, now } = setup();
  e.disconnect('red', now);
  assert.equal(e.s.phase, 'waiting');
  assert.equal(e.resume(redTok, now + 2000).team, 'red');
  assert.equal(e.s.phase, 'ready');
  e.leave('red', now + 3000);
  assert.equal(e.s.players.red, null);
  assert.equal(e.s.host, 'green');
  assert.equal(e.resume(redTok, now + 4000).error, 'bad_token');
  assert.equal(e.join('新紅隊', now + 5000, gen).team, 'red');
});

test('比賽中主動離開：本局取消，不判勝負', () => {
  const ctx = race();
  walk(ctx, 'red', 10);
  ctx.e.leave('green', ctx.now);
  assert.equal(ctx.e.s.winner, null);
  assert.equal(ctx.e.s.phase, 'waiting');
  assert.equal(ctx.e.s.players.red.score, 0);
});

test('多個房間互不干擾；狀態可序列化後復原（模擬休眠）', () => {
  const a = race(), b = race();
  walk(a, 'red', 7);
  assert.equal(b.e.s.players.red.score, 0);
  const restored = RoomEngine.fromJSON(JSON.parse(JSON.stringify(a.e.toJSON())));
  assert.equal(restored.s.players.red.score, 7);
  assert.equal(restored.teamOfToken(a.redTok), 'red');
  assert.ok(JSON.stringify(a.e.toJSON()).length < 1500, '狀態要小於 attachment 2KB 上限');
});

test('所有錯誤代碼與通知都有繁體中文說明', () => {
  const src = Object.values(MESSAGES).concat(Object.values(NOTICES)).join('');
  assert.match(src, /[一-鿿]/);
  for (const code of ['joined_green', 'paused_red', 'timeout_cancel', 'win_red', 'rematch', 'left_mid_green', 'released_red', 'unplugged_green']) assert.ok(NOTICES[code], code);
});

test('房間服務不使用任何持久化儲存，也不記錄訊息內容', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile('race-server/src/worker.js', 'utf8');
  const code = src.replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /\.storage\b|ctx\.storage|env\.\w*KV|\bD1\b|\.prepare\(|setAlarm|console\.(log|info|warn|error)/);
  assert.match(code, /acceptWebSocket/); // Hibernation API
  assert.match(code, /serializeAttachment/);
  const toml = await readFile('race-server/wrangler.toml', 'utf8');
  assert.doesNotMatch(toml, /kv_namespaces|d1_databases|r2_buckets/);
});

test('前端：token 只存在分頁 sessionStorage，不放網址；選單有雙人競賽入口', async () => {
  const { readFile } = await import('node:fs/promises');
  const app = await readFile('src/race/app.js', 'utf8'), client = await readFile('src/race/client.js', 'utf8');
  assert.doesNotMatch(app + client, /localStorage/);
  assert.doesNotMatch(client, /searchParams\.set\('token'/);
  assert.match(await readFile('src/app.js', 'utf8'), /href="\.\/race\/"/);
  assert.match(await readFile('race/index.html', 'utf8'), /src\/race\/app\.js/);
});

test('復原用的房間狀態要完整才採用', async () => {
  const { validSnapshot } = await import('../src/race/room-core.js');
  const { engine } = RoomEngine.create('583216', '甲', 0, gen);
  assert.ok(validSnapshot(engine.toJSON()));
  for (const bad of [null, {}, { ...engine.toJSON(), phase: 'boom' }, { ...engine.toJSON(), players: null }, { ...engine.toJSON(), players: { red: { score: 99 }, green: null } }, { ...engine.toJSON(), phase: 'racing' }]) assert.ok(!validSnapshot(bad));
});

test('課程頁：存在、有入口連結、不含參考程式碼', async () => {
  const { readFile } = await import('node:fs/promises');
  const lesson = await readFile('race/lesson.html', 'utf8');
  for (const k of ['序列 寫入一行文字', '字串組合', 'plot bar graph', '出口票', '回家作業']) assert.ok(lesson.includes(k), k);
  assert.doesNotMatch(lesson, /onGesture\(|led\.plot|serial\.writeLine|plotBarGraph\(|localStorage/);
  assert.match(await readFile('src/race/app.js', 'utf8'), /href="\.\/lesson\.html"/);
});

test('第 3 週頁面有雙人競賽課程入口', async () => {
  const { readFile } = await import('node:fs/promises');
  const app = await readFile('src/app.js', 'utf8');
  assert.match(app, /w\.id==='w3'\?`<div class="panel game-callout race-callout">[^`]*href="\.\/race\/lesson\.html"/);
});

test('第 2 週含一板雙隊、第 3 週是雙人競賽，兩週皆為完整 PBL 格式', async () => {
  const { tasks } = await import('../src/data/tasks.js');
  const { weeks } = await import('../src/data/weeks.js');
  const w2 = tasks.filter(t => t.weekId === 'w2'), w3 = tasks.filter(t => t.weekId === 'w3');
  assert.equal(w2.length, 6); assert.equal(w3.length, 6);
  for (const t of [...w2, ...w3]) { assert.ok(t.story && t.predict && t.tiers.basic.length && t.tiers.plus.length && t.tiers.challenge.length, t.id); assert.ok(!t.outline, t.id); }
  assert.match(JSON.stringify(w2), /R,/); assert.match(JSON.stringify(w2), /RESET/);
  assert.ok(w3.every(t => t.practiceUrl && t.practiceUrl.startsWith('./race/')));
  assert.match(weeks.find(w => w.id === 'w3').title, /雙人競賽/);
  assert.doesNotMatch(JSON.stringify([...w2, ...w3]), /STEP:/); // 統一用逗號
  assert.doesNotMatch(JSON.stringify([...w2, ...w3]), /onGesture\(|serial\.writeLine|plotBarGraph\(/); // 學生頁不放程式碼
});
