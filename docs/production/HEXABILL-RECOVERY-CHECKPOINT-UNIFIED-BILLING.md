# HexaBill recovery checkpoint: unified Billing History (Release A, slice 1)

- Date: 2026-11-01 (Asia/Dubai)
- Branch: `claude/fh1-unified-billing-history` (worktree `C:\Users\anand\.claude-worktrees\hexabill-unified-billing`), based on `origin/main` 9e7a3f3b
- Release state: FIXED_LOCALLY / TESTED locally. Not pushed, not deployed. Production verification pending an approved release.
- Coordination: a Codex goal session works in the main working tree on `main` (credential rotation, PdfService). This branch avoids PdfService, Program.cs, and the task tracker.

## Defects in this slice

| ID | Sev | Problem | Root cause | State |
|----|-----|---------|------------|-------|
| BH-01 | P0 | Billing History showed 16 invoices | Page kept three source tabs; `?tab=operating` in a URL/bookmark forced the operating-only query. Default also hard-coded tenant 20. | FIXED_LOCALLY: one unified list for every tenant; `tab` param dropped on load; links repointed |
| BH-02 | P0 | Unified list dropped invoices on the selected end date | Operating branch compared `InvoiceDate <= toDate 00:00Z`; rows are stored at 12:00Z. Live repro: end date 31 Oct returned 0 of 3 operating invoices. | FIXED_LOCALLY: shared `BusinessDateRange` (Dubai, inclusive start / exclusive end) for both sources |
| BH-03 | P1 (latent) | Customer filters matched `SourceCustomerId == customerId` | Source (Starplus 1..81) and destination (115..211) customer ids are different namespaces | FIXED_LOCALLY in LegacyController (3), CustomerService (5), PaymentService (1), ReportService (1). Live: 0 rows change today |
| BH-04 | P1 | Renumbering from Billing History preview threw `fetchSales is not defined` | Stale callback name | FIXED_LOCALLY |
| BH-05 | P2 | Unified endpoint leaked `ex.Message` in 500s | | FIXED_LOCALLY (unified endpoint only) |
| BH-06 | P2 | No status / sort / preset filters; "Voided" invisible after tabs removed | | FIXED_LOCALLY: `status=all|paid|partial|unpaid|voided`, `sort=newest|oldest`, Today..Custom presets |

Operating paid amount in the unified list = cleared payments only (same rule as the operating list); pending cheques never count. Paid/Partial/Pending use the 0.05 AED settlement tolerance; outstanding amounts are shown unrounded (one-cent residuals stay visible).

## Evidence

- Backend unit (SQLite): `UnifiedBillingHistoryTests` 16/16. Full suite (SQLite only): 2,121 passed, 0 failed, 114 PostgreSQL-gated skipped.
- Full suite with local PostgreSQL 18 (`HEXABILL_TEST_POSTGRES`, fresh DB): 2,233 passed, 1 failed, 1 skipped. The failure (`ReturnBalancePostgreSqlTests.Ledger_NetsApprovedReturns_SeparatelyFromActualReceipts`, Approved/15.75: expected customer balance -5, got 0) also fails on unmodified `origin/main` 9e7a3f3b (OPEN-06). The skip is `MigrationRehearsalPostgreSqlTests` (needs `HEXABILL_MIGRATION_REHEARSAL=1`); run explicitly it fails identically on `origin/main` (OPEN-07). This branch adds no migrations.
- Live production, read-only session (`default_transaction_read_only=on`, asserted by the test), new controller code on real data (`UnifiedBillingHistoryLiveReadOnlyTests`, opt-in via `HEXABILL_LIVE_READONLY_PG`):
  - Tenant 20 unified count 4,932 = 16 operating + 4,916 historical active; every row exactly once across 25 pages.
  - Status partitions: paid 4,845 + partial 17 + unpaid 70 = 4,932 (partial+unpaid = 87, matching the dashboard pending count).
  - Rolling week 26 Oct–1 Nov: 113 invoices, grand total AED 81,261.09 (matches the verified combined weekly sales baseline).
  - 6996 (historical), 6997 and 7012 (operating) each found by search.
  - Tenants 22 and 23: no historical rows; counts equal their own operating invoices.
- Frontend unit: 351/351 (`businessDateRange`, `billingHistoryUrl` new/updated).
- Vite production build: OK.
- Browser (local synthetic stack only; never production): `e2e/billing-history.spec.js` 4 tests x 5 viewports (m360, m390, t768, d1024, d1440) = 20 passed. Covers deprecated `?tab=` URLs, no Starplus/Archive wording, historical rows read-only and openable, status partitions, voided list, pagination, custom empty range, FH2 isolation.

## Open defects found (not fixed in this slice)

| ID | Sev | Where | Note |
|----|-----|-------|------|
| OPEN-01 | P1 | `CustomerLedgerPage.jsx` ~L1228 | Hard-codes tenant 20 and also fetches history when `tenantId` is missing. Server scope keeps data safe; should be capability-driven. |
| OPEN-02 | P1 | Dashboard / Reports date presets | Duplicated, browser-local dates. Migrate to `src/utils/businessDateRange.js`. |
| OPEN-03 | P2 | `GET /api/legacy/invoices`, `/payments`, `/purchases`, `/expenses` | Still UTC-day date filters and `ex.Message` in 500s. Move to `BusinessDateRange`. |
| OPEN-04 | P2 | `tests/legacyArchiveIntegration.test.js` | Asserts constants only; proves nothing. Replace with real reconciliation tests. |
| OPEN-05 | P2 | `CustomerDetailPage.jsx` | Separate amber "Starplus Legacy Archive" block remains in the normal customer page (Section 6). |
| OPEN-06 | P1 | Customer ledger with approved returns (pre-existing on main) | Approved return of 15.75 against a fully paid invoice should leave a -5.00 customer credit; ledger shows 0.00. |
| OPEN-07 | P2 | EF migrations (pre-existing on main) | `20260214070330_InitialPostgreSQL` fails on an empty DB (`Customers` already exists); migrations alone cannot build a fresh database. |

## Next executable task

Customer Ledger continuity (Section 8): remove OPEN-01, verify customers 136 (AED 8,954.00) and 143 (AED 1,611.99) on live read-only data, period vs current balance split, then OPEN-02.

## How to resume / reproduce

- Live read-only probe: set `HEXABILL_LIVE_READONLY_PG` to a connection string that includes `Options=-c default_transaction_read_only=on`, then `dotnet test --filter UnifiedBillingHistoryLiveReadOnlyTests`.
- Browser: disposable cluster `%TEMP%\hexabill-unified-pg-20261101` port 55481, DB `hexabill_codex_browser_unified_20261101` (synthetic tenants `frozenhub1-test`, `frozenhub2-test`; 30 synthetic historical rows + 1 deleted on `frozenhub1-test`).
