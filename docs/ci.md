# GitHub Actions CI

工作流程位於 [.github/workflows/ci.yml](../.github/workflows/ci.yml)，在 GitHub hosted Ubuntu 24.04 Runner 執行。

| 事件 | 執行內容 |
| --- | --- |
| 對 develop 或 master 建立／更新 PR | Vitest、型別檢查、正式建置、Docker 建置及 Nginx 啟動驗證 |
| push 到 develop、master 或 ci/** | 同上；ci/** 可在合併前直接驗證工作流程 |
| workflow_dispatch | 手動執行；工作流程合併至預設分支後可由 Actions 頁操作 |
| 其他功能分支的一般 push | 不觸發，建立 PR 後才執行 |

同一個 ref 的新執行取消舊執行。測試與 Docker job 的 GitHub Token 僅有 contents: read；獨立 publisher job 才取得 packages: write，且只接受 develop／master／ci/ghcr-release 的 push。PR 不發布映像。Checkout 不保留 Git 憑證，Actions 固定完整 commit SHA。

## Frontend tests and production build

使用 Node 24，npm ci 依 package-lock.json 安裝依賴，再執行 npm test -- --maxWorkers=2 與 npm run build。Build 本身包含 tsc --noEmit，會檢查 TypeScript。

既有前端測試使用受控的 API 回應；不需要後端、資料庫、正式 Secrets 或真實 TWSE API。主機的 .env 不會傳入 GitHub Runner。

## Build and smoke-test Nginx image

測試通過後，使用既有 Dockerfile 建置 React 靜態檔與 Nginx 執行映像，先載入 Runner 進行驗證。BuildKit 快取只保存建置層。

[smoke_frontend.py](../.github/scripts/smoke_frontend.py) 實際啟動該映像，確認：

- /、/login、/account/sessions、/stocks/2330 直接存取會得到 SPA HTML，並使用 no-cache。
- index.html 引用的 JavaScript／CSS 可取得，使用 immutable 快取。
- 不存在的 /assets/nonexistent.js 回 404。

檢查不需要另一個儲存庫；不執行瀏覽器登入流程或整站 API 整合測試。結束時清除自己建立的容器，失敗時輸出 Nginx 日誌。

## GHCR 發布

develop／master 與 ci/ghcr-release 的 push 通過檢查後，Docker job 將已驗證的映像保存為一天期 artifact。獨立 publisher job 下載、核對 source revision，再使用 GITHUB_TOKEN 登入 ghcr.io；發布過程不重新建置。

映像名稱為 ghcr.io/tw-stock-analysis/tw-stock-frontend，包含：

- run-RUN_ID-RUN_ATTEMPT：本次執行的獨立標籤。
- sha-COMMIT_SHA：追查原始碼的標籤；重跑同一 commit 時可能更新。
- develop／master：各分支最近一次通過檢查的映像，只有對應分支能更新。

ci/ghcr-release 不更新 develop 或 master 標籤。發布後以 digest 拉回映像，比對 image ID，並將 ghcr.io/...@sha256:... 寫入 Actions 摘要及 image-release-COMMIT_SHA artifact。正式部署固定使用 digest，前後端版本分別指定。

GITHUB_TOKEN 由 Actions 自動提供，不需要另存 Registry 密碼。新 package 維持 GitHub 預設可見性；本流程不變更公開／私人設定。部署主機若拉取私人 package，需要另準備有 read:packages 權限的憑證並執行 docker login ghcr.io。

## 結果與後續部署

在 Actions 或 commit／PR 的 Checks 查看 test、docker 與 publish job。CI 結果若要成為合併必要條件，需要另外設定 GitHub ruleset／branch protection。

後端儲存庫的 docker-compose.deploy.yml 使用前後端各自的 digest，提供正式 HTTPS 入口與獨立資料庫。正式主機尚未建立，本流程只發布映像，不透過 SSH 部署或合併分支。
