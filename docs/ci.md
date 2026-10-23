# GitHub Actions CI

工作流程位於 [.github/workflows/ci.yml](../.github/workflows/ci.yml)，在 GitHub hosted Ubuntu 24.04 Runner 執行。

| 事件 | 執行內容 |
| --- | --- |
| 對 develop 或 master 建立／更新 PR | Vitest、型別檢查、正式建置、Docker 建置及 Nginx 啟動驗證 |
| push 到 develop、master 或 ci/** | 同上；ci/** 可在合併前直接驗證工作流程 |
| workflow_dispatch | 手動執行；工作流程合併至預設分支後可由 Actions 頁操作 |
| 其他功能分支的一般 push | 不觸發，建立 PR 後才執行 |

同一個 ref 的新執行取消舊執行。GitHub Token 僅有 contents: read，checkout 不保留 Git 憑證，Actions 固定完整 commit SHA。

## Frontend tests and production build

使用 Node 24，npm ci 依 package-lock.json 安裝依賴，再執行 npm test -- --maxWorkers=2 與 npm run build。Build 本身包含 tsc --noEmit，會檢查 TypeScript。

既有前端測試使用受控的 API 回應；不需要後端、資料庫、正式 Secrets 或真實 TWSE API。主機的 .env 不會傳入 GitHub Runner。

## Build and smoke-test Nginx image

測試通過後，使用既有 Dockerfile 建置 React 靜態檔與 Nginx 執行映像，只載入 Runner，不推送 Registry。BuildKit 快取只保存建置層。

[smoke_frontend.py](../.github/scripts/smoke_frontend.py) 實際啟動該映像，確認：

- /、/login、/account/sessions、/stocks/2330 直接存取會得到 SPA HTML，並使用 no-cache。
- index.html 引用的 JavaScript／CSS 可取得，使用 immutable 快取。
- 不存在的 /assets/nonexistent.js 回 404。

檢查不需要另一個儲存庫；不執行瀏覽器登入流程或整站 API 整合測試。結束時清除自己建立的容器，失敗時輸出 Nginx 日誌。

## 結果與後續發布

在 Actions 或 commit／PR 的 Checks 查看 test 與 docker job。CI 結果若要成為合併必要條件，需要另外設定 GitHub ruleset／branch protection。

GHCR 發布、與後端映像的版本配對、正式主機與 HTTPS 部署在下一階段處理。本輪不需要 Registry 或部署憑證。
