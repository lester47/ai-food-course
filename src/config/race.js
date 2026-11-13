// 雙人競賽房間服務（Cloudflare Worker）的網址。
// 留空代表尚未部署：頁面會提示老師，並只開放「單機示範」。
// GitHub Actions 建置時若設定了存放庫變數 RACE_SERVER_URL，會改用那個網址（見 scripts/build.mjs）。
export const RACE_SERVER = 'https://ai-food-race.lester47.workers.dev';
