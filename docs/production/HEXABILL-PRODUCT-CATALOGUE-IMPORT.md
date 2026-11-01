# Product catalogue import: FrozenHub 2 (tenant 23) and Gulf Harvest (tenant 22)

Status: **plan generated and rehearsed locally; production apply BLOCKED pending owner review of the manifest, a fresh database backup, and explicit approval.**

## What is copied

Product master only: English name, Arabic name (none exist in the source), unit, conversion, SKU.
Never copied: stock, cost, selling price, barcode, stock movements, purchases, sales, customers, suppliers, payments, expenses, VAT history.

New rows are created **inactive, stock 0, cost 0, price 0** ("catalogue-only"). They appear under Products → Inactive (the tab badge now shows the real server count), are not offered in POS search, and cannot be sold until the owner activates them. Prices are entered at POS as today, or set on the product first.

Server rule added with this work (applies to all tenants): a normal (non zero-invoice) sale line must have a unit price above 0, and an inactive product cannot be newly added to a sale. Live check before the change: 0 sale lines anywhere matched either case, so no existing workflow is affected. Activation is deliberately *not* gated on a master price: FrozenHub 1 sells 14 of 15 products with no master price (priced at POS).

## Source (live, read-only, 2026-11-02)

FrozenHub 1 (tenant 20): 283 historical product masters (278 distinct names, no Arabic names, no barcodes) + 15 operating products = 298 rows.

## Plan results (live, read-only)

| Classification | Decision | FrozenHub 2 (23) | Gulf Harvest (22) |
|---|---|---|---|
| NEW_PRODUCT | IMPORT | 284 | 280 |
| DUPLICATE_IN_SOURCE | SKIP | 11 | 11 |
| ALREADY_EXISTS | SKIP | 0 | 2 |
| SKU_CONFLICT | REVIEW | 2 | 3 |
| POSSIBLE_DUPLICATE | REVIEW | 0 | 1 |
| INACTIVE_SOURCE | REVIEW | 1 | 1 |
| **Total rows** | | **298** | **298** |

Existing destination products are never modified: FrozenHub 2 keeps its 1 product (#102, an E2E test item from 2026-10-06; removing it needs separate approval); Gulf Harvest keeps all 69 (which already contain duplicate rows: 69 rows, 58 distinct names. The "7 matching names" in the brief are 7 Gulf Harvest rows that collapse to 2 distinct names, both classified ALREADY_EXISTS).

Review items (by source id; names are in the private CSVs):
- FH1 #90 (inactive onboarding item): recommend EXCLUDE.
- Starplus #23 vs Gulf Harvest #107: same SKU, different name. Probably the same item; recommend SKIP for tenant 22.
- Starplus #272 shares its SKU with an FH1 product of a longer name: probably the same product renamed; recommend SKIP.
- Starplus #298 shares its SKU with an unrelated FH1 product: needs a new SKU if wanted (set `ProposedSku`, change Decision to IMPORT).
- Starplus #60 vs Gulf Harvest #100: a duplicate source row uses Gulf Harvest's SKU; possibly the same item under another name.

Private manifests (not committed; repo is public): `C:\Users\anand\.hexabill-ro\product-import\`
`PRODUCT-SOURCE-AUDIT.csv`, `TENANT-23-PRODUCT-IMPORT-PREVIEW.csv`, `TENANT-23-PRODUCT-CONFLICT-REPORT.csv`, `TENANT-22-PRODUCT-IMPORT-PREVIEW.csv`, `TENANT-22-PRODUCT-CONFLICT-REPORT.csv`.

## Tool

`tools/HexaBill.CatalogueImport` (logic in `backend/HexaBill.Api/Modules/Products/CatalogueImportPlanner.cs`, 21 unit tests).

```
set HEXABILL_CATALOGUE_DB=<connection string>
dotnet HexaBill.CatalogueImport.dll plan  --target-tenant 23 --out <dir>          # forced read-only session, verified
dotnet HexaBill.CatalogueImport.dll apply --target-tenant 23 --manifest <reviewed preview.csv> --confirm IMPORT-CATALOGUE-TENANT-23 --out <dir>
```

Apply safety: refuses without the exact per-tenant token; writes through a DbContext scoped to the target tenant (cross-tenant writes are rejected by the context); re-checks each manifest row against the live source (edited names/units are rejected) and the live destination (existing names/SKUs skipped); one transaction; post-conditions (exact count, stock 0, price 0, cost 0, inactive, 0 stock movements) checked before commit, otherwise rolled back; writes a results CSV and a guarded rollback SQL (refuses if any imported product has been used in a sale, purchase or stock movement).

## Local rehearsal evidence (disposable DB, real source catalogue copied: names/SKUs/units only)

- Without token / wrong token: refused, exit 3, nothing written.
- Apply: 278 imported, 278 inactive, stock sum 0, price/cost 0, 0 inventory transactions; existing product unchanged (stock 100, active); all other tenants' products byte-identical (md5 before/after).
- Second apply: 0 imported. Re-plan: 278 ALREADY_EXISTS, 0 IMPORT.
- Rollback SQL: deleted exactly 278 rows; original product kept. Re-applied for UI checks.
- Browser (`e2e/catalogue-import.spec.js`, m390 + d1440): item listed under Inactive with real count badge, stock 0, AED 0.00; absent from the active list and POS search; API sale refused ("is inactive", and "no selling price" at 0.00).

## Production steps (each needs approval)

1. Owner reviews the two preview CSVs (Decision column), resolves REVIEW rows.
2. Fresh Render PostgreSQL backup / snapshot confirmed.
3. Deploy the branch containing the sale guard first (so imported items cannot be sold at 0.00 even after activation).
4. `apply` for tenant 23, then tenant 22; keep the results CSV and rollback SQL.
5. Verify counts in SQL and in the Products → Inactive tab for each tenant; confirm no stock movements.
