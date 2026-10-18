# React 前端：獨立 Node.js 環境

本資料夾有自己的 package.json、.env 與 node_modules；不使用 backend/.venv，也不需要 Docker 啟動前端。

## 第一次安裝

在 frontend 內執行（建議 Node24）：

    npm install
    cp -n .env.example .env

## 每次啟動

    npm run dev

預設 http://localhost:5173。Vite 從 frontend/.env 讀取 FRONTEND_PORT 與 API_PROXY_TARGET，預設代理 /api 到 http://127.0.0.1:8000；不讀根目錄 .env。

交易資料頁經同源 `/api/v1/twse` 呼叫後端，再由後端向 TWSE OpenAPI 取得資料。每次進入資料頁與手動更新都發出新請求，沒有行情快取、背景輪詢或自動重試。`API_PROXY_TARGET` 是開發代理設定，不放資料庫密碼或私密金鑰。需要啟動搭配的 TWSE 轉接後端；來源或後端失敗會顯示錯誤，不會用假資料補上。

## 其他指令

    npm test
    npm run typecheck
    npm run build

目前使用 React/TypeScript/Vite、React Router 與 TanStack Query，提供以下導覽與示範頁面：

| 導覽 | 路由 | 內容 |
| --- | --- | --- |
| 首頁 | `/` | TWSE 官方指數概覽、交易功能入口 |
| 個股分析 | `/stocks` | 本次 TWSE 日成交資訊、代碼／名稱搜尋 |
| 交易資料 | `/market` | 44 個 API 的分類功能目錄 |
| 各 API 功能頁 | `/market/:datasetId` | 對應端點的搜尋、原始資料表與功能視圖 |
| 舊版個股摘要 | `/stocks/:instrumentId` | 原有假資料摘要，保留明確示範標示 |
| 自選股 | `/watchlists/demo` | 固定的示範觀察清單；`/watchlists` 會導向此處 |

交易功能依用途提供價格摘要、指數／量值序列、排行比較、外資持股／資券明細、交易事項卡片及日曆事項。每一個 API 都有獨立頁面與後端對應 endpoint；分類、說明及路徑由後端固定目錄取得。完整 44 個來源與頁面對照見後端 [TWSE 交易資料說明](https://github.com/tw-stock-analysis/tw-stock-backend/blob/feat/public-market-endpoints/docs/twse-trading-api.md)。

資料表保留官方原始欄位、數值及單位，代碼前導零、大整數和小數不經 Number 轉換；圖形才使用近似值。資料日期保持來源格式，取得時間顯示 Asia/Taipei；取得時間不等於成交時間。搜尋、指定欄位篩選、每頁 50 筆分頁及圖表欄位選擇只處理本次回應，不額外向 TWSE 發送請求。首次開頁與手動更新顯示載入狀態，來源失敗、合法空資料、搜尋無結果分別呈現；更新失敗不顯示之前成功的資料。

原有自選示範與舊版個股摘要仍使用 `src/features/stocks/mockStocks.ts`，頁面明確標示假資料。自選股目前沒有個人儲存、增刪或會員功能。

這批來源涵蓋 TWSE 價格、成交、指數、外資、資券、當沖、鉅額、注意／處置、日曆、權證交易及 ETF 定期定額統計；不含公司基本資料、營收及財報。TWSE 此 OpenAPI 沒有 T86 三大法人每日買賣超，不以外資持股比率代替。各 API 的更新頻率依官方發布，不代表都提供盤中報價。

目前開發環境仍阻擋 `openapi.twse.com.tw`，真實來源驗收尚未完成；測試使用合成 HTTP 回應，正式頁面沒有假行情回退。

桌面與手機皆可使用主要導覽，目前頁面以底線及 `aria-current="page"` 標示；交易資料子頁維持分類導覽標示。另提供跳至主要內容、鍵盤焦點與可橫向捲動的資料表格。

## Nginx 部署

本儲存庫的 `Dockerfile` 使用 Node 24 執行 `npm ci` 與 `npm run build`，再將 `dist` 複製到 Nginx 映像；執行階段不需要 Node、Vite 或前端開發伺服器。建置不讀取本機 `.env`，瀏覽器固定使用同源 `/api/v1`。

Nginx 同時提供前端檔案與後端代理：

- `/api`、`/api/*` 轉送內部 `backend:8000`，保留完整路徑、query string 與公開 Host；支援 WebSocket 升級及不緩衝的串流回應。
- `/stocks`、`/market/:datasetId`、`/stocks/:instrumentId`、`/watchlists/demo` 等頁面回退至 `index.html`，支援直接開啟與重新整理。
- `index.html` 每次重新驗證；Vite 雜湊資產長期快取；不存在的 `/assets/*` 回傳 404。

整站由後端儲存庫的 Docker Compose 啟動，前後端儲存庫預設放在同一層：

```bash
cd ../tw-stock-backend
docker compose --env-file .env up -d --build --wait
```

需先依後端 `.env.example` 設定既有部署的資料庫密碼，並搭配提供 `/api/v1/twse` 的後端分支（PR #4）。入口為 http://localhost:8080，只有 Nginx 對主機開放連接埠；FastAPI 與 PostgreSQL 留在內部網路，交易查詢不讀寫 PostgreSQL。Nginx API 代理明確停用快取，瀏覽器請求使用 `cache: no-store`。完整啟動、環境變數與驗證方式見 [後端部署說明](https://github.com/tw-stock-analysis/tw-stock-backend#readme)。

[前端設計](docs/frontend-plan.md) · [API 契約](../backend/docs/api-contract.md)
