<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

# hometool 專案規則

- 這是台中市實價登錄地圖（foundi 風格）的 web 專案：Next.js 16 + Prisma 7 + PostgreSQL（Zeabur）+ Leaflet。
- 資料來源是內政部實價登錄開放資料（臺中市代碼 B），格式細節見 `lib/lvr.ts`。
- 不做大規模爬取仲介網站的功能（法律風險，專案既定決策）。
- 管理 API（`/api/admin/*`）由 n8n 排程呼叫，一律要驗證 `Authorization: Bearer ADMIN_TOKEN`。
- 部署流程：push GitHub → Zeabur 自動部署；`npm start` 會先跑 `prisma migrate deploy`。
