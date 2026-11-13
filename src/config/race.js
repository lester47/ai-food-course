// 雙人競賽房間服務（Cloudflare Worker）的網址。
// 例如 'https://ai-food-race.<你的帳號子網域>.workers.dev'
// 留空代表尚未部署：頁面會提示老師，並只開放「單機示範」。
// GitHub Actions 建置時若設定了 RACE_SERVER_URL，會自動填入這裡（見 scripts/build.mjs）。
export const RACE_SERVER = '';
