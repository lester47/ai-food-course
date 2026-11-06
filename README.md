# AI 食農大使｜五週互動課程

獨立靜態網站，繁體中文，適合國小四～六年級。未修改原有遊戲或推送任何正式分支。學生不需要安裝開發工具。

Google 登入與個人進度同步已啟用，使用 Firebase Authentication／Firestore，專案為 `ai-food-ambassador-course`，Standard 資料庫位於台灣 asia-east1，維持免付費 Spark 方案。已用學校 Google 帳號完成登入、完成／取消關卡、重新載入及最後學習位置同步驗證。Firestore 規則測試確認本人可讀、匿名與跨帳號讀取遭拒。新部署網域仍需加入 Firebase 授權清單；詳見 [Firebase 設定指南](docs/firebase-setup.md)。學習進度同步與 Google 表單交件分開。

## 啟動與建置

開發者在此資料夾執行（需 Node.js 20 以上，無額外套件）：

```powershell
npm run dev
```

瀏覽器開啟 http://localhost:4173/ 。若連接埠已占用，先關閉先前的預覽，不要重複啟動。伺服器僅監聽本機 IPv4 與 IPv6。停止前景伺服器用 Ctrl+C；背景伺服器請先用 `Get-NetTCPConnection -LocalPort 4173 -State Listen` 確認程序，再停止該 Node 程序。

```powershell
npm test
npm run build
```

`dist/` 是可部署產物；不要直接以 file:// 開啟 ES module 網站。課堂使用正式 HTTPS 網址即可。

## 目前功能

- 首頁、五週總覽、週次頁、34 個任務、作業頁、教師工具說明、操作說明、授權作品展示入口。
- 每週 180 分鐘；第一週十關有具體教學、測試、除錯、延伸挑戰。前七關必達，後三關分層。
- A 鍵累加、十步愛心、雙隊 5×5 LED；兩隊各最多十燈，中間排留白。
- 真實 Web Serial 連接／中斷程式、權限與錯誤提示、逐行分段解碼、原始資料與進度對照、無硬體示範。
- 13 鄉鎮卡片選取、紅綠隊占領、統計與重置；整合挑戰需十步才可攻佔；三題食農素養即時回饋。
- 本機進度可保存；不宣稱已交件、跨裝置同步或正式評分。
- 每週 Google 表單可設定真實繳交入口；未設定一律顯示尚未開放繳交。

## 內容與設定

所有 34 個任務均採兩種方式並列：MakeCode／網頁動手實作，以及 AI 提示詞輔助。桌機雙欄、手機上下排列。學生可以編輯功能想法，在本機整理、修改、複製提示詞，再貼到老師指定的 AI 工具；網站不呼叫 AI API，不傳送或保存輸入。每種方式都需實際操作與測試。前三關另附老師示範及學生實作指引。提示詞邏輯位於 `src/data/ai-prompts.js`，介面位於 `src/components/learning-paths.js`。

| 路徑 | 用途 |
| --- | --- |
| `src/data/weeks.js` | 五週目標、設備、作業要求與鄉鎮資料 |
| `src/data/tasks.js` | 任務概念、步驟、測試、除錯、延伸與圖片 |
| `src/config/assignments.js` | 公開學生表單、開放狀態、截止日期、授權作品、既有遊戲入口 |
| `src/services/core.js` | 序列資料解析、LED、表單網址驗證 |
| `src/services/serial.js` | Web Serial 讀取與連線生命週期 |
| `src/app.js` | hash 路由與互動頁面 |
| `src/styles.css` | 響應式、焦點、減少動畫與投影模式 |
| `public/images/lessons/` | 真實教材截圖存放處 |

所有設定更動後都要重新執行 build 並部署。新增任務沿用 `tasks` 欄位，指定正確 weekId；目前每週時間總計由測試驗證。插圖是 CSS 教學示意，不是 MakeCode 積木截圖。

## Google 表單繳交

請閱讀 [教師指南](docs/teacher-guide.md)。每週設定範例（範例不是有效連結，請填自己表單）：

```js
// 將 assignments.w1 改成：
{
  provider: 'googleForm',
  formUrl: '', // 貼上 Google 表單「發布／傳送」取得的學生填答網址
  open: true,
  deadline: '', // 未設定不顯示假日期
  note: '請依課堂公告填寫作品連結與心得。'
}
```

接受 HTTPS forms.gle 短網址或 docs.google.com/forms/.../viewform 填答網址；不接受表單編輯網址。真實表單未提供，因此目前五週皆關閉，實際交件尚待教師設定後驗收。網站無法知道學生有沒有送出外部表單；教師應從 Google 表單管理後台確認回應，並以校內核准管道提供私人回饋。

`provider` 欄位是未來切換的擴充點。目前只支援 googleForm，未知 provider 不開放提交；原生上傳需另建真實後端與權限，不可只修改 provider 就宣稱可用。

## GitHub Pages 部署

1. 在學校核准的獨立儲存庫放入此資料夾內容；勿覆蓋原遊戲。
2. 本機執行 `npm test` 和 `npm run build`。
3. 將 **dist 內的內容** 放到核准的 Pages 發布分支根目錄，或透過學校既有 GitHub Actions 上傳 dist。
4. 在 GitHub Settings → Pages 選擇對應來源。正式發布請由維護者確認後操作；本次未推送、未建立遠端站點。
5. 開啟 HTTPS 網址（可包含儲存庫子路徑），測試 `#/weeks/w1/tasks/w1-t01` 並重新整理。

所有資源使用相對路徑，hash 路由不需 404 fallback。若改用其他靜態主機，同樣指定 dist 為輸出目錄。不要部署整個工作目錄或私人設定。

## 已知限制與待提供素材

- 第 2～5 週為基礎任務教學，沒有冒稱完整圖文教材。
- 尚無可信繁體中文積木截圖，頁面明確顯示待補。請提供或由教師在官方編輯器擷取；不能用 AI 仿圖替代。
- 尚未提供原穩定版遊戲、真實行政界線、已核對農產及授權圖片，因此地理互動採卡片練習，**沒有正式行政地圖**，不亂配農產。可先設定 `integration.gameUrl` 連到經確認的完整遊戲。`mapGeoJson` 為未來保留欄位，目前尚未實作載入。
- 整合挑戰以單頁本機狀態運作，非多人同步；重新載入會清除練習、領地與答題狀態。硬體攻佔後應按實體 A+B 送出 RESET，再開始下一輪；網頁不會回寫板子步數。
- 未提供實體板子，未完成實體下載、USB 拔線、重連的硬體驗收；已有相應程式與提示。
- 提供學生 Google 登入與個人學習進度同步；未提供教師角色、站內私有檔案儲存或私人批閱。私人回饋由學校核准管道完成。
- 字型可從 Google Fonts 載入，失敗時使用系統中文字型。沒有 PWA 或完整離線支援。

請參閱 [驗收紀錄](docs/acceptance-test.md)、[學生指南](docs/student-guide.md)、[規格檢視](docs/spec-review.md)。

首頁五週路線下方另附 [專題架構圖](public/images/project-architecture.png)，可點擊放大，並以三段文字解說。使用內建 image_gen 生成；[完整提示](docs/architecture-image-prompt.md)及[架構解說](docs/architecture-explained.md)已保留。

首頁現以「[七個模組拆解](docs/project-modules.md) → [整體專案架構圖](public/images/project-overall-architecture.png)」為主要說明，涵蓋五週、網站、硬體、食農遊戲、交件回饋及部署；原操作資料流圖保留於可展開的補充區。總圖使用內建 image_gen；[生成提示](docs/overall-architecture-image-prompt.md)與[修正提示](docs/overall-architecture-image-edit.md)一併保留。

## 官方技術參考

- [MakeCode serial.writeLine](https://makecode.microbit.org/reference/serial/write-line)：逐行文字會附加 CRLF。
- [Chrome Web Serial 文件](https://developer.chrome.com/docs/capabilities/serial)：由使用者操作要求裝置權限，讀取 stream，取消讀取後釋放鎖定再關閉連線。
