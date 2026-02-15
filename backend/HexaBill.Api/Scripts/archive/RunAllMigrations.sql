-- ============================================
-- COMPLETE DATABASE MIGRATION SCRIPT
-- Purpose: Execute all migrations in correct order
-- Date: 2026-02-11
-- ============================================
-- 
-- IMPORTANT: Run this script AFTER Entity Framework migrations
-- This script handles:
-- 1. Data migration (OwnerId → TenantId)
-- 2. Seed subscription plans
-- 3. Enable RLS (if PostgreSQL)
--
-- ============================================

-- Step 1: Create Tenants from existing OwnerIds
-- This creates Tenant records from distinct OwnerId values
INSERT INTO "Tenants" ("Name", "Country", "Currency", "Status", "CreatedAt")
SELECT 
    'Tenant ' || "OwnerId"::text AS "Name",
    'AE' AS "Country",
    'AED' AS "Currency",
    0 AS "Status", -- Active
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

-- Step 2: Update Users table - Assign TenantId = OwnerId
UPDATE "Users"
SET "TenantId" = "OwnerId"
WHERE "OwnerId" IS NOT NULL AND "OwnerId" > 0 AND "TenantId" IS NULL;

-- Step 3: Update all business tables - Set TenantId = OwnerId
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

UPDATE "Settings"
SET "TenantId" = "OwnerId"
WHERE "TenantId" IS NULL AND "OwnerId" IS NOT NULL;

UPDATE "Alerts"
SET "TenantId" = "OwnerId"
WHERE "TenantId" IS NULL AND "OwnerId" IS NOT NULL;

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

-- Step 4: Seed Subscription Plans
INSERT INTO "SubscriptionPlans" ("Name", "Description", "MonthlyPrice", "YearlyPrice", "Currency", "MaxUsers", "MaxInvoicesPerMonth", "MaxCustomers", "MaxProducts", "MaxStorageMB", "HasAdvancedReports", "HasApiAccess", "HasWhiteLabel", "HasPrioritySupport", "HasCustomBranding", "TrialDays", "IsActive", "DisplayOrder", "CreatedAt")
VALUES
    ('Basic', 'Perfect for small businesses', 99.00, 990.00, 'AED', 5, 100, 500, 1000, 1024, false, false, false, false, false, 14, true, 1, NOW()),
    ('Professional', 'For growing businesses', 199.00, 1990.00, 'AED', 15, 500, 2000, 5000, 5120, true, true, false, true, true, 14, true, 2, NOW()),
    ('Enterprise', 'For large businesses', 499.00, 4990.00, 'AED', -1, -1, -1, -1, -1, true, true, true, true, true, 14, true, 3, NOW())
ON CONFLICT DO NOTHING;

-- Step 5: Create indexes for performance (PostgreSQL syntax)
-- Note: For SQLite, indexes are created automatically by EF Core
-- These commands work for PostgreSQL. For SQLite, EF Core handles indexes.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'IX_Sales_TenantId') THEN
        CREATE INDEX "IX_Sales_TenantId" ON "Sales" ("TenantId");
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'IX_Customers_TenantId') THEN
        CREATE INDEX "IX_Customers_TenantId" ON "Customers" ("TenantId");
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'IX_Products_TenantId') THEN
        CREATE INDEX "IX_Products_TenantId" ON "Products" ("TenantId");
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'IX_Purchases_TenantId') THEN
        CREATE INDEX "IX_Purchases_TenantId" ON "Purchases" ("TenantId");
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'IX_Payments_TenantId') THEN
        CREATE INDEX "IX_Payments_TenantId" ON "Payments" ("TenantId");
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'IX_Expenses_TenantId') THEN
        CREATE INDEX "IX_Expenses_TenantId" ON "Expenses" ("TenantId");
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'IX_Users_TenantId') THEN
        CREATE INDEX "IX_Users_TenantId" ON "Users" ("TenantId");
    END IF;
END $$;

-- Step 6: Verification queries
-- Check for any NULL TenantIds in business tables (should be 0 after migration)
SELECT 'Sales' AS TableName, COUNT(*) AS NullTenantIds FROM "Sales" WHERE "TenantId" IS NULL AND "OwnerId" IS NOT NULL
UNION ALL
SELECT 'Customers', COUNT(*) FROM "Customers" WHERE "TenantId" IS NULL AND "OwnerId" IS NOT NULL
UNION ALL
SELECT 'Products', COUNT(*) FROM "Products" WHERE "TenantId" IS NULL AND "OwnerId" IS NOT NULL
UNION ALL
SELECT 'Users', COUNT(*) FROM "Users" WHERE "TenantId" IS NULL AND "OwnerId" IS NOT NULL AND "OwnerId" > 0;

-- Show tenant summary
SELECT 
    t."Id",
    t."Name",
    COUNT(DISTINCT u."Id") AS UserCount,
    COUNT(DISTINCT s."Id") AS SaleCount,
    COUNT(DISTINCT c."Id") AS CustomerCount
FROM "Tenants" t
LEFT JOIN "Users" u ON u."TenantId" = t."Id"
LEFT JOIN "Sales" s ON s."TenantId" = t."Id"
LEFT JOIN "Customers" c ON c."TenantId" = t."Id"
GROUP BY t."Id", t."Name"
ORDER BY t."Id";

-- Show subscription plans
SELECT "Id", "Name", "MonthlyPrice", "MaxUsers", "IsActive" FROM "SubscriptionPlans" ORDER BY "DisplayOrder";

-- COMMIT transaction
COMMIT;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next steps:
-- 1. Verify tenant isolation (Tenant A cannot see Tenant B data)
-- 2. Enable PostgreSQL RLS (if using PostgreSQL) - Run EnableRLS.sql
-- 3. Test signup flow
-- 4. Test subscription enforcement
-- ============================================
