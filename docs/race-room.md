# 雙人競賽實驗室｜老師使用與設定說明

網址：https://lester47.github.io/ai-food-course/race/ （上方選單「🏁 雙人競賽」）

兩位學生各用一台電腦、各接一塊 micro:bit，建立／加入同一個 6 位數房號，搖晃 micro:bit 比賽誰先走到 20 步。

- 不使用資料庫：房間只在比賽期間存在於 Cloudflare 的記憶體中，所有人離開後就消失；不保留成績、不記錄真實姓名。
- 需要一個「競賽伺服器」（Cloudflare Worker，免費方案即可）負責同步兩台電腦。伺服器還沒設定前，頁面只能使用「單機示範」。

---

## 一、第一次設定（老師本人做一次，約 15 分鐘）

> 全程使用 Cloudflare **免費方案**。如果畫面要求輸入信用卡或升級付費方案，請停下來，不要繼續。

1. 到 https://dash.cloudflare.com/sign-up 用學校或個人信箱註冊 Cloudflare 帳號，完成信箱驗證。
2. 登入後點左側「Workers & Pages」，第一次進入時會請你確認一個 `workers.dev` 子網域名稱（例如 `lester47`），按確認即可。
3. 建立 API 權杖：右上角頭像 →「My Profile」→「API Tokens」→「Create Token」→ 選範本 **Edit Cloudflare Workers** →「Account Resources」選你的帳號、「Zone Resources」選 All zones →「Continue to summary」→「Create Token」。**複製這串權杖**（只會顯示一次，不要貼到任何公開地方）。
4. 找帳號 ID：回到「Workers & Pages」首頁，右側欄有 **Account ID**，複製下來。
5. 到 GitHub 存放庫 `lester47/ai-food-course` →「Settings」→「Secrets and variables」→「Actions」→「New repository secret」，新增兩個 Secret：
   - `CLOUDFLARE_API_TOKEN`：第 3 步的權杖
   - `CLOUDFLARE_ACCOUNT_ID`：第 4 步的帳號 ID
6. 到「Actions」→ 左側「部署雙人競賽伺服器（Cloudflare Worker）」→「Run workflow」。完成後點進這次執行，摘要會顯示伺服器網址，例如 `https://ai-food-race.lester47.workers.dev`。
7. 網站已預先設定伺服器網址 `https://ai-food-race.lester47.workers.dev`（`src/config/race.js`）。只有在網址不同時，才需要到「Variables」分頁新增 `RACE_SERVER_URL`，再執行「部署到 GitHub Pages」。
8. 打開雙人競賽頁，大廳應顯示「✅ 競賽伺服器連線正常」。

之後只要修改 `race-server/` 或 `src/race/room-core.js` 並推送到 `main`，伺服器會自動重新部署。

**權杖安全**：權杖只放在 GitHub Secrets；不要寫進程式碼、文件、Padlet 或聊天訊息。若不小心外流，到 Cloudflare「API Tokens」按「Roll」或刪除重建。

---

## 二、上課流程

1. 學生用 MakeCode 寫好計步程式（見下一節）並下載到 micro:bit，**關掉 MakeCode 的「顯示資料」視窗**。
2. 兩人一組：一人按「建立房間」（紅隊），把 6 位數房號唸給另一人；另一人輸入房號按「加入房間」（綠隊）。
3. 兩人各自選「用 micro:bit 搖晃」→「連接 micro:bit」→ 在跳出的視窗選自己的板子 → 搖一搖，確認「訊號測試」有出現 `STEP`。
4. 兩人都按「我準備好了」，由房主（紅隊）按「開始比賽」，兩台電腦同步倒數 3 秒。
5. 先到 20 步獲勝。按「再比一次」，兩人都按了就會歸零重來。

### micro:bit 程式（MakeCode 積木）

- 建立變數「步數」
- 當 晃動（搖晃）時：步數 改變 1；序列埠 寫入一行 `"STEP:"` 合併 步數
- 當 按鈕 A 被按下時：步數 設為 0；序列埠 寫入一行 `"RESET"`

紅隊、綠隊參考程式（JavaScript）在網站「教師入口」→ 第 3 週 → 「延伸：雙人競賽實驗室」（需教師密碼）；積木圖在老師電腦「雙人競賽_microbit範例程式」資料夾。第一週的 `STEP,12`（逗號）格式也能使用。比賽只計算「倒數結束後新增的步數」，所以開始前不用歸零，比賽前搖晃也不會算分。

### 沒有 micro:bit 時

- **兩台電腦連線測試**：兩邊都選「模擬按鈕」，比賽時按大按鈕或空白鍵走一步。對手畫面會清楚標示「模擬按鈕」。
- **單機示範**：大廳最下方「老師專區」→「開始單機示範」，一台電腦同時扮演兩隊（鍵盤 A／L），不用網路，適合投影講解規則。

---

## 三、規則與保護

| 情況 | 系統怎麼處理 |
|---|---|
| 倒數中或比賽前搖晃 | 不計分 |
| 上一局殘留的訊號 | 帶有局次編號，新局不採用 |
| 第三人輸入同一個房號 | 「這個房間已經有兩位選手了」 |
| 房號打錯 | 「找不到這個房號」 |
| 比賽中有人斷網或關掉分頁 | 雙方畫面顯示「暫停」，60 秒內回來就重新倒數、分數保留 |
| 比賽中拔掉 micro:bit | 暫停；按「重新連接 micro:bit」後重新倒數 |
| 60 秒內沒回來 | 本局取消、不判勝負，釋放座位讓別人加入 |
| 重新整理頁面 | 自動回到原本的座位（只在同一個分頁有效） |
| 同一位選手開了兩個分頁 | 舊分頁停止，新分頁接手 |
| 比賽中按「離開房間」 | 要連按兩次確認；本局取消、不判勝負 |
| 幾乎同時到 20 步 | 以伺服器先收到的為準 |

勝負只採用伺服器確認過的分數；學生的網頁不能替對方加分，也不能直接宣告勝利。每秒最多 8 步、一次最多加 3 步。這是教學娛樂競賽，**不是精密計時，也無法完全防止有人改程式作弊**，請搭配公平的班級規則。

---

## 四、常見問題

| 畫面訊息 | 處理方式 |
|---|---|
| 這個瀏覽器不能連 micro:bit | 改用 Windows 的 Chrome 或 Edge；iPad／手機只能用模擬按鈕 |
| micro:bit 正被別的程式使用 | 關掉 MakeCode「顯示資料」、其他開著這一頁的分頁，再按連接 |
| 沒有選到裝置 | 跳出視窗時要點選板子再按「連線」；看不到板子請換一條「可傳資料」的 USB 線 |
| 訊號測試一直沒有 STEP | 確認程式有「序列埠 寫入一行」、文字是 `STEP:`；重新下載程式 |
| 連不上競賽伺服器 | 檢查學校網路是否擋 `*.workers.dev`；或請老師確認第一節的設定 |

---

## 五、技術摘要（給維護者）

- 前端：`race/index.html`、`src/race/`（`room-core.js` 房間規則、`client.js` 連線、`serial-reader.js` Web Serial、`app.js` 畫面）
- 伺服器：`race-server/`（Cloudflare Worker + Durable Object，每房一個），與前端共用 `src/race/room-core.js`
- 使用 WebSocket Hibernation；房間狀態只寫在「活躍連線的 attachment」中，休眠後由此復原；**不呼叫任何儲存 API（ctx.storage、KV、D1）**
- 每位選手有隨機 token，只存在該分頁的 sessionStorage，放在 WebSocket 訊息中，不放網址、不廣播
- 來源限制：只接受 `https://lester47.github.io` 與 localhost；建立房間與加入有每分鐘次數限制；房間最長 4 小時
- 本機測試：
  ```bash
  npm test                                   # 單元測試（含房間規則、休眠復原）
  cd race-server && npm install && npm run dev   # 本機伺服器 http://localhost:8787
  npm run build && (cd dist && python3 -m http.server 4173)
  # 瀏覽器開 http://localhost:4173/race/?server=http://localhost:8787
  cd race-server && npm run test:e2e         # 伺服器與兩個瀏覽器的端對端測試（需 playwright）
  ```
