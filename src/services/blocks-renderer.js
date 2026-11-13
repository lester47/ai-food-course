// 用 MakeCode 官方的積木繪圖服務（--docs?render=1），把 JavaScript 畫成積木圖。
// 程式碼只在瀏覽器裡交給 makecode.microbit.org 的頁面繪圖，不儲存、不公開。
const ORIGIN = 'https://makecode.microbit.org';
const SRC = ORIGIN + '/--docs?render=1&lang=zh-TW';
// 需要擴充功能的程式：依程式內容自動帶入
const EXTENSIONS = [[/\bneopixel\./, 'neopixel=github:microsoft/pxt-neopixel']];
// 看起來是 MakeCode 程式（有這些 API）才畫積木；資料範本之類的就不畫
const MAKECODE_API = /\b(basic|input|serial|led|music|radio|pins|neopixel|game|control)\./;

let frame = null, ready = null, seq = 0, offline = false;
const waiting = new Map();
const cache = new Map();

function boot() {
  if (ready) return ready;
  ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 30000);
    window.addEventListener('message', e => {
      if (e.origin !== ORIGIN || !e.data) return;
      if (e.data.type === 'renderready') { clearTimeout(timer); resolve(); }
      if (e.data.type === 'renderblocks') {
        const w = waiting.get(e.data.id);
        if (w) { waiting.delete(e.data.id); e.data.error || !e.data.uri ? w.reject(new Error(e.data.error || 'no image')) : w.resolve(e.data); }
      }
    });
    frame = document.createElement('iframe');
    frame.title = 'MakeCode 積木繪圖（隱藏）';
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:absolute;width:1px;height:1px;left:-9999px;top:0;border:0;opacity:0';
    frame.src = SRC;
    document.body.append(frame);
  });
  ready.catch(() => { offline = true; frame?.remove(); frame = null; });
  return ready;
}

export const isMakeCode = code => MAKECODE_API.test(code || '');

export async function renderBlocks(code) {
  if (cache.has(code)) return cache.get(code);
  if (offline) throw new Error('offline'); // 這次開頁連不上就不再重試，避免每格都等 30 秒
  await boot();
  const id = 'b' + (++seq);
  const options = {};
  for (const [re, pkg] of EXTENSIONS) if (re.test(code)) options.package = pkg;
  const result = new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    setTimeout(() => { if (waiting.delete(id)) reject(new Error('timeout')); }, 40000);
  });
  frame.contentWindow.postMessage({ type: 'renderblocks', id, code, options }, ORIGIN);
  const r = await result;
  const out = { uri: r.uri, width: r.width, height: r.height };
  cache.set(code, out);
  return out;
}

// 把容器裡還沒畫的積木格子一一畫出來（每格有 data-code-index，對應 codes 陣列）
export async function fillBlockSlots(root, codes) {
  const slots = [...root.querySelectorAll('.mat-blocks[data-code-index]:not([data-done])')];
  for (const slot of slots) {
    slot.dataset.done = '1';
    const code = codes[Number(slot.dataset.codeIndex)];
    try {
      const r = await renderBlocks(code);
      const img = new Image();
      img.src = r.uri;
      img.alt = '這段程式的 MakeCode 積木';
      img.style.width = Math.round(r.width) + 'px';
      img.loading = 'lazy';
      slot.replaceChildren(img);
    } catch {
      slot.innerHTML = '<p class="muted">無法畫出積木圖（需要連上 makecode.microbit.org）。可以複製右邊的程式，到 MakeCode 切到 JavaScript 貼上，再切回積木。</p>';
    }
  }
}
