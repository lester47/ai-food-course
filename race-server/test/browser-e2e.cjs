// 瀏覽器端對端測試：兩個獨立瀏覽器（模擬兩台電腦），含假的 micro:bit（Web Serial 模擬）
// 需要：dist 在 http://localhost:4173、wrangler dev 在 http://localhost:8787
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const URL = (process.env.SITE || 'http://localhost:4173') + '/race/?server=' + (process.env.SERVER || 'http://localhost:8787');
const OUT = process.env.SHOTS || '/tmp/race-shots';
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 假的 Web Serial：測試可用 window.__serialPush('STEP:1\n') 送資料、window.__serialUnplug() 拔線
const FAKE_SERIAL = `(() => {
  let ctrl = null, port = null;
  const listeners = [];
  class FakePort { constructor(){ this.readable = null; }
    async open(){ this.readable = new ReadableStream({ start(c){ ctrl = c; } }); }
    async close(){ this.readable = null; } getInfo(){ return { usbVendorId: 0x0d28 }; } }
  const serial = {
    async requestPort(){ port = new FakePort(); return port; },
    async getPorts(){ return port ? [port] : []; },
    addEventListener(t, f){ listeners.push(f); },
  };
  Object.defineProperty(navigator, 'serial', { value: serial, configurable: true });
  window.__serialPush = s => ctrl && ctrl.enqueue(new TextEncoder().encode(s));
  window.__serialUnplug = () => { try { ctrl.error(new Error('device lost')); } catch {} };
})();`;

const results = [];
async function check(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push(['✅', name, Date.now() - t0]); }
  catch (e) { results.push(['❌', name + '：' + e.message.split('\n')[0], Date.now() - t0]); }
}

(async () => {
  const browser = await chromium.launch();
  const mk = async (fake = false, viewport = { width: 1280, height: 900 }) => {
    const ctx = await browser.newContext({ viewport });
    if (fake) await ctx.addInitScript(FAKE_SERIAL);
    const page = await ctx.newPage();
    page.errors = [];
    page.on('pageerror', e => page.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text()); });
    await page.goto(URL);
    return page;
  };
  const text = (p, sel) => p.locator(sel).first().innerText();
  const score = async (p, t) => Number(await text(p, `[data-b="score-${t}"]`));
  const waitText = (p, sel, re, timeout = 8000) => p.waitForFunction(([s, r]) => { const el = document.querySelector(s); return el && new RegExp(r).test(el.textContent); }, [sel, re.source], { timeout });

  const A = await mk(true), B = await mk(true);
  let code;

  await check('大廳：檢查伺服器與 Web Serial、介面為繁體中文', async () => {
    await waitText(A, '[data-check="server"]', /連線正常/);
    await waitText(A, '[data-check="serial"]', /可以連接/);
    await A.screenshot({ path: OUT + '/01-lobby.png' });
  });

  await check('沒填暱稱不能建立；房號格式錯誤有提示', async () => {
    await A.click('#create');
    await waitText(A, '[data-b="msg"]', /暱稱/);
    await B.fill('#nick', '綠豆'); await B.fill('#code', '12a3');
    await B.click('#join');
    await waitText(B, '[data-b="msg"]', /6 位數字/);
  });

  await check('A 建立房間（紅隊）、B 輸入房號加入（綠隊），兩邊都看到對方', async () => {
    await A.fill('#nick', '紅茶'); await A.click('#create');
    await A.waitForSelector('[data-b="code"]');
    await waitText(A, '[data-b="code"]', /^\d{6}$/);
    code = await text(A, '[data-b="code"]');
    await B.fill('#code', code); await B.click('#join');
    await waitText(B, '[data-b="nick-red"]', /紅茶/);
    await waitText(A, '[data-b="nick-green"]', /綠豆/);
    assert.match(await text(A, '[data-b="you-red"]'), /你/);
    assert.match(await text(B, '[data-b="you-green"]'), /你/);
    await A.screenshot({ path: OUT + '/02-room-red.png' });
  });

  await check('網址列與畫面都沒有 token', async () => {
    for (const p of [A, B]) {
      assert.ok(!p.url().includes('token'));
      const tok = await p.evaluate(() => JSON.parse(sessionStorage.getItem('ai-food-race-session')).token);
      assert.ok(tok && tok.length > 20);
      assert.ok(!(await p.content()).includes(tok));
    }
  });

  await check('模擬模式準備 → 只有房主能開始 → 兩邊同步倒數；倒數中按鈕不計分', async () => {
    for (const p of [A, B]) { await p.click('[data-input="sim"]'); await p.click('#ready'); }
    await waitText(A, '[data-b="ready-green"]', /準備好了/);
    assert.equal(await B.locator('#start').count(), 0);
    await A.waitForSelector('#start:not([disabled])');
    await A.click('#start');
    await waitText(B, '[data-b="center"]', /^[123]$/);
    await waitText(A, '[data-b="center"]', /^[123]$/);
    await B.screenshot({ path: OUT + '/03-countdown-green.png' });
    await B.click('#sim-step'); await B.click('#sim-step');
    await sleep(200);
    assert.equal(await score(A, 'green'), 0);
    assert.match(await text(A, '[data-b="tbadge-green"]'), /模擬/);
  });

  await check('競跑：A 先到 20 步，兩邊顯示相同分數與勝負', async () => {
    await waitText(A, '[data-b="center"]', /出發|^$/, 6000);
    await sleep(300);
    for (let i = 0; i < 20; i++) { await A.click('#sim-step'); if (i < 9) await B.click('#sim-step'); await sleep(140); }
    await waitText(A, '[data-b="center"]', /紅隊 獲勝/);
    await waitText(B, '[data-b="center"]', /紅隊 獲勝/);
    assert.equal(await score(A, 'red'), 20); assert.equal(await score(B, 'red'), 20);
    assert.equal(await score(A, 'green'), await score(B, 'green'));
    assert.match(await text(A, '[data-b="result"]'), /你贏了/);
    assert.match(await text(B, '[data-b="result"]'), /再接再厲/);
    await A.screenshot({ path: OUT + '/04-finished-red.png' });
    await B.screenshot({ path: OUT + '/05-finished-green.png' });
  });

  await check('重賽：兩人都同意才歸零（第 2 局）', async () => {
    await A.click('#rematch');
    await waitText(A, '[data-b="result"]', /等對手同意/);
    await waitText(B, '[data-b="result"]', /對手想再比一次/);
    await B.click('#rematch');
    await A.waitForSelector('#ready');
    await waitText(A, '[data-b="ready-green"]', /準備好了/);
  });

  await check('改用 micro:bit（模擬 USB 板）：訊號測試、比賽前搖晃不計分、比賽中 STEP 計分', async () => {
    // 綠隊改用 micro:bit：先取消準備、連接板子
    await B.click('[data-input="microbit"]');
    await waitText(A, '[data-b="ready-green"]', /還沒準備/);
    await B.click('#serial');
    await waitText(B, '[data-b="serial"]', /已連接/);
    await B.evaluate(() => window.__serialPush('STEP:30\r\nST'));
    await B.evaluate(() => window.__serialPush('EP:31\n'));
    await waitText(B, '[data-b="signal"]', /STEP:31/);
    await B.click('#ready');
    await waitText(A, '[data-b="input-green"]', /micro:bit 已連接/);
    await A.waitForSelector('#start:not([disabled])');
    await A.click('#start');
    await waitText(B, '[data-b="center"]', /^[123]$/);
    await B.evaluate(() => window.__serialPush('STEP:32\nSTEP:33\n')); // 倒數中搖：不算
    await waitText(B, '[data-b="center"]', /出發|^$/, 6000);
    await sleep(200);
    assert.equal(await score(A, 'green'), 0);
    for (let n = 34; n < 39; n++) { await B.evaluate(n => window.__serialPush('STEP:' + n + '\n'), n); await sleep(150); }
    await B.evaluate(() => window.__serialPush('garbage\nRESET\n'));
    await sleep(150);
    await B.evaluate(() => window.__serialPush('STEP:1\n')); // 板子歸零後繼續，不倒扣
    await sleep(300);
    assert.equal(await score(A, 'green'), 6);
    assert.equal(await score(B, 'green'), 6);
    assert.match(await text(A, '[data-b="tbadge-green"]'), /^$/);
  });

  await check('比賽中拔掉 micro:bit：雙方看到暫停；插回後重新倒數、分數保留', async () => {
    await B.evaluate(() => window.__serialUnplug());
    await waitText(A, '[data-b="center"]', /暫停/);
    await waitText(A, '[data-b="msg"]', /拔掉/);
    await A.screenshot({ path: OUT + '/06-paused-unplug.png' });
    await B.click('#leave').catch(() => {}); // 第一次只會提醒，不會真的離開
    await waitText(B, '[data-b="msg"]', /再按一次/);
    // 插回：按「重新連接 micro:bit」
    await B.click('#re-serial');
    await waitText(A, '[data-b="center"]', /^[123]$/);
    assert.equal(await score(A, 'green'), 6);
    await waitText(A, '[data-b="center"]', /出發|^$/, 6000);
    await B.evaluate(() => window.__serialPush('STEP:2\n'));
    await sleep(300);
    assert.equal(await score(A, 'green'), 7);
  });

  await check('重新整理頁面（綠隊）：比賽暫停，自動回到原座位並重新倒數', async () => {
    await B.reload();
    await waitText(B, '[data-b="nick-green"], [data-b="tnick-green"]', /綠豆/, 10000);
    await waitText(A, '[data-b="center"]', /暫停/);
    // 綠隊用 micro:bit：重新整理後要再按一次連接（真實 Chrome 會自動打開已授權的板子）
    await B.click('#re-serial');
    await waitText(B, '[data-b="center"]', /^[123]$/);
    await waitText(A, '[data-b="center"]', /^[123]$/);
    assert.equal(await score(B, 'green'), 7);
    assert.equal(await score(B, 'red'), 0);
  });

  await check('第三人無法擠入滿房', async () => {
    const C = await mk();
    await C.fill('#nick', '路人'); await C.fill('#code', code); await C.click('#join');
    await waitText(C, '[data-b="msg"]', /已經有兩位選手/);
    await C.screenshot({ path: OUT + '/07-room-full.png' });
    await C.context().close();
  });

  await check('不存在的房號有提示', async () => {
    const C = await mk();
    await C.fill('#nick', '路人'); await C.fill('#code', code === '999999' ? '999998' : '999999'); await C.click('#join');
    await waitText(C, '[data-b="msg"]', /找不到這個房號/);
    await C.context().close();
  });

  await check('比賽中紅隊離開：本局取消、不出現幽靈勝利、席位釋放（60 秒逾時另有單元測試）', async () => {
    await A.click('#leave'); await A.click('#leave');
    await waitText(B, '[data-b="msg"]', /紅隊選手在比賽中離開|紅隊選手離開/);
    await B.waitForSelector('[data-seat="red"].empty');
    assert.equal(await A.locator('#create').count(), 1);
  });

  await check('3 個房間同時進行，互不干擾', async () => {
    const pairs = [];
    for (let i = 0; i < 3; i++) {
      const R = await mk(), G = await mk();
      await R.fill('#nick', '紅' + i); await R.click('#create');
      await waitText(R, '[data-b="code"]', /^\d{6}$/);
      const c = await text(R, '[data-b="code"]');
      await G.fill('#nick', '綠' + i); await G.fill('#code', c); await G.click('#join');
      await waitText(R, '[data-b="nick-green"]', new RegExp('綠' + i));
      for (const p of [R, G]) { await p.click('[data-input="sim"]'); await p.click('#ready'); }
      await R.waitForSelector('#start:not([disabled])'); await R.click('#start');
      pairs.push({ R, G, c });
    }
    assert.equal(new Set(pairs.map(p => p.c)).size, 3);
    await sleep(3400);
    for (let k = 0; k < 3; k++) for (let i = 0; i <= k; i++) { await pairs[k].G.click('#sim-step'); await sleep(140); }
    await sleep(400);
    for (let k = 0; k < 3; k++) { assert.equal(await score(pairs[k].R, 'green'), k + 1); assert.equal(await score(pairs[k].R, 'red'), 0); }
    for (const p of pairs) { await p.R.context().close(); await p.G.context().close(); }
  });

  await check('單機示範（不需網路）：倒數、兩隊按鍵、勝負', async () => {
    const T = await mk();
    await T.click('summary:has-text("老師專區")');
    await T.click('#local');
    await T.click('#local-start');
    await waitText(T, '[data-b="center"]', /出發|^$/, 6000);
    await sleep(200);
    for (let i = 0; i < 21; i++) { await T.keyboard.press('l'); await sleep(130); }
    await waitText(T, '[data-b="center"]', /綠隊 獲勝/);
    await T.screenshot({ path: OUT + '/08-local-demo.png' });
    await T.context().close();
  });

  await check('手機寬度 390px 不出現橫向捲軸（大廳／房間／比賽）', async () => {
    const M = await mk(false, { width: 390, height: 844 });
    const over = () => M.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(await over() <= 0, '大廳 ' + await over());
    await M.screenshot({ path: OUT + '/09-mobile-lobby.png', fullPage: true });
    await M.fill('#nick', '一二三四五六七八九十'); await M.click('#create');
    await waitText(M, '[data-b="code"]', /^\d{6}$/);
    assert.ok(await over() <= 0, '房間 ' + await over());
    await M.screenshot({ path: OUT + '/10-mobile-room.png', fullPage: true });
    await M.context().close();
  });

  for (const p of [A, B]) if (p.errors.length) results.push(['⚠️', '瀏覽器錯誤訊息：' + p.errors.slice(0, 3).join(' | '), 0]);
  await browser.close();
  for (const [s, n, ms] of results) console.log(s, n, ms ? `(${ms}ms)` : '');
  const failed = results.filter(r => r[0] === '❌').length;
  console.log(failed ? `\n${failed} 項失敗` : `\n全部 ${results.length} 項通過`);
  process.exit(failed ? 1 : 0);
})();
