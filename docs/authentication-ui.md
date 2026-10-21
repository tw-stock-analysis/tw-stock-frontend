# 前端登入與裝置管理

本輪完成四項既有後端認證能力的 UI：登入、重新整理後還原身分、登出／過期清理，以及登入裝置管理。不新增後端端點或資料表，公開註冊、信箱驗證、忘記密碼與寄信流程仍待後續。自選清單頁維持明確的既有示範內容。

## 使用方式

1. 啟動已完成 Alembic migration 的後端，準備 active 且已驗證 Email 的帳號；獨立開發資料庫可依後端認證文件的可信腳本準備測試帳號。
2. 前端設定 FRONTEND_PORT=3007、API_PROXY_TARGET=http://127.0.0.1:8000，執行 npm run dev。
3. 開啟 http://localhost:3007/login。登入後預設進入 /account/sessions；從其他頁面點登入，成功後返回原本的站內頁面。
4. 右上角可進入登入裝置或登出。裝置頁顯示本人有效紀錄，標示目前裝置、瀏覽器資訊、IP、建立／最近活動／到期時間；所有時間顯示 Asia/Taipei。
5. 登出其他裝置成功後會重新取得清單，保留目前裝置。已被撤銷的裝置在下一次私人請求或重新整理時要求重新登入。

Vite／正式 Nginx 都透過同源 /api 代理，前端不直接呼叫另一個來源的後端。後端 AUTH_ALLOWED_ORIGINS 須包含實際瀏覽器入口；開發預設已包含 localhost／127.0.0.1 的 3007 與 Nginx 8080。正式環境使用 HTTPS 與 Secure Cookie，來源設定不會自動開啟 CORS。

## 路由與 HTTP 契約

| UI | API | 行為 |
| --- | --- | --- |
| /login | POST /api/v1/auth/login | JSON email／password，成功後只使用公開 user 資訊；Cookie 由瀏覽器處理 |
| 共用帳號狀態 | GET /api/v1/me | 開啟頁面時確認身分；401 SESSION_INVALID 視為未登入，503／網路失敗另顯示服務錯誤 |
| 右上角登出 | POST /api/v1/auth/logout | 不傳 body；204 後清除本機私人狀態，私人頁返回登入 |
| /account/sessions | GET /api/v1/me/sessions | 只顯示本人的有效裝置，支援明確的手動重新取得 |
| 登出其他裝置 | POST /api/v1/me/sessions/revoke-others | 不傳 body；204 後依序重新讀取裝置清單 |

認證 fetch 明確設定 credentials: same-origin、cache: no-store；POST 帶 Content-Type: application/json 與 X-CSRF-Protection: 1。Origin 由瀏覽器提供，JavaScript 不自行設定 Cookie／Authorization Header，也不讀取 Session Token。204 不解析 JSON。

## 狀態、失敗與資料清理

- AuthStore 由 AuthProvider 持有，僅存在目前頁面記憶體；不使用 localStorage、sessionStorage 或 React Query 儲存帳號／Token。密碼不放進 React state、URL、日誌或回應錯誤中，送出後立即清空輸入框。
- 開始時為 checking；成功取得 /me 才是 authenticated。缺少／失效 Session 為 anonymous；服務錯誤為 error，不假裝登入成功或靜默回退舊使用者。
- RequireAuth 只保護裝置管理頁。服務失敗提供手動重試；公開行情與示範頁不因登入檢查失敗而被強制導向登入。
- 所有私人操作經過 privateRequest；401 SESSION_INVALID 會清除使用者、取消未完成私人請求、卸載私人畫面並回到登入。其他錯誤（例如 503）不誤清除有效登入。
- 登入／登出切換會遞增版本並取消舊請求；過期的成功或 401 回應不能覆蓋新的登入狀態或重新顯示舊資料。離開裝置頁亦取消尚未完成的讀取。
- 登出等待時先卸載私人頁；成功才顯示已登出。若連線或服務失敗，明確告知未完成，保留身分供重試，重新取得私人資料。
- 裝置讀取或撤銷開始時移除舊清單；來源失敗顯示錯誤與手動重試，不保留舊裝置資料充當成功結果。不自動重試、輪詢或快取。
- 每個認證 HTTP 請求最多等待 15 秒，逾時釋放操作狀態並提供錯誤；重複點擊不會送出重複登入／撤銷操作。
- 登入 return path 僅允許已知站內路由，先正規化 dot segments，拒絕外站、雙斜線、反斜線、控制字元及登入迴圈。

## 驗證

2026-10-21：前端 111 項測試通過，包含原有 75 項公開行情／導覽測試；TypeScript 與正式編譯通過。認證測試涵蓋 Cookie／CSRF 呼叫契約、204、錯誤訊息、登入狀態還原、私人路由、逾時、操作重複與舊請求競態。公開行情測試仍使用原有 synthetic transport，沒有修改應用程式市場資料政策。

另以真正 Chromium → Vite 3007 → FastAPI 8000 → 獨立 PostgreSQL 驗證：

- 錯誤密碼與成功登入、HttpOnly Cookie、JavaScript storage 無憑證、重新整理還原身分。
- 兩個裝置登入、本人裝置列表與 204 撤銷；另一帳號保持登入，被撤銷裝置移除私人畫面。
- 僅調整獨立測試資料庫的 Session 期限，確認實際到期後的 401 會清除畫面與 Cookie。
- 注入登出網路失敗，確認可重試；實際 204 登出後清除 Cookie。注入 /me 503，確認公開頁面仍能使用。
- 桌面與 390px 手機排版、登入深連結、無水平溢出；沒有 JavaScript runtime error。
- 已完成的登入／登出 HTTP 請求實際攜帶同源 Origin 與 CSRF header。網路失敗的模擬請求不視為已送達後端。

本輪沒有重新驗證 44 個真實 TWSE 來源或部署到外部網站；驗證資料庫、帳號與瀏覽器環境皆為隔離測試用途。
