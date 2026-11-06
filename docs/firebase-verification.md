# Google 登入與雲端進度實際驗證

日期：2026-11-06。

- Firebase 專案：ai-food-ambassador-course。
- 已註冊課程 Web 應用程式，Google 登入已啟用。
- 已授權 localhost、127.0.0.1；保留 Firebase 預設網域。
- 預設 Firestore：Standard／asia-east1 (Taiwan)。維持 Spark，每月 $0 方案；未啟用付費備份、Analytics 或 Gemini。
- firestore.rules 已經控制台發布。規則測試區用虛構測試 UID 證實：匿名 get 拒絕；Google UID A 對 A 路徑 get 允許；Google UID B 對 A 路徑 get 拒絕。模擬不會新增真實學生紀錄。
- 使用者親自完成學校 Google 帳號登入。網站確認「Google 帳號已登入」及「已同步到此 Google 帳號」。
- W1-T01 勾選後伺服器寫入完成；重載頁面可讀取；測試後取消勾選，確認取消狀態同步。未留下虛假的課程完成標記。
- 前往 W1-T02 後，最後學習位置已儲存，待同步 0 筆；再次按「重新同步」執行 getDocsFromServer／getDocFromServer，回到已同步狀態。
- 12 組本機測試及 build 通過。

## 驗證界線

未以第二台實體裝置測試；學校各學生帳號政策仍需課前驗收。同時使用多台電腦時，由重新同步讀取其他裝置修改；非即時共同編輯。

Firebase 控制台資料瀏覽器曾顯示文件載入錯誤；網站的 Firebase SDK 寫入確認及重新讀取已成功，不能把該控制台列表當作本次資料欄位逐筆檢視已通過的證據。

目前課程仍是本機預覽。正式開放給學生前，需部署靜態網站至核准的 HTTPS 網域、將網域加入 Authentication 授權清單，再以實際教室設備驗收；不能把 127.0.0.1 當成其他電腦可開啟的正式網址。
