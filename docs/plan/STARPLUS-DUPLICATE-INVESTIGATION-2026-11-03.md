# Starplus / FrozenHub 1 (tenant 20) — duplicate invoice investigation

Date: 2026-11-03 · Branch `main` · HEAD `af248089` (= origin/main, clean tree) · Backend `deployVersion=af248089` healthy · Frontend bundle `index-HynaQbkh.js` served on frozenhub and gulfharvest hosts.

Scope of this checkpoint: READ-ONLY investigation and plan. No production writes, no pushes, no deploys, no data repair.
Read-only access: `~/.hexabill-ro/q.sh` (forces `default_transaction_read_only=on`). Credentials are not reproduced here.

## 1. Root cause of the visible duplicates (CONFIRMED in code and data)

Two independent read paths both inject the same historical (LegacyInvoices) rows into the same customer list:

| # | Location | Behaviour |
|---|----------|-----------|
| A | `backend/HexaBill.Api/Modules/Reports/ReportService.cs` ~L1376–1450 | For tenant 20, `GetSalesReportAsync` merges active `LegacyInvoices` into the Sales Report as `SaleDto` with `Id = -LegacyId`, `Notes = "Historical Starplus invoice"`, and **no `isLegacy` flag**. The UI therefore shows Edit/Delete on these rows. |
| B | `frontend/hexabill-ui/src/features/customers/CustomerLedgerPage.jsx` ~L1225–1340 | Separately calls `legacyAPI.getInvoices({customerId})`, maps each row with `isLegacy: true`, and returns `[...validSales, ...legacyInvoices]`. Each legacy invoice therefore appears a second time, labelled "Historical". |

Result on the Customer Ledger Bills tab: every active legacy invoice appears twice (one "Historical" row with Pay/eye only, one "normal" row with Edit/Delete). This matches the screenshots for customers 139 and 143 exactly.

The Billing History page uses `legacyAPI.getUnifiedInvoices` (`LegacyHistoryController.cs` ~L571–700), which builds operating keys and historical keys as a union. It does not show the duplicate in code review. This is the pattern to standardise on.

### Customer 139 (KHAN DARBAR RESTAURANT) — footer and header arithmetic

| Figure on screen | Database value | Explanation |
|---|---|---|
| Header balance 1,475.00 Dr | `Customers.Balance` = 1,475.00 | Equals only current sale 7013. Excludes the 3 legacy pending invoices (6955 1,485 + 6974 1,465 + 6995 1,455 = 4,405.00). **Correct balance from these rows = 5,880.00.** Header is wrong. |
| "4 Unpaid Invoices" | 1 current + 3 legacy | Correct count. |
| Footer Total Pending 10,285.00 | 1,475 + 4,405 + 4,405 = 10,285 | Legacy pending is counted twice (report merge + legacy list). |
| Footer Total Invoices 374 | DB: 345 active legacy + 1 current sale = 346 | **NOT VERIFIED**: 374 does not reproduce from these tables. Likely a date-range or pagination artefact (see open item O-3). |
| Footer Total Paid 454,276.40 | DB: legacy paid 418,456.40 (×1 per row) | **NOT VERIFIED**: difference 35,820.00 not reproduced. |

Date-filter note: the screenshot shows FROM 01-11-2026 TO 03-11-2026 but displays October rows. Legacy invoices for customer 139 span 2025-11-21 to 2026-10-31. Which range was actually sent in the request is **NOT VERIFIED** (open item O-3).

## 2. Data-level findings (tenant 20 only; other tenants have no legacy rows)

| Item | Value (read-only query) |
|---|---|
| Legacy source tables | `LegacyInvoices` 5,109 rows (4,916 active, 193 deleted). `LegacyInvoiceItems` 10,627. `LegacyPayments` 5,330. `LegacyCustomers` 81, `LegacyCustomerMappings` 81. `LegacyProducts` 283. |
| Migration runs | `MigrationRuns` has **1** row: `PROD_MIGRATION_20261031210752`, Starplus, COMPLETED 2026-10-31 21:07:51Z. All 5,109 invoices share that `MigrationRunId`. **No evidence of two overlapping migration runs in the legacy tables.** The duplicate is a read-path defect, not a double import. |
| Run record vs live data | Run recorded TotalOutstanding 70,077.29. Live active outstanding 70,178.09 (93 invoices). Difference 100.80 = invoice 5100 (no destination customer). |
| Active legacy totals | Grand 3,817,356.88 · Paid 3,747,182.98 · Outstanding 70,178.09 across 93 invoices (87 `ReportedAsPending`). Overpayment 4.19 (63 invoices, per `STARPLUS-MIGRATION-RECONCILIATION.md`). Check: 70,178.09 − 4.19 = 3,817,356.88 − 3,747,182.98 ✓ |
| Source duplicates | 0 duplicate `SourceInvoiceId`. 99 invoice numbers appear on 211 rows (112 surplus rows). Each row is a distinct source document, so number alone is not an identity. Sample: mostly one deleted row next to one active row, often with different totals (e.g. 5369: 1331.04 deleted / 1331.00 active, same customer and date). |
| Same number + customer + date + total | 5 groups. Candidates for class C (duplicate) pending owner rule. |
| Customers affected by the duplicate display | 76 customers have active legacy invoices. Every one of them shows duplicated rows wherever the date range covers their invoices. |
| Orphans | 4 active legacy invoices have `DestinationCustomerId` NULL: 6632 (580.65), 2158 (100.80 outstanding, pending), 3829 (317.63), 4798 (708.75). Class F. |
| Payments linkage | `Payments.LegacyInvoiceId` linked rows = **0**. No historical payment has been recorded through the new negative-ID path in production. Historical payments exist only in `LegacyPayments`. Pay on a historical invoice is therefore **NOT VERIFIED** end-to-end. |
| Current sales (tenant 20) | `Sales` 40 rows (30 active, 10 deleted). No invoice number overlaps any legacy number (0 matches). No duplicate active numbers. |
| Current numbering defect (separate) | 9 current POS invoices carry Unix-timestamp-like numbers (e.g. 1791254850–1791254860, customer 115, Oct 2026). Needs its own investigation of `InvoiceNumberService`. Not changed. |
| Customers | 85 tenant-20 customers; 81 legacy mappings. 4 current-only customers (not yet identified). |

## 3. What is NOT the cause (ruled out so far)
- Two overlapping Starplus migration runs (only one run exists).
- Duplicated source rows (0 duplicate `SourceInvoiceId`).
- Cross-tenant leakage in legacy data (all legacy rows are tenant 20; no `Payments` cross-tenant mismatch).
- Negative-ID collision with current sales (no legacy row resolves to a current sale in the data; negative-ID logic is still a code-path item to test).

## 4. Other live state
- Backend `https://hexabill.onrender.com/api/health`: healthy, `deployVersion=af2480890c0939bfb1e9d98f8bc41cae3c2b8242`, DB connected, 4/100 connections.
- Frontend `frozenhub.hexabill.company` and `gulfharvest.hexabill.company` serve the same bundle (`index-HynaQbkh.js`). Tenant alias pin trap (memory: `hexabill-deploy-facts`) not re-tested this checkpoint.
- Render logs, Vercel runtime logs, and authenticated browser QA: **NOT VERIFIED** in this checkpoint (no logged-in browser session; endpoints return 401 without auth).

## 5. Proposed plan (for approval)

**Phase 1 — Code fix (local only, test first).**
1. Make one canonical invoice read model for tenant 20: a single backend list (reuse the `invoices/unified` key-union pattern) that returns each genuine invoice exactly once, with `sourceKind: current | historical`, `canonicalKey` (`SALE:<id>` / `LEG:<id>`), and the legacy row's own identity.
2. Remove the report-side legacy merge from Sales Report (or keep it only behind the same canonical model) and remove the frontend `[...validSales, ...legacyInvoices]` concat.
3. Compute header balance, footer totals, and "unpaid" count from the canonical list (balance = sum of canonical outstanding, not `Customers.Balance`).
4. Historical rows: read-only (Pay, view, reprint only). Current rows: unchanged editing rules.
5. Regression tests first (failing before the fix): one row per legacy invoice; footer pending equals sum of unique outstanding; customer 139 synthetic fixture expects 5,880 header balance and 3 legacy pending; no `Sales` row ever returned with a negative ID.
6. Run targeted backend tests against a disposable PostgreSQL seeded with anonymised fixtures (not live data), frontend build, then commit locally. **No push.**

**Phase 2 — Read-only reconciliation (prod, SELECT only).**
- Per-customer table for all 76 customers: legacy active count, current sale count, expected balance, `Customers.Balance` cache, diff.
- Classify the 99 repeated-number groups into A–F using the owner's rules (see questions).
- Output as CSV in `docs/plan/` for review. No writes.

**Phase 3 — Backup (needs approval).** Verified `pg_dump` of tenant-20 tables (`LegacyInvoices`, `LegacyInvoiceItems`, `LegacyPayments`, `Sales`, `SaleItems`, `Payments`, `Customers`, `MigrationRuns`) plus restore drill on a scratch database.

**Phase 4 — Data repair (only if owner approves rules).** Idempotent script with dry-run, before/after counts, transaction, audit rows, and rollback. Candidates: recalculate `Customers.Balance` cache for affected customers; assign the 4 orphans; decide on the 9 timestamp-numbered POS invoices (existing renumber tooling in `tools/billing/renumber_fh1_7000.md`). **No deletes** of legacy or current financial rows.

**Phase 5 — Deploy (needs explicit approval).** Push to `main` auto-deploys Render backend and Vercel frontend. Then verify both tenant hosts serve the same bundle, `deployVersion` matches, and the customer 139 and 143 ledgers show one row per invoice.

**Phase 6 — Live QA (needs owner login).** Customer ledger (139, 143), Billing History, Sales Ledger, Payments page, Pay on a historical invoice, Pay All, historical and current PDF reprint, date-range filters. Record evidence per item; mark NOT VERIFIED where not run.

**Not in this plan (separate tracks, do not mix):** print pagination redesign, purchases/expenses continuity audit, FrozenHub 2 isolation test, profit/cost snapshots (86 line recovery, owner-approved earlier, still unstarted), catalogue duplicates (`SHEEP FEET EVERYDAY`, `FROZEN GREEN PEAS SEARA`).

## 6. Decisions needed from the owner before Phases 3–5
- **O-1 Canonical display:** confirm historical invoices appear once, read-only, with Pay/view/reprint only (no Edit/Delete). Recommended: yes.
- **O-2 Repeated numbers (99 groups, 112 surplus rows):** approve rule: same customer + same date + same total = duplicate candidate (class C, hidden from list, kept in DB); same number but different customer or total = distinct documents (keep both, class D/E review). Who decides the candidate list?
- **O-3 Date filter and footer 374:** please confirm which date range was selected on the screenshot. I need that to resolve the 374 and 454,276.40 footer figures.
- **O-4 Orphans:** destination customer for invoices 6632, 2158, 3829, 4798, or keep as unassigned historical.
- **O-5 POS timestamp numbers:** renumber, or keep as-is and document?
- **O-6 Approval** for the backup in Phase 3 and for pushing/deploying in Phase 5.

## 7. Status
- Phase 1 investigation (read-only): done for the duplicate path. Unverified items listed above.
- No code changed, no commits, no pushes, no production writes in this checkpoint.
