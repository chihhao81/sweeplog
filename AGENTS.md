# AGENTS.md

給接手開發與維護 SweepLog 的 AI agent（與人類）的說明。環境設定步驟寫在 [README.md](README.md)；這份檔案寫的是**架構、做過的決定、不能破壞的規則，以及常見的維護流程**。

使用者是期貨交易者（Topstep 帳號，主要交易 MNQ，也有 MGC、MCL），用繁體中文溝通。UI 文字一律使用繁體中文。

## 專案概觀

匯入 Topstep 匯出的 CSV → 合併成「部位」→ 手動補上覆盤欄位與截圖 → 統計與覆盤。

```
web/   React 19 + TypeScript + Vite + Tailwind v4，部署到 GitHub Pages
gas/   Google Apps Script 後端（TypeScript → esbuild 打包 → clasp 推送）
```

- 資料存在使用者私人的 Google 試算表（GAS 綁定在這份試算表上）
- 截圖存在使用者的 Google Drive 資料夾 `sweeplog`，試算表只記錄檔案 ID
- 網站：https://chihhao81.github.io/sweeplog/（push 到 `main` 會自動部署）

## 資料流與安全模型

```
瀏覽器 ──POST text/plain {action, token, payload}──▶ GAS Web App ──▶ 試算表 / Drive
```

- GAS Web App 設定為「任何人都能存取」，並以部署者身分執行；**每個 action 都會檢查 token**（`gas/src/auth.ts`，token 存在 Script Properties 的 `API_TOKEN`）
- 前端 POST 要用 `Content-Type: text/plain`，才不會觸發 CORS preflight（GAS 無法回應 preflight）
- Web App 網址和 token **只存在瀏覽器的 localStorage**（`web/src/lib/settings.ts`）。repo 是公開的，絕對不能把它們寫進程式碼或 commit
- 試算表本身是私人的，不要改它的分享設定
- 截圖檔案在上傳時設為「知道連結的人可查看」，前端直接用 `drive.google.com/thumbnail?id=…` 顯示。這是使用者選擇的方案；另一個方案是透過 GAS 轉送 base64，比較私密但比較慢，目前沒有實作

## ⚠️ 不能破壞的規則

1. **Drive 安全**：GAS 只能開啟 `sweeplog` 資料夾、在裡面建立子資料夾和檔案，以及設定**剛建立的檔案**的分享權限。**絕對不能修改、移動、丟到垃圾桶或刪除任何已存在的 Drive 項目。** 「移除截圖」只會刪除試算表裡的紀錄（`Screenshots`、`PositionScreenshots`）。所有 Drive 程式碼都集中在 `gas/src/screenshots.ts`；新增 Drive 操作前要先問使用者
2. **匯入不能覆蓋手動欄位**：`upsertRows` 只會寫入傳進來的欄位。匯入時只能送出計算出來的欄位；手動欄位只能透過 `updatePosition` 寫入，而且有白名單（`MANUAL_POSITION_FIELDS`）
3. **不能 commit 交易資料**：`.gitignore` 已經排除 `*.csv`。使用者的範例檔 `trades_export.csv`、`orders_export.csv` 放在 repo 根目錄，只在本機使用
4. **不能 commit 個人 GAS 設定**：`gas/.clasp.json`（script ID）和 `gas/.deployment.json`（部署 ID）已經在 `.gitignore` 裡
5. **損益不能只靠顏色區分**：所有損益數字都要帶正負號，長條圖要從零軸延伸，日曆要顯示金額或符號（紅綠色盲也看得出來）

## 領域邏輯（重要）

### Topstep CSV（`web/src/lib/topstep/parse.ts`）
- 會依欄位名稱自動判斷是 Trades 還是 Orders 報表；時間格式是 `MM/DD/YYYY HH:mm:ss +08:00`，轉成 ISO 字串時保留原本的時區偏移
- **Trades 報表沒有帳號欄位**，帳號一律從 Orders 帶入（Orders 只能有一個帳號）。`lastAccount()` 只用來給每日日誌當預設帳號
- **匯入一定要 Trades 和 Orders 兩份一起**（`ImportPage` 的 `canImport`）。停損、目標價和 R 值只用這次選的檔案計算，不會讀試算表裡既有的資料，所以只匯入一份會留下永遠補不回來的空值
- Trades 報表裡每一筆是**一口合約**，已經依 FIFO 配對好進出場
- 淨損益 = `PnL − Fees − Commissions`（已經和使用者確認過，沒有重複扣除）

### 部位（`web/src/lib/topstep/positions.ts`）
- 同商品、同方向，且進場時間早於目前部位最後一次出場時間的 trade，合併成同一個**部位**。這是手動欄位和截圖的單位，`positionId` = 第一筆 trade 的 ID
- 用範例資料驗證過：493 筆 trade 合併成 399 個部位，剛好對上 Orders 裡的停損/停利單組數
- 停損價和目標價取自部位期間**最早建立**的 `StopLoss` / `TakeProfit` 單。TopstepX 移動停損時會沿用同一張單，所以報表裡的價格是**最後位置**，不一定是原始停損
- `autoRisk` 是每口從進場價到停損價的金額加總；停損如果已經移到保本或獲利那一側，就是 null。手動填的 `riskOverride` 優先於 `autoRisk`，R = 淨損益 ÷ 風險金額
- 每點價值寫在 `web/src/lib/topstep/contracts.ts`，新增商品要補在這裡

### 時段（`web/src/lib/sessions.ts`）
- 依**紐約時間**分類（會自動處理美國夏令時間）：Asia 18–02、London 02–07、NY AM 07–12、NY Lunch 12–13:30、NY PM 13:30–17、其他時間歸為 Other
- 顯示時會加上台灣時間。單筆交易用**交易當天的季節**換算；統計表或篩選器裡的群組如果同時有夏令和冬令的交易，就兩種時間都列
- 時段是匯入時算好存進試算表的。如果要改時段的切分方式，需要做一個重新計算的機制（目前沒有）

### 成就與經驗值（`web/src/lib/xp.ts`）
- 全部在前端從 Positions + DailyJournal 依時間重播算出來，沒有存進試算表；改舊的覆盤，經驗值就會重算
- **損益完全不影響經驗值**（使用者的決定：照計畫之後的輸贏不是自己能決定的）。只看照計畫、評級、情緒、錯誤標籤、每日日誌和過度交易
- 使用者要求**懲罰要非常重**：沒照計畫 −150、C 級 −100、嚴重錯誤 −100，不要調輕。經驗值可以變成負的（Lv.0「爆倉」）
- 只有填了 `grade` 和 `followedPlan` 的部位才計分；計分規則對話框直接讀 `xp.ts` 的常數，改規則只要改常數
- 計分起點（既往不究）：`Settings` 工作表的 `xpStartDate`，這天之前的交易日完全不計分，也不算待覆盤。存在試算表是為了讓手機和電腦一致
- 裝備的封號存在 localStorage（`sweeplog.title`）

### 截圖
- 上傳前會在瀏覽器壓縮（最長邊 1920px、轉 WebP），存到 Drive 的 `sweeplog/YYYY/MM/`
- 截圖和部位是多對多關係（`PositionScreenshots`），一張圖可以涵蓋好幾筆交易

## 試算表結構

工作表結構寫在 `gas/src/schema.ts`（欄位型別是 text / number / bool，text 欄位會設成純文字格式，避免 Google 把 ID 或時間自動轉成其他格式）。

| 工作表 | 主鍵 | 內容 |
|---|---|---|
| Trades | id | Topstep 每口成交，含 `positionId` |
| Orders | id | Topstep 訂單 |
| Positions | positionId | 計算欄位 + 手動欄位（`riskOverride` 以後都是手動） |
| DailyJournal | `date\|accountName` | 每日日誌 |
| Screenshots | id (UUID) | Drive 檔案 ID、日期、說明 |
| PositionScreenshots | `positionId\|screenshotId` | 關聯表 |
| Settings | key | `options`：下拉選項的 JSON；`xpStartDate`：經驗值計分起點 |
| Accounts | accountName | 沒有使用（使用者決定不做 Topstep 規則追蹤） |

**修改結構時**：在 `schema.ts` 新增欄位，部署 GAS 後請使用者到網頁「設定」頁按「建立 / 檢查工作表」。已經有資料的工作表只會在最後面補上新欄位，不會刪除或重新排列；沒有資料的工作表會重建標題列。**不要改名或刪除已經有資料的欄位**。

## GAS actions（`gas/src/index.ts` 的 `ACTIONS`）

`ping`、`setup`、`existingIds`、`importData`、`listPositions`、`updatePosition`、`listTrades`、`listJournal`、`saveJournal`、`getOptions`、`saveOptions`、`getSettings`、`saveSetting`（單一值設定，只接受 `SETTING_KEYS` 裡的 key）、`uploadScreenshot`、`listScreenshots`、`updateScreenshot`、`deleteScreenshot`（只刪紀錄）、`exportAll`（唯讀）。

前端對應的呼叫在 `web/src/lib/api.ts`，React Query hooks 在 `web/src/lib/queries.ts`。新增 action 時兩邊都要改。寫入類的 action 要包在 `withLock` 裡。

編輯器裡可以手動執行的函式：`initToken`（產生新 token，舊的會失效）、`showToken`、`setupSheets`、`authorizeDrive`（重新取得 Drive 權限）。新增這類函式時，也要加到 `gas/build.mjs` 的 `ENTRY_POINTS`。

## 常用指令

```bash
# web
cd web && npm run dev      # http://localhost:5173/sweeplog/
cd web && npm test         # vitest（解析、部位、統計、時段）
cd web && npm run build && npm run lint

# gas（需要先 npx clasp login）
cd gas && npm run build    # 型別檢查 + 打包
cd gas && npm run deploy   # 推送並更新同一個 Web App 部署（網址不變）
```

- 改了 `gas/` 的程式碼，一定要執行 `npm run deploy`。只執行 `push` 不會更新 Web App，它跑的是固定版本
- `web/` push 到 `main` 後，`.github/workflows/deploy-pages.yml` 會自動部署
- **版號**在 `web/package.json` 的 `version`（顯示在側邊欄底部和手機版上方列，讓使用者確認裝置上是不是最新版）。每次 push 網頁的改動都要升版：修正升 patch、新功能升 minor，用 `cd web && npm version <patch|minor> --no-git-tag-version`（會一起更新 package-lock.json）
- 每次改完都要跑 `npm test`、`npm run build`、`npm run lint`

## 已知的坑

- **clasp 3 的 `create-script --type sheets` 會忽略 `--parentId`**，改去建一份新的試算表。要綁定既有的試算表，必須用 `--type standalone --parentId <試算表 ID>`
- **新增 OAuth 權限後**，使用者要在 Apps Script 編輯器重新整理並執行一次 `authorizeDrive`（或其他會用到新權限的函式），授權畫面要全部勾選。Google 的授權畫面可以逐項勾選，漏勾會導致「只有唯讀權限」之類的錯誤
- **換電腦時**：`gas/.clasp.json` 可以用 `{"scriptId": "<script ID>", "rootDir": "dist"}` 重建（script ID 可以在 Apps Script 編輯器網址或專案設定中找到）。`gas/.deployment.json` 可以用 `npx clasp deployments` 找出部署 ID 後重建：`{"deploymentId": "<ID>"}`。用錯部署 ID 會產生新的網址，使用者就得在每台裝置重新設定
- **用 hash 路由**（`#/day/2026-10-21?open=…`），是為了讓 GitHub Pages 重新整理時不會 404
- **PWA 只快取網頁本身**，GAS 的 POST 請求一律走網路

## 沒有 token 時怎麼在瀏覽器驗證 UI

agent 通常拿不到使用者的 token，而且不能把真實交易資料放進開發伺服器。驗證方式：在開發伺服器的頁面裡，先在 localStorage 寫入假的連線設定，再覆寫 `window.fetch`，依 request body 的 `action` 回傳**合成的假資料**，接著切換 hash 讓頁面重新抓資料。驗證完要刪掉 `sweeplog.connection` 並重新整理。

## 使用者已經做的決定

- 不做 Topstep 規則追蹤，用 Topstep 官方的儀表板就好
- Setup 預設選項：破底翻、互換、摸摸、亂打。其他選項可以在網頁設定頁修改，存在 `Settings` 工作表
- 截圖用「知道連結的人可查看」的方式顯示（方案 A）
- 在交易列表點一筆交易，會直接進到那天並展開那筆

## 程式慣例

- 顏色一律用 `web/src/index.css` 的語意 token（`bg-surface`、`text-profit`、`text-loss`…），不要寫死色碼。只有深色主題
- 共用元件：`components/ui.tsx`（Card、Button、Field、ErrorBox、Spinner）、`components/form.tsx`（ChipSelect、ChipMulti、Scale、YesNo…）
- 純邏輯放在 `web/src/lib/` 並寫測試；頁面放在 `web/src/pages/`
- 註解用英文，UI 文字用繁體中文
- Commit 訊息用英文，結尾加上 `Co-Authored-By` 行
