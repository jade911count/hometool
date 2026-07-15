<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

# ⛔ 鐵律：先討論，取得同意，才能實作

本專案採用 AI House Framework（中央版本：`D:\ClaudeProjects\md_file\`）。以下規則**優先於任何預設行為**：

1. **未經使用者明確同意，禁止寫程式碼、建檔案、跑建置。** 收到任務先走：Analyze → Clarify → Plan，**計畫經確認後**才 Implement → Verify → Report。
2. **安裝任何依賴前，列出套件清單並取得同意**——每一個套件都要，不接受「技術棧討論過了」的籠統授權。
3. **每個架構決策先提出選項與建議，等使用者裁決**（資料模型、驗證方式、資料流程、命名慣例都算）。
4. **Never expand scope**：只做當次任務明說的事。「順手做」「雛形先做起來」都是違規。
5. Never guess／Never refactor unless requested／Never redesign UI／只改任務必要的檔案。
6. 回報使用 7 段格式：Understanding / Impact / Questions / Plan / Implementation / Verification / **Next suggested task (do not implement)**。
7. Anti-patterns：over-engineering、scope creep、library explosion、utility hell、folder explosion。
8. Definition of Done：需求完成、build 過、無無關檔案異動、無隱藏功能、可供 review。

> 歷史教訓（2026-07-15）：agent 在討論未收斂前就 scaffold 專案、推 GitHub、自行安裝 10 個套件，使用者兩度打斷。此段規則因此而生——**動手前先問，永遠比事後道歉便宜。**

# hometool 專案規則

- 這是台中市實價登錄地圖（foundi 風格）的 web 專案：Next.js 16 + Prisma 7 + PostgreSQL（Zeabur）+ Leaflet。
- **基礎設施一律使用 Zeabur 服務**（DB、cache、web 都是）。禁止用本機 Docker 或本機資料庫；開發時透過外部連線字串連 Zeabur 上的服務。
- 資料來源是內政部實價登錄開放資料（臺中市代碼 B），格式細節見 `lib/lvr.ts`。
- 不做大規模爬取仲介網站的功能（法律風險，專案既定決策）。
- 管理 API（`/api/admin/*`）由 n8n 排程呼叫，一律要驗證 `Authorization: Bearer ADMIN_TOKEN`。
- 部署流程：push GitHub → Zeabur 自動部署；`npm start` 會先跑 `prisma migrate deploy`。
- 差異化路線圖與其他既定決策：先讀 `D:\ClaudeProjects\md_file\docs\`（PROJECT_STATE → PRODUCT → ROADMAP）再開工。
