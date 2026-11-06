# AI 協作者須知（Codex／Claude）

這是「AI 食農大使｜五週互動課程學習平台」，國小四～六年級使用，網址 https://lester47.github.io/ai-food-course/ 。

開始前請先讀：
1. `handoff/README.md`：交接規則（Claude 寫 `handoff/claude/`、Codex 寫 `handoff/codex/`）
2. `handoff/claude/` 裡最新的移交清冊：系統現況、美工協作規則、待辦
3. `docs/spec-v2-PBL修改規格書.md`：課程架構

必守規則：
- 介面文字一律使用臺灣繁體中文。
- `teacher-src/` 不得加入 Git，也不得複製到 `src/`、`docs/`、`public/`。不要手動修改 `src/data/teacher-vault.js`。
- 不寫入教師密碼、表單編輯連結、試算表網址或學生個資。
- CSS 只在 `src/styles.css` 最後附加自己的區塊，顏色用 `:root` 變數。
- 插畫只用原創 SVG（`src/components/illustrations.js`），不用外部圖片、真實人物照片、既有卡通角色或品牌。
- 推送前 `npm test` 要通過；390／768／1024／1366px 不得出現橫向捲軸。
- 推送到 `main` 約 1～2 分鐘後自動上線；較大的修改請用 `codex/<主題>` 分支並開 Pull Request。
- 每次完成工作，在自己的 handoff 資料夾留下 `YYYY-MM-DD_主題.md` 移交單。
