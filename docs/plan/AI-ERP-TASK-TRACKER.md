# HexaBill AI-native ERP — single task tracker

**Status:** IN_PROGRESS — tracker adopted into repo 2026-10-10 on branch `uiux-audit-p1` (base `origin/main` = `c6ba249`).
**Last verified (2026-10-10, read-only):** local `main` fast-forwarded `022e418` → `c6ba249`. Render backend `srv-d68jpdvpm1nc7393q4d0` live = `92a5059` (manual deploy 2026-10-10 10:53 UTC, `autoDeploy` off). `origin/main` = `92a5059` + 2 frontend-only commits (`4a3ac0b`, `c6ba249`). Vercel frontend SHA UNVERIFIED.
**Linked trackers (not duplicated here):** `docs/production/TASK-TRACKER.md` + `BUG-REGISTER.md` (T-/B- IDs), `docs/plan/PRODUCTION-ISSUE-REGISTER.md` (PS-), `docs/plan/ERROR-REGISTER.md` (REL-), `docs/plan/VAT-IMPLEMENTATION-TRACKER.md`, `docs/uiux/PREMIUM-UX-TRACKER.md` (UX). `docs/plan/STATE.md` is historical (stale deploy SHA).
**Session order approved by owner 2026-10-10:** Checkpoint 1 = UX Phase 1 audit (read-only) → Checkpoint 2 = P0-02. Read-only production checks authorized for P0-02.
**Current milestone:** P0 — Production stability and evidence.
**Tracker contract:** real tasks only; update `Last verified`, `git SHA`, test command/outcome, exact source reference/evidence. States `TODO / IN_PROGRESS / PASS / FAIL / BLOCKED / NOT TESTED`. Do not count skips as PASS. Existing VAT UI tracker is separate; link relevant entries.

| ID | Priority | Milestone | Task | Status | Evidence / gate |
|---|---|---|---|---|---|
| P0-01 | P0 | 0 | Capture `git status`, source SHA, Render/Vercel deployed versions and source drift | PASS (Vercel NOT TESTED) | 2026-10-10: see header; Render `list_deploys` live `92a5059`; Vercel SHA unverified (prior 403) |
| P0-02 | P0 | 0 | Investigate maintenance UI on frozenhub login (explicit maintenance vs arbitrary 503); recoverability | PASS (code, local) / production BLOCKED (owner rollback) | LIVE ROOT CAUSE 2026-10-10: Render deploy `92a5059` logged `Production database has 2 pending EF migrations; readiness will remain closed.` (10:55:05 UTC); live `/health` and `/api/maintenance-check` = 503 `InitializationFailed`. Every API call 503 → frontend showed "Under Maintenance". Fix: gate/maintenance 503 bodies carry `reason` (`SERVICE_UNAVAILABLE` / `MAINTENANCE_ENABLED`) + `Retry-After`; maintenance flag read past tenant query filter (was invisible to signed-in tenant requests); frontend shows "Server unavailable" vs "Scheduled maintenance", polls `/api/maintenance-check` 5→60s, Try again. Tests: `ServiceUnavailableContractTests` (2, red→green), `serviceErrors.test.js` (5), `e2e/service-availability.spec.js` (3 × m390/d1440 green; all 3 red on old code). Backend 778/778 on fresh disposable PG, 0 skips; frontend 144/144; build OK. Production restore = rollback to `bdcc429` or backup+apply 2 additive migrations — owner action pending |
| P0-03 | P0 | 0 | Verify PostgreSQL integration skips, migration history and disposable-PG migration rehearsal | PARTIAL | 2026-10-10: full suite with `HEXABILL_TEST_POSTGRES` on fresh disposable DB 778/778, 0 skips. Old disposable DB `hexabill_master_loop_test` lacks today's VAT columns (42703) — reuse of stale test DBs gives false failures. Silent-return PG tests and fresh-history migration collision (REL-004/011) still open |
| P0-04 | P0 | 0 | Fix confirmed wrong-company/TRN/footer in Gulf Harvest/Frozen Hub print | PARTIAL | GH PASS (T-001, T-010a-c, Starplus absent assertions); FrozenHub family T-010d BLOCKED(asset) — FH BW logo present in `SeedLogos/` since `9630420`, re-check |
| P0-05 | P0 | 0 | Reconcile expected four tenants vs shown three; no duplicate creations | PARTIAL | B-004 note: read-only prod check counted 7 tenants; SuperAdmin list pageSize 20, case-sensitive search, stat cards count current page only |
| P0-06 | P0 | 0 | Audit real create/edit/save/delete in POS, purchase, expense, payment, SKU, stock and reports | PARTIAL | T-004a-c PASS (SQLite HTTP harness); returns HTTP round-trip T-004d TODO |
| P0-07 | P0 | 0 | Check idempotency/retry/double-payment and tenant leakage in APIs, caches, logs and exports | PARTIAL (client fixed) | Old client re-sent a failed expense POST (browser test: 2 requests). Now writes auto-retry only with `Idempotency-Key` or POS `externalReference` (`isAutoRetryable`). Server-side dedupe for purchases/expenses/returns still TODO |
| P1-01 | P1 | 1 | Tenant onboarding, owner invitation/reset, subdomains, role permissions | TODO | 4 synthetic tenant E2E |
| P1-02 | P1 | 1 | Staff job title, active vs attendance distinction, owner activity dashboard | TODO | role and activity E2E |
| P1-03 | P1 | 1 | Last finalized customer-product-unit price reuse, returns/void/edit edge cases | TODO | historical price tests |
| P1-04 | P1 | 1 | Daily opening/closing cash UX, tender reconciliation, branch/cashier | TODO | expected vs counted and role tests |
| P1-05 | P1 | 1 | Frozen Hub header only + common print identity/Arabic/monochrome design | TODO | PDFs and image diff |
| P1-06 | P1 | 2 | Inventory routes/screens/modal/form count and premium shared design tokens | IN_PROGRESS (audit PASS; Expenses slice PARTIAL, Checkpoint 3: list states PASS, first-record target 35% not met; other modules TODO) | 2026-10-10 Checkpoint 1: `docs/uiux/PAGE-INVENTORY.md` recount + `docs/uiux/PREMIUM-UX-TRACKER.md` (25 confirmed defects (8 P1, 14 P2, 3 P3) + 1 NOT REPRODUCED + 1 NOT TESTED, baseline metrics at 360/390/768/1440); `e2e/ux-audit.spec.js` 28/28 passed on synthetic local data |
| P1-07 | P1 | 2 | Desktop navigation, tablet, mobile quick create, no duplicate chrome | TODO | Playwright viewport matrix |
| P1-08 | P1 | 2 | Tenant global search + indexed results + shortcuts | TODO | permission and latency tests |
| P1-09 | P1 | 2 | Faster invoice/POS/purchase/expense workflows; explicit save confirmation | TODO | click/time and DB E2E |
| P1-10 | P1 | 2 | PWA install, auth/cache/privacy and offline semantics where feasible | TODO | install/clear session checks |
| AI-01 | P2 | 3 | Backend tool registry with tenant/role scope and source links | TODO | negative cross-tenant tests |
| AI-02 | P2 | 3 | Provider registry + API-key safe vault + model/capability/cost routing | TODO | synthetic provider tests |
| AI-03 | P2 | 3 | SuperAdmin provider/test/keys/models/quotas/usage/email alerts | TODO | auth audit + budget tests |
| AI-04 | P2 | 3 | Read-only assistant for sales, AR, stock, expenses, routes, daily close, staff | TODO | grounded response evidence |
| VOICE-01 | P2 | 4 | Malayalam/English/Hindi/Arabic push-to-talk STT, captions, text fallback | TODO | locale/accent/noise eval |
| VOICE-02 | P3 | 4 | LiveKit real-time voice & Gemini Live/voice pipeline optional | TODO | latency, privacy, caps |
| VOICE-03 | P3 | 4 | Voice-drafted invoice with confirmation & idempotent posting | TODO | injection, ambiguity, denial tests |
| MAP-01 | P2 | 5 | Existing routes/stops/collections map + delivery/visit completion | TODO | geofence/role/e2e |
| MAP-02 | P3 | 5 | Opt-in location tracking, freshness, attribution/licensed tiles | TODO | permission/session/retention |
| AUTO-01 | P2 | 5 | Daily summaries, overdue reminder drafts, stock alerts, owner email alerts | TODO | dedupe/quiet hours/audit |
| ML-01 | P3 | 6 | Data quality check, demand/reorder/payments baseline, time-split evaluation | TODO | baseline accuracy report |
| ML-02 | P3 | 6 | Approved model rollout, feedback, drift and safe scheduled retraining | TODO | offline comparison/pilot |
| FINAL-01 | P0 | ALL | Cross-tenant security/PII, unit integration, PG, E2E, build, PDF, AI failures | TODO | No unexplained skips |
| FINAL-02 | P0 | ALL | Stage rollout plan, backups, feature flags, rollback, support docs | TODO | Written approval for prod |

## Session log
### 2026-10-10 — Checkpoint 1: UX Phase 1 audit (read-only)
- **Source:** branch `uiux-audit-p1` from `c6ba249`. Changes are docs plus one audit spec; no product code. Nothing committed yet, pending owner review.
- **Environment:** local API on 127.0.0.1:5000 over the throwaway SQLite copy `%TEMP%\hexabill-uitest`. Synthetic expenses were added through the local API. No production access was used for this checkpoint.
- **Commands:** `npx playwright test e2e/ux-audit.spec.js --project=m360 --project=m390 --project=t768 --project=d1440 --workers=1` → **28 passed**.
- **Results:**
  - 25 defects confirmed: 8 P1, 14 P2, 3 P3. One suspected defect was not reproduced (UX-E08, expense list scroll). No P0 UX defect.
  - Not tested: large datasets (only 2 invoices), RTL, a real device keyboard.
- **Next task:** Checkpoint 2, P0-02.

### 2026-10-10 — Checkpoint 3: Expenses UX slice (P1-06, PARTIAL)
- **Source:** branch `uiux-audit-p1`; local Vite on 127.0.0.1:5173 over the local API on 127.0.0.1:5000 (SQLite synthetic copy, tenant `gulfharvest`). No production access.
- **Changed:** `frontend/hexabill-ui/src/features/expenses/ExpensesPage.jsx` (filters collapse below 1024px; totals and Ledger/By category tabs share one row; tablet chips scroll; Route and VAT Period hidden below 1280px; desktop empty state gets Add expense; list error gets "Try again" on all widths with one copy). New spec: `frontend/hexabill-ui/e2e/expenses-states.spec.js`. Tracker: `docs/uiux/PREMIUM-UX-TRACKER.md`.
- **Results (before → after):** first record 360px 411→387 px (51%→48%); 768px 752→498 px (73%→49%); 1440px 566→528 px (63%→59%). The 35% target was **not** met.
- **Commands and results:**
  - `npx playwright test e2e/ux-audit.spec.js -g "audit /expenses" --project=m360 --project=m390 --project=t768 --project=d1440` → 8 passed.
  - `npx playwright test e2e/expenses-states.spec.js --project=m360 --project=t768 --project=d1440` → 6 passed.
  - `npx playwright test e2e/expenses-crud.spec.js --project=m360 --project=t768 --project=d1440` → one clean run 3 passed; reruns failed on HTTP 429 (see open risk). Single-viewport d1440 clean rerun → 1 passed.
  - `npm test` (frontend unit) → 147 pass, 0 fail. ESLint on ExpensesPage: 0 errors, 7 warnings, all pre-existing (none on changed lines).
- **Open risk (not fixed):** the API's global rate limiter is 300 requests/min per IP (`backend/HexaBill.Api/Core/Authorization/SecurityConfiguration.cs:254`, skipped for HTTP integration-test hosts). The Playwright suites exceed it, and in 3 of 4 three-viewport runs the list GET returned 429. This is a test-environment limit, but shared-NAT offices could hit the same limit in production. Owner decision needed on the limit or per-user keying.
- **Not tested:** Arabic/RTL, real phone keyboard, large datasets for the Expenses list, print and export of the changed view.
- **Next task:** finish P1-06 Expenses (UX-E01 target 35%), then Purchases, POS and the other modules in the coverage matrix.
- **STOP HERE** — one checkpoint per session; do not begin the next phase automatically.

### 2026-10-10 — Checkpoint 4: Expenses tablet layout (P1-06, UX-E06 PASS)
- **Source:** branch `uiux-audit-p1`, local Vite 5173 + local API 5000 (synthetic SQLite copy). No production access.
- **Changed:** `ExpensesPage.jsx` ledger switch moved from `md` to `xl` (table ≥1280px, compact list below). `e2e/expenses-crud.spec.js` row selector threshold 768→1280.
- **Results:** 768px first record 498→392 px (49%→38%). 360px 387 px (48%, unchanged). 1440px 528 px (59%). UX-E01 stays PARTIAL: the 35% target is not met at any width.
- **Commands:** `ux-audit` expenses → 6 passed. `expenses-states` → 6 passed. `npm test` → 147 pass. `expenses-crud` batch (m360, t768, d1440) → 2 passed, 1 failed at d1440 (edit-dialog amount locator timed out). d1440 alone → 1 passed. Failure not isolated, recorded as OPEN.
- **Open risk (carried):** API limit 300 req/min per IP causes 429s in batch runs. See Checkpoint 3.
- **Not tested:** Arabic/RTL, real keyboard, large Expenses datasets, print/export of the changed view.
- **Next task:** UX-E01 phone first-record target (decision needed: keep the period chips for quick switching, or move them into the Filters sheet as the audit proposed), then Purchases.
- **STOP HERE** — one checkpoint per session.

### 2026-10-10 — Checkpoint 5: Purchases list (P1-06, PARTIAL)
- **Source:** branch `uiux-audit-p1`, local Vite 5173 + local API 5000 (synthetic SQLite copy). Seeded 12 synthetic purchases and 2 suppliers through the local API (`seed-purchases` script in the local UI-test folder, not committed). No production access.
- **Decision recorded:** UX-E01 phone period chips are kept (recommended option). The 35% target is not reached, and the trade-off is noted in the UX tracker.
- **Changed:** `PurchasesPage.jsx` (filters collapse below 1024px; compact expandable rows below 1280px; status colours; desktop numbers no-wrap and neutral; failed-load error with Try again). New spec: `e2e/purchases-list.spec.js`. `ux-audit.spec.js` now also audits `/purchases` and `/suppliers`.
- **Results (before → after):** 360px first record 823→491 px (103%→61%), row 410→86 px. 768px 593→421 px (58%→41%), row 205→86 px. 1440px row 106→59 px. Target 35% not met on any width.
- **Commands and results:**
  - `npx playwright test e2e/purchases-list.spec.js` at m360, t768 (one batch, 5 passed each), d1440 (3 passed, 2 mobile-only skipped, on a clean run).
  - `npx playwright test e2e/ux-audit.spec.js -g "audit /purchases"` → 3 passed (final).
  - `npm test` → 147 pass, 0 fail. `npx vite build` → exit 0. ESLint on PurchasesPage: 0 errors, 3 warnings (pre-existing).
- **Open risks:** the local per-IP rate limit (300/min) caused 429s on one retry in a batch run (see Checkpoint 3). The desktop purchase rows still have 4 buttons (PU-08). Create, edit, delete, pay and print/export on Purchases are not tested (PU-10). Suppliers only has a baseline measurement.
- **Next task:** PU-08 (desktop row actions) and PU-10 (Purchases create/edit/delete/pay with DB persistence checks), then Suppliers.
- **STOP HERE** — one checkpoint per session.

## Start-of-session template
```
CHECKOUT SHA: <verified>
BRANCH / CLEAN STATUS: <verified>
CURRENT TASK ID: <single task>
WHY P0/P1: <verified symptom>
FILES RELEVANT: <paths>
REPRODUCTION: <command/steps>
SCOPE AND SAFETY: <no live writes>
```

## End-of-session template
```
STATUS: PASS | FAIL | BLOCKED | NOT TESTED
TASK ID:
FILES CHANGED:
ROOT CAUSE:
TEST COMMANDS/RESULTS:
PG/FRONTEND/E2E STATUS:
TENANT SECURITY EVIDENCE:
AI PRIVACY/COST IMPACT:
OPEN RISKS:
GIT STATUS:
NEXT ONE TASK:
STOP HERE — do not begin next phase automatically.
```

### 2026-10-10 — Checkpoint 6: Purchases row actions and desktop workflow (P1-06, PU-08 PASS, PU-10 PARTIAL)
- **Source:** branch `uiux-audit-p1`, local Vite 5173 + local API 5000 (synthetic SQLite copy). No production access.
- **Changed:** `PurchasesPage.jsx` (desktop row: Pay supplier when owed + shared `OverflowMenu` for Supplier ledger, Edit purchase, Delete purchase). New spec: `e2e/purchases-crud.spec.js` (desktop 1280px+).
- **Results:** desktop row controls 4→2, row 59→55 px. The CRUD workflow passes at 1440px: create → API total 105.00 → refresh → edit qty 6 → API total 126.00 → refresh → delete via menu and confirm → gone. Pay supplier → supplier payment saved → API net payable reduced by the paid amount.
- **Commands and results:**
  - `npx playwright test e2e/purchases-crud.spec.js --project=d1440` → 2 passed (clean run after cooldown). An earlier run failed on HTTP 429 from the local per-IP limit; the error banner showed correctly.
  - `npx playwright test e2e/purchases-list.spec.js --project=d1440` → 3 passed, 2 mobile-only skipped.
  - `npm test` → 147 pass, 0 fail. `npx vite build` → exit 0. ESLint: 0 errors, 3 warnings (pre-existing).
- **Data changed on the local synthetic DB:** one payment was recorded against the seeded supplier (Al Noor) by the pay test. Balances on the seeded purchases differ from earlier audits.
- **Open:** PU-12 (amount and invoice number in the Pay URL, P2). Mobile create, edit, delete and pay not tested. Print and export not tested. Desktop row text is 10.5 px (UX-S06).
- **Next task:** PU-12 (router state instead of URL), then the mobile purchase form (create, edit, pay), then Suppliers.
- **STOP HERE** — one checkpoint per session.

### 2026-10-10 — Checkpoint 7: Purchases PU-12 (router state) and mobile workflow (PU-10 PARTIAL)
- **Source:** branch `uiux-audit-p1`, local Vite 5173 + local API 5000 (synthetic SQLite copy). No production access.
- **Changed:** `PurchasesPage.jsx` (`openPay` passes the amount and reference in router state). `SupplierDetailPage.jsx` (applies router-state payment once, then clears history state; removed the unused `useSearchParams` import). `e2e/purchases-crud.spec.js` is viewport-aware (item form table at 768px+, list table at 1280px+).
- **Results:** PU-12 closed: the Pay URL is `/suppliers/<name>` with no amount or invoice reference. Purchase CRUD and pay pass at 360, 768 and 1440 (2 tests each, 6 total).
- **Commands and results:**
  - `npx playwright test e2e/purchases-crud.spec.js` at m360, t768, d1440, one project per run with cooldowns → 2 passed each.
  - `npx vite build` → exit 0. ESLint on the changed files: 0 errors. The remaining supplier-page warning (a `loadData` hook dependency) was already there before this change.
- **Open:** print and export not tested. VAT toggles, supplier auto-registration and payment allocation to a specific invoice not tested. The mobile form has not been reviewed visually. Desktop row text 10.5 px (UX-S06). The local API limit (300/min) returned 429s in batch runs; the helper polls count against it.
- **Next task:** a visual review of the mobile purchase form and the supplier ledger at 360/768, then Suppliers.
- **STOP HERE** — one checkpoint per session.

### 2026-10-10 — Checkpoint 8: Purchase form review and Suppliers (P1-06; SU-01, SU-02, SU-03, SU-04, PU-13, PU-14 PASS)
- **Source:** branch `uiux-audit-p1`, local Vite 5173 + local API 5000 (synthetic SQLite copy). The API was stopped for a backend build and restarted in Development against the same UI-test database. No production access.
- **Changed:**
  - Backend: `SupplierService.cs` and `SuppliersController.cs`. The summary takes an opt-in `includeInactive` flag (default false), and each row reports its real `IsActive`. Test added to `tests/HexaBill.Tests/tenancy/SuppliersHttpIsolationTests.cs`.
  - Frontend: `SuppliersPage.jsx` (full-width search; one "…" menu per card and per desktop row; reload on toggle), `services/index.js`, `PurchasesPage.jsx` and `SupplierDetailPage.jsx` (labels linked; form marked `data-shell-hides-nav`), `useShellChrome.js`.
  - E2E: new `e2e/suppliers-list.spec.js`. `e2e/purchases-list.spec.js` gains a form nav and label test.
- **Found by review:** the inline purchase form ran under the phone bottom nav (PU-13). "Include deactivated" did nothing (SU-01, P1). The toggle helper matched two elements, which exposed the desktop row label duplication (SU-04).
- **Commands and results:**
  - `dotnet test --filter SuppliersHttpIsolationTests` → 7 passed, 0 failed.
  - `npx playwright test e2e/suppliers-list.spec.js` at m360 and d1440 → 2 passed each.
  - `npx playwright test e2e/purchases-list.spec.js` at m360 → 6 passed.
  - `npx playwright test e2e/shell-navigation.spec.js` at m360 → 5 passed.
  - `npx vite build` → exit 0. ESLint on the changed files: 0 errors (pre-existing warnings only).
- **Measured:** Suppliers 360px first record 295 px (37%; target 35% not met, SU-06). Row 136→108 px. 1440px first record 249 px (28%). Row controls 3→2.
- **Not done:** the full backend suite was not run (only the supplier HTTP tests). `dotnet build` could not replace the API binaries while the local API ran (file lock), so the API was stopped for the test run and restarted afterwards. Supplier edit fields, statement export, purchase print and export are still untested.
- **Next task:** SU-05 and SU-06 (Suppliers header and first record), SU-08 (supplier name in the ledger header), then Suppliers edit and statement checks.
- **STOP HERE** — one checkpoint per session.

### 2026-10-11 — Checkpoint 9: Suppliers header, filter row and ledger title (SU-05, SU-06, SU-08 PASS)
- **Source:** branch `uiux-audit-p1`, local Vite 5173 + local API 5000 (synthetic SQLite copy). No production access.
- **Changed:** `SuppliersPage.jsx` (helper line placed by breakpoint; phone search row with an icon-only Filters trigger; checkboxes in a panel on phones, inline from md). `SupplierDetailPage.jsx` (ledger title wraps). `e2e/suppliers-list.spec.js` (first-record and search-width checks; the add-and-deactivate test opens Filters on phones).
- **Measured:** 360px first record 295→257 px (37%→32%), controls 5→4, rows 108 px. 1440px first record 249→238 px (28%→26%).
- **Commands and results:**
  - `npx playwright test e2e/suppliers-list.spec.js` at m360 (4 passed), t768 (3 passed, 1 mobile-only skipped), d1440 (3 passed, 1 skipped).
  - `npx playwright test e2e/ux-audit.spec.js -g "audit /suppliers"` at m360 and d1440: measured above.
  - `npx vite build` → exit 0. ESLint on the changed files: 0 errors (pre-existing warnings only).
- **Review:** 360px screenshot checked by eye: one search row with the filter icon, helper line readable, cards with one "…" action, no clipping.
- **Not done:** SU-07 (edit fields, statement export). Ledger tabs (Ledger, Bills, Paid) not exercised.
- **Next task:** Suppliers ledger tabs and supplier edit/statement checks (SU-07), then the next module in the coverage matrix.
- **Continue:** next approved local task, per AGENTS.md CONTINUOUS LOCAL EXECUTION POLICY.

### 2026-10-11 — Checkpoint 10: Daily close phone layout and actions (DC-01, DC-02, DC-03 PASS)
- **Source:** branch `uiux-audit-p1`, local Vite 5173 + local API 5000 (synthetic SQLite copy). Local setup: the synthetic tenant's `FeaturesJson` set to `["daily_close"]` in the UI-test DB (see PREMIUM-UX-TRACKER, Daily close). No production access.
- **Changed:** `DailyClosePage.jsx` (page root hides the bottom nav; sticky footer on phones; plain buttons with explicit styles and pending labels). `e2e/daily-close.spec.js` (new). `e2e/ux-audit.spec.js` (adds `/daily-close` to the audit list).
- **Measured:** 360px page height 1,574 px, Submit close at 1,430 px before the change. After: footer in viewport at the bottom of the page with the nav hidden.
- **Commands and results:**
  - `npx playwright test e2e/daily-close.spec.js` → m360 2 passed; t768 1 passed (1 mobile-only skipped); d1440 1 passed (1 skipped).
  - `npx vite build` → exit 0. ESLint on the page: 0 errors.
- **Not done:** Submit close, reopen, Add movement and capital transfers (they would change the synthetic day). Shared `LoadingButton` override problem (DC-04) is open.
- **Next task:** Daily close close-and-reopen fixture (DC-06), then the Payments and Receipts module surface discovery.

### 2026-10-11 — Checkpoint 11: Payments list header and rows (PY-01 to PY-05 PASS; PY-06 NOT TESTED)
- **Source:** branch `uiux-audit-p1`, local Vite 5173 + local API 5000 (synthetic SQLite copy). No production access.
- **Changed:** `PaymentsPage.jsx` (one header row on phones; Bulk Payment secondary; row name truncates and amount is nowrap; search card padding on phones; intro 14px on phones; bounded desktop search). `e2e/payments-list.spec.js` (new). `e2e/ux-audit.spec.js` (adds `/payments`).
- **Commands and results:**
  - `npx playwright test e2e/payments-list.spec.js` → m360 2 passed (desktop and tablet skipped by design).
  - `npx vite build` → exit 0. ESLint on the page: 0 errors (pre-existing warnings).
- **Audit limit:** the row measurement needs two or more receipts; the local tenant has one. Row density stays unmeasured until a receipt fixture exists (PY-06).
- **Next task:** Payments create/edit/delete with API read-back and a receipt fixture (PY-06); then the Receipts module surface.

### 2026-10-11 — Checkpoint 12: Payment create, edit and void with API read-back (PY-06 PARTIAL)
- **Source:** branch `uiux-audit-p1`, local Vite 5173 + local API 5000 (synthetic SQLite copy). No production access.
- **Changed:** `e2e/payments-crud.spec.js` (new). No application code changed.
- **Results:** create → API persisted (amount, customer) → refresh → edit (amount -10%, reference) → API persisted → refresh → void → API status VOID. Passes at 360, 768 and 1440.
- **Finding:** on-account customer payments are refused by the API unless an outstanding invoice exists. That is the intended rule, and the test selects a customer with a balance.
- **Commands:** `npx playwright test e2e/payments-crud.spec.js` at m360, t768, d1440 → 1 passed each.
- **Not done:** bulk payments, cheques, allocations across invoices, receipts and print, role restriction, row density with two or more receipts.
- **Next task:** Receipts module surface (print and PDF of cleared receipts, batch receipts), then bulk payments.

### 2026-10-11 — Checkpoint 13: Receipts on the Payments page (RC-01, RC-02, RC-03 PASS; RC-04 OPEN decision; RC-06 BLOCKED)
- **Source:** branch `uiux-audit-p1`, local Vite 5173 + local API 5000 (synthetic SQLite copy). Local setup: tenant id 5 `FeaturesJson` set to `["daily_close","receipt_snapshots"]` in the UI-test DB. No production access.
- **Changed:**
  - Backend: `PaymentReceiptService.cs` (combined receipt keeps one payment method when all payments share it). `PaymentReceiptTests.cs` (two tests, the first failed before the fix).
  - E2E: `e2e/receipts.spec.js` (new).
- **Commands and results:**
  - `dotnet test --filter PaymentReceiptTests` → 41 passed, 0 failed. Before the fix: 1 failed (the same-method test).
  - `dotnet test --filter Receipt` → 77 passed, 0 failed, 8 skipped (PostgreSQL-only: `HttpIsolationPostgreSqlTests`; BLOCKED, no disposable PostgreSQL).
  - `npx playwright test e2e/receipts.spec.js` → m360 2 passed, t768 2 passed, d1440 2 passed.
- **Open:** RC-04 (tenants without the snapshot flag cannot download a receipt PDF): owner decision. RC-05 not tested (print window, legacy preview, branding, Arabic).
- **Next task:** Bulk payments (Payments page), then the receipt print window and legacy-flag fixture (RC-05).

### 2026-10-11 — Checkpoint 14: Bulk payments (BP-01, BP-02, BP-03 PASS; BP-04 OPEN test data; BP-05 NOT TESTED)
- **Changed:** `PaymentsPage.jsx` (bulk customer check runs before the draft builder). `e2e/bulk-payments.spec.js` (new, three tests).
- **Commands and results:**
  - `npx playwright test e2e/bulk-payments.spec.js` at d1440 (3 passed, earlier amounts), m360 and t768 (6 passed with the small-amount version).
  - `npx vite build` → exit 0.
- **Finding:** the client retries a keyed payment POST once on its own; a pause is visible only if that retry also fails. No duplicates were created.
- **Next task:** reload-during-pause and cheque validation for bulk payments (BP-05), then Daily close close and reopen (DC-06).

### 2026-10-11 — Checkpoint 15: Daily close close and reopen (DC-06 PARTIAL, both paths PASS)
- **Changed:** `e2e/daily-close-close.spec.js` (new, two tests). No application code changed.
- **Commands and results:** `npx playwright test e2e/daily-close-close.spec.js` at m360, t768 (4 passed in total), d1440 (passed).
- **Finding:** a day with cash paid out and no opening cash has negative expected drawer cash (-1,597.50 on 2026-10-10). The close form cannot record a negative count, so the test sets opening cash first. Whether the page should ask for opening cash before showing expected cash is a product question, not changed here.
- **Next task:** Suppliers supplier edit and statement (SU-07), then Receipts print window and legacy flag (RC-05).

### 2026-10-11 — Checkpoint 16: Supplier edit and statement (SU-07 PARTIAL, SU-09 PASS)
- **Changed:** `SuppliersPage.jsx` (edit fields disabled and Save blocked until the saved details load; loading message). `e2e/suppliers-edit-statement.spec.js` (new, three tests).
- **Finding (P1, fixed):** typing in the edit form before its details loaded was lost, because the late load replaced every field (SU-09).
- **Commands and results:** `npx playwright test e2e/suppliers-edit-statement.spec.js` → d1440 3 passed, m360 and t768 6 passed in total. `npx vite build` → exit 0. ESLint on the page: 0 errors.
- **Next task:** Receipt print window and the legacy snapshot case (RC-05), then the Suppliers Bills and Paid tabs and credit limit (rest of SU-07).

### 2026-10-11 — Checkpoint 17: Login form (AU-01 PASS)
- **Changed:** `e2e/auth-login.spec.js` (new). No application code changed.
- **Commands and results:** `npx playwright test e2e/auth-login.spec.js` at d1440 (3 passed), m360 and t768 (6 passed in total).
- **Next task:** Products and Inventory: product create, edit, SKU and stock adjustment with API read-back.

### 2026-10-11 — Checkpoint 18: Products create, edit and deactivate (PR-01, PR-02 PASS; PR-03 NOT TESTED)
- **Changed:** `ProductDetailPage.jsx` (owners and admins: Deactivate and Activate on the detail page, typed confirmation). `e2e/products-crud.spec.js` (new).
- **Commands and results:** `npx playwright test e2e/products-crud.spec.js` at m360, t768, d1440 → 3 passed. `npx vite build` → exit 0. ESLint on the page: 0 errors.
- **Next task:** Product stock adjustment with API read-back and the stock history page (PR-03), then Inventory categories.

### 2026-10-11 — Checkpoint 19: Product stock adjustment and history (SA-01, SA-02 PASS)
- **Changed:** `components/StockAdjustmentModal.jsx` (removed the native `required` on the reason; the app's message shows). `e2e/stock-adjust.spec.js` (new).
- **Commands and results:** `npx playwright test e2e/stock-adjust.spec.js` at d1440 (1 passed), m360 and t768 (2 passed). `npx vite build` → exit 0.
- **Next task:** Product price list and categories (PR-03), then POS checkout with API read-back.

### 2026-10-11 — Checkpoint 20: POS checkout total matches the stored sale (PS-01 PASS; PS-02 NOT TESTED)
- **Changed:** `e2e/pos-checkout.spec.js` (new). No application code changed.
- **Commands and results:** `npx playwright test e2e/pos-checkout.spec.js` at m360, t768 (2 passed), d1440 (1 passed).
- **Next task:** POS stock after sale and duplicate-save protection (PS-02), then credit sale and payment.
