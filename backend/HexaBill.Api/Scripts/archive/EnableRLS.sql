-- ============================================
-- POSTGRESQL ROW-LEVEL SECURITY (RLS) POLICIES
-- Purpose: Enforce tenant isolation at database level
-- Date: 2026-02-11
-- ============================================
-- 
-- IMPORTANT: This script enables RLS on all tenant-scoped tables
-- Middleware must set: SET app.tenant_id = {tenantId}
-- SystemAdmin (tenantId = 0 or NULL) bypasses RLS
--
-- ============================================

BEGIN;

-- Enable RLS on all tenant-scoped tables
ALTER TABLE "Sales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Purchases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InvoiceVersions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SaleReturns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseReturns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PriceChangeLogs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InventoryTransactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLogs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Settings" ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES: Tenant Isolation
-- ============================================

-- Sales table
CREATE POLICY tenant_isolation_sales ON "Sales"
    USING (
        -- SystemAdmin (tenant_id = 0 or NULL) sees all
        (current_setting('app.tenant_id', true)::int IS NULL OR current_setting('app.tenant_id', true)::int = 0)
        OR
        -- Regular users see only their tenant's data
        ("TenantId" = current_setting('app.tenant_id', true)::int)
    );

-- Customers table
CREATE POLICY tenant_isolation_customers ON "Customers"
    USING (
        (current_setting('app.tenant_id', true)::int IS NULL OR current_setting('app.tenant_id', true)::int = 0)
        OR
        ("TenantId" = current_setting('app.tenant_id', true)::int)
    );

-- Products table
CREATE POLICY tenant_isolation_products ON "Products"
    USING (
        (current_setting('app.tenant_id', true)::int IS NULL OR current_setting('app.tenant_id', true)::int = 0)
        OR
        ("TenantId" = current_setting('app.tenant_id', true)::int)
    );

-- Purchases table
CREATE POLICY tenant_isolation_purchases ON "Purchases"
    USING (
        (current_setting('app.tenant_id', true)::int IS NULL OR current_setting('app.tenant_id', true)::int = 0)
        OR
        ("TenantId" = current_setting('app.tenant_id', true)::int)
    );

-- Payments table
CREATE POLICY tenant_isolation_payments ON "Payments"
    USING (
        (current_setting('app.tenant_id', true)::int IS NULL OR current_setting('app.tenant_id', true)::int = 0)
        OR
        ("TenantId" = current_setting('app.tenant_id', true)::int)
    );

-- Expenses table
CREATE POLICY tenant_isolation_expenses ON "Expenses"
    USING (
        (current_setting('app.tenant_id', true)::int IS NULL OR current_setting('app.tenant_id', true)::int = 0)
        OR
        ("TenantId" = current_setting('app.tenant_id', true)::int)
    );

-- Users table (special handling - SystemAdmin users have TenantId = NULL)
CREATE POLICY tenant_isolation_users ON "Users"
    USING (
        -- SystemAdmin sees all users
        (current_setting('app.tenant_id', true)::int IS NULL OR current_setting('app.tenant_id', true)::int = 0)
        OR
        -- Regular users see only their tenant's users
        ("TenantId" = current_setting('app.tenant_id', true)::int)
        OR
        -- Users can always see themselves
        ("Id" = current_setting('app.user_id', true)::int)
    );

-- Alerts table
CREATE POLICY tenant_isolation_alerts ON "Alerts"
    USING (
        (current_setting('app.tenant_id', true)::int IS NULL OR current_setting('app.tenant_id', true)::int = 0)
        OR
        ("TenantId" = current_setting('app.tenant_id', true)::int)
    );

-- InvoiceVersions table
CREATE POLICY tenant_isolation_invoice_versions ON "InvoiceVersions"
    USING (
        (current_setting('app.tenant_id', true)::int IS NULL OR current_setting('app.tenant_id', true)::int = 0)
        OR
        ("TenantId" = current_setting('app.tenant_id', true)::int)
    );

-- SaleReturns table
CREATE POLICY tenant_isolation_sale_returns ON "SaleReturns"
    USING (
        (current_setting('app.tenant_id', true)::int IS NULL OR current_setting('app.tenant_id', true)::int = 0)
        OR
        ("TenantId" = current_setting('app.tenant_id', true)::int)
    );

-- PurchaseReturns table
CREATE POLICY tenant_isolation_purchase_returns ON "PurchaseReturns"
    USING (
        (current_setting('app.tenant_id', true)::int IS NULL OR current_setting('app.tenant_id', true)::int = 0)
        OR
        ("TenantId" = current_setting('app.tenant_id', true)::int)
    );

-- PriceChangeLogs table
CREATE POLICY tenant_isolation_price_change_logs ON "PriceChangeLogs"
    USING (
        (current_setting('app.tenant_id', true)::int IS NULL OR current_setting('app.tenant_id', true)::int = 0)
        OR
        ("TenantId" = current_setting('app.tenant_id', true)::int)
    );

-- InventoryTransactions table
CREATE POLICY tenant_isolation_inventory_transactions ON "InventoryTransactions"
    USING (
        (current_setting('app.tenant_id', true)::int IS NULL OR current_setting('app.tenant_id', true)::int = 0)
        OR
        ("TenantId" = current_setting('app.tenant_id', true)::int)
    );

-- AuditLogs table
CREATE POLICY tenant_isolation_audit_logs ON "AuditLogs"
    USING (
        (current_setting('app.tenant_id', true)::int IS NULL OR current_setting('app.tenant_id', true)::int = 0)
        OR
        ("TenantId" = current_setting('app.tenant_id', true)::int)
    );

-- Settings table (composite key: Key + TenantId)
CREATE POLICY tenant_isolation_settings ON "Settings"
    USING (
        (current_setting('app.tenant_id', true)::int IS NULL OR current_setting('app.tenant_id', true)::int = 0)
        OR
        ("TenantId" = current_setting('app.tenant_id', true)::int)
    );

COMMIT;

-- ============================================
-- VERIFICATION
-- ============================================
-- Test RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('Sales', 'Customers', 'Products');

-- Test policy exists:
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename IN ('Sales', 'Customers', 'Products');
