-- =============================================================================
-- PASTE THIS ENTIRE FILE INTO RENDER PSQL (Connect → PSQL)
-- Fixes: 42703 column e.TenantId / e0.TenantId does not exist (Expenses, ExpenseCategories)
-- Run once, then restart your HexaBill API on Render.
-- =============================================================================

-- 6b. Add TenantId to Expenses
ALTER TABLE "Expenses" ADD COLUMN IF NOT EXISTS "TenantId" integer NULL;
CREATE INDEX IF NOT EXISTS "IX_Expenses_TenantId" ON "Expenses" ("TenantId");
UPDATE "Expenses" SET "TenantId" = "OwnerId" WHERE "TenantId" IS NULL AND "OwnerId" IS NOT NULL;
UPDATE "Expenses" SET "TenantId" = (SELECT "Id" FROM "Tenants" ORDER BY "Id" ASC LIMIT 1) WHERE "TenantId" IS NULL;

-- 7. Add TenantId to ExpenseCategories
ALTER TABLE "ExpenseCategories" ADD COLUMN IF NOT EXISTS "TenantId" integer NULL;
DROP INDEX IF EXISTS "IX_ExpenseCategories_Name";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Expenses' AND column_name='TenantId') THEN
    UPDATE "ExpenseCategories" ec
    SET "TenantId" = (
      SELECT e."TenantId" FROM "Expenses" e
      WHERE e."CategoryId" = ec."Id" AND e."TenantId" IS NOT NULL
      LIMIT 1
    )
    WHERE ec."TenantId" IS NULL AND EXISTS (
      SELECT 1 FROM "Expenses" e2 WHERE e2."CategoryId" = ec."Id"
    );
  END IF;
END $$;
UPDATE "ExpenseCategories" ec
SET "TenantId" = (SELECT "Id" FROM "Tenants" ORDER BY "Id" ASC LIMIT 1)
WHERE ec."TenantId" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "IX_ExpenseCategories_TenantId_Name" ON "ExpenseCategories" ("TenantId", "Name");

-- 8. Add TenantId to InvoiceTemplates
ALTER TABLE "InvoiceTemplates" ADD COLUMN IF NOT EXISTS "TenantId" integer NULL;
CREATE INDEX IF NOT EXISTS "IX_InvoiceTemplates_TenantId" ON "InvoiceTemplates" ("TenantId");
UPDATE "InvoiceTemplates" t
SET "TenantId" = (SELECT u."TenantId" FROM "Users" u WHERE u."Id" = t."CreatedBy" AND u."TenantId" IS NOT NULL LIMIT 1)
WHERE t."TenantId" IS NULL;
UPDATE "InvoiceTemplates" t
SET "TenantId" = (SELECT "Id" FROM "Tenants" ORDER BY "Id" ASC LIMIT 1)
WHERE t."TenantId" IS NULL;
