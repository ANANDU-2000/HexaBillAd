-- ============================================
-- DATA MIGRATION SCRIPT: OwnerId → TenantId
-- Purpose: Migrate existing OwnerId data to TenantId
-- Date: 2026-02-11
-- ============================================
-- 
-- IMPORTANT: Run this script AFTER creating Tenant entities
-- This script assumes:
-- 1. Tenant table exists
-- 2. TenantId columns exist in all business tables (nullable)
-- 3. OwnerId columns still exist (will be removed later)
--
-- ============================================

BEGIN TRANSACTION;

-- Step 1: Create tenants from distinct OwnerIds
-- This creates Tenant 1 and Tenant 2 from existing OwnerId 1 and OwnerId 2

INSERT INTO "Tenants" ("Name", "Country", "Currency", "Status", "CreatedAt")
SELECT 
    'Tenant ' || "OwnerId"::text AS "Name",
    'AE' AS "Country",
    'AED' AS "Currency",
    'Active' AS "Status",
    NOW() AS "CreatedAt"
FROM (
    SELECT DISTINCT "OwnerId" 
    FROM "Users" 
    WHERE "OwnerId" IS NOT NULL AND "OwnerId" > 0
) AS distinct_owners
WHERE NOT EXISTS (
    SELECT 1 FROM "Tenants" WHERE "Id" = distinct_owners."OwnerId"
)
ON CONFLICT DO NOTHING;

-- Step 2: Update Users table
-- Assign TenantId = OwnerId for regular users
-- SystemAdmin users keep TenantId = NULL

UPDATE "Users"
SET "TenantId" = "OwnerId"
WHERE "OwnerId" IS NOT NULL AND "OwnerId" > 0 AND "TenantId" IS NULL;

-- Step 3: Update all business tables
-- Set TenantId = OwnerId for all existing records

UPDATE "Sales"
SET "TenantId" = "OwnerId"
WHERE "TenantId" IS NULL AND "OwnerId" IS NOT NULL;

UPDATE "Customers"
SET "TenantId" = "OwnerId"
WHERE "TenantId" IS NULL AND "OwnerId" IS NOT NULL;

UPDATE "Products"
SET "TenantId" = "OwnerId"
WHERE "TenantId" IS NULL AND "OwnerId" IS NOT NULL;

UPDATE "Purchases"
SET "TenantId" = "OwnerId"
WHERE "TenantId" IS NULL AND "OwnerId" IS NOT NULL;

UPDATE "Payments"
SET "TenantId" = "OwnerId"
WHERE "TenantId" IS NULL AND "OwnerId" IS NOT NULL;

UPDATE "Expenses"
SET "TenantId" = "OwnerId"
WHERE "TenantId" IS NULL AND "OwnerId" IS NOT NULL;

UPDATE "Alerts"
SET "TenantId" = CASE WHEN "OwnerId" > 0 THEN "OwnerId" ELSE NULL END
WHERE "TenantId" IS NULL;

UPDATE "InvoiceVersions"
SET "TenantId" = "OwnerId"
WHERE "TenantId" IS NULL AND "OwnerId" IS NOT NULL;

UPDATE "SaleReturns"
SET "TenantId" = "OwnerId"
WHERE "TenantId" IS NULL AND "OwnerId" IS NOT NULL;

UPDATE "PurchaseReturns"
SET "TenantId" = "OwnerId"
WHERE "TenantId" IS NULL AND "OwnerId" IS NOT NULL;

UPDATE "PriceChangeLogs"
SET "TenantId" = "OwnerId"
WHERE "TenantId" IS NULL AND "OwnerId" IS NOT NULL;

UPDATE "InventoryTransactions"
SET "TenantId" = "OwnerId"
WHERE "TenantId" IS NULL AND "OwnerId" IS NOT NULL;

UPDATE "AuditLogs"
SET "TenantId" = "OwnerId"
WHERE "TenantId" IS NULL AND "OwnerId" IS NOT NULL;

UPDATE "Settings"
SET "TenantId" = "OwnerId"
WHERE "TenantId" IS NULL AND "OwnerId" IS NOT NULL;

-- Step 4: Verify migration
-- Check that all records have TenantId set (except SystemAdmin records)

DO $$
DECLARE
    unmigrated_count INTEGER;
BEGIN
    -- Check Sales
    SELECT COUNT(*) INTO unmigrated_count
    FROM "Sales"
    WHERE "TenantId" IS NULL AND "OwnerId" IS NOT NULL;
    
    IF unmigrated_count > 0 THEN
        RAISE NOTICE 'Warning: % Sales records still have NULL TenantId', unmigrated_count;
    END IF;
    
    -- Check Customers
    SELECT COUNT(*) INTO unmigrated_count
    FROM "Customers"
    WHERE "TenantId" IS NULL AND "OwnerId" IS NOT NULL;
    
    IF unmigrated_count > 0 THEN
        RAISE NOTICE 'Warning: % Customer records still have NULL TenantId', unmigrated_count;
    END IF;
    
    -- Check Products
    SELECT COUNT(*) INTO unmigrated_count
    FROM "Products"
    WHERE "TenantId" IS NULL AND "OwnerId" IS NOT NULL;
    
    IF unmigrated_count > 0 THEN
        RAISE NOTICE 'Warning: % Product records still have NULL TenantId', unmigrated_count;
    END IF;
    
    RAISE NOTICE 'Migration completed. Review warnings above.';
END $$;

-- Step 5: Create indexes on TenantId for performance
-- (Only if they don't exist)

CREATE INDEX IF NOT EXISTS "IX_Sales_TenantId" ON "Sales" ("TenantId");
CREATE INDEX IF NOT EXISTS "IX_Customers_TenantId" ON "Customers" ("TenantId");
CREATE INDEX IF NOT EXISTS "IX_Products_TenantId" ON "Products" ("TenantId");
CREATE INDEX IF NOT EXISTS "IX_Purchases_TenantId" ON "Purchases" ("TenantId");
CREATE INDEX IF NOT EXISTS "IX_Payments_TenantId" ON "Payments" ("TenantId");
CREATE INDEX IF NOT EXISTS "IX_Expenses_TenantId" ON "Expenses" ("TenantId");
CREATE INDEX IF NOT EXISTS "IX_Users_TenantId" ON "Users" ("TenantId");

COMMIT;

-- ============================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================

-- Check tenant count
-- SELECT COUNT(*) FROM "Tenants";

-- Check users with TenantId
-- SELECT "Id", "Email", "OwnerId", "TenantId" FROM "Users";

-- Check Sales migration
-- SELECT COUNT(*) FROM "Sales" WHERE "TenantId" IS NULL AND "OwnerId" IS NOT NULL;

-- Check Customers migration
-- SELECT COUNT(*) FROM "Customers" WHERE "TenantId" IS NULL AND "OwnerId" IS NOT NULL;

-- Check Products migration
-- SELECT COUNT(*) FROM "Products" WHERE "TenantId" IS NULL AND "OwnerId" IS NOT NULL;
