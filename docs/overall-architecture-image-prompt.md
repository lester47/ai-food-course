# 整體專案架構圖：生成紀錄

使用內建 image_gen，先依 [七個模組拆解](project-modules.md) 核對，再以四層視覺整合。初稿核對發現教師回應箭頭易造成誤解，已要求針對該標示及文字修正。首頁會保留原圖作為可展開的資料流補充。

## 完整生成提示

Create one landscape high-resolution Traditional Chinese system architecture infographic, 16:10. This is the OVERALL PROJECT architecture of "AI 食農大使", NOT a Week 1 tutorial. Professional educational presentation style, ivory background, forest green and technology blue, restrained colorful icons, large readable Traditional Chinese labels. Avoid a giant micro:bit or LED dominating composition. No fake MakeCode screenshots. Main title EXACT "AI 食農大使｜整體專案架構". Subtitle "五週課程 × 互動網站 × 硬體串接 × 成果回饋".
Organize as four clearly labeled horizontal layers, with clear directional connectors and whitespace.
TOP layer label "01 使用者". Three compact cards: "學生｜學習・練習・交件", "教師｜編修教材・查看作品・回饋", "訪客｜公開教材・授權匿名作品".
SECOND layer is the large core: label "02 課程網站（HTML / CSS / JavaScript）". Inside two rows:
First row five equal curriculum cards with small icons, no dominance of Week 1:
"第1週｜程式基礎" + "按鍵・變數・LED 計步器"
"第2週｜USB 網頁" + "序列資料・單人進度條"
"第3週｜雙隊競跑" + "R / G 分流・達標與重置"
"第4週｜食農探索" + "13 鄉鎮・資料查核・地圖"
"第5週｜領地挑戰" + "系統整合・知識闖關・小組展示".
Second row four functional modules inside site: "教學導覽｜首頁・週次・34 個任務", "互動實驗室｜LED・USB・競跑・鄉鎮卡片", "作品與教師入口｜作業說明・公開展示・維護指引", "本機進度｜僅此瀏覽器，不是正式交件".
THIRD layer label "03 資料與外部服務". Four boxes:
"課程資料與公開設定" + "weeks / tasks / assignments" + "教師可編輯"
"micro:bit 硬體輸入" + "第二週起：USB → Web Serial" + "STEP,n / R,n / G,n / RESET"
"Google 表單" + "學生送出作品連結與心得" + "教師從私人回應資料確認"
"既有食農領地戰" + "完整遊戲入口・真實行政界線" + "待提供原穩定版與核准素材".
Connect data/config box upward into site; hardware arrow upward into site only labeled "讀取逐行資料"; website outward arrow to Google Forms label "另開真實表單"; Google Forms arrow to teacher in top row on outer edge label "查看回應・私人管道回饋" (do not imply private responses reside in website). Existing game dashed connector to Week4/5 label "後續整合".
BOTTOM layer label "04 部署與版本界線". Three short notes:
"靜態部署｜本機預覽 → build → GitHub Pages / HTTPS"
"已實作｜五週教材骨架、34 任務、模擬練習、USB 接收程式、卡片整合"
"待完成驗收／素材｜實體 USB、真實表單、積木截圖、核對農產、正式行政地圖"
Very bottom small readable disclaimer "目前沒有站內登入、原生檔案上傳或私人批閱後台；未設定表單時不開放繳交。"
Legend: solid connectors "本版流程"; dashed connectors "待補／擴充". Use arrows sparingly with no crossings. Overall visual must communicate full project system and all five weeks equally, not just hardware or the first week. All text should be crisp, accurate Taiwan Traditional Chinese.
