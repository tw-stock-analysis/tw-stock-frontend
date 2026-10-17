# React 前端：獨立 Node.js 環境

本資料夾有自己的 package.json、.env 與 node_modules；不使用 backend/.venv，也不需要 Docker 啟動前端。

## 第一次安裝

在 frontend 內執行（建議 Node24）：

    npm install
    cp -n .env.example .env

## 每次啟動

    npm run dev

預設 http://localhost:5173。Vite 從 frontend/.env 讀取 FRONTEND_PORT 與 API_PROXY_TARGET，預設代理 /api 到 http://127.0.0.1:8000；不讀根目錄 .env。

前端可獨立啟動。後端未運行時，連線狀態區顯示尚未連線，頁面本身仍可載入。API_PROXY_TARGET 是開發代理設定，不放資料庫密碼或私密金鑰。

## 其他指令

    npm test
    npm run typecheck
    npm run build

目前已建立 React/TypeScript/Vite、Router、TanStack Query 與連線頁；會員／行情／圖表待後續實作。尚未成功下載依賴，因此未完成 Vite build 或整站啟動驗證。

[前端設計](docs/frontend-plan.md) · [API 契約](../backend/docs/api-contract.md)
