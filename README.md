# hometool｜台中實價地圖

台中市實價登錄地圖服務：在地圖上瀏覽近兩年真實成交行情，點擊門牌查看完整成交歷史與每坪單價。資料來源為[內政部不動產成交案件實際資訊資料供應系統](https://plvr.land.moi.gov.tw/)。

## 技術架構

- **Web**：Next.js 16（App Router）+ React 19 + Tailwind CSS 4
- **地圖**：Leaflet + react-leaflet + OpenStreetMap
- **資料庫**：PostgreSQL（Zeabur）+ Prisma 7
- **資料管線**：n8n 排程呼叫管理 API 自動匯入與地理編碼
- **部署**：GitHub → Zeabur 自動部署

## API

### 公開查詢

| 端點 | 說明 |
|---|---|
| `GET /api/transactions?bbox=minLng,minLat,maxLng,maxLat&district=&buildingType=&priceMin=&priceMax=&dateFrom=&dateTo=` | 地圖範圍內的成交點（價格單位：萬元） |
| `GET /api/address?q=臺中市南區和昌街156號` | 單一門牌的成交歷史與平均每坪單價 |

### 管理（需 `Authorization: Bearer <ADMIN_TOKEN>`）

| 端點 | 說明 |
|---|---|
| `POST /api/admin/import` | 匯入近 8 季實價登錄；`?seasons=114S4,115S1` 指定季別。同季重複匯入會先清除舊資料 |
| `POST /api/admin/geocode?limit=40` | 批次地理編碼（Nominatim，1 req/s）；重複呼叫直到回應 `remaining: 0` |

## 環境變數

見 [.env.example](.env.example)：`DATABASE_URL`（Zeabur PostgreSQL）、`ADMIN_TOKEN`（管理 API 密鑰）。

## n8n 排程建議

1. **匯入**：每 10 天（配合內政部每月 1、11、21 日更新）→ `POST /api/admin/import`
2. **地理編碼**：匯入完成後以 loop 呼叫 `POST /api/admin/geocode?limit=40`，直到 `remaining = 0`（Nominatim 有速率限制，每批約 1 分鐘）

## 開發

```bash
npm install          # postinstall 會自動 prisma generate
npm run dev          # 需要 .env 內有效的 DATABASE_URL
```

首次建立資料庫結構：`npx prisma migrate deploy`（部署時 `npm start` 會自動執行）。
