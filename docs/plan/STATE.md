# STATE.md — HexaBill single source of truth

## Current strict checkpoint — 8 October 2026

Authoritative current work is tracked in [PRODUCTION-STABILIZATION-STATE.md](PRODUCTION-STABILIZATION-STATE.md), [PRODUCTION-ISSUE-REGISTER.md](PRODUCTION-ISSUE-REGISTER.md), and [FINAL-PRODUCTION-SIGNOFF.md](FINAL-PRODUCTION-SIGNOFF.md). Branch release-1, starting HEAD bdcc429; work remains uncommitted. Latest backend692/692, PostgreSQL enabled/zero skips, frontend113/113; lint0errors/234warnings, FE build27.95s PASS. These are checkpoint regressions, not production certification.

Trusted-host scoped shared-email login and request-stage timings implemented; baseline test contamination isolated and obsolete print fixtures repaired. Owner-directed5% positive operating-profit comparison appears in existing ProfitBased VAT views, while posted VAT/filing totals and SalesBased Zayogya remain unchanged. GulfHarvest/Zayogya actual form/dashboard/VAT browser proof and all four API/SQL balances205/100/105 recorded. PaymentModal retry-key defect reproduced in the actual React component and fixed using the existing ledger recovery journal; local browser/PG recovery verified (same key/body/payment10), both new rows voided; broader acceptance OPEN. PaymentsPage single/bulk retries and the full master gate remain OPEN. No final commit/main push/deploy.


## Current release override — 4 October 2026, Codex Stage A

**Authoritative latest checkpoint — REL-032, 5 October 2026 IST:** Bills totals now sum the displayed rows' actual paid amounts rather than face values of fully paid invoices. Chrome before shows row100 paid/footer0; after shows100 paid/105 pending. Shared calculator is also used by the new mobile summary. Seven regressions applied to the extracted original calculation had5fail/2pass before; all7 now pass. Full frontend **99 passed / 0 failed / 0 skipped**, lint **236 warnings / 0 errors**, build **28.72s PASS**; Zayogya snapshots **3/3**. Five Bills viewports captured and actually inspected. Empty date-filtered results show0/0/0 on desktop/mobile and retain customer/tab/dates after refresh. Real Chrome invoice payment5 posts only ID22, invoice paid100→105 and Bills totals100/105→105/100 without reload; receipt preview shows5 AED. UI void retains22VOID, disables receipt controls, restores invoice paid100 and Bills100/105; original receipts remain CLEARED and all four synthetic balances105. No backend/schema/VAT/print implementation changed; previous full backend673/0/0 remains historical. Full page counter **0 DONE / 2 partial / 59 NOT RUN**; receipt preview is not full PDF/header/print acceptance. MigrationProof=false; migration/VAT/golden/rollback blockers remain. Stage A **FAIL / IN PROGRESS**, B/C/D not started. No production operations, commits/pushes, flag or migration-history changes. Next: remaining Customer Ledger/receipt acceptance, full fixture matrix and other tenant journeys. Owned Chrome/API/Vite/PG stopped, runtime secrets/storage cleared, data/evidence preserved; user services5000/5173 untouched. Final reconciliation/cleanup proof is in RELEASE-AUDIT.

**Historical checkpoint — REL-033/034, 5 October 2026 IST:** Chrome reproduced an S1 manual retry defect: a committed 20 AED payment with a lost response followed by Save generated a new UUID and a second receipt (IDs 12/13). Customer Ledger now persists the original scoped request/key in sessionStorage before sending; changed forms cannot replace uncertain payments, and a recovery action survives reload. After fix Chrome confirms a single 21 AED payment across two same-key/same-payload calls; Pay All 105 AED survives reload with frozen 5/40/60 allocations despite the refreshed outstanding list being empty; a real 30-second UI timeout followed by retry also retains one 19 AED payment. Additional denied-retry check reproduced two 23 AED receipts after a forced client403 discarded uncertainty; fixed by retaining the original request on rejected recovery attempts. After correction, lost response/403/success uses one key/body and confirms only one27 AED receipt (ID21). Each new receipt was voided through the application's API, retaining IDs 12–21 as VOID; original receipts remain CLEARED and all four synthetic tenants reconcile to 205 sales / 100 paid / 105 balance. REL-034 corrects overlapping general-payment explanatory text on mobile. Frontend **92 passed / 0 failed / 0 skipped**, lint **236 warnings / 0 errors**; production build PASS in 41.83s (remaining chunk-size/stale browser-data warnings). Focused Zayogya snapshots **3/3** pass; previous full backend **673/0/0** remains historical (backend unchanged this iteration). Screenshots are inspected, but complete page acceptance remains **0 DONE / 2 partial / 59 NOT RUN**. REL-032 Bills paid footer remains OPEN. MigrationProof=false, rollback key compatibility and all migration/VAT/golden release blockers remain unresolved. No production operations, commits/pushes, historical migration edits or feature-flag changes. Stage A **FAIL / IN PROGRESS**; B/C/D not started. Next: REL-032, then remaining money page interactions/error states and tenant journeys. Owned browser/API/Vite/PG stopped, runtime secrets and browser storage cleared, temp evidence/data preserved; pre-existing ports5000/5173 untouched. Cleanup proof is in RELEASE-AUDIT.

**Historical checkpoint — REL-031, 5 October 2026 IST:** real installed Chrome now runs against a guarded loopback synthetic PostgreSQL/Vite/API TestServer bridge. Chrome reproduced missing Pay All: all outstanding invoices were removed by the ledger's customer filter because `OutstandingInvoiceDto` omitted `customerId`. Added the DTO field and mapped the already tenant/customer-scoped sale identity; the real HTTP regression failed before, then focused customer isolation **16/16** passed. Full backend on a separate fresh disposable PostgreSQL database: **673 passed / 0 skipped / 0 failed** (1m32s); API Release **43 warnings / 0 errors**. Chrome after fix: Pay All allocates **105 AED as 5 + 40 + 60**, balance goes **105 → 0 → 105** after each new payment is voided through the UI. IDs 9/10/11 retained VOID, original independent IDs 1/2 remain CLEARED; database customer/sale/payment totals reconcile; all other synthetic tenants remain at their baseline. Five ledger viewports captured and inspected; no Chrome page errors. Browser counter remains **0 DONE / 2 partial / 59 NOT RUN**. Newly observed REL-032: Bills footer says Total Paid 0 despite a visible 100-paid partial invoice; still OPEN. Test host explicitly reports `migrationProof=false`; initialization proof, lost-response/manual resubmission, complete interactions/error states, other tenant browser journeys and full data matrix remain unverified. All owned browser/API/Vite/PG services stopped, temp evidence/data preserved; pre-existing ports 5000/5173 untouched. No production/Zayogya writes, push, merge, deploy, schema history or flag changes. Stage A **FAIL / IN PROGRESS**; B/C/D not started. Next: money UI timeout/resubmission-key lifetime and REL-032, then continue page acceptance. Migration/VAT decisions and approved golden baselines remain release blockers.

**Historical checkpoint — REL-030:** final full PostgreSQL-enabled backend suite **672 passed / 0 skipped / 0 failed** (1m20s); focused idempotency/void identity checks **17/17**; API Release **43 warnings / 0 errors**. Frontend **84/84**; lint **237 warnings / 0 errors**; Vite build **33.59s**. Payment create/allocation now share tenant-qualified hashed keys, a transaction key lock before lookup, canonical request hashes, atomic response snapshots, tenant-scoped legacy lookup and safe live refresh after retained-payment mutation/void. Ledger and allocation API forward the same caller key. First full attempt found 3 stale void-status regressions (667 pass / 3 fail); corrected and final suite green. No schema/history migration changed. Compatibility still requires Stage B proof: an old rollback build cannot recognize new hashed keys; legacy rows lack full request fingerprints. Browser counter **0 DONE / 2 partial / 59 NOT RUN**. Stage A **FAIL / IN PROGRESS**, B/C/D not started. Dedicated loopback PostgreSQL cluster stopped; temporary data preserved. No production/Zayogya writes, push, merge, deployment or flag changes. Next: establish isolated synthetic browser/authenticated stack and exercise money retry/void journeys; migration/VAT decisions and golden baselines remain release blockers.

**Historical checkpoint — REL-029:** full backend on a fresh dedicated disposable PostgreSQL 17 UTF-8 database passed **658 / 0 skipped / 0 failed** (1m18s); Release build passed **43 warnings / 0 errors**. Frontend test/lint/build commands passed; lint remains **237 warnings / 0 errors**, Vite build **32.78s**. Allocation's sub-cent rounding defect is implemented locally: before-fix tests observed a 0.03 AED receipt posting 0.04 AED and a 0.004 request posting a zero-value payment; inputs with sub-cent totals or invoice allocations now fail before writes. A valid 0.03 split posts 0.02 + 0.01 and refreshes balances. Ledger pay-all total uses the existing money-rounding helper to remove JavaScript summation noise. Browser acceptance remains **0 DONE / 2 partial / 59 NOT RUN**. Stage A remains **FAIL / IN PROGRESS**; Stages B/C/D have not started. Test cluster stopped, temp data preserved; no production/Zayogya writes, deploy, push, merge, or feature-flag changes. Next money review: idempotency's global raw-key storage/pre-transaction lookup and missing allocation client header need behavioral regressions.

**Historical checkpoint — REL-028:** branch `release-1`, HEAD `9935fff` plus uncommitted local changes. Stage A **FAIL / IN PROGRESS**. Full backend suite after payment-allocation fixes: **654 passed / 0 skipped / 0 failed**, including PostgreSQL integration and allocation concurrency; duration 1m21s. Isolated incremental Release build rechecked successfully: **0 warnings / 0 errors** (this incremental result does not supersede the earlier clean-build warning inventory). REL-028 reproduced duplicate-entry and concurrent over-allocation: two simultaneous requests recorded 200 AED against a 100 AED invoice before the fix. Allocation now rejects repeated invoice IDs, takes tenant/customer-scoped invoice locks in stable order before reading outstanding amounts, refreshes sale state from the payment ledger, and rolls back when no allocation is possible. Four new regressions pass. Browser counter remains **0 DONE / 2 partial / 59 NOT RUN**; no page acceptance claimed. Disposable PostgreSQL 17 UTF-8 loopback test cluster on port 55441 is stopped and its temp data preserved. No production or Zayogya writes, push, merge, migration, deployment, or flag changes.

Urgent order remains: REL-004 migration-history/baseline strategy and REL-011 startup schema ownership; REL-015/016 accountant-approved VAT mapping/fixtures; REL-007 approved Zayogya golden baseline; REL-025 document-title policy and active browser paths; full tenant browser journeys and dependency triage. Continue reviewing money idempotency and amount precision locally while those external decisions remain unresolved. Stages B/C/D have not started and production approval is not requested while Stage A fails.

Read PRODUCTION-RELEASE-LOOP.md and RELEASE-AUDIT-20261004.md before historical entries below. Local branch `release-1` starts from `315c1c5`. Stage A **FAIL / IN PROGRESS**. Production merge/migrations/deploy and smoke-tenant creation are unchecked in the latest owner authorization; older push/main permissions below are superseded for this release.

Latest release state (2026-10-04): backend full suite against a disposable PostgreSQL 17 UTF-8 cluster after REL-011/020/021/022/023/024 changes **648 passed / 0 skipped / 0 failed**; PostgreSQL cases, including isolation and close-vs-post concurrency, all executed; Release API build passed with 43 compiler warnings / 0 errors. REL-023 closes tenant-status lookup fail-open during login. REL-024 tenant-isolation review fixed supplier merge PurchaseReturns preview/update to scope TenantId; behavioral regression passes; full PostgreSQL suite now passes 648/648 with zero skips or failures. This turn full PostgreSQL-enabled backend suite passed 648 / 0 failed / 0 skipped; isolated Release API output build passed with 0 warnings/errors and git diff --check passed. Frontend clean install passed; tests **82/82**, lint **0 errors / 237 warnings**, production build passed (34.52s; chunk-size and stale browser-data warnings). `npm audit` reported 28 dependency advisories (22 high, 4 moderate, 2 low). Fresh EF migration rehearsal still fails 42P07 Customers already exists. A static scan of 50 handwritten migrations found 30 repeated table-creation targets: 27 shared by InitialPostgreSQL/AddBranchAndRoute plus later duplicate supplier-table creates. Skipping only the first colliding migration would therefore still fail later. An additive migration cannot run ahead of the earliest collision, and project rules forbid edits to old migrations; owner-approved historical repair/baseline strategy is required. Tests using EnsureCreated are not migration proof. REL-011 readiness remains PARTIAL: the new request gate blocks non-health traffic and `/health` plus `/health/ready` fail closed; startup DDL catches and migration-chain collisions still gate release (REL-004/011). REL-022 additionally closes anonymous RefundNow cash accounting and branch Daily Close refund filtering locally; full PostgreSQL rerun passed 647/647, zero skips/failures; Release build 43 warnings / 0 errors. Browser acceptance remains partial (0 pages DONE; 2 partial; 59 NOT RUN). The isolated ledger browser now verifies CASH/CHEQUE mode filtering against two independent equal receipts plus a pending cheque; no production page was touched. The prior PG-enabled 618-pass statement below is historical and is not current evidence for this working tree.

Latest review follow-up: supplied E2E prompt read. Added REL-025: both POS variants hardcode “Tax Invoice”, and the same-day decision log conflicts on whether sample-TRN output must be labelled “SAMPLE INVOICE”; primary PDF render paths use the policy helper, while legacy fallback paths remain to be proven reachable. Exact file scan has 0 byte-identical files; repeated source windows and migration create collisions remain separate categories (clone candidates versus migration safety defect). No product code changed. Stage A remains FAIL; S1 migration and VAT mapping remain the immediate blockers.

Latest code iteration: REL-026 fixed locally. Return and credit-note workflows now pass the caller's explicit tenant ID to customer balance recalculation rather than resolving it through an unscoped customer-key lookup. Failing-before synthetic regression proves a tenant-A return could rewrite a malformed tenant-B customer balance under platform scope (777 to 0); the corrected path preserves the other tenant's row. `ReturnStockTests` plus `CreditNoteDailyCloseTests`: 22/22 passed. After-change full backend suite against a newly initialized disposable PostgreSQL 17 UTF-8 cluster: 649 passed / 0 skipped / 0 failed. Isolated Release API build: 43 warnings / 0 errors. The cluster ran only on loopback port 55441 and was stopped afterward; its temp data directory is preserved. No browser acceptance claimed.

Next Stage A code review expanded that boundary to the shared `IBalanceService`: tenant ID is required for recalculation, validation, repair and balance update APIs, including sales/payment calls, admin validation and periodic reconciliation. Added a platform-scope regression for cross-tenant customer IDs. The complete PostgreSQL suite after this change passed 650/650, zero skips/failures; isolated Release build passed with 43 warnings / 0 errors. Disposable loopback PG17 cluster is stopped; its temp data is preserved.
Latest pre-REL-020 PostgreSQL backend run passed **635 / 0 skip / 0 fail**; the post-REL-020 run recorded 637 passed / 1 intermittent SQLite schema setup failure / 0 skipped (see continuation details below). API build passed with 0 warnings/errors. The return reversal guard now checks approved generated write-off expense dates as well as refund dates. REL-018's global raw-SQL `fix-columns` route is retired; its HTTP regression proves tenant-owner denial and preservation of a synthetic other-tenant row. REL-019 now stores random per-execution SQL console IDs instead of raw query literals in logs/audit and uses generic execution errors. Before these changes, the full non-PostgreSQL run passed 587 / 45 skips / 0 failures; no post-change non-PostgreSQL full run is claimed. Remaining return mutation edges require review.

Latest code-review finding: REL-011 is more severe than a misleading migration history alone. `Program.cs` runs separate delayed and background migration/init paths, suppresses their failures, and may continue serving. Production PostgreSQL skips EF migrations but still attempts ad-hoc DDL; `/health/ready` checks connectivity rather than schema readiness. This needs a single fail-closed initialization/readiness lifecycle and regression tests. No startup behavior changed in this documentation/review iteration.

2026-10-04 continuation: REL-011 partial containment implemented. `/health/ready` now stays 503 until the async DB initializer reports success, then checks DB connectivity and requires zero pending EF migrations; readiness errors return generic schema status without database exception details. Initializer marks failure on uncaught errors and does not mark ready if migrations remain pending. HTTP test drives initialization-pending, failed initialization, and connected-but-unmigrated schema states; all return 503. Combined readiness, purchase-return, and Zayogya regressions pass 10/10. Full PostgreSQL-configured backend suite after these edits: 639 passed / 0 failed / 0 skipped. Release build completes with 43 compiler warnings / 0 errors. Migration checking and asynchronous initialization now share one background task. Pre-host DDL and nested best-effort DDL handlers remain, so REL-011 is PARTIAL.

Follow-up: found the Production/Render initializer fast path returned before marking readiness complete, which would leave production perpetually unready. It now checks pending migration history before returning; pending migrations or required supplier-credit schema errors leave the process fail-closed. Readiness completion is monotonic: a later success cannot clear a previously failed status. Focused readiness + purchase-return tests pass 7/7. The full PostgreSQL-configured backend suite after this correction passed 643/643 with zero skipped; the Release build passed with 43 warnings and zero errors.

2026-10-04 continuation: REL-020 found purchase returns could exceed original line quantities, including repeats, and did not serialize returns. Added tenant-scoped transaction serialization, PostgreSQL purchase-row locking, and quantity/request validation. Focused `PurchaseReturnStockTests`: **6 passed / 0 failed**. Full PostgreSQL-configured backend suite after the fix: **637 passed / 1 failed / 0 skipped**; all PG cases ran, but `AgreementsHttpIsolationTests.GetAgreement_OtherTenantsAgreement_ReturnsNotFound` intermittently failed during SQLite `EnsureCreated` with `DemoRequests already exists`. The same HTTP isolation class passes when rerun alone (3/3); return concurrency plus that class passes 5/5. A subsequent full PostgreSQL-configured run after readiness changes passed 639/639 with zero skipped; see the latest evidence row. Browser session was unavailable: the embedded browser mapped `localhost:5173` to the Paperclip app instead of the local Vite server; no page acceptance is claimed. Working tree contains this local fix and evidence updates only.

REL-001/003 safety guards implemented with tests observed failing before fixes. REL-002 DELETE and status VOID share audited reversal, retain source/exact linked adjustments and idempotency, and reject reactivation/edit. Concurrent PostgreSQL void reproduced duplicate audits before transaction row locks; after locks, two requests yield one audit. Payment-edit balance regression now passes with payment saved before aggregates. Chrome synthetic GulfHarvest: equal receipts retained, void changes balance 5 to 55, void receipt disabled, unsafe cleanup 409, force delete 400, reactivation/edit 400, cross-tenant payment 404; CASH/CHEQUE filter displays only matching mode and pending cheque receipt remains disabled. Five layout screenshots inspected; mobile/header/table interactions remain partial. REL-015/016 S1 confirm reverse-charge undercount and mismatch between local persisted/UI VAT box meanings and the current FTA Form 201 guide; accountant-approved mapping is required before a filing calculation change. Detailed evidence in EVIDENCE.md; register remains open pending complete journeys. No production work, feature enablement, push or merge.

Local checkpoints: `ba319df` money corrections and regression tests; `6bfa5a8` isolated synthetic fixture tooling. Both remain on `release-1`, unpushed. The required full data matrix, VAT reconciliation, migration strategy and complete browser journey gate remain outstanding.

---

**As of:** 2026-10-04 (IST)  
**Executor:** Cursor Agent on main repo  
**Working tree:** `C:\Users\anand\OneDrive\Desktop\My StartUps Projects\HexaBilngApp`  
**Branch:** `master-loop-2` (tip advancing; owner authorized push main+branch this slice)  
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
| Backend tests | **PASS** | Non-PG: **558 passed** / 0 failed. With `HEXABILL_TEST_POSTGRES` on local `:5433`: **55/55 PostgreSql PASS** (2026-10-04) |
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
| Tier 0 gates (pre-phase) | **PARTIAL** | T0-01..T0-13 mostly PASS local; **PG suite 55/55 PASS** on disposable `hexabill_master_loop_test` @ `:5433`; restore copy PASS; production deploy still blocked; D5 profit-VAT UI still shows ProfitVat |
| 1 Clean build / version baseline | **PARTIAL** | Clean build PASS today; deployed SHAs UNVERIFIED |
| 2 Isolation + FH2 provisioning | **PARTIAL** | SQLite/HTTP isolation PASS; FH2 provisioned locally; **PG isolation 55/55 PASS** |
| 3 Payments / invoices / receipts | **PARTIAL** | Unit tests + FH1 receipt HAR (0 POST on reprint×2); popup-denied path still NOT RUN |
| 4 Cost snapshots + settlement adj | **PARTIAL** | Flags OFF by default; tests exist |
| 5 Daily Close | **PARTIAL** | API/UI wired; flag OFF; petrol journey tests |
| 6 Margin VAT | **NOT STARTED** | Needs accountant fixtures; D5 stop-gap required |
| 7 Shell UX (Tally / 4 tabs) | **PARTIAL** | ListSkeleton; Billing History bottomNav fix; owner+staff screenshots 4 tenants × 6 pages × 5 VPs (240 PNGs); §10 smoke owner+staff 12×4@360 |
| 8 Remaining routes matrix | **PARTIAL** | Owner static 37×4×5VP; staff static 37×4@360; params 9×4×5VP; superadmin 10; platform metrics; §10 smoke only (not full matrix) |
| 9 AI assistant | **NOT STARTED** | |
| 10 Voice / driver / maps | **NOT STARTED** | |
| 11 Staging / restore / pilot | **NOT STARTED** | Production BLOCKED |

---

## 6. Deployed versions

| Surface | SHA | Status |
|---|---|---|
| Vercel production (`hexabill-ui`) | — | **UNVERIFIED** (project found `prj_GRooh8ebxo33R0uy5EspPoe5HmAo`; deployment list 403) |
| Render backend (`HexaBill` / `srv-d68jpdvpm1nc7393q4d0`) | `39ffafb` | **VERIFIED** live; `autoDeploy=no`; older than local `master-loop-2` tip |
| GitHub `origin/main` | `80998f1` | Owner-authorized sync 2026-10-04 (RTL shell slice) |
| GitHub `origin/master-loop-2` | `80998f1` | Same tip as main |

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

### 2026-10-04 — slice §10 Arabic RTL shell smoke (PARTIAL)
- **changed:** boot `hexabill_lang` → `html lang/dir` in `main.jsx`; new Playwright RTL smoke script
- **files:** `frontend/hexabill-ui/src/main.jsx`, `scripts/phase7-rtl-shell-smoke.mjs`, STATE.md, EVIDENCE.md, PHASE-TODO.md
- **tests+evidence:** FH1 owner ar RTL 9 pages × 360+1440 **ok=18 fail=0 warn=0** (`Desktop/HexaBill_Backups/rtl-shell-20261004`); Zayogya **8 PASS**
- **NOT RUN / blocked:** Phase 6 accountant fixtures; Phases 9–11; full §10 field-by-field (offline/Malayalam/…); production deploy
- **flags+rollback:** none (lang/dir boot only; default remains `en`/`ltr`)
- **next:** Phase 6 waits on fixtures; Phases 9–11 gated; expand RTL to FH2/GH/ZY if needed

### 2026-10-04 — slice flags-OFF live + dashboard CTA recheck (PARTIAL)
- **changed:** DashboardTally remove `lg:!min-h-9` on New invoice/purchase/ledger/expenses; Layout nav keep 44px; live flag inventory
- **files:** DashboardTally.jsx, Layout.jsx, STATE.md, EVIDENCE.md, PHASE-TODO.md
- **tests+evidence:** flags OFF ×4 tenants ×5 keys (`data:false`); TenantFeatureFlags/Subscription tests **7 PASS**; field-edge FH1 10p×2VP **ok=20 warn=1** then dashboard@1440 fix **ok=1 warn=0**; Zayogya **8 PASS**
- **NOT RUN / blocked:** Phase 6 accountant fixtures; Phases 9–11; full §10 field-by-field; production deploy
- **flags+rollback:** confirmed OFF by default (no flag changes)
- **next:** Phase 6 waits on fixtures; Phases 9–11 gated

### 2026-10-04 — slice Phase 3 live ledger+receipt re-verify (PARTIAL)
- **changed:** docs only; ran `phase3-ledger-receipt-evidence.mjs` against live API:5000 + Vite:5173
- **files:** STATE.md, EVIDENCE.md, PHASE-TODO.md
- **tests+evidence:** FH1 owner 5VP ledger+sales-ledger **ledgerOk=10 fail=0**; reprint HAR **receiptPosts=0 reprintSafe=true**; artifact `Desktop/HexaBill_Backups/ledger-receipt-live-reverify-20261004`
- **NOT RUN / blocked:** Phase 6 accountant fixtures; Phases 9–11; full §10 field-by-field; production deploy
- **flags+rollback:** none
- **next:** Phase 6 waits on fixtures; Phases 9–11 gated

### 2026-10-04 — slice §10 clear remaining md:min-h-9 / sm:min-h-0 (PARTIAL)
- **changed:** force `min-h-[44px]` across Billing History, Reports, POS drawer, Products row actions, Branch/Route links, Expenses/Purchases filters, DashboardTally, Return create; DailyClose/AuditLog already at tip
- **files:** BillingHistoryPage, ReportsPage, ProductDrawer, ProductsPage, BranchDetailPage, RouteDetailPage, ExpensesPage, PurchasesPage, DashboardTally, ReturnCreatePage, STATE.md, EVIDENCE.md
- **tests+evidence:** Zayogya **8 PASS**; `rg md:min-h-9|sm:min-h-0` in `frontend/hexabill-ui/src/*.jsx` → **0 hits**
- **NOT RUN / blocked:** Phase 6 accountant fixtures; Phases 9–11; full §10 field-by-field (Arabic/offline/RTL); production deploy
- **flags+rollback:** none (CSS touch targets only)
- **next:** Phase 6 waits on fixtures; Phases 9–11 gated; optional live receipt re-verify

### 2026-10-04 — slice §10 CustomerDetail/Products/Payments CTA ≥44px (PARTIAL)
- **changed:** CustomerDetail header CTAs; Products toolbar (drop `sm:min-h-0`); Payments primary outline → `min-h-[44px]`
- **files:** CustomerDetailPage.jsx, ProductsPage.jsx, PaymentsPage.jsx, STATE/EVIDENCE/TIER0/PHASE-TODO
- **tests+evidence:** Zayogya **8 PASS**; tip pushed through `3d0ddad` then this commit
- **NOT RUN / blocked:** Phase 6 accountant fixtures; Phases 9–11; full §10 field-by-field; production deploy
- **flags+rollback:** none (CSS touch targets only)
- **next:** remaining `md:min-h-9`/`sm:min-h-0` secondary controls; Phase 6 waits on fixtures

### 2026-10-04 — slice §10 under-44 CTA touch targets (PARTIAL)
- **changed:** min-h-[44px] on Users/Profile/Branches + doc editors + Purchases/Expenses (removed md:min-h-9 shrink)
- **files:** UsersPage, ProfilePage, BranchesPage, Quotation/Agreement/Salary editors, PurchasesPage, ExpensesPage, STATE.md, EVIDENCE.md
- **tests+evidence:** FH1 CTA pages warn=0; purchases/expenses @360+1440 **ok=4 warn=0**; Zayogya 8; Phase 6 still BLOCKED (accountant fixtures)
- **NOT RUN / blocked:** Phase 6 margin VAT fixtures; Phases 9–11; full §10 field-by-field; production deploy
- **flags+rollback:** none (CSS touch targets only)
- **next:** Phases 9–11 gated; Phase 6 waits on accountant written fixtures

### 2026-10-04 — slice §10 static-36 rest tenants 5VP (PARTIAL)
- **changed:** docs only; evidence artifact from Playwright run
- **files:** STATE.md, EVIDENCE.md, TIER0-SIGNOFF.md
- **tests+evidence:** FH2/GH/ZY owner static-36 ×5VP **ok=540 fail=0 warn=171**; Zayogya **8 PASS**; with FH1 180 → **720** static-36@5VP owner cells
- **NOT RUN / blocked:** full §10 field-by-field (Arabic/offline/RTL/…); Phases 9–11; production deploy
- **flags+rollback:** none
- **next:** Phases 9–11 gated; production needs separate deploy auth

### 2026-10-04 — slice release handoff push main (PASS)
- **changed:** pushed `master-loop-2` then FF-merged into `main` (owner explicit auth)
- **files:** none (git only)
- **tests+evidence:** `origin/main` = `origin/master-loop-2` = **`3a44391`**; GitHub commits API confirms tip
- **NOT RUN / blocked:** production Render/Vercel deploy (autoDeploy=no; production boundary); Phases 9–11; full §10 field-by-field
- **flags+rollback:** none
- **next:** finish FH2/GH/ZY static-36 @5VP; Phases 9–11 remain gated

### 2026-10-04 — slice §10 static-36×4 owner+staff (PARTIAL)
- **changed:** `phase7-field-edge-smoke.mjs` DEFAULT_PAGES → 36 static ROUTE-MANIFEST paths; multi-VP via `HEXABILL_VIEWPORTS`; dismiss notification overlay
- **files:** phase7-field-edge-smoke.mjs, STATE.md, EVIDENCE.md, PHASE-TODO.md
- **tests+evidence:** owner **ok=144** warn=36; staff **ok=144** warn=36 (@360); FH1 owner **ok=180** @5VP; Zayogya 8; coverage JSON `section10-coverage-20261004.json`
- **NOT RUN / blocked:** full §10 field-by-field (Arabic/offline/RTL/…); Phases 9–11
- **flags+rollback:** none
- **next:** Phases 9–11 gated

### 2026-10-04 — slice browser-print live (PARTIAL)
- **changed:** `scripts/tier0-browser-print-evidence.mjs` — Billing History → Invoice Preview → Print Options (+ API A4 PDF)
- **files:** scripts/tier0-browser-print-evidence.mjs, STATE.md, EVIDENCE.md, TIER0-SIGNOFF.md
- **tests+evidence:** FH1 sale 17; API PDF **119298** bytes; Print Options modal screenshot; Zayogya 8; artifact `Desktop/HexaBill_Backups/browser-print-20261004`
- **NOT RUN / blocked:** `git push` (HTTPS credential prompt disabled in agent); full §10 all 60 routes; Phases 9–11; Vercel SHA 403
- **flags+rollback:** none
- **next:** push `master-loop-2` from HexaBilngApp folder (bundle `master-loop-2-ahead25.bundle`)

### 2026-10-04 — slice Tier0 backup restore PG COPY (PARTIAL)
- **changed:** disposable `hexabill_restore_copy` via `pg_dump -Fc` + `pg_restore` from `hexabill_master_loop_test`; recorded EF migrate-to-head FAIL on PG
- **files:** STATE.md, EVIDENCE.md, TIER0-SIGNOFF.md
- **tests+evidence:** dump/restore **67=67 tables**; post-restore isolation **8/8 PASS**; EF `database update` FAIL after `InitialPostgreSQL` (SQLite-shaped next migration / Customers 42P07); Zayogya 8
- **NOT RUN / blocked:** EF migration *rollback-to-previous* (chain not PG-safe); `git push` (HTTPS prompt disabled); full §10; Phases 9–11
- **flags+rollback:** none (disposable DBs only)
- **next:** push `master-loop-2` from authenticated terminal; Phase 6–11 remain gated

### 2026-10-04 — slice 1 PG suite unblocked (PARTIAL)
- **changed:** disposable DB `hexabill_master_loop_test` on local PostgreSQL **:5433** (`postgres`/`postgres`); ran full `~PostgreSql|~Postgres` filter
- **files:** STATE.md, EVIDENCE.md, TIER0-SIGNOFF.md, PHASE-TODO.md
- **tests+evidence:** **Passed 55 / Failed 0 / Skipped 0** (~12s); Zayogya **8 PASS**
- **NOT RUN / blocked:** `git push` (retry after ConnectScm); full §10 all cells; Vercel SHA 403; Phases 9–11
- **flags+rollback:** none (test DB only; no prod)
- **next:** push `master-loop-2`; then Phases 9–11 gate decision

### 2026-10-04 — slice §10 owner+staff extended smoke (PARTIAL)
- **changed:** field-edge supports staff + 12 routes; blank-only hard fail
- **files:** phase7-field-edge-smoke.mjs, EVIDENCE.md, STATE.md
- **tests+evidence:** owner ok=48; staff ok=48 (warns for missing search / under-44); Zayogya 3; PG still blocked
- **NOT RUN / blocked:** PG 44; `git push`; full §10 all cells; Phases 9–11
- **flags+rollback:** none
- **next:** push + HEXABILL_TEST_POSTGRES

### 2026-10-04 — slice deploy SHA + restore copy + §10×4 (PARTIAL)
- **changed:** field-edge multi-tenant; SQLite copy restore rehearsal; Render/Vercel read-only deploy check
- **files:** phase7-field-edge-smoke.mjs, STATE.md, EVIDENCE.md, TIER0-SIGNOFF.md, PHASE-TODO.md
- **tests+evidence:** field-edge 4 tenants **ok=28 fail=0 warn=4**; sqlite restore copy **pass**; Render live `39ffafb` autoDeploy=no; Vercel deploy list 403; Zayogya 3 passed
- **NOT RUN / blocked:** PG 44; `git push`; full §10; R2/agent zip restore; Phases 9–11
- **flags+rollback:** none
- **next:** push branch; disposable `HEXABILL_TEST_POSTGRES`

### 2026-10-04 — slice 8c params 5VP all tenants + ledger 44px (PARTIAL)
- **changed:** CustomerLedgerPage primary/tool actions → min-h-[44px]; FH2/GH/ZY param 5VP matrix
- **files:** CustomerLedgerPage.jsx, EVIDENCE.md, STATE.md
- **tests+evidence:** params rest **ok=135**; FH1 already 45 → **180 total**; field-edge ledger primaryMin44=true; Zayogya 3 passed
- **NOT RUN / blocked:** PG 44; `git push`; full §10; Phases 9–11
- **flags+rollback:** none
- **next:** push `master-loop-2`; supply `HEXABILL_TEST_POSTGRES`

### 2026-10-04 — slice 3/8 popup fallback + params 5VP + §10 smoke (PARTIAL)
- **changed:** PrintOptionsModal downloads PDF when pop-up blocked; param script multi-VP; field-edge smoke script
- **files:** PrintOptionsModal.jsx, printOptionsPopupFallback.test.js, phase8-param-routes.mjs, phase7-field-edge-smoke.mjs, EVIDENCE.md, STATE.md
- **tests+evidence:** receipt+print popup tests **8 passed**; FH1 params 5VP **ok=45**; field-edge first run ok=4/fail=3 (products hidden search timeout; POS/ledger under-44 CTA); Zayogya this slice
- **NOT RUN / blocked:** PG 44; `git push`; full §10 matrix all tenants/roles; Phases 9–11
- **flags+rollback:** none
- **next:** push branch; disposable `HEXABILL_TEST_POSTGRES`; raise POS/ledger primary CTA to ≥44px

### 2026-10-04 — slice 3/4 ledger viewports + receipt HAR (PARTIAL)
- **changed:** added `phase3-ledger-receipt-evidence.mjs`; captured FH1 ledger/sales-ledger ×5 VP; receipt reprint HAR
- **files:** scripts/phase3-ledger-receipt-evidence.mjs, EVIDENCE.md, STATE.md
- **tests+evidence:** ledgerOk=10 fail=0; receiptPosts=0 reprintSafe=true; Zayogya 3 passed; artifacts `Desktop/HexaBill_Backups/ledger-receipt-20261004`
- **NOT RUN / blocked:** PG 44 (`Password1` auth fail for local postgres); `git push` (agent HTTPS); popup-denied PDF fallback; §10 field/edge; Phases 9–11
- **flags+rollback:** none
- **next:** push `master-loop-2` from a logged-in terminal; supply disposable `HEXABILL_TEST_POSTGRES` URL

### 2026-10-04 — slice 8b Phase 8 staff shell + push bundle (PARTIAL)
- **changed:** phase8-route-shell supports staff; staff static 37×4@360; EVIDENCE.md refreshed; git bundle for offline push
- **files:** phase8-route-shell.mjs, EVIDENCE.md, STATE.md
- **tests+evidence:** staff phase8 `ok=148`; bundle `Desktop/HexaBill_Backups/master-loop-2-ahead13.bundle` (requires base `4ac380e`)
- **NOT RUN / blocked:** `git push` (agent HTTPS credential); PG 44; §10 field/edge; Phases 9–11
- **flags+rollback:** none
- **next:** you push branch from HexaBilngApp folder; then decide Phases 9–11

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



