# SweepLog

期貨交易紀錄與覆盤工具。匯入 Topstep 報表、補上手動欄位與截圖，資料存在 Google 試算表。

- `web/`：前端（Vite + React + TypeScript + Tailwind），部署到 GitHub Pages
- `gas/`：後端（Google Apps Script，TypeScript + esbuild，用 clasp 推送）

接手開發或維護前，請先讀 [AGENTS.md](AGENTS.md)：架構、資料模型、不能破壞的規則、部署流程都在裡面。

## 開發

```bash
cd web
npm install
npm run dev
```

## GAS 首次設定

1. 開啟 Apps Script API：https://script.google.com/home/usersettings
2. 登入 clasp（會開瀏覽器授權）：

   ```bash
   cd gas
   npm install
   npx clasp login
   ```

3. 建立綁定試算表的 GAS 專案（只做一次，會產生 `gas/.clasp.json`）：

   ```bash
   npx clasp create-script --type standalone --parentId <試算表 ID> --title SweepLog --rootDir dist
   ```

4. 推送程式碼：`npm run push`
5. 在 Apps Script 編輯器（`npm run open`）執行 `initToken`，第一次會要求授權；執行紀錄裡的 `API_TOKEN` 就是網頁要填的 token。接著執行 `authorizeDrive` 授權截圖用的 Drive 權限
6. 發布 Web App：`npm run deploy`，輸出的網址填進網頁「設定」頁
7. 在網頁「設定」頁按「建立 / 檢查工作表」

之後改了 GAS 程式碼，執行 `npm run deploy` 就會更新同一個 Web App 網址。

## 注意

- repo 是公開的，**不要**把 Web App 網址或 token 寫進程式碼。它們只存在瀏覽器的 localStorage。
- `gas/.clasp.json`、`gas/.deployment.json` 已列入 `.gitignore`。
