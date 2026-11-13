// 模擬 Durable Object 休眠後被叫醒：只靠活躍 WebSocket 的 attachment 復原房間
import { register } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  if (spec === 'cloudflare:workers') return { url: 'data:text/javascript,export class DurableObject{constructor(ctx,env){this.ctx=ctx;this.env=env}}', shortCircuit: true };
  return next(spec, ctx);
}`));

const { RaceRoom } = await import('../race-server/src/worker.js');
const { RoomEngine, COUNTDOWN_MS } = await import('../src/race/room-core.js');

class FakeWS {
  constructor(att) { this.att = att; this.sent = []; this.readyState = 1; this.closedWith = null; }
  serializeAttachment(a) { this.att = structuredClone(a); }
  deserializeAttachment() { return this.att; }
  send(s) { this.sent.push(JSON.parse(s)); }
  close(code) { this.closedWith = code; this.readyState = 3; }
}
const ctxWith = sockets => ({ getWebSockets: () => sockets.filter(s => s.readyState !== 3), acceptWebSocket() {} });

function racingSnapshot() {
  let i = 0; const gen = () => 'token-' + (++i) + '-abcdefghijklmnop';
  const now = Date.now() - 10_000;
  const { engine: e, token: rt } = RoomEngine.create('583216', '紅', now, gen);
  const { token: gt } = e.join('綠', now, gen);
  for (const t of ['red', 'green']) e.handle(t, { type: 'ready', ready: true, input: 'sim' }, now);
  e.handle('red', { type: 'start_request' }, now);
  let t = now + COUNTDOWN_MS;
  for (let k = 1; k <= 5; k++) { t += 300; e.handle('red', { type: 'step', round: 1, sequence: k, count: k }, t); }
  return { snap: e.toJSON(), rt, gt };
}

test('休眠後兩人都還連著：完整復原分數與局次，比賽繼續', () => {
  const { snap, rt, gt } = racingSnapshot();
  const red = new FakeWS({ team: 'red', tk: rt, snap }), green = new FakeWS({ team: 'green', tk: gt, snap });
  const room = new RaceRoom(ctxWith([red, green]), {});
  assert.equal(room.engine.s.phase, 'racing');
  assert.equal(room.engine.s.players.red.score, 5);
  assert.equal(room.engine.s.round, 1);
  // 復原後收到步數可以繼續計分
  room.webSocketMessage(red, JSON.stringify({ type: 'step', round: 1, sequence: 99, count: 6 }));
  assert.equal(room.engine.s.players.red.score, 6);
  const last = green.sent.filter(m => m.type === 'room_state').pop();
  assert.equal(last.players.red.score, 6);
  assert.ok(!JSON.stringify(green.sent).includes(rt));
  room.clearTimer();
});

test('休眠期間有人斷線：復原時判定為暫停，不會宣告勝負', () => {
  const { snap, rt } = racingSnapshot();
  const red = new FakeWS({ team: 'red', tk: rt, snap });
  const room = new RaceRoom(ctxWith([red]), {});
  assert.equal(room.engine.s.phase, 'paused');
  assert.equal(room.engine.s.winner, null);
  assert.equal(room.engine.s.players.green.online, false);
  room.clearTimer();
});

test('attachment 損壞無法可信復原：關閉連線，不亂判勝負', () => {
  const bad = new FakeWS({ team: 'red', tk: 'x', snap: { ver: 3, players: null } });
  const room = new RaceRoom(ctxWith([bad]), {});
  // 損壞的狀態不能拿來比賽：要嘛無法復原，要嘛房間不再存在
  assert.ok(!room.engine || !room.engine.alive);
  room.clearTimer?.();
});

test('只有房號、沒有正確 token 的連線不能操作座位', () => {
  const { snap, rt, gt } = racingSnapshot();
  const red = new FakeWS({ team: 'red', tk: rt, snap }), green = new FakeWS({ team: 'green', tk: gt, snap });
  const intruder = new FakeWS({ team: 'red', tk: 'wrong-token-xxxxxxxxxx', snap });
  const room = new RaceRoom(ctxWith([red, green, intruder]), {});
  room.webSocketMessage(intruder, JSON.stringify({ type: 'step', round: 1, sequence: 500, count: 8 }));
  assert.equal(room.engine.s.players.red.score, 5);
  assert.equal(intruder.closedWith, 4001);
  room.clearTimer();
});
