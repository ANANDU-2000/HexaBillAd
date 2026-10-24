# Invoice numbering: Starplus history and new FrozenHub 1 invoices

Status: PLAN — no production write. Written 2026-10-24 from read-only checks. Owner decisions are marked **DECISION**.

## Verified facts (read-only, 2026-10-24 ~10:35 UTC)

| Item | Value |
|---|---|
| Starplus source (`dpg-d4b0c91e2q1c73bamq70-a`) highest numeric invoice number | 6892 |
| Starplus source sales rows | 5,002 (all numeric invoice numbers; no non-numeric) |
| Starplus source invoices created in last 24 h / last 7 days | 22 / 115 |
| Starplus source live duplicates | none on live rows; duplicates exist only where one copy is soft-deleted |
| FrozenHub 1 (tenant 20, `dpg-d68jhpk9c44c73ft047g-a`) live duplicate numbers | none |
| FrozenHub 1 numbers in the 7000 series (7000–999,999) | none issued |
| FrozenHub 1 numbers ≥ 1,000,000 | 1791254850–1791254859 (issued 20–24 Oct, genuine customers) |
| FrozenHub 1 test numbers | `FH-SMK-1791254849`, `1791254850/51/54/55` (test; to be voided) |
| `INVOICE_SERIES_START` for tenant 20 | not set (owner action pending) |

At the observed rate, Starplus reaches 7000 in roughly 4–5 days (around 29 October). Starplus is not assumed to stop.

## Rules

1. **Original numbers are never changed.** A migrated Starplus invoice keeps its exact printed `InvoiceNo`. Its internal `Sales.Id` is a new identity mapped in the migration ledger (source ID → target ID). Old pending-bill paper references stay searchable by that original number.
2. **Issued numbers are never reused or renumbered**, including deleted and voided invoices. The app already refuses a typed number that was ever issued in the series (`GetManualInvoiceNumberProblemAsync`).
3. **The FrozenHub series starts above every imported number.** The series start `S` must satisfy `S > N_c`, where `N_c` is the highest Starplus number that is imported or still live at cutover.
   - If Starplus stops before 7000 (`N_c` < 7000): `S = 7000`, as the client asked.
   - If Starplus issues numbers at or above 7000 before cutover: `S` must move above `N_c`. **DECISION:** owner chooses `S` (e.g. 8000); the client's 7000 start then applies only if the cutoff is before 7000.
4. **Imports never write a number that already exists in tenant 20**, live or deleted. The importer checks the full set difference before writing and stops on any intersection. A conflict is an exception for the owner, never an automatic renumber.
5. **Typed numbers below `S` are refused for new invoices.** This keeps the Starplus range (2000–`N_c`) for imported history only. **DECISION (owner):** confirm this is wanted; the current rule refuses every number below `S`, even unused ones.
6. **Starplus invoices issued after the cutoff** are a separate delta. Each delta invoice must pass rule 4 before import; a delta number at or above `S` is a blocker, not a renumbering case.
7. **Tenant isolation:** FrozenHub 2 (tenant 23) and Gulf Harvest (tenant 22) are not part of this numbering and must not receive any of these numbers or series settings.

## Gates before any production import

1. Owner decision on cutoff time and on `S` (rules 3 and 5).
2. Fresh source snapshot and a restorable backup of both databases; restore drill passed.
3. Pre-import collision report: source numbers ∩ tenant 20 numbers (live and deleted) = empty, with the result stored in the migration ledger.
4. Staging rehearsal on a disposable copy of tenant 20, using the same importer, reconciled by count, sum of `GrandTotal`/`PaidAmount`/VAT, and a sample of exact invoice-number matches.
5. Explicit cutover approval recorded in the migration ledger.

## Read-only checks to run at cutover

```sql
-- live numbers that collide with imported source numbers (must return 0 rows)
select s."InvoiceNo" from "Sales" s where s."TenantId" = 20 and s."InvoiceNo" = any(:source_numbers);
-- highest issued number in the series window (must be below S until the owner moves it)
select max("InvoiceNo"::numeric) from "Sales" where "TenantId" = 20 and "InvoiceNo" ~ '^[0-9]+$' and "InvoiceNo"::numeric < 1000000;
```

## Open items

- **DECISION (owner):** cutoff date/time for Starplus, and whether Starplus issues beyond 7000 before cutover.
- **DECISION (owner):** `S` if the cutoff is after 7000; whether typed numbers below `S` should stay refused.
- **DECISION (accountant):** pre-registration tax treatment for invoices dated before 1 November 2026.
- The invoice-header staging importer is not yet built. The existing migration batches (`FinancialStage`, `ReceiptSnapshotStage`) must be extended under the rules above before any cutover.
