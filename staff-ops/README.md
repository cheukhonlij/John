# TODAY'S FOOD LAB · 員工營運系統

俾全體員工用嘅營運系統。另外有一頁 **開單台**（`/invoice`，只限老闆），員工同其他主管都睇唔到。
員工見到嘅頁面冇客戶價錢、冇貨品售價、冇人工資料。

## 功能

| 頁面 | 內容 |
| --- | --- |
| 今日 | 今日返工、放假、未完成工作、要補貨、聽日更表、下個法定假日 |
| 排更 | 每週更表、常用更份、複製上週、整週排更、列印；兼職顯示近 4 星期工時（468 規則） |
| 每日流程 | 按時間嘅工作清單，打剔記錄邊個幾點做；連結相關 SOP；可列印 |
| 倉存／入貨落貨 | 現有存貨、安全存量提示、入貨（批次／到期日）、落貨、損耗、盤點、紀錄 |
| 假期 | 申請及批核、年假／病假結餘（按《僱傭條例》計）、2026–2027 法定假日 |
| SOP | 標準作業程序，可搜尋、編輯、列印 |
| 員工 | 全職／兼職、入職日期、休息日、公司額外年假 |

## 兩種模式

| | 雲端模式（Firebase） | 單機模式 |
| --- | --- | --- |
| 幾時用 | 填咗 `.env.local` 嘅 Firebase 設定 | 冇填 Firebase 設定 |
| 資料 | Firebase 雲端，所有手機／電腦即時同步，冇網絡都用得 | 只存喺嗰部機嘅瀏覽器 |
| 登入 | 每個同事有自己嘅用戶名＋密碼 | 冇登入，頁頂揀「我係」 |
| 主管權限 | 主管帳戶；由 Firebase 保安規則喺伺服器把關 | 4 位數 PIN（只防誤改） |

### 權限（雲端模式）

- **員工**：睇所有資料、打剔每日流程、記錄入貨／落貨／損耗／盤點、申請假期（同取消自己未批嘅申請）、改自己密碼。
- **主管**：以上全部，加排更、批假、改 SOP／流程／貨品清單／法定假日、開同停用員工帳戶、備份。
- **老闆**（做「首次設定」嗰個帳戶）：以上全部，加 **開單台**：客戶、客戶專屬價、開單、飯票、月結、PDF。
  其他主管同員工睇唔到開單台分頁，就算直接打 `/invoice` 都讀唔到任何資料（由保安規則把關）。

### 開單台（只限老闆）

- 員工系統頁頂最右邊有「開單台 🔒」分頁，只有老闆帳戶見到。
- 第一次用：開單台 → ⚙ 設定 → **匯入開單台備份**，揀之前開單台（Mac 本機版或者 Claude 版）匯出嘅 `.json`。
  匯入只會新增或者覆蓋，唔會刪除。
- 單號格式：年份＋日＋月＋三位流水號（例如 7/3/2026 第一張 = `20260703001`），同一日內自動遞增，電腦同手機同時開單都唔會撞號。
- 備份：開單台 → ⚙ 設定 → 下載備份檔。

規則寫喺 [`firestore.rules`](./firestore.rules)。單係喺 Firebase 註冊冇用：要主管開通帳戶先睇到資料。

## 設定 Firebase（一次過，大約 15 分鐘）

1. **開項目**：去 <https://console.firebase.google.com> → 「新增專案」（例如 `todays-staff-ops`）。Google Analytics 可以唔開。
2. **開登入**：左邊「Authentication」→「開始使用」→「登入方式」→ 啟用「電子郵件/密碼」。
3. **開資料庫**：左邊「Firestore Database」→「建立資料庫」→ 位置揀 **asia-east2（香港）** → 揀「正式版模式」。
4. **攞設定**：⚙️「專案設定」→「一般」→「你的應用程式」→ 按 `</>` 加一個網頁應用程式 → 複製 `firebaseConfig` 入面四個值，
   喺 `staff-ops/` 開一個 `.env.local`（參考 `.env.example`）：
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_APP_ID=...
   ```
   呢四個值唔係密碼，放喺網頁入面係正常；真正保護資料嘅係保安規則。
5. **上載**（喺電腦終端機）：
   ```bash
   cd staff-ops
   bun install                      # 或 npm install
   npx firebase-tools login         # 用開項目嗰個 Google 帳戶登入
   npx firebase-tools use --add     # 揀啱啱開嘅項目
   bun run deploy                   # build + 上載網站同保安規則
   ```
   完成後會顯示網址，例如 `https://todays-staff-ops.web.app`。
6. **首次設定**：用瀏覽器打開網址 → 「首次設定」→ 輸入你嘅姓名、用戶名、密碼 → 建立主管帳戶。
   系統會自動放入 SOP、每日流程、貨品清單、更份同法定假日，你可以直接改。
7. **開同事帳戶**：「員工」頁加員工 →「設定 → 員工帳戶」幫每個同事開用戶名同初始密碼。同事登入後可以自己改密碼。
   之後打開網址 → 手機瀏覽器「加至主畫面」，用落就似 app 咁。

> 首次設定只可以做一次（第一個帳戶會成為主管），所以上載完請即刻做第 6 步。

### 費用

用 Firebase 免費方案（Spark）就夠：每日 5 萬次讀取、2 萬次寫入、1 GB 資料。
為咗慳讀取，系統只會即時同步最近 8 星期更表、2 星期流程打剔同 60 日倉存紀錄；睇更早嘅資料時先會載入。

### 常見問題

- **同事忘記密碼**：主管喺「設定 → 員工帳戶」將舊帳戶改做「已停用」，再開一個新用戶名。
- **由單機版轉上雲端**：喺單機版「設定 → 匯出備份」，再喺雲端版「設定 → 由備份還原」。
- **存貨數字唔對**：「設定 → 重新計算存貨」會由全部紀錄重新計。

## 自動上載（GitHub）

設定好之後，喺 GitHub 合併（Merge）改動，網站同保安規則就會自動上載，唔使再開電腦行 `bun run deploy`。
每個改動到 `staff-ops/` 嘅 PR 亦會自動做 TypeScript 檢查、build 同保安規則測試。
未設定之前，檢查照做，上載會自動跳過。

**A. 整一條 Google 服務帳戶金鑰（約 5 分鐘）**

1. 打開 <https://console.cloud.google.com/iam-admin/serviceaccounts>，用開 Firebase 嗰個 Google 帳戶登入，左上角揀專案 `todays-staff-ops`。
2. 撳「建立服務帳戶」（Create service account）。名稱輸入 `github-deploy`，撳「建立並繼續」（Create and continue）。
3. 「角色」（Role）搜尋並揀 **Firebase Admin**，撳「繼續」→「完成」（Done）。
4. 喺列表撳 `github-deploy@…` →「金鑰」（Keys）分頁 →「新增金鑰」（Add key）→「建立新的金鑰」→ 揀 **JSON** →「建立」。
   電腦會下載一個 `.json` 檔。呢個檔等於一條鎖匙，唔好傳俾任何人。

**B. 喺 GitHub 加兩個 secret（約 3 分鐘）**

1. 打開 <https://github.com/cheukhonlij/John/settings/secrets/actions>，撳「New repository secret」。
2. Name 填 `FIREBASE_SERVICE_ACCOUNT`；Secret 貼上 A 步個 `.json` 檔嘅全部內容（用記事本／文字編輯打開再全選複製）→「Add secret」。
3. 再撳「New repository secret」：Name 填 `STAFF_OPS_ENV`；Secret 貼上電腦 `staff-ops/.env.local` 嘅全部內容 →「Add secret」。
4. 刪除電腦入面下載咗嘅 `.json` 金鑰檔。

**C. 試一次**

1. 打開 <https://github.com/cheukhonlij/John/actions>，左邊揀「staff-ops」，右邊撳「Run workflow」→ 揀 `main` →「Run workflow」。
2. 等 3–5 分鐘：綠色 ✓ 即係上載成功；紅色 ✗ 就撳入去，將錯誤畫面截圖俾 Claude 睇。

以後改完功能，只要喺 GitHub 合併 PR，幾分鐘後網站就會自動更新。

## 開發

```bash
bun run dev        # http://localhost:3001（冇 .env.local 就係單機模式）
bun run lint       # TypeScript 檢查
bun run test:rules # 保安規則測試（用 Firebase 模擬器，需要 Java）
bun run emulators  # 本機 Firebase 模擬器；.env.local 加 VITE_FIREBASE_EMULATOR=true 就會連去模擬器
```

## 計算規則（只供參考，以勞工處為準）

- 年假：做滿第 1、2 年各 7 日，之後每年加 1 日，最多 14 日。
- 有薪病假：首 12 個月每月累積 2 日，之後每月 4 日，最多 120 日。
- 連續性合約（2026 年 1 月 18 日起）：每週 17 小時或每 4 星期合共 68 小時。
- 法定假日：2026、2027 年各 15 日（`src/data/defaults.ts`，可喺「假期 → 法定假日」修改）。
