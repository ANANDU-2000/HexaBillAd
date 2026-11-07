# LOOP-STATE: UI/UX + Performance loop memory

Save as `docs/uiux/LOOP-STATE.md`. This file is the loop's **only memory between sessions**. The agent reads it first and writes it last, every iteration. Keep it under 300 lines: move old iteration rows to `LOOP-STATE-ARCHIVE.md` when the history table passes 30 rows.

---

## 1. Now (overwrite every iteration)

| Field | Value |
|---|---|
| Updated | 2026-11-07 session 1 (A01 merged) |
| Branch / HEAD | loop/integration @ fefe5bd7 + state commit (base main 9183b31e); worktree `C:/Users/anand/.claude-worktrees/hexabill-loop-integration` |
| Current task | T1: A02 next; T2: P-00 harness (A01 proved the local stack works) |
| Status | RUNNING |
| Next exact action | Write P-00 perf harness (e2e/perf/*.spec.js, scripts/perf-report.mjs) in worktree hexabill-loop-P00; then A02 in hexabill-loop-A02 |
| Last command + exit | `run-spec.ps1 ... users-page-table.spec.js` exit 0 (2 passed) |
| Last error (1 line) | none blocking. Pre-existing: lint 3 errors, unit 2 fails (see 6c Bugs found) |
| Open files | — |

## 2. Baselines (fill once in P-00, then compare against them)

| Metric | Page | Desktop 1440 | Phone 360 throttled | Date |
|---|---|---|---|---|
| Time to first data row | /ledger?customerId=… | | | |
| Time to first data row | /sales-ledger | | | |
| Time to first data row | /billing-history | | | |
| POS ready (search usable) | /pos | | | |
| POS add item → total updated | /pos | | | |
| Long tasks > 200 ms during load | /ledger | | | |
| JS shipped for route (kB gz) | /pos, /ledger, /reports | | | |
| Requests during 5 min idle | /pos | | | |
| Build output total (kB gz) | — | | | |
| Money snapshot hash (H03) | 3 ledgers + VAT + worksheet | | | |

Baseline run 2026-11-07 (production build via vite preview, tiny synthetic tenant: absolute numbers understate production; phone = 360, 4x CPU, Fast 4G). Source: docs/uiux/evidence/2026-11-07/perf/baseline.json. Compare with `npm run perf -- --compare`.

| Metric | Desktop | Phone | Budget d/p |
|---|---|---|---|
| Ledger first data row | 1148 ms OVER | 3528 ms OVER | 1000 / 2500 |
| Sales ledger first row | 483 | 2149 | 1000 / 2500 |
| Billing history first row | 309 | 2260 | 1000 / 2500 |
| POS ready to search | 354 | 1960 | 1200 / 3000 |
| POS keystroke to list p95 | 5.5 | 30.4 | 100 / 250 |
| POS add item to total | 7.8 | 53.4 | 50 / 150 |
| Long tasks >200 ms | 0 | 0 (ledgerScaled phone 1) | 0 / 2 |
| POS idle 5 min requests | 11 OVER | 9 OVER | 6 / 6 |
| POS idle heap growth | 0.57 MB | 0.63 MB | n/a |
| Route JS gz: pos / ledger / sales-ledger / billing | 76.3 / 75.4 / 37.4 / 33.5 kB | same | 120 |
| Route JS gz: dashboard / reports | 139.9 / 170.7 kB OVER | same | 120 |
| Total JS gz | 952.5 kB | | n/a |

Findings from the baseline: no page shows "Still loading... Cancel" at 3 s (P-01); Ledger makes 18-19 API calls on load (P-04); POS idle polls /api/products and /api/customers 5x each in 5 min (P-02/P-03); dashboard/reports exceed 120 kB because of ~128 kB recharts (S9).

## 3. Decisions in force (owner answers + assumed defaults)

| ID | Decision | Source | Date |
|---|---|---|---|
| D-UX-1 | `tab: 700px` breakpoint | ASSUMED default (yes) until owner answers | |
| D-UX-2 | Auto location during routes | ASSUMED Optional, on by default | |
| D-UX-3 | Auto-reorder stops | ASSUMED On with Undo | |
| D-UX-4 | Driver pin needs office approval | ASSUMED yes (matches existing `arrivalRequest`) | |
| D-A02 | Assistant `reply` text: server flags grounded replies (`grounded: true` + sources on ChatReply, owner adds backend). UI renders `data.text` ONLY when `data.grounded === true`, with sources / as-of; ungrounded keeps the canned fallback. Commit 923564c0 guard stays | OWNER decision | 2026-11-07 |
| D-UX-5 | Voice provider first | ASSUMED Gemini Live via LiveKit, after data-terms check | |

## 4. Learned facts (things a fresh session would otherwise rediscover)

Add one line per fact. Delete a line when it is no longer true.

- Shell switches at `md`=768 in `Layout.jsx` (L55/L103); the HONOR Pad portrait is 752 CSS px, so it gets the phone layout.
- `assistantChat.js describeChatReply()` used to drop `data.text` for `mode==='reply'` (fix = UX-A02).
- POS (`PosEnterprisePage.jsx` ~L530) reloads ALL product pages via `loadAllProductPages` + customers every 60 s.
- `CustomerLedgerPage.jsx` fetches customers `pageSize:1000` (~L868) and sales+payments `pageSize:1000` (~L1164) for the cash ledger.
- Only 2 uses of `@tanstack/react-virtual` in the app; 15 uses of AbortController/signal.
- `api.js` axios timeout is 30 s, with a 30 s GET cache (`_bypassCache` to skip).
- `useAutoRefresh` and most polls already skip when the tab is hidden.
- `driverRoute.js arrivalRequest()` already sends lat/lng and `updateSavedLocation` for owner/admin; for staff the fix goes to the office to confirm.
- `PosPageLegacy.jsx` must stay (flag `VITE_POS_ENTERPRISE_V2=false` falls back to it).

- LOOP-STATE is owned by the orchestrator in the integration worktree; team branches must NOT edit it (avoids merge conflicts). Teams report evidence; orchestrator records it.
- Primary checkout (`HexaBilngApp`, branch main) is SHARED with Codex sessions and has 57 uncommitted files from other work. Never edit or stage there. Loop work lives only in `~/.claude-worktrees/hexabill-loop-*`; junction `frontend/hexabill-ui/node_modules` from the primary tree.
- Loop docs originally sat in the repo root (+ identical `_1` copies, left untouched). Canonical copies are now `docs/uiux/*` on loop/integration. DESIGN-SYSTEM v1 kept as `DESIGN-SYSTEM-v1-2026-10.md`.
- No Docker and no psql/pg_isready on PATH. PostgreSQL 18 is at `C:\Program Files\PostgreSQL8in`. Working QA cluster notes: memory `hexabill-local-qa-harness` (start `pg_ctl` with output redirected, runner = `scripts/run-customer-save-qa.ps1`, Playwright projects `m360,m390,t768,d1024,d1440`).
- `docs/uiux/evidence/` already exists in repo (untracked files in primary tree); evidence for this loop goes in `docs/uiux/evidence/2026-11-07/`.

- DANGER (hit TWICE on 2026-11-07, node_modules was emptied and rebuilt with npm ci): every loop worktree has `frontend/hexabill-ui/node_modules` as a JUNCTION to the primary tree, and `git worktree remove --force` FOLLOWS it and deletes the real node_modules (other sessions use it). SAFE REMOVAL (PowerShell only): `[System.IO.Directory]::Delete("<worktree>\frontend\hexabill-ui\node_modules")` removes just the link (check `(Get-Item <path>).LinkType -eq "Junction"` first, and verify the primary count is unchanged), THEN `Remove-Item -Recurse -Force <worktree>` and `git worktree prune`. Never use `cmd /c rmdir "..."` quoted from Git Bash (the quoting fails silently and the next step then deletes the target). Repair: kill every node/esbuild/vite process first (a running Vite or Playwright holds esbuild.exe / rollup .node open and `npm ci` fails with EPERM), then `npm ci` in the primary frontend dir (~20 s, lockfile must be clean). Never run npm install/ci from a worktree. Teams must stop their wrapper-spawned Vite/API when a run ends (an orphaned Vite on 5181 blocked the repair).
- Files modified in the primary (dirty) tree overlap loop work: App.jsx, Layout.jsx, PosEnterprisePage.jsx, PosPageLegacy.jsx, BillingHistoryPage, SalesLedgerPage, CustomersPage, ExpensesPage, PaymentsPage, ProductsPage, ModernTable, Badge, OverflowMenu etc. Expect merge conflicts when the owner commits that work onto main; the loop never touches the primary tree.
- Native-confirm replacement pattern: `const [askConfirm, confirmDialog] = useConfirmDialog()`; `if (!(await askConfirm({title, message, confirmLabel}))) return`; render `{confirmDialog}` in the component root. Name it askConfirm (the task grep flags `confirm(`).
- Page tests that bundle a page with esbuild stub `lucide-react` with a fixed icon list (tests/vatManagementPage.test.js); add any new icon a page transitively imports.
- ONE DATABASE PER TEAM (2026-11-08): the runner rotates the seeded user's password on every run, so teams sharing a DB lock each other out (429, 15 min). Databases: T1 `hexabill_codex_browser_loopa_20261108`, T2 `..._loop_20261107`, T3 `..._loopd_20261108`, T4 `..._loopb_20261108`, T5 `..._loopc_20261108`. First run on a new DB needs `-FirstSeed`; wrapper has `-Database`.
- Render: the connected Render MCP account (ANANDU SBSOL TESTING) cannot see the HexaBill workspace (tea-ctr63al2ng1s73ersr5g): log reading is BLOCKED until the owner provides a read-only API key through the secret prompt. Vercel CLI works (project hexabill-ui under scope anandukrishnapa2000-gmailcoms-projects); tenant hosts verified to serve the same build after the 2026-11-08 deploy.
- Same-name files differing only by case (`returnInvoicePicker.js` vs `ReturnInvoicePicker.jsx`) shadow each other on Windows imports: never create them.
- Helper scripts outside the repo: `~/.claude-worktrees/_loop-tools/` (run-spec.ps1, rm-worktree.ps1 = safe worktree removal, add_row.py = append a history row). Never run add_row.py without a real row.
- LOCAL QA STACK (works, verified 2026-11-07): PG cluster `%TEMP%\hexabill-unified-pg-20261101` on port 55481 (start with `pg_ctl ... -o "-p 55481" -W start >/dev/null 2>&1 </dev/null`; first start takes ~30 s crash recovery). Loop DB `hexabill_codex_browser_loop_20261107` (seeded; tenant `gulfharvest-test`, owner `owner@gulfharvest-test.hexabill.local`). Run a spec: `cmd //c "powershell -NoProfile -File C:\Users\anand\.claude-worktrees\_loop-tools\run-spec.ps1 -Root <worktree> -Spec e2e/x.spec.js -Projects d1440 > out.txt 2>&1"` (wrapper lives outside the repo; `-FirstSeed` only on a new DB). Needs `dotnet build tools/HexaBill.SyntheticSeed` and `tools/HexaBill.SyntheticBrowserHost` once per worktree.
- Port plan (runner now takes -ApiPort/-FePort): T1 5178/5179, T2 5180/5181, T3 5182/5183, T4 5184/5185, T5 5186/5187. Default 5078/5175 can be blocked by a phantom PID-0 Listen socket for ~30 s after a run; the wrapper waits.
- NEW BASELINE after BUG-1..4: lint 0 errors, unit 411/411, build 0. (Old, at HEAD 9183b31e: `npm run lint` = 3 errors + 256 warnings (errors are BUG-1..3, none from the loop); `npm test` = 403 tests, 401 pass, 2 fail (customerLedgerUrl, BUG-4); `npm run build` exit 0 (~16 s).
- DS v2: table header = 12px/500 secondary, NO uppercase; rows 36px. Users table follows it (A01). Other tables still use `uppercase tracking-wider` (later A/B tasks).
- The Edit tool works on these CRLF-in-worktree files. Don't `sed -i` repo files. Python strings with Windows paths need raw strings.

## 5. Task board (mirror of the loop file; tick here first)

`[ ]` todo · `[~]` doing/blocked · `[x]` done · `STUCK` · `BLOCKED-BACKEND`

- Perf: P-00 [x] P-01 [ ] P-02 [ ] P-03 [ ] P-04 [ ] P-05 [ ] P-06 [ ] P-07 [ ] P-08 [ ] P-09 [ ] P-10 [ ]
- A: A01 [x] A02 BLOCKED-BACKEND (D-A02 decided; waits for `grounded` on ChatReply) A03 [x] (A03b open: useUnsavedChangesGuard.js still uses window.confirm) A04 [x] A05 [x] A06 [x]
- B: B01 [ ] B02 [ ] B03 [ ] B04 [ ] B05 [ ] B06 [ ]
- C: C01 [ ] C02 [ ] C03 [ ] C04 [ ] C05 [ ] C06 [ ] C07 [ ] C08 [ ] C09 [ ]
- D: D01 [ ] D02 [ ] D03 [ ]
- E: E01 [ ] E02 [ ] E03 [ ] E04 [ ] E05 [ ] E06 [ ]
- F: F01 [ ] F02 [ ] F03 [ ] F04 [ ] F05 [ ]
- G: G01 [ ] G02 [ ] G03 [ ] G04 [ ] G05 [ ] G06 [ ] G07 [ ] G08 [ ] G09 [ ] G10 [ ]
- H / E2E gates: H01 [ ] H02 [ ] H03 [ ] E2E-G1 [ ] E2E-G2 [ ] E2E-G3 [ ]

## 6. Iteration history (append; newest at the bottom)

| # | Date | Task | Result | Commit | Tests (unit/e2e) | Evidence path | Notes |
|---|---|---|---|---|---|---|---|
| 1 | 2026-11-07 | A01 Users table | PASS | fefe5bd7 | unit 401/403 (2 pre-existing fails), build 0, lint 0 new errors, e2e users-page-table 2/2 | docs/uiux/evidence/2026-11-07/A01-users-*.png | Also fixed a Status/Role header swap hidden by the invisible header. Before: contrast 1.09 |
| 2 | 2026-11-07 | A02 assistant reply text | BLOCKED | - | - | docs/plan/REVIEW-INBOX.md | Task assumption wrong: hiding model text is a deliberate guard (commit 923564c0 + test). No code changed |
| 3 | 2026-11-07 | A03 native confirm -> modal | PASS | 7e58d5b4 | unit 401/403 (same 2 pre-existing), build 0, lint 0 new errors, e2e confirm-modal 2/2 (d1440, m360) | docs/uiux/evidence/2026-11-07/A03-*.png | New hooks/useConfirmDialog.jsx (`askConfirm`). 2 tests updated (UIX006 assertion, VAT icon stub +X). Grep now only hits the guard hook + hook docs |
| 4 | 2026-11-07 | A05 notification language | PASS | f187c607 | unit 409/411 (same 2 pre-existing; +8 new alertPresentation), build 0, lint 0 new errors, e2e notifications-language 2/2 (d1440, t768; m360 NOT TESTED, see BUG-6) | docs/uiux/evidence/2026-11-07/A05-*.png | New components/alertPresentation.js. Also fixed BUG-5 (category chips never filtered the list). Raw ids only behind a Details toggle for Owner/Admin |
| 5 | 2026-11-07 | BUG-1 + BUG-3 (S1) | PASS | a67da7a9 | lint errors 3 -> 1 (only BUG-2 left), unit 409/411 (BUG-4 same 2), build 0 | - | BUG-1: import Link in ReportsPage. BUG-3: stray `)}` left by commit a566bcfe rendered literal text under the Customer Ledger filter bar (esbuild tolerates it, ESLint did not) |
| 6 | 2026-11-07 | BUG-2 + BUG-4 (S1) | PASS | 9c98505c | lint 0 errors (baseline now clean), unit 411/411, build 0 | - | BUG-2: dropped undefined debouncedSearch (page search is client-side). BUG-4: stale tests updated to the intentional Pending default tab. Built on committed main, not the owner's WIP |
| 7 | 2026-11-07 | P-00 perf baseline + harness (T2) | PASS | 7ab8ee33 | merged; lint 0 errors, unit 411/411, build 0; perf runs exit 0 (desktop 18, phone 18 passed) | docs/uiux/evidence/2026-11-07/perf/ (README, baseline.json, bundle.json) | Visualizer skipped (bundle size by script). Runner honours HEXABILL_FE_MODE=preview. NOT TESTED: 30-min soak, server time on a large tenant |
| 8 | 2026-11-08 | A04 returns invoice picker | PASS | e476cff1 | unit 416/416, lint 0 errors, build 0, e2e returns-picker 4/4 (d1440, m360) | docs/uiux/evidence/2026-11-08/A04-*.png | Recent 30 days, typed search covers all dates; helper renamed invoicePickerQuery.js (a same-name-different-case file shadowed the component on Windows) |
| 9 | 2026-11-08 | A06 unconfirmed payment alert | PASS | 6e97cf37 | unit 416/416, lint 0, build 0, e2e payments-unconfirmed 4/4 (d1440, m360); two intents = one alert <=64 px | docs/uiux/evidence/2026-11-08/A06-*.png | Time not shown (journal stores none; adding it touches ledgerPaymentIntent.js recovery code, REVIEW-INBOX). Shared-DB lesson: runner rotates password per run, one DB per team |
| 10 | 2026-11-08 | BUG-6 bell on phone/portrait tablet (S2) | PASS | 93d742fe | unit 416/416, lint 0, build 0, e2e notifications-language 3/3 (d1440, t768, m360) | docs/uiux/evidence/2026-11-08/BUG6-*.png | Bell added to mobile header; panel = fixed full-width sheet <640 px. Closes the A05 m360 gap |
| 11 | 2026-11-08 | T4 bug hunt 1 (tests only) | MERGED | fad3343f | 29/31 new e2e pass; 2 fail on purpose (BUG-8, BUG-9) | docs/uiux/evidence/2026-11-08/bug-hunt-1.md | 6 features, 4 viewports. Render logs BLOCKED (account cannot see HexaBill workspace). Vercel: no failed prod deploys, static SPA |
| | | | | | | | |


## 6b. Claims (files a team is editing; release on merge)

| Team | Task | Files |
|---|---|---|
| | | |

## 6c. Bugs found (T4/T5 and gate runs)

Format: BUG-n | feature | severity | repro | failing test | suspected file | status

- PRIORITY (owner 2026-11-07): BUG-1, BUG-2, BUG-3, BUG-4 are S1, fix next BEFORE A04. BUG-6 is S2, do after A06. UPDATE: owner says committed main = production = the good base; proceed in order on it, do NOT wait for the WIP branch (conflicts handled when the owner commits). OLD NOTE: owner commits his 57 files on branch `wip/pre-loop-2026-11-07`; loop/integration must be rebased onto it before the next merge (waiting: branch not present yet at last check). BUG-2/BUG-4 files are in that dirty set, so fix them after the rebase; BUG-1/BUG-3 files are clean and can go now.
- BUG-1 | Reports | S2 | `Link` used (L1408, unpaid-invoices link) but never imported from react-router-dom: ReferenceError when that block renders | `npx eslint src/features/reports/ReportsPage.jsx` (react/jsx-no-undef) | ReportsPage.jsx:1408 | FIXED a67da7a9
- BUG-2 | Expenses | S2 | `debouncedSearch` is not defined at L431 (list params): ReferenceError when the list loads | `npx eslint src/features/expenses/ExpensesPage.jsx` (no-undef) | ExpensesPage.jsx:431 | FIXED 9c98505c
- BUG-3 | Customer Ledger | S3 triage | ESLint parse error at L2957 (`)}` after `</div>`) while `vite build` succeeds | `npx eslint src/features/customers/CustomerLedgerPage.jsx` | CustomerLedgerPage.jsx:2957 | FIXED a67da7a9 (real bug: literal `)}` text rendered under the filter bar)
- BUG-4 | Customer Ledger tests | S3 | `tests/customerLedgerUrl.test.js` has 2 failures at HEAD (normalizeLedgerTab default, syncLedgerTabSearchParam). Primary tree has uncommitted edits to the test AND source | `npm test` | features/customers + utils | FIXED 9c98505c (tests were stale)

- BUG-5 | Notifications | S2 | Category chips (All/Stock/Overdue/System) set `activeCategory` but the list rendered every alert, so the filter did nothing | tests/alertPresentation.test.js (filterByCategory) + e2e notifications-language | AlertNotifications.jsx | FIXED in A05
- BUG-6 | Shell / Notifications | S2 | The alerts bell exists only in the desktop header (Layout.jsx:529, md+). The phone shell (<768, which includes the HONOR Pad portrait at 752) has no bell, so owners there cannot see stock/overdue/mismatch alerts at all | e2e/notifications-language.spec.js at m360 times out on the bell | components/Layout.jsx (mobile header ~L375). File has uncommitted edits in the primary tree | FIXED 93d742fe

- BUG-7 | Reports | S1 (wrong data shown to other tenants) | ReportsPage.jsx ~L1388-1410 'legacy' block has hardcoded fallbacks and copy from one tenant's migration: `|| '5,325'` cleared receipts, `|| 93` pending bills, '21 customers (+ AED 100.80 Inv 2158)', '21 customer accounts with approved opening balances'. Any tenant that reaches this block sees another company's numbers | grep those literals in ReportsPage.jsx | ReportsPage.jsx | OPEN: money/tenant display, owner review first (REVIEW-INBOX). Needs the gating condition checked (is the block only for the migrated tenant?)

- BUG-8 | Products/Stock backend | S1 authorization | Staff can POST /api/products/recompute-stock (200) and rewrite tenant stock from movement history; sibling reset-all-stock is Admin/Owner only | e2e/bughunt/roles-permissions.spec.js (BUG-8) | ProductsController.cs:723 `Roles = "Admin,Owner,Staff"` | NEEDS-BACKEND / REVIEW-INBOX (auth change is owner's; loop adds tests only)
- BUG-9 | Purchases backend | S3 latent | Owner gets 403 on POST /api/purchases/{id}/upload (`Roles = "Admin,Staff"`); no UI calls it today | same spec (BUG-9) | PurchasesController.cs:527 | NEEDS-BACKEND

## 7. Stuck log

| Task | Attempts | Last error | Root-cause guess | What a human should check |
|---|---|---|---|---|
| | | | | |

## 8. NEEDS-BACKEND queue (copy also into REVIEW-INBOX)

| Task | Contract | Status |
|---|---|---|
| A02 | `ChatReply` gains `grounded: bool` + `sources[]` (+ asOf). Owner implements. UI part (when this lands): in `describeChatReply` mode `reply`, show `data.text` only if `data.grounded === true`, render sources/as-of, else keep canned text. Keep the existing 'unsupported model text' test for ungrounded | waiting |
| BUG-8 | Restrict POST /products/recompute-stock to Admin,Owner (S1). BUG-9: add Owner to purchases/{id}/upload | waiting |
| E03 | `POST /assistant/chat/stream` SSE: token / tool / card / done | waiting |
| E05 | `POST /assistant/voice/session` → `{url, token, room, expiresAt, provider}` | waiting |
| F02 | `source:"auto"|"manual"` on the visit body; live-position ping endpoint if not reusable | waiting |
| P-04 | Server-side customer cash-ledger endpoint (paged), replacing client merge of 1,000 sales + 1,000 payments | waiting |
| P-05 | `GET /products/lookup?q=&limit=20` (fast POS search) + `updatedSince` delta | waiting |
