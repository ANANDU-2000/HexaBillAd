# FrozenHub 1 (tenant 20) — Starplus duplicate and PDF repair: evidence

Date: 2026-11-03 · Base commit `af248089` (origin/main) · Scope: FrozenHub 1 only. FrozenHub 2 (tenant 23), Gulf Harvest (22) and Zayogya (6) were not modified.

## 1. Backup and restore drill (completed before any change)

| Item | Value |
|---|---|
| Backup | `pg_dump -Fc` of production `hexabill`, read-only session (not kept in the repo) |
| Location | `C:\Users\anand\hexabill-backups\prod-20261103-pre-repair\hexabill-full.dump` |
| Size / archive entries | 3,326,623 bytes / 1,039 TOC entries (`pg_restore --list`) |
| SHA-256 | `66ba9d19c725d86c0a1a79459a09a7d4fc45a593f6ce12596b9e91052f779c64` |
| Schema-only copy | `hexabill-schema.sql` (263,702 bytes), same folder |
| Restore drill | `pg_restore` into disposable database `hexabill_restore_drill_20261103` on the local QA cluster (port 55481). Exit 0. |

Row counts, production vs restored (identical):

| Table | Production | Restored |
|---|---|---|
| LegacyInvoices | 5,109 | 5,109 |
| LegacyPayments | 5,330 | 5,330 |
| LegacyInvoiceItems | 10,627 | 10,627 |
| Sales | 1,119 | 1,119 |
| SaleItems | 6,728 | 6,728 |
| Payments | 1,001 | 1,001 |
| Customers | 183 | 183 |
| MigrationRuns | 1 | 1 |

No data repair was executed. Every change in this checkpoint is code, tests or documentation. The database is unchanged.

## 2. Root causes found and fixed in code

| # | Symptom | Root cause (file) | Fix | Status |
|---|---|---|---|---|
| R1 | Each historical invoice appears twice in the customer ledger ("Historical" plus a normal Edit/Delete row) | Sales report merged LegacyInvoices (`ReportService.cs`) and the ledger page appended LegacyInvoices again (`CustomerLedgerPage.jsx`) | Ledger requests the report with `includeLegacy=false`; historical rows come only from the legacy list; `mergeCustomerBillRows` keys each record by source identity | FIXED (tested) |
| R2 | Footer pending 10,285 for customer 139 (true 5,880) | Pending summed across the duplicated rows | Footer derives from the deduplicated rows (R1) | FIXED (unit test on the customer 139 shape) |
| R3 | Header balance 1,475 for customer 139 (true 5,880) | Header used cached `Customers.Balance`, which excludes historical pending invoices | Header uses canonical all-history outstanding (`canonicalOutstandingBalance`) | FIXED (unit test); cache left unchanged |
| R4 | "All dates" showed only the last 30 days of current sales and an unbounded legacy list | Sales report defaults a missing `fromDate` to 30 days; ledger sent `''`, which the report read as missing | Ledger sends one explicit window to both sources (`billingDateWindow`: from 2000-01-01 when empty, today when `to` is empty) | FIXED (unit test) |
| R5 | Sales-report paging could repeat or skip rows for tenant 20 | Legacy slice used an offset that assumed operating rows came first, then re-sorted | Top-k merge: each source limited to `page*pageSize` in the same stable order, then sliced | FIXED (backend tests: paging, no repeats, constant totals) |
| R6 | **Wrong invoice printed.** PDF button on a historical row sent its legacy id to `/sales/{id}/pdf`, which prints the live sale with that numeric id | Ledger `onViewPDF(invoice.id)` for all rows; historical ids are legacy ids | Historical rows never call the sales PDF endpoint; they open the read-only record. `salePdfId` returns undefined for historical rows | FIXED (unit tests); see section 4 |
| R7 | No historical PDF renderer exists | Not implemented anywhere in the repo | Not built in this checkpoint | NOT IMPLEMENTED (see section 4) |
| R8 | Billing History offered no payment for historical invoices | `collectable` required `!isLegacy` | Collect and Customer ledger actions use `historicalCollectionId` (negative legacy id, same convention as the outstanding list) when money is owed | FIXED (unit tests); live payment NOT VERIFIED |

Payment path review (no change needed): `PaymentService` resolves negative historical ids with tenant, customer, outstanding and duplicate checks (single payment), and Pay All allocates through the customer-scoped outstanding list. Legacy paid and outstanding update on both branches. The restored DB shows **0** `Payments` rows linked to legacy invoices, so the path has not been exercised in production yet.

## 3. Reconciliation (read-only, production)

- Customers with a cache-vs-canonical difference: **11** (all have historical invoices). Customers without historical invoices: **0** differences across 74 customers. File: `customer-balance-reconciliation-dry-run.csv` (85 customers, IDs only).
- Customers with historical pending invoices: **21**. Largest combined row count for one customer: **349** (below the 1,000-row page).
- Credit balances (negative `Customers.Balance`) in tenant 20: **0**.
- Duplicate-number groups (99 numbers, 112 surplus rows): unchanged. They are distinct source documents (no duplicate `SourceInvoiceId`). They are displayed as separate rows and are not merged on number alone, per the owner rule.
- Orphan historical invoices (no destination customer): 4 (6632, 2158, 3829, 4798). Left unassigned, per the owner rule.
- Current POS invoices with timestamp-like numbers: 9. Preserved, per the owner rule.
- Migration run `PROD_MIGRATION_20261031210752`: the only run. Recorded TotalOutstanding 70,077.29 vs live 70,178.09; the 100.80 difference equals invoice 5100 (orphan), so the run record was taken before that invoice was assigned or recorded. Not repaired.

## 4. Verification

| Check | Command / source | Result |
|---|---|---|
| Backend new regression tests | `dotnet test --filter SalesReportLegacyContinuityTests|CustomerBalanceCanonicalTests` | 8/8 passed |
| Backend full suite (SQLite, default) | `dotnet test HexaBill.Tests.csproj` | 2,190 passed, 0 failed, 115 skipped (PostgreSQL-only) on the second run. The first run had 1 failure (`FrozenHubPrintFinalTests.Footer_HistoricalInvoicesAndOpeningReceivable_AreNotDoubleCounted`), which passed on rerun and in class runs (33/33 twice). Root cause not identified; NOT RESOLVED. |
| Backend full suite incl. PostgreSQL (`HEXABILL_TEST_POSTGRES`, fresh DB on local QA cluster) | same | 2,303 passed, 1 failed, 1 skipped. The failure `ReturnBalancePostgreSqlTests.Ledger_NetsApprovedReturns_SeparatelyFromActualReceipts(Approved, 15.75, 0, -5)` **also fails on a clean HEAD checkout** (pre-existing, not caused by this change). Expected customer credit -5, actual 0. NOT FIXED (returns ledger, out of scope). |
| Frontend unit tests | `npm test` | 364/364 passed |
| Frontend production build | `npm run build` | passes |
| Local ledger behaviour | none | NOT VERIFIED (no logged-in browser run) |

Regression coverage mapping (from the task list):
- Historical invoice appears once: `HistoricalInvoices_AppearExactlyOnce_WithLegacyFlagsAndSourceIds`, `mergeCustomerBillRows` tests.
- Current invoice appears once: `CustomerLedgerRequest_WithIncludeLegacyFalse_ReturnsOperatingRowsOnly`.
- Same number, different customers stays distinct: `SameInvoiceNumber_ForDifferentCustomers_RemainsDistinct`, helper test.
- Genuine duplicate representation not counted twice: helper test "appears exactly once" and "repeated historical record ... dropped".
- Partial / historical payment: `historicalCollectionId` tests; payment service paths covered by existing suites (`PaymentLegacyContinuityTests`, `PaymentLegacyInvoiceRelationshipTests`) — passing.
- Historical Pay All, multiple payments, receipt: NOT VERIFIED end-to-end (no live or authenticated run).
- Historical PDF reprint: NOT VERIFIED (no renderer; see R7).
- Customer balance reconciles: `LedgerClosingBalance_EqualsOutstandingTotal_AndEachInvoiceIsDebitedOnce` (5,880 both ways), `OutstandingList_TotalsTheCustomersTrueBalance...`.
- Sales ledger reconciles: report-side tests above; UI NOT VERIFIED.
- Date filters across month boundaries: `ExplicitMonthWindow_ReturnsOnlyInvoicesInsideItsBoundaries`, `billingDateWindow` tests.
- Pagination footer equals filtered rows: `Paging_AcrossPages_NeitherRepeatsNorSkipsRows_AndTotalsStayConstant`.
- Cross-tenant payment / invoice visibility: `TenantIsolation_OtherTenantHistoricalInvoice_IsNeverReturned`.

Test fixture note: the new SQLite fixtures disable FK enforcement (`PRAGMA foreign_keys = OFF`). They test report logic, not referential integrity. The existing SQLite fixtures do the same only where needed.

Red-first note: the backend tests were written after the code change because the old `GetSalesReportAsync` has no `includeLegacy` parameter and cannot compile against the new tests. The defect was demonstrated from production data (customer 139 numbers, footer arithmetic, 39 colliding ids) and from code reading, not from a failing test run.

## 5. Live production state (read-only, before deploy)

- Backend `https://hexabill.onrender.com/api/health`: healthy, `deployVersion=af2480890c0939bfb1e9d98f8bc41cae3c2b8242`, DB connected, 4/100 connections.
- Frontend: `frozenhub` and `gulfharvest` hosts serve `index-HynaQbkh.js`.
- Authenticated endpoints return 401 without a session. Owner credentials are not available to this session, so authenticated live QA is **BLOCKED**.

## 6. Still open (not fixed in this checkpoint)

1. **Historical PDF renderer (R7).** A historical reprint needs a legacy document layout with the Starplus issuer identity. The owner must confirm the header and issuer wording before this is built. Until then historical rows open the read-only record.
2. **Customers.Balance cache (11 customers).** Dry-run only. Recalculation needs owner approval and a before/after audit row. Not executed.
3. **Footer 374 invoices and 454,276.40 paid (customer 139).** Not reproducible from the current tables. Likely a date-window artefact of the old code (30-day default in the report, unbounded legacy list). Re-check on the live page after deploy. NOT VERIFIED.
4. **Live QA** for Pay, Pay All, partial payment, receipts, PDFs, Billing History and Sales Ledger. Owner credentials required. BLOCKED.
5. **Render logs and performance.** Not inspected in this checkpoint (no workspace access in this session). NOT VERIFIED.
6. **Vercel runtime errors and browser console.** Not inspected in this checkpoint. NOT VERIFIED.
7. **Returns credit ledger test** (`Ledger_NetsApprovedReturns...`) fails on clean HEAD. Pre-existing.
8. **Intermittent full-run failure** of `Footer_HistoricalInvoicesAndOpeningReceivable_AreNotDoubleCounted`. Not reproduced in 3 later runs. Root cause unknown.
9. **Staff visibility.** The report hides historical rows from Staff roles, but the ledger's legacy list does not apply the same role rule. Pre-existing; not changed. Owner decision needed.
10. **Billing History PDF for historical rows** is not offered (it opens the record), consistent with R6.

## 7. Files changed in this checkpoint

Backend: `Models/DTOs.cs`, `Modules/Reports/ReportService.cs`, `Modules/Reports/ReportsController.cs`.
Backend tests: `tests/HexaBill.Tests/billing/SalesReportLegacyContinuityTests.cs`, `tests/HexaBill.Tests/billing/CustomerBalanceCanonicalTests.cs`.
Frontend: `src/features/customers/CustomerLedgerPage.jsx`, `src/features/sales/BillingHistoryPage.jsx`, `src/utils/customerBillRows.js` (new).
Frontend tests: `tests/customerBillRows.test.js` (new).
Evidence: `docs/plan/starplus-repair-2026-11-03/` (this file, two CSVs), `docs/plan/STARPLUS-DUPLICATE-INVESTIGATION-2026-11-03.md`.

No database rows were written, updated or deleted.
