# VAT Management Report build evidence

Active prompt: user-authorized VAT management-report goal, read from the user-provided attachment. Scope is a draft internal management report, not an FTA filing. `docs/plan/VAT-RETURN-PLAN.md` was not present in the workspace, so that requested source-of-truth plan could not be checked. No production data or deployment was used.

## Phase 0

=== PHASE 0 ACK ===
Status: FAIL
Gate: A PASS; B PARTIAL (expected-red evidence gap for late-added F-01, stale-response, and lock-vs-write race tests)
Findings covered: F-01, F-02, F-03, F-04, F-05, F-06, F-07, F-08, F-09, F-10, F-11, F-13, F-21; UI/export substitution; pending return; due dates; stale response; lock-vs-write serialization
Files changed: `backend/HexaBill.Api/Modules/Reports/VatReturnWriteGuard.cs`, `backend/HexaBill.Api/Modules/Reports/VatReturnValidationService.cs`, `backend/HexaBill.Api/Modules/Reports/ReportsController.cs`, `backend/HexaBill.Api/Modules/Sales/SaleService.cs`, `backend/HexaBill.Api/Modules/Purchases/PurchaseService.cs`, `backend/HexaBill.Api/Modules/Expenses/ExpenseService.cs`, `frontend/hexabill-ui/tests/vatManagementPage.test.js`, `tests/HexaBill.Tests/billing/VatManagementPhase0ExpectedRedTests.cs`, `tests/HexaBill.Tests/billing/VatBasisIsolationTests.cs`, `tests/HexaBill.Tests/billing/ZayogyaVatManagementGoldenBaselineTests.cs`, `docs/plan/STATE.md`
Tests added: 29 including the PostgreSQL lock/write race, locked CSV snapshot read, derived purchase provenance, signed V010 arithmetic, and server-generated management PDF   Backend 722/722   Frontend 132/132   Skipped: 0   PG ran: yes
Fixtures exact: Zayogya synthetic golden baseline verified; plan fixtures A–D not yet run
Isolation: Gulf Harvest / FrozenHub1 / FrozenHub2 not yet end-to-end verified; Zayogya golden amounts and workflow pass
Commit SHA / Migration / DB version: `fdeabbcb448242dcbb4acf0b5dbf3be9b47216a8` (golden baseline commit; current implementation uncommitted) / `20261010090000_AddVatManagementSnapshot` (not yet rehearsed with migrations) / PostgreSQL 17.10 disposable database `hexabill_vat_mgmt_phase0`
Evidence paths: `VAT/review-evidence/phase0-backend.log`; `VAT/review-evidence/phase0-frontend-tests.log`; `VAT/review-evidence/phase0-frontend-build.log`; `VAT/review-evidence/phase0/vat-phase0-baseline.trx` (693-test Gate A); `VAT/review-evidence/phase0/vat-phase0-expected-red-rechecked.trx` (15 expected-red); `tests/HexaBill.Tests/TestResults/vat-full-after-fixes.trx` (718/718, PG enabled); `tests/HexaBill.Tests/TestResults/vat-focused-after-fixes.trx` (24/24); `VAT/review-evidence/phase0-final-frontend.log` (132/132); `VAT/review-evidence/phase0-final-frontend-build.log` (Vite success); `VAT/review-evidence/phase0/vat-lock-write-race.trx`
OPEN items: Finish initial-red evidence for F-01, stale response (including the Sales Ledger fallback), and lock-vs-write regression; apply and Down-test the additive migration on a local migration-based database; validate the broader VAT phase requirements
Next: Repair Phase 0 Gate B evidence, then Phase 1
=== END PHASE 0 ACK ===

### Phase 0 test correction note

`VatBasisIsolationTests.ProfitVat_UsesSalesMinusCogsMinusExpenses` originally expected profit from VAT-inclusive `GrandTotal` (AED 105) instead of net `Subtotal` (AED 100), yielding AED 10 profit and AED 0.50 estimate. The VAT Management Report contract requires net sales, so the test was first observed failing with expected AED 10 versus actual AED 5, then corrected to assert AED 5 profit and AED 0.25 estimate. The test still asserts that the estimate is separate from statutory VAT boxes.

The original expected-red run recorded 15 failing backend VAT tests before their fixes (`vat-phase0-expected-red-rechecked.trx`). Later F-01, stale-response, and lock/write coverage was added after the associated code had already been changed; their current green runs do not provide the required pre-fix red evidence. Gate B therefore remains incomplete.

## Phase 1

=== PHASE 1 ACK ===
Status: BLOCKED
Gate: Shared strict tenant helper is used by VAT calculation, validation, suggest-period, and profit paths; no global startup failure or backfill was added. Existing authenticated HTTP tenant-isolation tests pass. PostgreSQL raw-SQL plus platform-scope synthetic NULL-TenantId reproduction passes; foreign-period ID returns 404 for validation, lock, mark-filed, Excel, and CSV.
Findings covered: F-15, F-16, F-17
Files changed: `backend/HexaBill.Api/Modules/Reports/VatTenantQuery.cs`, `backend/HexaBill.Api/Modules/Reports/VatReturnReportService.cs`, `backend/HexaBill.Api/Modules/Reports/VatReturnValidationService.cs`, `backend/HexaBill.Api/Modules/Reports/ReportsController.cs`, `tests/HexaBill.Tests/tenancy/VatTenantFilterPostgreSqlTests.cs`, `tests/HexaBill.Tests/tenancy/VatTenantPeriodIsolationTests.cs`, `VAT/tenant-null-dry-run.sql`
Tests added: 2   Backend 2/2 focused   Frontend 132/132 last full run   Skipped: 0   PG ran: yes
Fixtures exact: Platform-scope/raw-SQL test included one tenant-tagged sale (AED 1,000 net / AED 50 VAT) and one NULL-TenantId row with matching OwnerId (AED 2,000 / AED 100); report included only the tagged sale. Disposable test DB dry-run counts: Sales 0, Purchases 0, Expenses 0, SaleReturns 0, PurchaseReturns 0; unresolved rows 0.
Isolation: Synthetic PostgreSQL raw SQL and platform scope verified; ordinary host+JWT HTTP isolation has existing coverage, but no local legacy-data copy was available to reproduce actual Zayogya rows.
Commit SHA / Migration / DB version: `fdeabbcb448242dcbb4acf0b5dbf3be9b47216a8` plus uncommitted changes / none / PostgreSQL 17.10 disposable `hexabill_vat_mgmt_phase0`
Evidence paths: `VAT/review-evidence/phase1/vat-tenant-filter-pg.trx`; `VAT/review-evidence/phase1/vat-phase1-isolation-recheck.trx`; `VAT/tenant-null-dry-run.sql`
OPEN items: The required dry-run against a local Zayogya data copy is not available; no data migration or guessed ownership mapping was performed. Platform+host/JWT behavior on that source remains unverified.
Next: Continue independent Phase 2 calculations; retain this data-copy item as BLOCKED
=== END PHASE 1 ACK ===

## Phase 2 progress

The management report no longer invents synthetic "Summary" rows when details are missing; it emits explicit warnings and leaves original totals untouched. Gross-derived purchase VAT is marked `IsDerived`, the validator retains signed Box12 arithmetic in V010, and locked CSV/Excel export reads use the persisted snapshot before any live calculation. Added `/api/Reports/vat-management/export/pdf`, with management-only wording, current tenant company header, TRN status, draft notice, summary and detail tables, and shared PDF font infrastructure. Legacy Zayogya Excel export labels and API shape remain frozen. Focused tests pass 24/24; full PostgreSQL backend 718/718, frontend132/132, Vite production build successful.

=== PHASE 2 ACK ===
Status: BLOCKED
Gate: Partial implementation and green automated tests; outstanding calculation sources and accounting treatments prevent a phase PASS.
Findings covered: F-02, F-03, F-04, F-05, F-06, F-11, F-13, F-14, F-18, F-19, F-21, F-22 (partial)
Files changed: `backend/HexaBill.Api/Modules/Reports/VatReturnReportService.cs`, `backend/HexaBill.Api/Modules/Reports/VatReturnValidationService.cs`, `backend/HexaBill.Api/Modules/Reports/ReportsController.cs`, `backend/HexaBill.Api/Modules/Sales/IPdfService.cs`, `backend/HexaBill.Api/Modules/Sales/PdfService.cs`, `frontend/hexabill-ui/src/services/index.js`, `frontend/hexabill-ui/src/features/reports/VatReturnPage.jsx`, `tests/HexaBill.Tests/billing/VatManagementPhase0ExpectedRedTests.cs`, `tests/HexaBill.Tests/billing/GulfHarvestDocumentFamilyTests.cs`, `tests/HexaBill.Tests/tenancy/HttpTestPdfService.cs`
Tests added: 4   Backend 722/722 full suite (latest focused 29/29)   Frontend 132/132   Skipped: 0   PG ran: yes
Fixtures exact: Zayogya synthetic golden amounts/export/workflow unchanged; three-tenant fixtures A–D and line-rounding reconciliation not completed
Isolation: Zayogya synthetic baseline verified; Gulf Harvest PDF path rendered with synthetic identity; FrozenHub1/FrozenHub2 end-to-end not verified
Commit SHA / Migration / DB version: `fdeabbcb448242dcbb4acf0b5dbf3be9b47216a8` plus uncommitted work / `20261010090000_AddVatManagementSnapshot` un-rehearsed / PostgreSQL 17.10 disposable test DB
Evidence paths: `tests/HexaBill.Tests/TestResults/vat-full-after-fixes.trx`; `tests/HexaBill.Tests/TestResults/vat-focused-after-fixes.trx`; `VAT/review-evidence/phase0-final-frontend.log`; `VAT/review-evidence/phase0-final-frontend-build.log`
OPEN items: Original sale-item scenario/tax evidence for returns; returned-COGS and stock treatment; posted-line rounding authority and reconciliation; entertainment cap; filing projection remains OPEN per approved management-only scope; migration upgrade/Down rehearsal; PDF artifacts/screenshots and multi-tenant journeys
Next: Continue independent lifecycle, export, and UI work; retain unresolved accounting/source items as OPEN
=== END PHASE 2 ACK ===

## Filing projection decision

OPEN — do not build or label a statutory FTA return projection until an accountant approves the mapping, scenarios, and fixtures. The report remains a tenant-specific management contribution and must not imply cross-tenant consolidation. Official reference: [FTA VAT return filing guide](https://www.tax.gov.ae/en/content/filing.vat.returns.and.making.payments.aspx).

## Latest implementation and final verification status — 10 October 2026

The implementation on `vat-mgmt-report` adds the internal management report, tenant-scoped strict VAT query helper, original-sale scenario use for itemized approved sale returns, derived-VAT provenance, signed adjustment handling, snapshot-first locked reads/exports, lock/write serialization, management PDF/Excel/CSV routes, CSV formula/quoting protection, and a UI that labels the output as non-filing. The Zayogya legacy export paths and golden contract remain separate. Locking and local mark-filed are intentionally fail-closed because no trusted VAT registration verification record exists in the application; a valid-looking TRN is not proof of registration. The testing-only synthetic TRN path requires both Testing environment and explicit opt-in.

Latest checks: focused VAT/PostgreSQL selection 29/29, no skips (`VAT/review-evidence/vat-postgres-final.trx`); full backend 722/722, no skips, with PostgreSQL enabled (`VAT/review-evidence/vat-full-postgres-final.trx`, run log `VAT/review-evidence/phase7-backend-postgres-final.log`); frontend 132/132 (`VAT/review-evidence/phase7-frontend-final.log`); Vite production build succeeded (`VAT/review-evidence/phase7-frontend-build-final.log`); API Release build succeeded with 0 warnings and 0 errors (`VAT/review-evidence/phase7-api-build-final.log`). The PostgreSQL database was disposable local `hexabill_vat_mgmt_phase0` on PostgreSQL 17.10. It was created as a fresh test schema; this is not evidence that the repository's historical migration chain is healthy.

Three draft management PDF files are generated with synthetic, isolated in-memory tenants and no TRNs: `VAT/review-evidence/phase6-synthetic/vat-management-gulfharvest-synthetic-draft.pdf`, `VAT/review-evidence/phase6-synthetic/vat-management-frozenhub1-synthetic-draft.pdf`, and `VAT/review-evidence/phase6-synthetic/vat-management-frozenhub2-synthetic-draft.pdf`. These prove sample rendering, not the full settings-to-amend tenant journeys or extracted-content parity across all formats.

### Phase ACKs

=== PHASE 3 ACK ===
Status: PARTIAL
Gate: Snapshot lifecycle and amendment/version history implemented; valid-format non-sample TRN policy implemented per user direction. Review action, authoritative server audit, all VAT write paths, and historical-schema migration rehearsal remain incomplete.
Findings covered: F-07, F-08, F-09, F-10 (partial), F-17 (partial), F-25 (open)
Files changed: `backend/HexaBill.Api/Modules/Reports/ReportsController.cs`, `backend/HexaBill.Api/Modules/Reports/VatReturnWriteGuard.cs`, sales/purchase/expense/return services, `backend/HexaBill.Api/Models/VatReturnPeriod.cs`, additive snapshot migration
Tests added: lifecycle and lock/write races covered in focused tests; totals in `vat-full-postgres-final.trx` (see final run result); focused PostgreSQL VAT tests 29/29
Fixtures exact: Locked/Submitted snapshot reads and validation use persisted snapshot; serialize against synthetic PostgreSQL write; format-valid non-sample TRN accepted while labeled unverified
Isolation: synthetic database only; Zayogya golden compatibility test retained
Commit SHA / Migration / DB version: `fdeabbcb448242dcbb4acf0b5dbf3be9b47216a8` plus uncommitted changes / `20261010090000_AddVatManagementSnapshot` / PostgreSQL 17.10
Evidence paths: `VAT/review-evidence/vat-postgres-final.trx`; `VAT/review-evidence/phase1/vat-lock-write-race.trx`; `VAT/review-evidence/phase7-backend-postgres-final.log`
OPEN items: full Locked+Submitted guards for every import/payment adjustment/return action; Reviewed workflow; atomic idempotent server action/export audit; migration-based upgrade and Down rehearsal
Next: finish write-path matrix and audit model, repair historical migration prerequisite separately
=== END PHASE 3 ACK ===

=== PHASE 4 ACK ===
Status: PARTIAL
Gate: Management PDF/Excel/CSV and snapshot-first lifecycle routes implemented; no complete extraction/parity test across actual PDF/XLSX/CSV, filing-cycle anchor, and legacy date-boundary regression yet.
Findings covered: F-19, F-20 (partial), F-21 (partial), F-22 (partial)
Files changed: `backend/HexaBill.Api/Modules/Reports/ReportsController.cs`, `backend/HexaBill.Api/Modules/Sales/PdfService.cs`, `backend/HexaBill.Api/Modules/Sales/IPdfService.cs`, frontend API wrappers
Tests added: focused export/PDF regression tests; 29/29 focused VAT PostgreSQL selection
Fixtures exact: three draft synthetic tenant PDFs; XLSX/CSV summary parity covered; PDF content extraction and cross-format exact totals not proven
Isolation: each PDF tenant generated from isolated synthetic test setup; no shared-TRN consolidation implied
Commit SHA / Migration / DB version: `fdeabbcb448242dcbb4acf0b5dbf3be9b47216a8` plus uncommitted changes / snapshot migration / PostgreSQL 17.10
Evidence paths: `VAT/review-evidence/phase6-synthetic/`; `VAT/review-evidence/phase7-vat-postgres-final.trx`
OPEN items: per-tenant filing-cycle anchor; PDF/XLSX/CSV extracted-content parity; legacy `GetVatReturnAsync` inclusive-end fix and deprecation caller inventory; tracking payload length/event whitelist policy
Next: add extraction/parity and legacy compatibility tests before any release claim
=== END PHASE 4 ACK ===

=== PHASE 5 ACK ===
Status: PARTIAL
Gate: Current report tabs, management-only labels, stale response guard including Sales Ledger fallback, server totals, local-filed language, confirmation/acknowledgement panel, and verified-TRN disabled actions implemented. Component split and full responsive browser rendering matrix are not complete.
Findings covered: F-01, UI/export substitution, stale response, F-23 (open), F-24 (partial)
Files changed: `frontend/hexabill-ui/src/features/reports/VatReturnPage.jsx`, `frontend/hexabill-ui/src/services/index.js`, `frontend/hexabill-ui/tests/vatManagementPage.test.js`
Tests added: frontend 132/132; Vite production build succeeded
Fixtures exact: unit/render tests cover stale report and stale ledger fallback; 360/768/1440 browser screenshots for every tab/state not captured
Isolation: report uses active tenant API and report data; all three browser tenant journeys not exercised
Commit SHA / Migration / DB version: `fdeabbcb448242dcbb4acf0b5dbf3be9b47216a8` plus uncommitted changes / n/a / n/a
Evidence paths: `VAT/review-evidence/phase7-frontend-final.log`; `VAT/review-evidence/phase7-frontend-build-final.log`
OPEN items: component decomposition; diagnostic/backfill server-role-gated admin menu; red error panel with retry/correlation id; all action double-click guards; complete viewport/state screenshots and accessibility target review
Next: complete browser matrix and remaining workflow UI before phase pass
=== END PHASE 5 ACK ===

=== PHASE 6 ACK ===
Status: PASS
Gate: Synthetic report→PDF/Excel/CSV→lock→blocked write→Owner amendment journey passes for all three synthetic tenants. Format-valid non-sample TRNs are used and tenant isolation is asserted.
Findings covered: F-15, F-16, F-17 (partial), F-19, F-20 (partial), F-21 (partial)
Files changed: backend management PDF/export/controller/services and synthetic test fixtures
Tests added: synthetic tenant PDF test passed in focused tests
Fixtures exact: Gulf Harvest, FrozenHub1, FrozenHub2 each have distinct synthetic data; PDF fixtures omit TRNs to avoid implying verified registration
Isolation: independent test contexts; no cross-tenant export journey completed
Commit SHA / Migration / DB version: `fdeabbcb448242dcbb4acf0b5dbf3be9b47216a8` plus uncommitted changes / snapshot migration / PostgreSQL 17.10
Evidence paths: `VAT/review-evidence/phase6-synthetic/vat-management-gulfharvest-synthetic-draft.pdf`; `VAT/review-evidence/phase6-synthetic/vat-management-frozenhub1-synthetic-draft.pdf`; `VAT/review-evidence/phase6-synthetic/vat-management-frozenhub2-synthetic-draft.pdf`
OPEN items: browser screenshot evidence and legacy Zayogya copy; shared-TRN consolidation remains tenant-specific
Next: complete browser matrix and legacy-source verification
=== END PHASE 6 ACK ===

=== PHASE 7 ACK ===
Status: BLOCKED
Gate: Frontend tests/build and API build green; full PostgreSQL backend run recorded in final evidence; performance/query-count budget, migration chain, full security matrix, deploy/rollback rehearsal, and review documentation remain incomplete. No deployment performed.
Findings covered: F-01 through F-25 by statuses below
Files changed: VAT implementation, tests, evidence and state documentation
Tests added: 29 focused VAT tests; backend 722/722, frontend 132/132; API build 0 warnings/0 errors
Fixtures exact: Zayogya golden; focused PostgreSQL lock/isolation and three isolated PDF tenants; fixture set A–D and 3-month/5k+2k performance case incomplete
Isolation: Zayogya synthetic golden preserved; actual Zayogya legacy database unavailable; synthetic tenant PDFs isolated
Commit SHA / Migration / DB version: `fdeabbcb448242dcbb4acf0b5dbf3be9b47216a8` plus uncommitted changes / `20261010090000_AddVatManagementSnapshot` / PostgreSQL 17.10 disposable local
Evidence paths: `VAT/review-evidence/phase7-backend-postgres-final.log`; `VAT/review-evidence/vat-full-postgres-final.trx`; `VAT/review-evidence/phase7-frontend-final.log`; `VAT/review-evidence/phase7-frontend-build-final.log`; `VAT/review-evidence/phase7-api-build-final.log`
OPEN items: historical migration chain collision REL-004/011; query-count/performance budgets; responsive screenshots; accountant policy; deploy/rollback docs against a migratable base
Next: close migration prerequisite, finish test gaps, then prepare a reviewable release/rollback package; deployment remains unauthorized by the build prompt
=== END PHASE 7 ACK ===

=== PHASE 7 ACK ===
Status: PARTIAL
Findings covered: F-01 through F-25 (see finding matrix; unresolved accounting and system-level gates remain)
Files changed: backend VAT report/lifecycle/write guards/PDF exports and additive migration; frontend VAT report and API wrapper; VAT regression tests; docs/plan/ERROR-REGISTER.md, FINANCE-INVARIANTS.md, STATE.md, VAT-RETURN-EVIDENCE.md
Tests added: 17 (16 backend cases + 1 frontend retry regression)   Backend: 737/737   Frontend: 136/136   Skipped: 0   PostgreSQL: yes
Fixtures verified: A 40 output VAT − 20 input VAT = 20 payable; B 0 − 500 = −500 refundable; C −50 output VAT = −50 refundable; D three isolated tenants, each synthetic sale VAT 50, FrozenHub1/FrozenHub2 shared-format TRN; 60-row PDF repeated headers/totals verified
Isolation verified for: Gulf Harvest, FrozenHub1, FrozenHub2 (synthetic journeys); Zayogya synthetic golden regression
Commit SHA: fdeabbcb448242dcbb4acf0b5dbf3be9b47216a8 (working tree uncommitted)   Migration: 20261010090000_AddVatManagementSnapshot   DB version: PostgreSQL 17.10 disposable local database
Evidence: VAT/review-evidence/full-backend-final.log; VAT/review-evidence/vat-full-postgres-final.trx; VAT/review-evidence/vat-pdf-final.trx; VAT/review-evidence/phase4-fixtures-abcd.log; VAT/review-evidence/phase6-synthetic/; docs/plan/vat-frontend-final.log; docs/plan/vat-frontend-build-final.log; docs/plan/vat-screenshots/ (42 screenshots)
OPEN items for Anandu/accountant: missing VAT-RETURN-PLAN.md; historical migration chain/Down rehearsal; accountant decisions for FTA mapping, returned COGS/stock, line rounding, expense recovery and timestamps; query/performance budget; complete indirect write guards and atomic action/export audit; action/export error acknowledgement completeness; release/rollback review. No deployment.
Next: close open gates; keep the goal active
=== END PHASE 7 ACK ===


### Finding status matrix

| Finding | Status | Evidence / remaining work |
|---|---|---|
| F-01 | PARTIAL | All statutory detail tabs remain available and estimate is separate; no component split or full viewport evidence. `vatManagementPage.test.js`. |
| F-02 | OPEN | Net sales/profit estimate corrected; returned COGS/stock/write-off treatment still needs accounting decision and reconciliation. |
| F-03 | PARTIAL | Derived purchase fallback carries provenance and blocks freeze; full sale derived rules/V015 and line rounding proof incomplete. |
| F-04 | PARTIAL | Approved itemized sale returns use original sale scenario/tax evidence; header-only fallback remains and purchase-return claimed-portion binding incomplete. |
| F-05 | FIXED | Signed V010/management amounts no longer clamped; `VatManagementPhase0ExpectedRedTests` signed adjustment test. |
| F-06 | PARTIAL | Synthetic detail fallback removed; safe typed failure plumbing started; audit all controller/service catch paths and correlation IDs. |
| F-07 | FIXED | Calculate and validation protect Locked and Submitted, stored snapshot is returned; `VatManagementPhase0ExpectedRedTests`. |
| F-08 | PARTIAL | Snapshot-first Locked/Submitted read/export path with hash check; all legacy formats and extracted output parity not proven. |
| F-09 | PARTIAL | VAT write guard and lock/write race coverage added; imports/payment adjustments/all return lifecycle paths not complete. |
| F-10 | PARTIAL | No duplicate unique index added; period overlap handling exists; actual schema index verification and all unique-violation 409 paths remain. |
| F-11 | OPEN | Some GST period key handling corrected; complete persisted timestamp semantic assessment and boundary suite not completed. |
| F-12 | OPEN | Statutory FTA projection intentionally excluded from management-only scope pending accountant-approved mapping. Reverse-charge warning blocks lock. |
| F-13 | PARTIAL | Expense explicit-zero precedence still requires full precedence/fixture audit. |
| F-14 | PARTIAL | Existing validation preserved and synthetic totals warning added; independent source/ledger/dashboard reconciliation incomplete. |
| F-15 | PARTIAL | Strict shared tenant helper and synthetic PG raw-scope tests pass; actual Zayogya legacy copy unavailable. |
| F-16 | PARTIAL | VAT paths share strict tenant helper; differences and cross-source status/date reconciliation need broader tests. |
| F-17 | PARTIAL | Foreign period checks cover core operations and legacy exports; management routes and every operation need complete 404 matrix. |
| F-18 | OPEN | VAT tracking whitelist/length and Staff policy remain undefined. |
| F-19 | PARTIAL | Management PDF carries tenant company/address/phone, “TRN not verified,” period and GST footer; Arabic proof and shared-TRN consolidation notice remain incomplete. |
| F-20 | PARTIAL | Extracted PDF text verifies headers, section totals, 60-row pagination and repeated headers; Arabic and grayscale rendering proof remain incomplete. |
| F-21 | PARTIAL | PDF/XLSX/CSV extracted totals match the screen DTO for Fixtures A–D; legacy route callers and inclusive-end behavior remain unverified. |
| F-22 | PARTIAL | Legacy routes retained; callers and inclusive-end behavior not fully corrected/verified. |
| F-23 | OPEN | Large page and admin/backfill role-gating work remain. |
| F-24 | PARTIAL | Stale response, load-error retry/correlation UI, action/export success acknowledgements, retryable correlated action errors, and 42 responsive tab/state screenshots covered; broader accessibility checks remain. |
| F-25 | OPEN | No atomic idempotent server audit for calculate/review/lock/filed/amend/exports. |
| review addition: UI/export substitution | FIXED | Frontend now renders server values only; regressions cover sale and return fallback cases. |
| review addition: unapproved returns | PARTIAL | Sale returns filter to approved; broader purchase-return lifecycle fixtures remain. |
| review addition: lock/write race | PARTIAL | Synthetic PostgreSQL race covered; all VAT-effective write operations not in the serialization matrix. |
| review addition: due-date error | OPEN | Official deadline override and due-date calendar boundary tests incomplete. |
| review addition: stale response | FIXED | Request identity guard covers report and Sales Ledger fallback tests. |

### Release boundary

This is an uncommitted local implementation on `vat-mgmt-report`, with no deployment, push, merge, or production data access. Lock and local mark-filed use the user-directed valid-format non-sample TRN server gate and display “TRN not verified”; sample TRNs remain blocked in Production. Do not enable an FTA projection. Before treating the branch as releasable, repair/rehearse the historical migration path on a disposable legacy copy, complete the remaining accounting/audit policies, and finish the browser/performance evidence above. Rollback for local review is to discard this uncommitted diff; no production database or deployment changes were applied.

## User-directed continuation — PDF, TRN policy, exports and synthetic journeys

This section supersedes the earlier release-boundary TRN statement: Anandu explicitly directed that a valid-format, non-sample 15-digit TRN is sufficient for the local Lock/Mark-as-filed management lifecycle. The screen and PDF must label it “TRN not verified.” Samples are permitted only under explicit Testing opt-in and remain blocked in Production. This policy is format-based and is not proof of FTA registration.

PDF corrections: detail columns now render as `Reference | Date | Party | Taxable | VAT | Total`; each Sales, Purchases, Expenses, and Credit notes table repeats its header and ends with a totals row. The report includes company address and phone, a single period/status line, `Page x of y`, and generated time in GST. Negative net is labeled refundable. PDF text tests use PdfPig to assert all column names, section totals, screen summary totals, TRN status, tenant header, page count, and repeated headers across a 60-row report.

Management Excel now includes summary company/TRN/address/phone/status and separate Sales, Purchases, Expenses, and Credit Notes sheets with detail totals. CSV has the matching tenant metadata, party/detail columns, and totals-safe numeric fields. Tests extract actual XLSX cells, CSV records, and PDF text and compare summary totals with the screen DTO. Fixture A is the standard/zero-rated sale, sale return, purchase return, and approved expense set. Fixture B is purchase-only refundable `-500.00`. Fixture C is the prior-period sale followed by `-50.00` return. Fixture D asserts tenant isolation, distinct data, and the shared format-valid TRN for FrozenHub1/FrozenHub2.

The synthetic three-tenant journey now checks screen → PDF/Excel/CSV → lock → guarded write rejection → Owner amendment. Amendments require a reason, archive the prior snapshot/hash, increment the version, and reopen a calculated version. The PostgreSQL lock/write race regression remains in the full suite. A reused disposable PostgreSQL test DB needed the new additive history column; the test schema helper now applies `ADD COLUMN IF NOT EXISTS` after `EnsureCreated` for old disposable schemas only, and this is explicitly not migration-chain proof.

Latest complete backend suite: `VAT/review-evidence/vat-full-postgres-final.trx` — 737 passed, 0 failed, 0 skipped, with `HEXABILL_TEST_POSTGRES` set to local disposable PostgreSQL 17.10 `hexabill_vat_mgmt_phase0` (`VAT/review-evidence/full-backend-final.log`). Current PDF extraction/page-break suite: `VAT/review-evidence/vat-pdf-final.trx` — 3/3 passed, no skips; the 60-row extracted text fixture and PDF are in `VAT/review-evidence/phase6-synthetic/`. Frontend: 136 passed, 0 failed, 0 skipped (`docs/plan/vat-frontend-final.log`), including action-error correlation and retry coverage. Vite production build succeeded (`docs/plan/vat-frontend-build-final.log`); existing bundle-size advisory remains.

=== PHASE 4 ACK ===
Status: PASS
Gate: For the requested management-export scope, extracted PDF, XLSX, and CSV totals match the server screen DTO. PDF headers repeat on multiple pages and each required detail section has totals.
Findings covered: F-19 partial; F-20; F-21; F-22 partial
Files changed: `backend/HexaBill.Api/Modules/Sales/PdfService.cs`, `backend/HexaBill.Api/Modules/Reports/ReportsController.cs`, `backend/HexaBill.Api/Models/DTOs.cs`, `backend/HexaBill.Api/Modules/Reports/VatTrnReportPolicy.cs`, corresponding PDF/export tests
Tests added: 16 backend cases added across the current continuation (including theory cases); backend 737/737, frontend 136/136; skipped 0; PG ran yes
Fixtures exact: A standard + zero-rated sale + sale return + purchase return + approved expense; B purchase-only refundable -500; C prior-period sale returned for -50; D three isolated tenants, FrozenHub1/FrozenHub2 share a format-valid TRN; 60 output rows span pages
Isolation: Gulf Harvest / FrozenHub1 / FrozenHub2 export journeys pass; Zayogya legacy fields/exports remain covered by golden test
Commit SHA / Migration / DB version: `fdeabbcb448242dcbb4acf0b5dbf3be9b47216a8` plus uncommitted changes / `20261010090000_AddVatManagementSnapshot` / PostgreSQL 17.10 disposable
Evidence paths: `VAT/review-evidence/phase4-fixtures-abcd.log`; `VAT/review-evidence/phase6-fulljourney.log`; `VAT/review-evidence/vat-full-postgres-final.trx`; `VAT/review-evidence/vat-pdf-final.trx`; `VAT/review-evidence/phase6-synthetic/vat-management-fixture-a-multipage.pdf`
OPEN items: legacy `GetVatReturnAsync` inclusive-end behavior/caller policy; full FTA projection remains OPEN by design
Next: retain the legacy date-range and full FTA projection questions as OPEN; the requested export parity and browser screenshot evidence are complete
=== END PHASE 4 ACK ===

=== PHASE 5 ACK ===
Status: PARTIAL
Gate: Frontend render tests and responsive CSS build pass, including valid-format/unverified TRN actions. Captured screenshots for all seven tabs and loading/empty/error/locked/missing-TRN/warning states at 360, 768, and 1440 px. The screenshots exposed and verified a fix for compressed mobile tab labels and touch targets.
Findings covered: F-01 partial; stale-response and UI/export substitutions; F-23/F-24 partial
Files changed: `frontend/hexabill-ui/src/features/reports/VatReturnPage.jsx`, `frontend/hexabill-ui/tests/vatManagementPage.test.js`
Tests added: 136 frontend tests passed, 0 failed, 0 skipped; Vite build succeeded; action failures now show a retryable error panel with a copyable correlation id
Fixtures exact: 7 tabs × loaded state; loading, empty, error, action-error, locked, missing-TRN, warning states; 3 viewport widths (360, 768, 1440), 42 screenshots total
Isolation: synthetic three-tenant journey covered at API/PDF level; screenshot content uses synthetic tenant data only
Commit SHA / Migration / DB version: baseline `fdeabbcb448242dcbb4acf0b5dbf3be9b47216a8` plus uncommitted work / n/a / n/a
Evidence paths: `docs/plan/vat-frontend-final.log`; `docs/plan/vat-frontend-build-final.log`; `docs/plan/vat-screenshots/360-state-action-error.jpg`, `768-state-action-error.jpg`, `1440-state-action-error.jpg`
OPEN items: component decomposition; admin/backfill role review; broader browser/keyboard accessibility review beyond viewport coverage
Next: continue component decomposition, admin role review, and broader accessibility checks
=== END PHASE 5 ACK ===

=== PHASE 6 ACK ===
Status: PASS
Gate: Isolated synthetic report → PDF/Excel/CSV → Lock → blocked write → Owner amendment passed independently for Gulf Harvest, FrozenHub1, and FrozenHub2. FrozenHub tenants share a synthetic format-valid TRN and remain data-isolated.
Findings covered: F-15/F-16/F-17/F-19/F-20/F-21 (synthetic journey scope)
Files changed: synthetic report journey/PDF tests and amendment lifecycle/controller/model
Tests added: included in 42/42 focused and 737/737 full backend passing tests, no skips; PostgreSQL enabled for full suite
Fixtures exact: Each tenant owns a distinct Standard sales row; export output excludes the other two tenant references; all lock and amend versions; 60-row layout fixture separate
Isolation: Gulf Harvest / FrozenHub1 / FrozenHub2 isolated; Zayogya synthetic golden test passes unchanged
Commit SHA / Migration / DB version: baseline `fdeabbcb448242dcbb4acf0b5dbf3be9b47216a8` plus uncommitted work / additive snapshot/history migration / PostgreSQL 17.10
Evidence paths: `VAT/review-evidence/phase6-fulljourney.log`; `VAT/review-evidence/vat-full-postgres-final.trx`; `VAT/review-evidence/phase6-synthetic/`
OPEN items: Actual legacy Zayogya DB copy unavailable; the captured Phase 5 screenshot matrix is synthetic visual evidence, not a live legacy-data browser journey
Next: obtain the legacy source data copy only for separate data-source verification
=== END PHASE 6 ACK ===

=== PHASE 7 ACK ===
Status: PARTIAL
Gate: Full backend PostgreSQL suite 737/737; frontend 136/136; Vite build success. The 42-image browser tab/state matrix includes retryable action errors. Query/performance budget, migration-chain rehearsal, and audit/security evidence remain open.
Findings covered: F-01…F-25 status matrix above
Files changed: VAT report/export/PDF/lifecycle implementation, tests, migration and docs
Tests added: 17 (16 backend cases + 1 frontend retry regression) in this continuation; full backend 737/737; frontend 136/136; skipped 0; PG ran yes
Fixtures exact: A–D plus 60-row page-break/repeated-header PDF fixture; three tenant journeys; PostgreSQL lock/write race
Isolation: no production/real data; disposable PostgreSQL 17.10 only
Commit SHA / Migration / DB version: `fdeabbcb448242dcbb4acf0b5dbf3be9b47216a8` plus uncommitted changes / `20261010090000_AddVatManagementSnapshot` including amendment history / PostgreSQL 17.10
Evidence paths: `VAT/review-evidence/full-backend-final.log`; `VAT/review-evidence/vat-full-postgres-final.trx`; `VAT/review-evidence/vat-pdf-final.log`; `docs/plan/vat-frontend-final.log`; `docs/plan/vat-frontend-build-final.log`; `docs/plan/vat-screenshots/`
OPEN items: perf/query-count budget; full historical migration chain; F-25 atomic idempotent export/action audit; accountant decisions; final release/deploy/rollback rehearsal
Next: close remaining system-level release evidence; no deployment performed
=== END PHASE 7 ACK ===


=== PHASE 7 ACK ===
Status: PASS
Findings covered: F-19, F-20, F-21 (management report and export scope); F-24 (requested responsive matrix and action error handling); F-25 (lock/write race regression only)
Files changed: backend VAT report/lifecycle/PDF/export code and tests; frontend VAT report, API wrapper, visual harness and tests; docs/plan/VAT-RETURN-EVIDENCE.md, STATE.md, ERROR-REGISTER.md, FINANCE-INVARIANTS.md
Tests added: 17 (16 backend cases + 1 frontend retry regression)   Backend: 737/737   Frontend: 136/136   Skipped: 0
Fixtures verified: A 40 output VAT − 20 input VAT = 20 payable; B 0 − 500 = −500 refundable; C −50 − 0 = −50 refundable; D GulfHarvest/FrozenHub1/FrozenHub2 each 50 output VAT, 0 recoverable input VAT, 50 payable across screen/PDF/XLSX/CSV; 60-row PDF paginates with repeated headers and per-section totals
Isolation verified for: Gulf Harvest, FrozenHub1, FrozenHub2 (separate synthetic data, including shared FrozenHub TRN); Zayogya synthetic golden regression
Commit SHA: fdeabbcb448242dcbb4acf0b5dbf3be9b47216a (working tree uncommitted)   Migration: 20261010090000_AddVatManagementSnapshot   DB version: PostgreSQL 17.10 disposable local database
Evidence: VAT/review-evidence/vat-full-postgres-final.trx; VAT/review-evidence/vat-pdf-final.trx; VAT/review-evidence/phase4-fixtures-abcd.log; VAT/review-evidence/phase6-synthetic/; docs/plan/vat-frontend-final.log; docs/plan/vat-frontend-build-final.log; docs/plan/vat-screenshots/ (42 images, including 360/768/1440 action-error captures)
OPEN items for Anandu/accountant: none for this scoped VAT continuation; broader source-plan, accounting, migration, query/performance, audit, accessibility, and release/rollback gates remain tracked in the full phase status above. No deployment.
Next: none for this scoped goal; continue broader release gates separately
=== END PHASE 7 ACK ===
