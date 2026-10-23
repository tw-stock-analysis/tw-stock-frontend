# React 前端：獨立 Node.js 環境

本資料夾有自己的 package.json、.env 與 node_modules；不使用 backend/.venv，也不需要 Docker 啟動前端。

## GitHub Actions CI

[Frontend CI](.github/workflows/ci.yml) 在對 develop／master 的 PR，以及 develop／master／ci/** 分支的 push 時執行。使用 Node 24、npm ci、Vitest 與包含 TypeScript 檢查的正式建置；通過後建置標準 Dockerfile，實際啟動 Nginx 驗證 SPA 路由、靜態資產及快取標頭。

CI 在 GitHub Runner 執行，不需要啟動本機 Docker，也不依賴後端儲存庫或真實 TWSE API。映像僅用於當次驗證，GHCR 與正式部署在下一階段接上。觸發及檢查範圍見 [CI 說明](docs/ci.md)。

## 第一次安裝

在 frontend 內執行（建議 Node24）：

    npm install
    cp -n .env.example .env

## 每次啟動

    npm run dev

預設 http://localhost:3007。Vite 從 frontend/.env 讀取 FRONTEND_PORT 與 API_PROXY_TARGET，預設代理 /api 到 http://127.0.0.1:8000；不讀根目錄 .env。既有 `.env` 若仍為 `5173`，請同步改成 `FRONTEND_PORT=3007`。

開發時，瀏覽器的頁面與 `/api/*` 都走 Vite `3007`；正式部署則都走 Nginx，由代理轉發至 FastAPI，因此不需啟用跨來源 CORS。前端持續使用 `/api/v1/...` 相對路徑。後端 `AUTH_ALLOWED_ORIGINS` 的開發預設已包含 `http://localhost:3007` 與 `http://127.0.0.1:3007`，另保留 Nginx `8080` 入口；若自行覆寫此設定，必須包含實際瀏覽器入口，登入等 POST 才能通過 CSRF 檢查。此白名單不會啟用 CORS。

交易資料頁經同源 `/api/v1/twse` 呼叫後端，再由後端向 TWSE OpenAPI 取得資料。每次進入資料頁與手動更新都發出新請求，沒有行情快取、背景輪詢或自動重試。`API_PROXY_TARGET` 是開發代理設定，不放資料庫密碼或私密金鑰。需要啟動搭配的 TWSE 轉接後端；來源或後端失敗會顯示錯誤，不會用假資料補上。

## 登入與裝置管理

已串接同源 Cookie 認證：登入頁為 /login，裝置管理頁為 /account/sessions。頁面開啟／重新整理會呼叫 GET /api/v1/me 還原登入；裝置頁要求有效身分，公開行情與既有示範頁仍可直接瀏覽。

登入使用 Email／密碼，憑證由 HttpOnly Cookie 傳送；前端不讀取 Token，也不寫入 localStorage／sessionStorage。登入固定有效 7 天，私人請求收到 SESSION_INVALID 會清除身分、裝置資料並導向登入頁。登出及登出其他裝置正確處理 204 空回應；登出失敗會顯示錯誤並允許重試，裝置資料不使用快取或自動輪詢。所有認證 POST 都附帶 CSRF header，登出相關 POST 不傳 body。

需搭配已完成資料庫 migration、提供五個認證端點的後端；已有帳號必須為 active 且完成信箱驗證。公開註冊、忘記密碼與寄信流程尚未開放，本機測試帳號可依[後端可信開發腳本](https://github.com/tw-stock-analysis/tw-stock-backend/blob/feat/cookie-auth/docs/authentication-api.md#本機建立可登入的測試帳號)建立。完整路由、失效與測試說明見[前端認證文件](docs/authentication-ui.md)。

## 其他指令

    npm test
    npm run typecheck
    npm run build

目前使用 React/TypeScript/Vite、React Router 與 TanStack Query，提供以下導覽與示範頁面：

| 導覽 | 路由 | 內容 |
| --- | --- | --- |
| 首頁 | `/` | TWSE 官方指數概覽、交易功能入口 |
| 個股分析 | `/stocks?q=&page=` | 依代碼／名稱搜尋上市證券並分頁，每次重新取得來源 |
| 真實個股詳情 | `/stocks/:code` | 依序取得成交、估值及資券，各自顯示日期與狀態 |
| 交易資料 | `/market` | 44 個 API 的分類功能目錄 |
| 各 API 功能頁 | `/market/:datasetId` | 對應端點的搜尋、原始資料表與功能視圖 |
| 舊版示範摘要 | `/stocks/demo-tsmc` 等三個既有 demo 路徑 | 原有假資料摘要，保留明確示範標示 |
| 自選股 | `/watchlists/demo` | 固定的示範觀察清單；`/watchlists` 會導向此處 |
| 登入 | /login | Email／密碼登入、失敗訊息與安全的站內返回路徑 |
| 登入裝置 | /account/sessions | 本人的有效登入紀錄、登出與登出其他裝置 |

交易功能依用途提供價格摘要、指數／量值序列、排行比較、外資持股／資券明細、交易事項卡片及日曆事項。每一個 API 都有獨立頁面與後端對應 endpoint；分類、說明及路徑由後端固定目錄取得。完整 44 個來源與頁面對照見後端 [TWSE 交易資料說明](https://github.com/tw-stock-analysis/tw-stock-backend/blob/develop/docs/twse-trading-api.md)。

資料表保留官方原始欄位、數值及單位，代碼前導零、大整數和小數不經 Number 轉換；圖形才使用近似值。資料日期保持來源格式，取得時間顯示 Asia/Taipei；取得時間不等於成交時間。搜尋、指定欄位篩選、每頁 50 筆分頁及圖表欄位選擇只處理本次回應，不額外向 TWSE 發送請求。首次開頁與手動更新顯示載入狀態，來源失敗、合法空資料、搜尋無結果分別呈現；更新失敗不顯示之前成功的資料。

`/market/:datasetId` 的篩選及分頁只使用本次結果。`/stocks` 搜尋詞與頁碼保留在 URL，每次送出搜尋、換頁或更新都重新取得官方快照，不在輸入時自動送出。結果名稱可連至 `/stocks/0050` 等真實詳情；詳情依序呼叫 `/api/v1/stocks/{code}`、`/valuation`、`/margin`，各請求獨立逾時與報錯。資券來源沒有資料日期，不以取得日期替代；本次未發布資料與來源失敗有不同呈現，缺值不補零。更新期間隱藏原結果，失敗區塊不沿用前次數值；取消導覽停止後續區塊請求。

`src/features/market/column-labels.json` 是依 2026-10-18 官方 Swagger 整理的各 API 欄位說明，僅含文件標籤；原始欄名仍顯示於表頭。同名欄位可依 API 使用不同單位，例如一般成交的 `TradeVolume` 為成交股數，盤後定價則沿用官方「成交數量」。圖表排除代碼、名次與日期，ETF／股票戶數使用各自名稱，鉅額交易先選分類再繪製同一分類的序列。當沖標的頁顯示來源暫停註記，不提供來源未回傳的成交統計。

原有自選示範與舊版個股摘要仍使用 `src/features/stocks/mockStocks.ts`，頁面明確標示假資料。自選股目前沒有個人儲存或增刪功能；登入不會將示範清單變為私人資料。

這批來源涵蓋 TWSE 價格、成交、指數、外資、資券、當沖、鉅額、注意／處置、日曆、權證交易及 ETF 定期定額統計；不含公司基本資料、營收及財報。TWSE 此 OpenAPI 沒有 T86 三大法人每日買賣超，不以外資持股比率代替。各 API 的更新頻率依官方發布，不代表都提供盤中報價。

2026-10-18 後端已逐一實測 44 個官方 API，全部成功且實際欄位與即時 Swagger 相符；[完整驗證紀錄](https://github.com/tw-stock-analysis/tw-stock-backend/blob/develop/docs/twse-live-verification.json) 只包含筆數、欄位與取得時間。75 項前端合成測試、TypeScript 檢查及正式建置通過；正式頁面沒有假行情回退。

2026-10-18 Chromium 曾經 Vite 同源代理 → FastAPI → 真實 TWSE，逐一驗證全部 44 個桌面功能頁及 6 個手機代表頁，包含欄數、首列原始值、超過 50 筆時的分頁、無整頁橫向溢出及 JavaScript 錯誤。手動更新確認新增一次資料請求且取得時間改變，共 51 個逐次資料請求；[瀏覽器驗證紀錄](docs/twse-browser-verification.json) 僅保存頁面 ID、筆數、欄數與結果。該輪未使用 Nginx；本輪已使用獨立 Docker Compose 的 Nginx → FastAPI → 真實 TWSE 部署，後端 154 項測試全過，含 PostgreSQL、13 項 Nginx 與 45 項真實來源閘道測試。

另以真實鉅額日資料覆驗手機分類切換：無可繪圖數值時保留選單及原始表格，仍可切回有數值的分類；切換不新增來源請求。

本輪個股功能另完成 8 項真實 Nginx 桌面／手機瀏覽器驗證，共 23 個逐次 HTTP 請求、同時最多 1 個請求，沒有 JavaScript 錯誤或整頁橫向溢出。包含搜尋分頁、選股、手動更新、直接開啟／重新整理、0050 前導零及無估值、未知代碼；受控來源連線失敗回 503 時移除舊值，恢復連線後可重新取得。[個股驗證紀錄](docs/stock-research-verification.json) 僅含結果及時間，不含行情紀錄。

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

需先依後端 `.env.example` 設定既有部署的資料庫密碼，並搭配提供 `/api/v1/stocks` 及 `/api/v1/twse` 的後端分支。入口為 http://localhost:8080，只有 Nginx 對主機開放連接埠；FastAPI 與 PostgreSQL 留在內部網路，交易查詢不讀寫 PostgreSQL。Nginx API 代理明確停用快取，瀏覽器請求使用 `cache: no-store`。完整啟動、環境變數與驗證方式見 [後端部署說明](https://github.com/tw-stock-analysis/tw-stock-backend#readme)。

[前端設計](docs/frontend-plan.md) · [API 契約](https://github.com/tw-stock-analysis/tw-stock-backend/blob/feat/cookie-auth/docs/api-contract.md)
