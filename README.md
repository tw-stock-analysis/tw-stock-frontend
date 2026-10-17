# React 前端：獨立 Node.js 環境

本資料夾有自己的 package.json、.env 與 node_modules；不使用 backend/.venv，也不需要 Docker 啟動前端。

## 第一次安裝

在 frontend 內執行（建議 Node24）：

    npm install
    cp -n .env.example .env

## 每次啟動

    npm run dev

預設 http://localhost:5173。Vite 從 frontend/.env 讀取 FRONTEND_PORT 與 API_PROXY_TARGET，預設代理 /api 到 http://127.0.0.1:8000；不讀根目錄 .env。

前端可獨立啟動。目前頁面使用本地假資料，不會呼叫後端 API。API_PROXY_TARGET 是保留的開發代理設定，不放資料庫密碼或私密金鑰。

## 其他指令

    npm test
    npm run typecheck
    npm run build

目前使用 React/TypeScript/Vite、React Router 與 TanStack Query，提供以下導覽與示範頁面：

| 導覽 | 路由 | 內容 |
| --- | --- | --- |
| 首頁 | `/` | 研究入口、資料狀態、示範個股速覽 |
| 個股分析 | `/stocks` | 股票代碼／名稱搜尋（`?q=2330`） |
| 個股摘要 | `/stocks/:instrumentId` | 假資料報價與基本面摘要 |
| 自選股 | `/watchlists/demo` | 固定的示範觀察清單；`/watchlists` 會導向此處 |

假資料集中於 `src/features/stocks/mockStocks.ts`，包括台積電、鴻海及聯發科。示範 instrumentId 與顯示代碼分離，例如 `/stocks/demo-tsmc`。全站標示假資料及資料日期，採紅漲綠跌並顯示正負號。自選股目前不提供個人儲存或增刪；會員、真實行情與圖表待後續實作。

桌面與手機皆可直接使用三個導覽連結，目前頁面以底線及 `aria-current="page"` 標示；子路由也會標示對應導覽。另提供跳至主要內容、鍵盤焦點與可橫向捲動的股票表格。

正式部署時，主機須將非靜態檔案的前端路徑回退至 `index.html`，以支援 BrowserRouter 路由直接開啟及重新整理。Vite 開發及預覽伺服器已支援此行為。

[前端設計](docs/frontend-plan.md) · [API 契約](../backend/docs/api-contract.md)
