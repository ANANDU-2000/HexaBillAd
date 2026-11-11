-- Profit-based VAT for FrozenHub 1 (20), FrozenHub 2 (23) and Gulf Harvest.
-- Run with:  psql "$DATABASE_URL" -v tenants="(20,23,<GULF_HARVEST_ID>)" -f scripts/sql/profit-vat-live-apply.sql
-- Everything runs in one transaction. Backups are kept in _bak_profitvat_* tables; drop them when verified.
-- Dry run first: replace COMMIT with ROLLBACK at the bottom.
BEGIN;

CREATE TABLE "_bak_profitvat_Expenses" AS SELECT * FROM "Expenses" WHERE "TenantId" IN :tenants;
CREATE TABLE "_bak_profitvat_ExpenseCategories" AS SELECT * FROM "ExpenseCategories" WHERE "TenantId" IN :tenants;
CREATE TABLE "_bak_profitvat_Tenants" AS SELECT "Id","VatCalculationBasis" FROM "Tenants" WHERE "Id" IN :tenants;

-- 1 = ProfitBased
UPDATE "Tenants" SET "VatCalculationBasis" = 1 WHERE "Id" IN :tenants;

-- Full amount, no VAT split. Amount becomes the gross figure the user typed (TotalAmount when present).
UPDATE "Expenses"
SET "Amount" = COALESCE("TotalAmount", "Amount"),
    "TotalAmount" = COALESCE("TotalAmount", "Amount"),
    "VatRate" = 0, "VatAmount" = 0, "ClaimableVat" = 0,
    "IsTaxClaimable" = false, "IsEntertainment" = false, "VatInclusive" = false
WHERE "TenantId" IN :tenants;

UPDATE "ExpenseCategories"
SET "DefaultVatRate" = 0, "DefaultIsTaxClaimable" = false, "DefaultIsEntertainment" = false
WHERE "TenantId" IN :tenants;

-- Check: every row now has Amount = TotalAmount and zero VAT.
SELECT "TenantId", COUNT(*) AS rows,
       SUM(("Amount" <> COALESCE("TotalAmount","Amount"))::int) AS amount_mismatch,
       SUM(COALESCE("VatAmount",0)) AS vat_left
FROM "Expenses" WHERE "TenantId" IN :tenants GROUP BY "TenantId";

COMMIT;
