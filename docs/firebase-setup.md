# Google 登入與進度同步設定

本專案已完成真實雲端設定並啟用：`ai-food-ambassador-course`，Google 供應商、localhost 與 127.0.0.1 授權網域、台灣 asia-east1 Standard 預設資料庫及本人存取規則。維持 Spark 免付費方案，未啟用付費備份、Analytics 或 Gemini。以下保留設定方式，供備份與未來移轉參考。

## 管理者一次性設定

1. 到 https://console.firebase.google.com/ ，用由你或學校管理的 Google 帳號登入。密碼與驗證碼只在 Google 頁面輸入，不提供給網站或聊天。
2. 選擇專用 Firebase 專案或建立新專案；本功能不需要 Analytics，不啟用付費服務。建立帳號、接受條款、選擇資料庫區域與付款等決策由管理者確認。
3. 新增 Web 應用程式，不必另外設定 Firebase Hosting。取得 Firebase 公開網頁設定：apiKey、authDomain、projectId、appId。不要下載或上傳 service account 私密金鑰。
4. Authentication → Sign-in method 啟用 Google，設定專案支援信箱。Authentication → Settings → Authorized domains 加入 localhost、127.0.0.1 與未來部署網站的網域（不含路徑）；新專案不一定預設允許 localhost。
5. 建立 Cloud Firestore **Standard edition 的預設資料庫**，選擇學校適用區域與 Production mode。不要使用開放所有人讀寫的測試規則。
6. 在 Firestore Rules 貼上專案根目錄 firestore.rules 並發布。只允許 Google 登入使用者存取自己的路徑，欄位僅限關卡完成狀態、上次關卡與伺服器時間。
7. 將步驟 3 的公開設定填入 src/config/firebase.js，並在所有設定完成後將 cloudProgressEnabled 改為 true，重新 build 與部署。這些公開設定不是資料庫的存取權限；安全規則不可省略。

## 學生使用

- 按「使用 Google 登入」，選擇學校允許的帳號。登入預設採分頁工作階段，不在公用電腦長期保留登入。
- 登入後讀取自己的雲端進度；按完成會自動儲存，只有雲端寫入完成才顯示已同步。
- 登入不會自動把公用電腦的訪客進度混入帳號。要匯入時，展開「本機進度與使用說明」，確認紀錄是自己的，再按匯入。
- 斷網或權限失敗顯示尚未同步，修改保留在本機該帳號暫存。恢復網路後重試；初始雲端讀取失敗時不直接覆寫整份雲端進度。
- 登出恢復訪客進度，不顯示剛才帳號的完成關卡。共用電腦使用完請登出。
- 換裝置登入會載入進度；同時開著的另一台裝置按「重新同步」載入最新資料。同一任務衝突時以最後送達伺服器的寫入為準，並非正式成績。

## 資料設計

- learners/{Firebase UID}/tasks/{taskId}：done（布林值）、updatedAt（伺服器時間）。每關獨立存放，修改單一關卡不覆寫其他關卡。
- learners/{Firebase UID}/state/course：lastTask、updatedAt。
- 雲端進度不存姓名、信箱、提示詞或作業內容；Google 登入服務本身仍處理帳號識別資料。前端為學生辨認帳號而顯示登入信箱。
- 登入不授予教師查看所有學生的權限。全班進度儀表板不在本次範圍；作品交件仍使用外部 Google 表單。

## 驗收

先以測試帳號 A 完成一關，在另一個瀏覽器登入 A 確認可讀取；取消完成也能同步。再用 B 確認看不到 A。登出確認回到原訪客紀錄。關網路測試尚未同步與重試，最後確認 Firestore 規則拒絕未登入與跨 UID 存取。

本機純程式測試涵蓋帳號切換、延遲讀取、登出、同步失敗、重試、匯入與連續修改；另已完成真實 Google OAuth、關卡完成／取消、頁面重載、最後位置同步。規則測試區已確認匿名拒絕、本人允許、跨 UID 拒絕。尚未在另一台實體裝置或每個學生帳號上逐一驗收；校方帳號政策與正式部署網域仍需課前確認。

SDK 採 Firebase 官方 CDN 的固定版本，只在啟用功能後載入。首次登入需要網路；未配置時不載入 SDK。教室網路若封鎖 Google／gstatic／Firebase 需由校方協助。

官方參考：https://firebase.google.com/docs/auth/web/google-signin 、https://firebase.google.com/docs/auth/web/auth-state-persistence 、https://firebase.google.com/docs/firestore/security/get-started
