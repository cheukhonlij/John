# CLAUDE.md

Notes for Claude sessions working in this repository. Read before changing anything.

## Who this is for

The owner is John (TODAY'S FOOD LAB, a food production company in Hong Kong). He is
not a programmer and writes in Cantonese. Reply in Hong Kong Cantonese with Traditional
Chinese characters, in plain words, and explain what he has to click or run step by step.

## Two separate apps — keep them apart

| Folder | App | Users | Hosting |
| --- | --- | --- | --- |
| repo root (`src/`, `index.html`) | Older B2B invoice generator (Google AI Studio) | Owner only | Google AI Studio / Cloud Run |
| `staff-ops/` | Staff operations: roster, leave, daily workflow, SOP, inventory | All staff | Firebase Hosting (`todays-staff-ops`) |
| `staff-ops/invoice.html` + `staff-ops/src/invoice/` | 開單台 invoice system: customers, customer prices, invoices, meal tickets, PDFs | **Owner only** | Same Firebase site, at `/invoice` |

- Staff, and managers other than the owner, must never see customer prices, product prices or
  salaries. At John's request (Oct 2026) the 開單台 invoice system lives inside `staff-ops/` as a
  separate page, locked to the owner: the account that did first-time setup
  (`config/bootstrap.by`) while it is still a manager. `firestore.rules` `isOwner()` guards every
  `inv*` collection; `tests/rules.test.mjs` checks that a second manager, staff and strangers are
  denied. The 開單台 tab in the staff app is only a link and is shown to the owner only.
- Invoice data (customers, prices, invoices, company bank details) lives only in Firestore. Never
  put it in `src/`, `invoice.html`, tests or commits: the page code is public. Load data with
  開單台 → ⚙ 設定 → 匯入開單台備份 (JSON exported by the 開單台 local or Claude version; adds or
  overwrites by id, never deletes).
- `src/invoice/*.js` is plain JavaScript on purpose (ported from the standalone 開單台): it is not
  in the TypeScript check. Invoice numbers are `YYYY` + `DD` + `MM` + 3-digit daily sequence
  (John's existing format), issued by a Firestore transaction on `invCounters/{YYYYDDMM}`.
- The root app keeps its own `package.json`, lockfile and build; the root `tsconfig.json` excludes
  `staff-ops/`. Nothing from the root app is imported into `staff-ops/`, and `staff-ops/` stores no
  pay data.

## Confidential content — never commit it

The company's SOPs and production process details (e.g. the chicken breast SOP) are
confidential ("所有工作流程未經同意不得流出、轉載、分享").

- Never put them in the repo, in `staff-ops/src/data/defaults.ts`, in tests or in commit
  messages. Anything in `src/` ships in the public JavaScript bundle, readable without login.
- To load real content, generate a backup-format JSON file outside the repo and have a manager
  import it in the app: 設定 → 由備份還原. Format: `{"app":"todays-staff-ops","version":1,
  "data":{"<storage key>":[...records]}}` with keys from `staff-ops/src/utils/storage.ts`.
  Cloud restore adds or overwrites by id and never deletes; browser-only restore replaces each
  included list, so include the full list for that key. Reuse a record's id to replace it.
- `defaults.ts` holds generic sample data only.

## staff-ops architecture

React 19 + TypeScript (strict) + Vite 6 + Tailwind CSS 4 + lucide-react, managed with bun.

- Two modes, picked at build time by `staff-ops/.env.local` (`VITE_FIREBASE_*`, see `.env.example`):
  - Cloud mode (production): Firebase Auth (username + password; usernames map to
    `<name>@staff.todaysfoodlab.app`) and Firestore with live sync and offline cache.
  - Browser-only mode: localStorage on one device, manager mode behind a PIN.
- `src/data/store.ts` gives both modes one `AppData` shape (arrays plus `save*` functions that take
  the whole new array). `useCloudCollection` in `src/lib/cloud.ts` diffs against the records that
  render saw, so another device's new records are never deleted. Components should not care
  which mode is running.
- Cloud mode keeps only recent shifts (56 days), workflow ticks (14 days) and stock movements
  (60 days, plus batches near expiry) live; screens widen the window through `data.history`.
- Stock totals live in `stockLevels/{itemId}` and are incremented in the same batch as each
  movement (`stockLevelOps`); Settings → 重新計算存貨 rebuilds them from all movements.
- `firestore.rules` is the real permission check. Staff read everything and may create workflow
  ticks, stock movements and pending leave; managers do everything else. The first account
  becomes manager exactly once via `config/bootstrap`; that account is also the owner who alone
  can use 開單台 (`inv*` collections). Any new collection needs a rules block and a case in
  `tests/rules.test.mjs`.
- Production data already exists in Firestore. Schema changes must stay compatible with existing
  documents (add optional fields; never rename or repurpose fields without a migration).
- Delivery notes (送貨單, `src/components/DeliveryNotes.tsx`): `deliveryCustomers` holds name, contact,
  phone and address only, copied from 開單台 `invCustomers` under the same id when the owner saves a
  customer (and re-synced each time 開單台 opens); managers can also add them. `deliveryNotes` are
  created by managers, either in the staff app (lines are stock items) or by the owner in 開單台 →
  送貨單 (lines carry the invItem `productId` plus the mapped stock `itemId`, empty when unmapped; the
  staff app does not edit those notes). Staff may only sign a pending note once (rules limit the changed
  keys). Signing writes `out` movements with ids `mv_<noteId>_<line>` for lines that have a stock item.
  開單台 → 匯入送貨單 resolves each line to an invItem (by `productId`, then `stockItemId`, then name),
  sums a month's signed notes per product into invoice lines and sets `invoiceId`/`invoiceNo` on the
  notes; deleting the invoice clears them. Cloud mode keeps notes from the last 62 days plus all pending
  ones live. 開單台 prints notes and makes their PDFs (`dnDocHTML`) through the same helpers as invoices
  (`printHTML`, `exportDocPDF`); neither app lets anyone edit a signed note.
- 每日流程 (`src/components/DailyWorkflow.tsx`): from the `lg` breakpoint it is an hour × area grid
  (area colours in `AREA_STYLES`); managers drag cards in 編排時間表 mode, moves wait until
  儲存時間表 and change the recurring task itself (a moved task keeps its minutes). Below `lg` it is a
  list grouped by hour with large tick boxes. The paper checklist is a separate print-only block.
- Leave and labour-law logic is in `src/utils/leave.ts` (HK Employment Ordinance: annual leave
  7→14 days by service year, sick-day accrual capped at 120, continuous contract = 68 hours in
  4 weeks from 18 Jan 2026). Statutory holidays are listed for 2026–2027 in `defaults.ts`;
  they need adding each year (Good Friday becomes statutory in 2028).

## UI text

- All UI text is Hong Kong Cantonese in Traditional Chinese. Match the existing tone (「撳」「睇」「嘅」).
- Type Chinese characters directly. Do not hand-write `\uXXXX` escapes: earlier sessions produced
  wrong look-alike characters that way (撳, 俾, 冇, 啱 and 剔 each came out as a different
  character, one of them vulgar). Proofread every Chinese string you add.

## Commands (run inside `staff-ops/`)

```bash
bun install            # dependencies (use bun; bun.lock is the lockfile)
bun run lint           # TypeScript check
bun run build          # production build into dist/
bun run test:rules     # Firestore rules tests on the emulators (needs Java)
bun run dev            # dev server on :3001 (browser-only mode without .env.local)
bun run emulators      # local Firebase emulators; set VITE_FIREBASE_EMULATOR=true in .env.local
```

Before pushing: lint, build and rules tests must pass. For UI changes, also run the app and click
through the change in both modes (cloud mode against the emulators). In Claude Code cloud sessions
Chromium for Playwright is preinstalled at `/opt/pw-browsers`.

## Deploying

- `.github/workflows/staff-ops.yml` checks every pull request that touches `staff-ops/` and, on
  push to `main`, deploys the website and `firestore.rules` to Firebase.
- Deploying needs repository secrets `STAFF_OPS_ENV` (contents of `.env.local`) and
  `FIREBASE_SERVICE_ACCOUNT` (service account JSON key with the Firebase Admin role). Without them
  the deploy job skips itself. Setup steps are in `staff-ops/README.md`.
- Manual fallback from the owner's computer: `bun run deploy` (or `npm run deploy`).
