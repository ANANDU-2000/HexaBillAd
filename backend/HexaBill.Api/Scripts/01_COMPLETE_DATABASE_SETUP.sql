-- ============================================
-- HEXABILL - COMPLETE DATABASE SETUP
-- Enterprise SaaS Multi-Tenant Database
-- ============================================
-- 
-- Purpose: Single source of truth for database schema
-- Run this ONCE after EF Core migrations
-- 
-- Contains:
-- 1. Core tables (via EF Core migrations)
-- 2. Enterprise tables (ErrorLogs, DemoRequests)
-- 3. Indexes for performance
-- 4. RLS policies (if PostgreSQL)
-- 5. Seed data (subscription plans)
--
-- ============================================

-- ============================================
-- PART 0: INFRASTRUCTURE (PostgreSQL only)
-- ============================================

-- PostgreSQL Sequence for Invoice Numbers
-- Used by the application to generate sequential invoice numbers across tenants if needed
CREATE SEQUENCE IF NOT EXISTS "invoice_number_seq" START 2000;

-- ============================================
-- PART 1: ENTERPRISE TABLES
-- ============================================

-- ErrorLogs: Server-side error tracking for SuperAdmin
CREATE TABLE IF NOT EXISTS "ErrorLogs" (
    "Id" SERIAL PRIMARY KEY,
    "TraceId" VARCHAR(64) NOT NULL,
    "ErrorCode" VARCHAR(64) NOT NULL,
    "Message" VARCHAR(2000) NOT NULL,
    "StackTrace" TEXT,
    "Path" VARCHAR(500),
    "Method" VARCHAR(16),
    "TenantId" INTEGER,
    "UserId" INTEGER,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "IX_ErrorLogs_CreatedAt" ON "ErrorLogs" ("CreatedAt");
CREATE INDEX IF NOT EXISTS "IX_ErrorLogs_TenantId" ON "ErrorLogs" ("TenantId");
CREATE INDEX IF NOT EXISTS "IX_ErrorLogs_ErrorCode" ON "ErrorLogs" ("ErrorCode");

-- DemoRequests: Marketing site demo requests → SuperAdmin approval flow
CREATE TABLE IF NOT EXISTS "DemoRequests" (
    "Id" SERIAL PRIMARY KEY,
    "CompanyName" VARCHAR(200) NOT NULL,
    "ContactName" VARCHAR(100) NOT NULL,
    "WhatsApp" VARCHAR(20),
    "Email" VARCHAR(100) NOT NULL,
    "Country" VARCHAR(10) DEFAULT 'AE',
    "Industry" VARCHAR(100),
    "MonthlySalesRange" VARCHAR(50),
    "StaffCount" INTEGER DEFAULT 0,
    "Status" VARCHAR(20) DEFAULT 'Pending',
    "RejectionReason" VARCHAR(500),
    "AssignedPlanId" INTEGER,
    "CreatedTenantId" INTEGER,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "ProcessedAt" TIMESTAMP,
    "ProcessedByUserId" INTEGER
);
CREATE INDEX IF NOT EXISTS "IX_DemoRequests_Status" ON "DemoRequests" ("Status");
CREATE INDEX IF NOT EXISTS "IX_DemoRequests_Email" ON "DemoRequests" ("Email");
CREATE INDEX IF NOT EXISTS "IX_DemoRequests_CreatedAt" ON "DemoRequests" ("CreatedAt");

-- ============================================
-- PART 2: PERFORMANCE INDEXES
-- ============================================

-- Sales indexes (most queried table)
CREATE INDEX IF NOT EXISTS "IX_Sales_TenantId_CreatedAt" ON "Sales" ("TenantId", "CreatedAt");
CREATE INDEX IF NOT EXISTS "IX_Sales_CustomerId" ON "Sales" ("CustomerId");

-- Products indexes
CREATE INDEX IF NOT EXISTS "IX_Products_TenantId_Code" ON "Products" ("TenantId", "Code");

-- Customers indexes
CREATE INDEX IF NOT EXISTS "IX_Customers_TenantId_Email" ON "Customers" ("TenantId", "Email");

-- AuditLog indexes
CREATE INDEX IF NOT EXISTS "IX_AuditLogs_TenantId_CreatedAt" ON "AuditLogs" ("TenantId", "CreatedAt");

-- ============================================
-- PART 3: ROW LEVEL SECURITY (PostgreSQL only)
-- ============================================

-- Enable RLS on tenant-scoped tables
-- ALTER TABLE "Sales" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "Products" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "Customers" ENABLE ROW LEVEL SECURITY;
-- 
-- -- RLS Policy: Users can only see their tenant's data
-- CREATE POLICY tenant_isolation_sales ON "Sales"
--     FOR ALL USING ("TenantId" = current_setting('app.current_tenant_id')::int);
-- 
-- CREATE POLICY tenant_isolation_products ON "Products"
--     FOR ALL USING ("TenantId" = current_setting('app.current_tenant_id')::int);
-- 
-- CREATE POLICY tenant_isolation_customers ON "Customers"
--     FOR ALL USING ("TenantId" = current_setting('app.current_tenant_id')::int);

-- ============================================
-- PART 4: SEED DATA
-- ============================================

-- Subscription Plans (if not exists)
INSERT INTO "SubscriptionPlans" ("Name", "Description", "MonthlyPrice", "YearlyPrice", "MaxUsers", "MaxProducts", "MaxCustomers", "MaxStorageMB", "Features", "IsActive", "DisplayOrder", "CreatedAt")
VALUES 
    ('Starter', 'Perfect for small businesses', 99.00, 990.00, 3, 500, 200, 1000, '["Basic Reports", "Email Support"]', true, 1, NOW()),
    ('Professional', 'For growing businesses', 199.00, 1990.00, 10, 2000, 1000, 5000, '["Advanced Reports", "Priority Support", "API Access"]', true, 2, NOW()),
    ('Enterprise', 'For large organizations', 499.00, 4990.00, 50, 10000, 5000, 20000, '["Custom Reports", "Dedicated Support", "API Access", "Custom Integrations"]', true, 3, NOW())
ON CONFLICT DO NOTHING;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check table counts
SELECT 'ErrorLogs' as table_name, COUNT(*) as count FROM "ErrorLogs"
UNION ALL
SELECT 'DemoRequests', COUNT(*) FROM "DemoRequests"
UNION ALL
SELECT 'SubscriptionPlans', COUNT(*) FROM "SubscriptionPlans";

-- ============================================
-- END OF SETUP
-- ============================================
