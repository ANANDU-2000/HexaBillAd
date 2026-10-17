# Product and customer create: field rules and failure causes — 2026-10-17

Scope: `Products` and `Customers` only. Each field is checked in three layers: the database (live catalog), the request DTO and service, and the client form. Database facts come from [LIVE-SCHEMA-2026-10-17.md](LIVE-SCHEMA-2026-10-17.md). No credentials are in this file.

## Why creates fail

| Symptom | Cause | Evidence | Status |
|---|---|---|---|
| Product saved, but the form stayed open and showed a failure | Save handler did not close the form when the row already existed | Incident note; commit `84c9e1f` | Fixed. Live on `84c9e1f` |
| Product create says "SKU already exists" for a new SKU | A barcode clash. The auto-barcode is the SKU, or an explicit barcode matches a deactivated product. The unique index `IX_Products_TenantId_Barcode` covers deactivated rows, but the service checked active rows only. The controller then mapped every unique violation to the SKU message | Live: 14 deactivated products carry barcodes. Reproduced on PostgreSQL 18: `DbUpdateException` in both cases ([ProductBarcodeConflictPostgreSqlTests.cs](../../tests/HexaBill.Tests/tenancy/ProductBarcodeConflictPostgreSqlTests.cs)) | Fixed in this session: [ProductService.cs](../../backend/HexaBill.Api/Modules/Products/ProductService.cs) and [ProductsController.cs](../../backend/HexaBill.Api/Modules/Products/ProductsController.cs). Not live until a backend deploy |
| Create failure message hidden behind "Something went wrong" | The client replaced 4xx server messages | Live bundle `index-C7xkt4XT.js` contains `(Ref:` and no old string | Fixed live |
| Customer create refused | Duplicate name (case-insensitive), near-duplicate root name, or duplicate phone. Returned as 409 by design | [CustomerService.cs](../../backend/HexaBill.Api/Modules/Customers/CustomerService.cs) lines 416 to 500 | Reason now shown. Rule unchanged |
| Customer create DB failure | Not found. No failing unique index on Customers, every NOT NULL column without a default is set by the create path, no ErrorLogs entries in 14 days | Schema note, section "NOT NULL columns with no database default" | No cause found |
| Customer 500 "Database error" | Any `DbUpdateException` maps to a generic 500 | [CustomersController.cs](../../backend/HexaBill.Api/Modules/Customers/CustomersController.cs) | Not reproduced; no live evidence |

## Products

| Field | Database (live) | Request DTO | Service | Client form | Gap |
|---|---|---|---|---|---|
| Sku | varchar(50) NOT NULL; unique (TenantId, Sku) | Required, max 50 | Character check; active and deactivated duplicates return 409 | Required, max 50 | None |
| Barcode | varchar(100) NULL; unique (TenantId, Barcode) WHERE not null. Live only, not in the EF model | Max 100 | Explicit barcode: active and deactivated owners return 409. Empty: the SKU is used if no row (active or not) holds it. Otherwise a generated `HB{tenant}-{id}` | Max 100 | Fixed here: deactivated rows were not checked |
| NameEn | varchar(200) NOT NULL | Required, max 200 | Max 200 | Required, max 200 | None |
| NameAr | varchar(200) NULL | Max 200 | Max 200 | Max 200 | None |
| UnitType | varchar(20) NOT NULL | Required, max 20 | Sanitised to 50, but the DTO rejects over 20 first | Required, max 20 | Service limit 50 disagrees with the DB limit 20. Harmless today |
| ConversionToBase | numeric(18,4) NOT NULL | Required, 0.0001 to 999,999.99 | Zero or less becomes 1 | 0.0001 to 999,999.99 | None |
| CostPrice | numeric(18,2) NOT NULL | Required, 0 to 99,999,999.99 | 0 to 1,000,000 (`ValidatePrice`), else 400 | 0 to 1,000,000 | DTO ceiling is higher than the service ceiling. Service wins |
| SellPrice | numeric(18,2) NOT NULL | As CostPrice | As CostPrice | As CostPrice | As CostPrice |
| StockQty | numeric(18,2) NOT NULL | Range 0 to 99,999,999.99 | Always 0. Opening stock uses the stock adjustment flow | Not sent | By design |
| ReorderLevel | integer NOT NULL | Zero or more | Negative becomes 0 | Whole number, zero or more | None |
| DescriptionEn, DescriptionAr | text NULL | Max 500 | Sanitised to 1,000 | Max 500 | None |
| ExpiryDate | timestamptz NULL | Optional | UTC | Optional | None |
| CategoryId | integer NULL, FK to ProductCategories, ON DELETE SET NULL | Optional | Category not in this tenant or inactive: silently set to null | Optional | Silent drop. Consider a 400 |
| ImageUrl | varchar(500) NULL | Optional | Max 500 | Optional | None |
| IsActive | boolean NOT NULL, default true | Not sent | Always true on create | Not sent | None |
| OwnerId | integer NOT NULL, no default | Not sent | Set to the tenant id | Not sent | None |
| TenantId | integer NOT NULL | From the token | Set | Not sent | None |
| CreatedAt, UpdatedAt | timestamptz NOT NULL, no default | Not sent | UtcNow | Not sent | None |
| RowVersion | bytea NOT NULL, default `\x00` | Not sent | Database default | Not sent | None |

## Customers

| Field | Database (live) | Request DTO | Service | Client form | Gap |
|---|---|---|---|---|---|
| Name | varchar(200) NOT NULL | Required, max 200 | Trimmed. Duplicate name (case-insensitive) or near-duplicate root name returns 409 | Required | None |
| Phone | varchar(20) NULL. No unique index | Max 20 | Trimmed. Duplicate phone in the tenant returns 409 | Required (`Phone number is required`) | Client requires a phone that the DB and DTO allow to be empty. No max-length on the field, so a long phone gets a server 400 |
| Email | varchar(100) NULL | Email format, max 100 | Trimmed | Valid email when set | None |
| Trn | varchar(50) NULL | Max 50 | Trimmed | Not checked in this review | Not reviewed |
| Address | varchar(500) NULL | Max 500 | Trimmed | Not checked in this review | Not reviewed |
| Location | varchar(200) NULL | Max 200 | Trimmed | Not checked in this review | Not reviewed |
| PaymentTerms | varchar(100) NULL | Max 100 | Trimmed | Required when credit limit is above 0 | None |
| CreditLimit | numeric(18,2) NOT NULL, default 0 | Range 0 to 99,999,999.99 | Negative becomes 0 | Not checked in this review | Not reviewed |
| CustomerType | integer NOT NULL, no default. Live values 0 and 1 | String, max 20 (`Credit` or `Cash`) | Parsed to the integer | Not checked in this review | None |
| Balance, TotalSales, TotalPayments, PendingBalance | numeric(18,2) NOT NULL, default 0 | Not sent | Balance 0 | Not sent | None |
| OwnerId | integer NOT NULL, no default | Not sent | Not set, so 0. 56 live rows are 0 | Not sent | Fix proposed (open item 7 in the schema note). Backfill needs approval |
| BranchId, RouteId | integer NULL | Optional | Route must exist in the tenant and match the branch | Branch and route required when chosen | None |
| MainLatitude, MainLongitude | numeric(9,6) NULL | Optional | Applied through `ApplyMainLocation` | Not checked in this review | Not reviewed |
| RowVersion | bytea NOT NULL, default `\x00` | Not sent | Set to a non-empty array | Not sent | None |
| CreatedAt, UpdatedAt | timestamptz NOT NULL, no default | Not sent | UtcNow | Not sent | None |

## Verification run in this session

- New tests, `ProductBarcodeConflictPostgreSqlTests`: 3 tests. Before the fix: 2 failed with `DbUpdateException`, 1 control passed. After the fix: 3 passed, 0 skipped.
- Full backend suite on a local disposable PostgreSQL 18 cluster, `127.0.0.1:55490`: 836 passed, 0 failed, 0 skipped. The schema was built with EnsureCreated, so this is not a migration rehearsal.
- Frontend unit suite: 184 passed, 0 failed, 0 skipped (`npm test`, this commit).

## Not done

- Live product create after the 07:38 UTC deploy: not tested. No live writes were made.
- The barcode fix is not on live until a backend deploy is approved. `render.yaml` says `checksPass`, but the Render service has `autoDeploy: no`.
- Migration rehearsal on a database with the live history: not done.
- Decision needed: declare `IX_Products_TenantId_Barcode` in the model, or keep it as a DB-only index. See schema note, open item 6.
- Client review of Trn, Address, Location, CreditLimit and map coordinates: not done.
