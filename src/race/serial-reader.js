// 用 Web Serial 讀 micro:bit 的逐行資料（STEP:n／RESET）
import { LineSplitter, parseSerialLine } from './room-core.js';

export const serialSupported = () => !!(globalThis.isSecureContext && navigator.serial);

export function serialErrorText(e) {
  const name = e?.name || '';
  if (name === 'NotFoundError') return '沒有選到裝置。請在跳出的視窗選「BBC micro:bit」或「mbed Serial Port」，再按「連線」。';
  if (name === 'SecurityError') return '瀏覽器不允許使用 USB 序列埠。請改用 Chrome 或 Edge，並確認網址是 https 開頭。';
  if (name === 'InvalidStateError' || name === 'NetworkError') return '這塊 micro:bit 正被別的程式使用（例如 MakeCode 的「顯示資料」或另一個分頁）。請先關掉它們，再按一次連接。';
  return `無法連接 micro:bit（${e?.message || name || '未知原因'}）。請換一條 USB 線或重新插拔後再試。`;
}

export class SerialReader {
  // onMessage({type:'step',count}|{type:'reset'}, rawLine)；onStatus(connected:boolean, text, isError)
  constructor(onMessage, onStatus) {
    this.onMessage = onMessage; this.onStatus = onStatus;
    this.port = null; this.reader = null; this.closing = false; this.busy = false; this.running = null;
    this.splitter = new LineSplitter(128);
    if (serialSupported()) navigator.serial.addEventListener('disconnect', e => { if (e.target === this.port) this.lost('micro:bit 被拔掉了。請插回 USB 線，再按「連接 micro:bit」。'); });
  }
  get connected() { return !!this.port; }

  // 需要使用者點擊才能呼叫 requestPort()
  async connect() {
    if (!serialSupported()) { this.onStatus(false, '這台電腦的瀏覽器不支援 Web Serial。請用 Windows 上的 Chrome 或 Edge；也可以先用「模擬按鈕」。', true); return false; }
    if (this.port || this.busy) return !!this.port;
    this.busy = true;
    try {
      const port = await navigator.serial.requestPort({ filters: [{ usbVendorId: 0x0d28 }] }).catch(async e => {
        if (e?.name === 'TypeError') return navigator.serial.requestPort(); // 舊版瀏覽器不支援 filters
        throw e;
      });
      return await this.open(port);
    } catch (e) { this.onStatus(false, serialErrorText(e), true); return false; }
    finally { this.busy = false; }
  }

  // 重新整理頁面後：自動打開之前已授權的板子（不需再點選）
  async reopenGranted() {
    if (!serialSupported() || this.port) return false;
    try { const ports = await navigator.serial.getPorts(); if (ports.length === 1) return await this.open(ports[0]); } catch {}
    return false;
  }

  async open(port) {
    try { await port.open({ baudRate: 115200 }); }
    catch (e) { this.onStatus(false, serialErrorText(e), true); return false; }
    this.port = port; this.closing = false; this.splitter.clear();
    this.onStatus(true, '已連接 micro:bit，搖一搖試試看！', false);
    this.running = this.loop();
    return true;
  }

  async loop() {
    const decoder = new TextDecoder();
    let failure = '';
    try {
      while (this.port?.readable && !this.closing) {
        this.reader = this.port.readable.getReader();
        try {
          for (;;) {
            const { value, done } = await this.reader.read();
            if (done) break;
            for (const line of this.splitter.push(decoder.decode(value, { stream: true }))) {
              const msg = parseSerialLine(line);
              if (msg) this.onMessage(msg, line.trim());
            }
          }
        } finally { try { this.reader.releaseLock(); } catch {} this.reader = null; }
      }
    } catch (e) { failure = 'micro:bit 連線中斷（USB 線可能鬆了或被拔掉）。請插好後再按「連接 micro:bit」。'; }
    const wasClosing = this.closing;
    try { await this.port?.close(); } catch {}
    this.port = null;
    if (!wasClosing) this.onStatus(false, failure || 'micro:bit 已中斷連線。', true);
  }

  lost(text) {
    if (!this.port) return;
    this.closing = true;
    try { this.reader?.cancel(); } catch {}
    this.port = null;
    this.onStatus(false, text, true);
  }

  async disconnect() {
    if (!this.port) return;
    this.closing = true;
    try { await this.reader?.cancel(); } catch {}
    try { await this.running; } catch {}
    this.port = null;
    this.onStatus(false, '已中斷 micro:bit 連線。', false);
  }

  // 新局開始前清掉緩衝區裡的舊資料
  flush() { this.splitter.clear(); }
}
