# Fresh-install baseline versus the live schema snapshot (2026-10-18)

What this is: a database built by `FreshDatabaseBaseline` (the current EF model) was compared, table by table and column by column, with the read-only live snapshot in `LIVE-SCHEMA-2026-10-17.md`. Nothing live was queried for this comparison and nothing was changed. It lists where a fresh install would differ from production. It is evidence for the next steps of OPS-01, not a decision.

Method: scratch PostgreSQL 18 database, `ApplyIfEmptyAsync`, `information_schema.columns` dump (name, type, nullability, length), diffed against the snapshot tables. Limits: it compares columns only. It does NOT compare indexes, constraints, sequences, defaults, triggers or data, and a snapshot is a point in time.

## Result

| Measure | Live snapshot | Baselined fresh install |
|---|---|---|
| Tables | 67 | 68 |
| Columns | 871 | 877 |
| Tables only in live | 0 | |
| Tables only in the model | | 1: `AssistantDrafts` (added this session; its migration is written but not applied anywhere real) |
| Columns only in the model (live lacks them), outside `AssistantDrafts` | | 0 |
| Columns only in live (not in the model) | 6 | |
| Type differences | 14 | |
| Nullability differences | 5 | |
| Length differences | 2 | |

Reading: production already contains everything the model expects (apart from the new table), so the model and the live schema agree on what the application reads and writes. A fresh install differs from production only in the items below.

## Columns that exist only in live (a fresh install will not have them)

| Column | Likely origin | Used by current code? |
|---|---|---|
| `Branches.ManagerUserId`, `Branches.ManagerId1` | An older model shape; `ManagerId1` looks like an EF shadow property from a mapping that was later changed | Not in the current model, so not read or written by it |
| `SupplierPayments.SupplierId`, `SupplierPayments.PurchaseId` | Runtime supplier DDL in `Program.cs` | Not in the current model |
| `Suppliers.OpeningBalance`, `Suppliers.SupplierCategoryId` | Runtime supplier DDL | Not in the current model |

Action for the owner/engineer: confirm none of these hold data that matters, then either leave them (harmless) or record them as intentionally live-only. Do not drop them as part of this change.

## Type differences (benign, text versus character varying)

`CustomerVisits.Status`, `SupplierPayments.Mode` (live varchar, model text); `Expenses.RejectionReason`, `Expenses.TaxType`, `PaymentReceipts.ReceiptNumber`, `PaymentReceipts.PdfStoragePath`, `RecurringInvoiceItems.UnitType`, `SaleItems.VatScenario`, `Sales.VatScenario`, `VatReturnPeriods.PeriodType`, `.PeriodLabel`, `.Status`, `.SourceFingerprint`, `.ReviewInvalidatedReason` (live text, model varchar). PostgreSQL treats these interchangeably for the application; length limits are the only practical effect.

## Nullability differences (a fresh install is stricter or looser than live)

| Column | Live | Fresh install |
|---|---|---|
| `SupplierPayments.TenantId`, `SupplierPayments.SupplierName`, `Suppliers.TenantId` | allows NULL | NOT NULL |
| `ProductCategories.TenantId` | NOT NULL | allows NULL |
| `ProductCategories.ColorCode` | allows NULL | NOT NULL |

The first three matter for tenant isolation: live permits rows without a tenant in supplier tables. Whether any such rows exist was NOT checked (that needs a read-only count query on live, which has not been authorised in this session).

## Length differences

`Tenants.Subdomain` live 100, model 30 (the application already validates slugs to 30). `ProductCategories.Description` live 500, model 200.

## What this does not cover and what comes next

- Indexes and constraints are not compared (for example `IX_Products_TenantId_Barcode` was already reconciled earlier).
- The roughly 217 runtime `ALTER`/`CREATE TABLE` statements are still in the code. Each should become a numbered idempotent migration, verified on a disposable PostgreSQL database that has live-like history, before removal.
- Before any production step: backup and restore drill, approval, and a rehearsal against a restored copy of the real database. None was done.
