# Production save incident — 2026-10-17 read-only

STATUS (updated 2026-10-17 UTC): local formatter PASS and committed on `main` at `84c9e1f`. Live backend is `84c9e1f` (Render deploy `dep-db9iamvavr4c73e6gpvg`, finished 07:38:04Z). Live frontend bundle `assets/index-C7xkt4XT.js` shows the `(Ref:` format. The `86eafed` and `index-DdioVnWh.js` statements below are historical, not current.

## Environment
- Backend: Render `srv-d68jpdvpm1nc7393q4d0`, live deploy `dep-db6q64nf3r2c73c3bu00`, commit `86eafed`, `/health/ready` 200 Ready/Current.
- Frontend: `https://gulfharvest.hexabill.company/` bundle `assets/index-DdioVnWh.js`. That bundle still contains `Something went wrong. Ref:`.
- Database: Render Postgres `hexabill`, PostgreSQL 18.6, 67 public tables, 52 migrations. Latest migration `20261010120000_AddVatCalculationVersioning`.
- No production writes, migrations, or deploys in this session.

## Clients
7 tenant rows, ids 3, 6, 8, 20, 21, 22, 23. Names are kept in the live database and are not repeated in this repo.

Counts: customers 99, products 130, sales 1118, payments 1011, purchases 33, expenses 75, sale returns 4, users 22. Tenant 22: 43 products, 8 customers. Products with an image path: 2.

## Products and Customers shape
Products: 22 columns. Required: Sku varchar(50), NameEn varchar(200), UnitType varchar(20), ConversionToBase/CostPrice/SellPrice/StockQty numeric(18,2), ReorderLevel int, IsActive bool default true. Unique: (TenantId, Sku) and (TenantId, Barcode) where barcode is not null. CategoryId FK to ProductCategories, ON DELETE SET NULL.

Customers: 27 columns. Required: Name varchar(200), CustomerType int, CreditLimit/TotalSales/TotalPayments/PendingBalance/Balance numeric(18,2) default 0. Phone varchar(20) nullable. No unique phone index; the service rejects a duplicate phone in code. MainLatitude/MainLongitude numeric(9,6).

## SAVE-01 — customer 409 shown as a ref only
- Time: 2026-10-17 06:09:00Z. Tenant 22, user 38, screen customers.
- HTTP: POST `/api/customers` status 409, correlation `ad0dcbded41a`, 22ms.
- Server exception: duplicate phone. No customer row was inserted for this call.
- Live `api.js` replaces `error.response.data.message` with `Something went wrong. Ref:` whenever `X-Correlation-ID` is present. The phone reason never reaches the toast.
- Later same session: POST `/api/customers` 201 at 06:10:27 correlation `3343d2f75a34` (73ms). POST `/api/products` 201 at 06:11:33 correlation `dca7b86e2efa` (45ms). Product id 135 inserted, active, stock 0. Those 201 responses are real commits, not false failures.
- Root cause of the misleading toast: 4xx message replacement in the response interceptor.
- Local fix: `formatApiErrorForToast` keeps the server message and appends `(Ref: …)`. Duplicate-phone exceptions are no longer logged as `CreateCustomerAsync error`.
- Test: `node --test tests/apiError.test.js` in `frontend/hexabill-ui` — 3 passed, 0 failed, 0 skipped.
- Browser: NOT TESTED on production. A live create would be a production write. The deployed bundle was inspected and still has the old string.

## FIN-01 — invoice 15.75 / payment 5 / return 15.75
- Sale 1628, tenant 22: GrandTotal 15.75, PaidAmount 5.00, PaymentStatus Partial, branch 7, route 6, not deleted.
- One payment row sums to 5.00.
- Sale return 9: approved, GrandTotal 15.75, RefundStatus PendingRefund, branch 7, route null, customer 123.
- Customer 123: Balance -5.00, PendingBalance -5.00, TotalSales 15.75, TotalPayments 5.00.
- Database customer credit matches 5.00. The live backend is `86eafed`, which is before the local return-netting commits, so live reports that use total minus paid still show 10.75.
- Local gap closed this session: sales report Pending/Paid/Partial filters now subtract approved returns. A full return of this shape is settled (not pending, not partial).
- SQLite evidence: `dotnet test --filter FullyQualifiedName~SalesReportStatus_Sqlite_FullyReturnedPartialInvoiceIsSettled` -> exit 0, **1 passed / 0 failed / 0 skipped**.
- PostgreSQL twin `SalesReportStatus_TreatsFullyReturnedPartialInvoiceAsSettled` compiled and **skipped**. The trust-auth cluster on port 55474 cannot bind `127.0.0.1` in this session, and the installed PostgreSQL 18 service on 5432 has no saved password.
- Aging, ledger, pending bills, and tenant dashboard already have local PostgreSQL tests from RETURN-01..04. Those tests were not re-run this session. Production screens were not opened with an owner login. Production runtime is still `86eafed`.

## Next
Deploy is not authorized. After an approved frontend deploy, repeat the duplicate-phone save and confirm the toast names the phone conflict and includes the ref. Then open the Gulf Harvest dashboard for sale 1628 and confirm outstanding 0 and credit 5.

## Update 2026-10-17 (UTC) — read-only verification after the deploy
- Live backend: `https://hexabill.onrender.com/health/ready` returned Ready / Connected / Current, `deployVersion` `84c9e1ff83ef768c9206c891e890b5387c71ba46`.
- Live frontend: bundle `assets/index-C7xkt4XT.js` (615,232 bytes) contains `(Ref:` 3 times and `Something went wrong. Ref:` 0 times, so the toast fix is served.
- Post-deploy write: customer `126` (tenant 22) created at 07:45:57 UTC. ErrorLogs rows since the deploy: 0. No product was created after the deploy, so the live product create path is NOT verified.
- Local tests on `84c9e1f`: `node --test tests/apiError.test.js` 3/3 PASS; frontend `npm test` 184/184 PASS, 0 skipped.
- Live schema: [LIVE-SCHEMA-2026-10-17.md](../database/LIVE-SCHEMA-2026-10-17.md). 55 migration rows, 54 files on disk, none pending. One orphan history row (`20260215070856_AddBranchIdToExpense`) is documented and kept.
- Still open: a live product create test (needs owner approval, a marked row, then cleanup); the barcode auto-fill 500 from 2026-10-13 is unexplained; sale return 9 has no route; the database password was pasted into chat and should be rotated.
