# STATE.md — HexaBill single source of truth

**As of:** 2026-10-04 (IST)  
**Executor:** Cursor Agent on main repo  
**Working tree:** `C:\Users\anand\OneDrive\Desktop\My StartUps Projects\HexaBilngApp`  
**Branch:** `master-loop-2` (off `main` @ `7edb29b`) — push branch only until owner says otherwise  
**Baseline for diff:** `39ffafb`  
**Codex worktree (read-only):** `C:\Users\anand\.codex\worktrees\afa0\HexaBilngApp`


## Deploy auto-check (read-only, 2026-10-04 master-loop-2)

| Platform | Resource | Auto-deploy from main? | Evidence |
|---|---|---|---|
| Render | HexaBill `srv-d68jpdvpm1nc7393q4d0` (repo HexaBillAd) | **NO** (`autoDeploy=no`, `autoDeployTrigger=off`) | Render list_services |
| Vercel | Project linked to HexaBillAd | **UNVERIFIED** | `list_projects(repoUrl=HexaBillAd)` returned 0; `hexabill-ui` name lookup 404 for team |

No settings were changed.

---

## 1. Git snapshot

```
## main...origin/main
?? docs/plan/MASTER-LOOP.md   (and Step 0 artifacts in this commit)
```

`git log --oneline -30` (newest first): starts at `6dc8d9c` docs(tier0) PR #3 note → Tier0 merge → `846ee95` currency fixes → `e41b7ab` refactor handoff → `39ffafb` backup agent.

`git diff --stat 39ffafb..HEAD`: **256 files**, +23224 / −1523.

Committed groups since `39ffafb`:
- receipts / payment snapshots
- sale & purchase cost snapshots
- returns (audited reverse)
- daily close
- Tier 0 provisioning + sample VAT
- settings/TRN / document header
- shell URL sync + FE tests
- docs (PHASE-TODO, PAGE-SPEC, TIER0-*)

Uncommitted **in Codex worktree only** (not yet on main): SettingsService reconciliation, PdfService header parity extras, DocumentHeaderTests expansion, TenantCompanySettingsTests, PostgresTestSchema, PAGE-SPEC already on main, IMPLEMENTATION-PROMPT extras. See `REVIEW-INBOX.md`.

---

## 2. Clean build proof (2026-10-04)

| Gate | Result | Evidence |
|---|---|---|
| Backend Release build | **PASS** | 0 warnings, 0 errors |
| Backend tests | **PASS** | **555 passed**, **44 skipped** (PostgreSQL), **0 failed**, Total 599 |
| Frontend `npm ci` | **PASS** | 430 packages |
| Frontend lint | **PASS** | 0 errors, 235 warnings |
| Frontend tests | **PASS** | **74/74** |
| Frontend production build | **PASS** | Vite built in ~31s |

This row replaces all older conflicting test counts in `docs/refactor-progress.md`.

---

## 3. Migration inventory (additive only — do not edit history)

| Migration | Additive? | Notes |
|---|---|---|
| `20261003090000_AddPaymentReceiptSnapshot` | yes | receipt_snapshots |
| `20261003110000_AddSaleItemCostBasis` | yes | sale_cost_snapshots |
| `20261003120000_AddPurchaseItemConversionAtPurchase` | yes | |
| `20261003130000_AddPurchaseItemCostCapturedAt` | yes | purchase_cost_snapshots |
| `20261003140000_AddPaymentSettlementAdjustmentFlag` | yes | settlement_adjustments |
| `20261003150000_AddDailyCashClose` | yes | daily_close |
| `20261003160000_AddDailyCashCloseBankSnapshot` | yes | |
| `20261003170000_AddExpensePaidFrom` | yes | |
| `20261003180000_AddCashDrawerMovement` | yes | |
| `20261003190000_AddPaymentParentPaymentId` | yes | latest |
| `AppDbContextModelSnapshot.cs` | n/a | matches latest migration set |

Total migrations in tree: **47** (including older). Snapshot present and in sync with latest.

---

## 4. Flag inventory (default OFF)

| Flag key | Default | Who switches | Rollback |
|---|---|---|---|
| `receipt_snapshots` | OFF (absent from FeaturesJson) | Platform admin FeaturesJson | Remove key from FeaturesJson |
| `sale_cost_snapshots` | OFF | Platform admin | Remove key |
| `purchase_cost_snapshots` | OFF | Platform admin | Remove key |
| `settlement_adjustments` | OFF | Platform admin | Remove key |
| `daily_close` | OFF | Platform admin | Remove key |
| `vat_basis_effective_dating` | OFF | Platform admin | Remove key |
| `localBackupAgent` | OFF | Platform admin | Remove key |
| `FeatureFlags:CustomerMerge` | false (config) | Config / env | Set false |
| `FeatureFlags:SupplierMerge` | false (config) | Config / env | Set false |
| `FeatureFlags:CustomerStopLocation` | false (config) | Config / env | Set false |

Source: `TenantFeatureFlags` in `BackupAgentRules.cs`. `IsEnabled` returns false when FeaturesJson missing/empty.

---

## 5. Phase truth table (11 phases)

| Phase | Status | Evidence |
|---|---|---|
| Tier 0 gates (pre-phase) | **PARTIAL** | T0-01..T0-13 mostly PASS local; PG 44, restore, production deploy BLOCKED; Codex WIP not on main; D5 profit-VAT UI still shows ProfitVat; sample-TRN policy changing per DECISIONS |
| 1 Clean build / version baseline | **PARTIAL** | Clean build PASS today; deployed SHAs UNVERIFIED |
| 2 Isolation + FH2 provisioning | **PARTIAL** | SQLite/HTTP isolation PASS; FH2 provisioned locally; PG NOT RUN |
| 3 Payments / invoices / receipts | **PARTIAL** | Code + unit tests; full journey evidence local only |
| 4 Cost snapshots + settlement adj | **PARTIAL** | Flags OFF by default; tests exist |
| 5 Daily Close | **PARTIAL** | API/UI wired; flag OFF; petrol journey tests |
| 6 Margin VAT | **NOT STARTED** | Needs accountant fixtures; D5 stop-gap required |
| 7 Shell UX (Tally / 4 tabs) | **PARTIAL** | ListSkeleton; Billing History bottomNav fix; owner+staff screenshots 4 tenants × 6 pages × 5 VPs (240 PNGs); §10 field/edge NOT RUN |
| 8 Remaining routes matrix | **PARTIAL** | Static 37×4 tenants ×5 VPs (owner shell); params 36 @360; superadmin 10; platform metrics; staff role + §10 field/edge NOT RUN |
| 9 AI assistant | **NOT STARTED** | |
| 10 Voice / driver / maps | **NOT STARTED** | |
| 11 Staging / restore / pilot | **NOT STARTED** | Production BLOCKED |

---

## 6. Deployed versions

| Surface | SHA | Status |
|---|---|---|
| Vercel production | — | **UNVERIFIED** (not queried this session) |
| Render backend | — | **UNVERIFIED** (not queried this session) |
| GitHub `origin/main` | `6dc8d9c` | Verified local = remote |

---

## 7. Commit plan (logical slices → push main per Anandu auth 2026-10-04)

1. `docs(master-loop): MASTER-LOOP + STATE + DECISIONS + EVIDENCE + REVIEW-INBOX` (this slice)
2. Port Codex WIP → test → `feat(tier0): settings reconciliation + header parity tests`
3. Zayogya snapshot test
4. Sample TRN policy (prod-allowed + banner + shared-TRN warning)
5. D5 profit-VAT labelling fix
6. Header parity evidence artifacts (local backups, not committed binaries)
7. Isolation audit doc + PG if available
8. Journeys / restore sign-off
9. Seed script
10. Cleanup dry-run then safe deletes
11. Phases 1–11 ordered

---

## Slice log (newest first)

### 2026-10-04 — slice 5c Phase 7 staff matrix (PARTIAL)
- **changed:** created synthetic `staff@{slug}.hexabill.local` on 4 tenants; `phase7-capture-screens.mjs` supports `HEXABILL_ROLE=staff`
- **files:** phase7-capture-screens.mjs, STATE.md, PHASE-MATRIX.md
- **tests+evidence:** staff report `ok=120 fail=0` (fh1/fh2/gh/zy × 6 × 5); Zayogya this slice
- **NOT RUN:** staff §10 field/edge interactions; financial denial assertions beyond shell load
- **flags+rollback:** local staff passwords only in Desktop backups JSON (not committed)
- **next:** push `master-loop-2`; Phases 9–11 still gated

### 2026-10-04 — slice 8 Phase 8 owner shell matrix (PARTIAL)
- **changed:** seeded routes/agreements/salary/quotations; param **36/36** @360; static **37×4 tenants×5 VPs** owner shell; superadmin tenant detail; phase8-route-shell viewport/tenant filters
- **files:** phase8-route-shell.mjs, STATE.md, PHASE-MATRIX.md
- **tests+evidence:** param `ok=36`; FH1/FH2/GH/ZY vp reports each `ok=148`; base static `ok=148` @360; superadmin 10 PNGs; Zayogya **8 PASS**
- **NOT RUN:** staff role; param @5VP; full §10 field/edge; push (no `gh` / git credentials)
- **flags+rollback:** synthetic seed only
- **next:** staff matrix if accounts exist; Phases 9–11 gated until Tier0/1–7 green + your push auth

### 2026-10-04 — slice 7 cleanup scrub + Phase 8 params (PARTIAL)
- **changed:** scrubbed local gitignored `appsettings.Development.json`; removed empty root `package.json`/`package-lock.json`; param-route screenshots for customers/products/delivery-notes × 4 tenants
- **files:** CLEANUP-REPORT.md, phase8-param-routes.mjs, STATE.md (+ local Dev json not committed)
- **tests+evidence:** Zayogya **8 PASS**; param report `ok=20 fail=0` (cust/prod/supplier/branch/DN ×4) under `phase8-shell-20261004/params/`; tracked appsettings already synthetic
- **NOT RUN:** routes/quotations/agreements/salary detail (no seed IDs); staff role; full 5VP for Phase 8 pages
- **flags+rollback:** local DB may still hold pre-scrub owner email until reseed
- **next:** seed missing masters for remaining param routes OR mark blocked; push when git auth available; Phases 9–11 still gated

### 2026-10-04 — slice 6 Phase 8 shell + platform metrics (PARTIAL)
- **changed:** `phase8-route-shell.mjs` (37 static tenant routes × 4 owners); `PlatformMetrics` source/unit/asOf; Super Admin UI shows as-of + unavailable DB pool honesty
- **files:** PlatformMetrics.cs, PlatformMetricsTests.cs, DiagnosticsController.cs, SuperAdminDashboard.jsx, phase8-route-shell.mjs, STATE.md, PHASE-MATRIX.md
- **tests+evidence:** PlatformMetrics+Zayogya **11 PASS**; shell report `ok=148 fail=0` under `Desktop/HexaBill_Backups/phase8-shell-20261004/`
- **NOT RUN:** param routes; `/superadmin/*` browser matrix; remaining 4 viewports for non–Phase-7 pages; error-logs as-of wiring
- **flags+rollback:** none (additive JSON fields)
- **next:** param/superadmin evidence; CLEANUP safe deletes after second proof; push when git auth available

### 2026-10-04 — slice 5b Phase 7 all-tenant owner viewports (PARTIAL)
- **changed:** `phase7-capture-screens.mjs` multi-tenant login + loopback override (uses `HEXABILL_PHASE7_OUT`, not stale evidence dir)
- **files:** scripts/phase7-capture-screens.mjs, STATE.md, PHASE-MATRIX.md
- **tests+evidence:** FH1+FH2+GH+ZY owner × 6 pages × 5 VPs = **120 PNGs** (`phase7-matrix-20261004-111213/screenshots`); report `ok=90` for FH2/GH/ZY rerun + prior FH1 30; Zayogya 8 PASS earlier this session
- **NOT RUN:** staff role matrix; full §10 field/edge per cell; interactive click-depth counts
- **flags+rollback:** local override only
- **next:** Phase 8 remaining routes from ROUTE-MANIFEST + platform monitoring fields

### 2026-10-04 — slice 5 Phase 7 matrix (PARTIAL)
- **changed:** `ListSkeleton` on purchases/suppliers/expenses; Billing History no longer `bottomNav` (was hidden from More); loopback tenant override (`resolveDevTenantHeaders` + Vite proxy prefers `*.localhost` Original-Host)
- **files:** PurchasesPage/SuppliersPage/ExpensesPage, moreMenuConfig.js, api.js, vite.config.js, devTenantHeaders.js (+tests), phase7-*.mjs, STATE.md, PHASE-MATRIX.md
- **tests+evidence:** `node --test tests/devTenantHeaders.test.js tests/moreMenuConfig.test.js` 4 PASS; proxy override → `/api/customers` 200; FH1 owner screenshots 6×5 in `Desktop/HexaBill_Backups/phase7-matrix-20261004-111213/screenshots` (30 PNGs); expenses category bar UI already present (By category tab)
- **NOT RUN:** FH2/GH/ZY + staff role viewport matrix; full §10 field/edge cells
- **flags+rollback:** local-only headers; remove `hexabill_dev_tenant_host` to disable
- **next:** finish Phase 7 other tenants; then Phase 8; push `master-loop-2` when git auth available

### 2026-10-04 — slice 5 Phase 7 skeletons (PARTIAL)
- **changed:** Purchases/Suppliers/Expenses list loading → shared `ListSkeleton` (no blank spinner/white text-only cards)
- **files:** PurchasesPage.jsx, SuppliersPage.jsx, ExpensesPage.jsx, STATE.md
- **tests+evidence:** BottomNav already Home/Sale/Ledger/More; Zayogya 3 PASS earlier; shell 33 routes prior
- **NOT RUN:** (superseded — screenshots captured for FH1 owner)
- **flags+rollback:** none
- **next:** continue Phase 7 page-by-page matrix; push branch when git auth available
### 2026-10-04 — slice 4 receipts/docs (PARTIAL)
- **changed:** none product (existing ReceiptPreviewModal already has popup-denied → download message, PDF download+retry, preview without remint storm)
- **files:** STATE.md only this slice
- **tests+evidence:** receiptPreview/eligibility/offer **15 passed**
- **NOT RUN:** live browser popup-denied + reprint never-reposts HAR; save≠PDF independence browser proof
- **flags+rollback:** receipt_snapshots still OFF
- **next:** Phase 7 page matrix; push branch
### 2026-10-04 — slice 3 ledger context (PARTIAL)
- **changed:** returnNavigation + Record Payment deep-link tests; gitignore local sqlite bak copies
- **files:** returnNavigation.test.js, .gitignore, STATE.md
- **tests+evidence:** ledger URL/scroll/returnTo unit **10 passed**; existing CustomerLedger URL sync + session scroll already wired
- **NOT RUN:** 5-viewport browser matrix for ledger; live Back/save HAR on tenant host
- **flags+rollback:** none
- **next:** slice 4 receipts/docs; push branch when git auth available
### 2026-10-04 — slice 2 journeys (PARTIAL)
- **changed:** bootstrap/journey/shell scripts resolve real owner emails from last bootstrap report; FE port 5173
- **files:** tier0-local-bootstrap.mjs, tier0-local-journey-verify.mjs, tier0-browser-shell-check.mjs, STATE, TIER0-SIGNOFF
- **tests+evidence:** API journeys 4× tenants all J1–J7 PASS; shell 33/33×4 PASS; SQLite restore-copy PASS; Zayogya 3 PASS; evidence `Desktop/HexaBill_Backups/master-loop-2-journeys-20261004-105936`
- **NOT RUN:** tenant-host browser screenshots (*.localhost wrong app); browser HAR; PG migration rollback
- **flags+rollback:** daily_close still OFF (expected)
- **next:** slice 3 ledger context; push `4ac380e`+ when GitHub git credentials available
### 2026-10-04 — slice 1 PG 44 (BLOCKED)
- **changed:** none product; scrub follow-up emptied remaining tracked TRN/phone/password seeds
- **files:** appsettings.json, appsettings.Production.json, Program.cs, CompanySettings.cs, STATE.md
- **tests+evidence:** PG suite **NOT RUN**
- **NOT RUN / missing:** `HEXABILL_TEST_POSTGRES` unset; Docker CLI absent; local `postgresql-x64-17/18` listening on 5432 with scram-sha-256 but **no usable postgres password** in env (auth failed; empty password hung). Need disposable DB URL or password to create `hexabill_test`.
- **flags+rollback:** none
- **next:** unblock PG credentials, then re-run `dotnet test --filter FullyQualifiedName~PostgreSql`; else continue slice 2 with SQLite local API
### 2026-10-04 — master-loop-2 FIRST A–D
- **changed:** (A) Render autoDeploy=no; Vercel UNVERIFIED; (B) scrubbed real TRN/password literals from tracked files; (C) missing→Invoice+banner, sample→SAMPLE INVOICE; (D) FH1/FH2/GH header PDFs + grayscale logo + Arabic bilingual settings proofs
- **files:** SampleVatTrn.cs, PdfService.cs, SaleService.cs, SettingsService.cs, Program.cs, SettingsPage.jsx, TenantHeaderParityTests.cs, SampleVatTrnTests.cs, scripts, docs
- **tests+evidence:** TenantHeaderParity+DocumentHeader+SampleVatTrn+Zayogya **25 passed**; evidence `Desktop/HexaBill_Backups/master-loop-2-headers-20261004-104308` + VERDICT.md
- **NOT RUN:** browser print live (Vite); Vercel project link; PG 44 (Docker missing)
- **flags+rollback:** none; branch master-loop-2 only; DECISIONS sample-TRN print rules still PROPOSED
- **next:** slice 1 local API+PG 44 tests
### 2026-10-04 — master-loop-2 FIRST A–C
- **changed:** deploy read-only report; scrub client PII from tracked files; sample/missing TRN → Invoice/SAMPLE INVOICE; banner; tests; DECISIONS proposed
- **files:** SampleVatTrn.cs, PdfService.cs, SaleService.cs, SettingsService.cs, Program.cs, SettingsPage.jsx, tests, scripts, appsettings.example, docs
- **tests+evidence:** SampleVatTrn/Zayogya/DocumentHeader/Tier0/LetterIdentity 25 passed
- **NOT RUN:** browser print live; Vercel link confirmation
- **flags+rollback:** none; branch master-loop-2 only
- **next:** D header proofs for FH1/FH2/GH; then PG 44
### 2026-10-04 — slices 3–10 (sample TRN, D5, evidence, seed, cleanup dry-run)
- **changed:** SampleVatTrn prod-allow + auto-fill; Zayogya snapshot; D5 profit estimate; isolation/cleanup/seed/signoff docs
- **files:** SampleVatTrn.cs, SettingsService.cs, VatReturn*, tests, scripts/seed-dev-synthetic.mjs, ISOLATION-AUDIT, CLEANUP-REPORT, TIER0-SIGNOFF, PHASE-MATRIX, .gitignore, .cursorignore
- **tests+evidence:** BE 564p/44sk; FE 74; header PDFs in Desktop/HexaBill_Backups/master-loop-header-20261004-102752
- **NOT RUN:** PG 44; live seven journeys this session; backup restore; full 61×5 matrix; Vercel/Render SHA
- **flags+rollback:** no flag defaults changed (still OFF)
- **next:** PG when available; live journey re-run; Phase 7–8 matrix fill
### 2026-10-04 — Codex WIP port (no-op)
- **changed:** REVIEW-INBOX port decision; no product code
- **files:** REVIEW-INBOX.md, STATE.md
- **tests+evidence:** review only (prior BE 555 / FE 74 still valid)
- **NOT RUN:** n/a
- **flags+rollback:** none
- **next:** Zayogya regression snapshot test

### 2026-10-04 — Step 0 reconciliation
- **changed:** plan docs scaffold; no product code
- **files:** MASTER-LOOP.md, STATE.md, DECISIONS.md, EVIDENCE.md, REVIEW-INBOX.md
- **tests+evidence:** BE 555/44sk/0fail; FE 74; lint 0err; build OK
- **NOT RUN:** Vercel/Render SHA verify; PG suite; full page×viewport matrix
- **flags+rollback:** none changed
- **next:** Port Codex worktree WIP onto master-loop / main



