# 前端實作規格

本文件保存在前端專案內；啟動步驟見 [前端 README](../README.md)，共用 API 契約見 [後端 API 規格](../../backend/docs/api-contract.md)。

## 1. 頁面與路由

| 頁面 | 路由 | 內容與驗收 |
| --- | --- | --- |
| 首頁 | / | 搜尋入口、最近查看、資料狀態；登入後顯示自選摘要 |
| 搜尋 | /stocks?q=&market= | 代碼／名稱、上市／上櫃過濾；分頁與鍵盤選取 |
| 個股摘要 | /stocks/:instrumentId | 公司、現行代碼、市場、最新日價格、基本面摘要 |
| 基本面 | /stocks/:instrumentId/fundamentals | 月營收、EPS、估值、適用財報指標與表格 |
| 技術分析 | /stocks/:instrumentId/technical | 日 K、量能、MA／RSI／MACD／布林 |
| 自選股 | /watchlists/:id | 清單增刪改名、項目增刪與排序 |
| 帳號 | /login、/register、/verify-email | 登入、註冊、驗證信箱 |
| 重設密碼 | /forgot-password、/reset-password | 申請重設與設定新密碼 |
| 偏好 | /settings | 顯示名稱、主題、預設圖表期間、登出其他裝置 |

路由採穩定 instrumentId，畫面顯示 TWSE:2330 等人類可讀標示。股票代碼變更或上櫃轉上市不改變內部身分。無效 ID 顯示不存在，下市標的顯示下市狀態及可用歷史，不導向不相關股票。

訪客按加入自選先登入，成功返回原站內路徑，再顯示加入哪個清單的操作。returnTo 僅允許站內相對路徑。首頁市場指數及排行不是第一版必要內容，來源確認後再加。

## 2. 主要版面

桌面個股頁由上到下為：名稱／市場／報價與交易日 → 摘要／基本面／技術分析分頁 → 圖表與範圍控制 → 指標卡片與表格 → 來源及計算說明。所有資料區塊使用自己的資料日期，不能用單一「更新時間」涵蓋全部。

手機使用單欄，工具列收進展開區；財報表格在獨立容器橫向捲動並固定指標名稱，不讓整頁橫向溢出。圖表提供表格入口，對話框管理焦點，搜尋與分頁可用鍵盤。漲跌預設紅漲綠跌，另有正負號或文字，不能只靠顏色。

價格顯示台幣與適當小數位；營收可顯示億元但保留單位與精確值 tooltip；成交量 API 用股，畫面若改用張，明示 1 張=1,000 股。百分比 -0 顯示為 0；缺值顯示原因而不是 0。

## 3. 在現有骨架上逐步新增

| 目錄 | 責任 |
| --- | --- |
| src/app | router、QueryClient、provider、layout、route error boundary |
| src/pages（實作時新增） | 組合各 feature 的路由頁，保持精簡 |
| src/features/auth | 認證表單、me query、session 狀態 |
| src/features/stocks | 搜尋、摘要、識別與報價 |
| src/features/fundamentals | 營收／財報展示與欄位解釋 |
| src/features/technical | 圖表控制、指標顯示與 chart adapter |
| src/features/watchlists | 清單與項目操作 |
| src/features/settings | 偏好與帳號設定 |
| src/components | 共用 Button、Dialog、Tabs、Table、資料狀態元件 |
| src/services | 共用 HTTP client、錯誤轉換、產生的 OpenAPI client/types |
| src/hooks、src/types、src/lib | 真正跨功能的 hooks、型別與格式化；lib 隨實作新增 |

共用層不依賴 feature；feature 不跨層讀別人的內部檔案；pages 負責組合。每個 feature 需要時才分 api/components/hooks，不為每個小元件建立一整套多層目錄。前端所有直接對外請求都經自己的 /api/v1。

## 4. 狀態管理

| 狀態 | 唯一主要來源 |
| --- | --- |
| 股票、價格、財報、自選清單、me | TanStack Query |
| 搜尋、股票、頁籤、起訖日、指標組合、排序 | URL path/query |
| 對話框、表單草稿、十字游標、臨時縮放 | React state/ref |
| 已登入的長期偏好 | 後端 settings，Query 快取 |
| 訪客主題、最近查看 | 有大小限制的 localStorage；不放私人 API 資料 |
| 登入憑證 | HttpOnly cookie，由瀏覽器／後端管理 |

Router loader 可預取 Query，但不另維護一份股票資料快取。Query key 包含 instrumentId、日期、price_basis、指標參數；相同查詢回應中的 data_version 用來判斷批次更新與一致性，不要求前端事先知道版本才能發出首次請求。公開圖表資料可保留，私人 key 包含使用者 ID 且不持久化；登出／帳號切換取消私人請求並清除私人快取。

建議起始 staleTime：主檔 24 小時，基本面 1 小時，收盤行情 5 分鐘，自選股 30 秒。這些是前端重新驗證頻率，不代表來源同樣頻率更新。沒有必要每幾秒輪詢收盤資料。公開查詢限兩次網路／5xx 重試，401/403/404/422 不自動重試；429 尊重 Retry-After；修改請求預設不自動重送。[TanStack Query 預設行為](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)。

搜尋防抖起始值 250ms，切換條件透過 AbortSignal 取消舊請求。切股票時清楚切換股票標題與資料狀態，不能暫時把前一檔價格放在新股票名稱下。

## 5. 圖表

Lightweight Charts 第一版只處理日 K、量能、指標及簡單基本面時間序列；沒有另引入 ECharts。若分類柱狀比較確實需要，再評估擴充。套件不提供行情或完整指標服務，工具列、資料與算法屬本專案責任；須保留 NOTICE 及 TradingView 連結署名。[產品比較](https://tradingview.github.io/lightweight-charts/docs/product-comparison)、[官方使用要求](https://tradingview.github.io/lightweight-charts/docs)。

- 容器 mount 時建立 chart，後續更新 series；unmount 清除 instance、observer 與事件。
- 圖表日期用交易日期，不把日 K 轉成本機時區後移動一天。
- API decimal 字串只在 chart adapter 轉成 number，顯示精確值仍用原資料；圖表浮點值不回寫資料庫。
- 第一版預載近一年、最多兩年；畫面提供 3M／6M／1Y／2Y，不承諾無限向左載入。
- 指標前段不足、來源缺口或停牌使用不同狀態；不造假價格、不把 null 轉 0。
- 切指標保留可視範圍；換股票重設到所選期間；後端算好指標再繪圖。
- RSI／MACD 用副圖，手機預設一次一個副圖；布林與均線可疊加，避免預設所有線都打開。
- K 線與指標用同一個 chart-data response 及 data_version，避免混到不同批次。

## 6. 表單、認證與修改操作

表單用 React Hook Form + Zod 做即時提示，後端驗證仍是最終依據。建立表單前取得 CSRF token，存記憶體；所有修改請求帶 X-CSRF-Token。登入成功更新 token 與 me，再清舊私人查詢；401 清認證狀態並保留安全的回跳路徑。

CSRF 失效重新取得 token 後提示重送；不在不確定前次是否成功時自動重放非冪等新增。多人／多分頁 version 衝突先重新取得伺服器資料，再讓使用者重試，不能靜默覆蓋。

第一版自選股修改採 pending 狀態＋後端成功後更新，避免太早引入複雜 optimistic rollback；之後可對冪等單項操作加入樂觀更新。排序操作在確認後整批送出。刪除清單有站內確認對話框，空清單引導搜尋股票。

重設／驗證連結的 token 由 fragment 讀入記憶體後清除網址，以 POST 完成動作，避免郵件預覽掃描器的 GET 消耗 token。驗證頁不載入第三方追蹤。這些是未來產品互動設計，本輪不執行任何帳號操作。

## 7. 每個資料區塊的狀態

| 狀態 | 畫面行為 |
| --- | --- |
| 首次載入 | 固定尺寸 skeleton |
| 背景更新 | 保留已知資料，顯示更新中 |
| 合法空資料 | 說明未公告／新上市歷史不足／不適用 |
| 明確無成交 | 顯示該交易狀態，與擷取失敗分開 |
| 有舊資料但更新失敗 | 顯示最後資料日期、過期訊息與重試 |
| 完全不可用 | 區塊錯誤、request_id、重試入口 |
| 程式錯誤 | 局部 error boundary，其他區塊仍可讀 |

一般帳號錯誤使用不洩漏帳號存在與否的訊息；欄位錯誤固定留在欄位旁，不只用短暫 toast。計算缺值原因可點開讀取，不以紅色錯誤覆蓋正常的不適用資料。

## 8. 前端驗收

Vitest 驗證日期／金額格式與 URL 參數；Testing Library 驗證搜尋、表單、錯誤與登入狀態；Playwright 驗證手機及桌面的完整旅程。至少一條 E2E 使用真實測試 API 與 PostgreSQL，mock 只用來穩定特定狀態。公開股票頁若將來依賴 SEO，再另評估 SSR／預先渲染，不作為目前 SPA 骨架的前置條件。[React Router Data mode](https://reactrouter.com/start/data/custom)。
