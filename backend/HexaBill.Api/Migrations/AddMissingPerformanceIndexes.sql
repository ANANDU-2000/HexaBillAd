-- PROD-5: Add Missing Performance Indexes for Common Query Patterns
-- This script adds composite indexes for TenantId + common filter fields
-- PostgreSQL & SQLite compatible (uses quoted identifiers)

-- ============================================
-- SALES TABLE INDEXES
-- ============================================

-- TenantId + BranchId (common filter in reports and branch views)
CREATE INDEX IF NOT EXISTS "IX_Sales_TenantId_BranchId" ON "Sales"("TenantId", "BranchId") WHERE "BranchId" IS NOT NULL;

-- TenantId + RouteId (common filter in route reports)
CREATE INDEX IF NOT EXISTS "IX_Sales_TenantId_RouteId" ON "Sales"("TenantId", "RouteId") WHERE "RouteId" IS NOT NULL;

-- TenantId + CustomerId (customer ledger queries)
CREATE INDEX IF NOT EXISTS "IX_Sales_TenantId_CustomerId" ON "Sales"("TenantId", "CustomerId") WHERE "CustomerId" IS NOT NULL;

-- TenantId + PaymentStatus (filtering by payment status)
CREATE INDEX IF NOT EXISTS "IX_Sales_TenantId_PaymentStatus" ON "Sales"("TenantId", "PaymentStatus");

-- TenantId + InvoiceDate + IsDeleted (most common query pattern for sales lists)
CREATE INDEX IF NOT EXISTS "IX_Sales_TenantId_InvoiceDate_IsDeleted" ON "Sales"("TenantId", "InvoiceDate" DESC, "IsDeleted") WHERE "IsDeleted" = false;

-- ============================================
-- EXPENSES TABLE INDEXES
-- ============================================

-- TenantId + Date (date range queries)
CREATE INDEX IF NOT EXISTS "IX_Expenses_TenantId_Date" ON "Expenses"("TenantId", "Date" DESC);

-- TenantId + BranchId (branch expense reports)
CREATE INDEX IF NOT EXISTS "IX_Expenses_TenantId_BranchId" ON "Expenses"("TenantId", "BranchId") WHERE "BranchId" IS NOT NULL;

-- TenantId + RouteId (route expense reports)
CREATE INDEX IF NOT EXISTS "IX_Expenses_TenantId_RouteId" ON "Expenses"("TenantId", "RouteId") WHERE "RouteId" IS NOT NULL;

-- TenantId + CategoryId (category filtering)
CREATE INDEX IF NOT EXISTS "IX_Expenses_TenantId_CategoryId" ON "Expenses"("TenantId", "CategoryId") WHERE "CategoryId" IS NOT NULL;

-- ============================================
-- PURCHASES TABLE INDEXES
-- ============================================

-- TenantId + PurchaseDate (date range queries)
CREATE INDEX IF NOT EXISTS "IX_Purchases_TenantId_PurchaseDate" ON "Purchases"("TenantId", "PurchaseDate" DESC);

-- TenantId + SupplierName (supplier filtering - partial index for non-null)
CREATE INDEX IF NOT EXISTS "IX_Purchases_TenantId_SupplierName" ON "Purchases"("TenantId", "SupplierName") WHERE "SupplierName" IS NOT NULL;

-- ============================================
-- CUSTOMERS TABLE INDEXES
-- ============================================

-- TenantId + BranchId (branch customer lists)
CREATE INDEX IF NOT EXISTS "IX_Customers_TenantId_BranchId" ON "Customers"("TenantId", "BranchId") WHERE "BranchId" IS NOT NULL;

-- TenantId + RouteId (route customer lists)
CREATE INDEX IF NOT EXISTS "IX_Customers_TenantId_RouteId" ON "Customers"("TenantId", "RouteId") WHERE "RouteId" IS NOT NULL;

-- TenantId + IsActive (filtering active customers)
CREATE INDEX IF NOT EXISTS "IX_Customers_TenantId_IsActive" ON "Customers"("TenantId", "IsActive") WHERE "IsActive" = true;

-- ============================================
-- PAYMENTS TABLE INDEXES
-- ============================================

-- TenantId + PaymentDate (date range queries - more accurate than CreatedAt)
CREATE INDEX IF NOT EXISTS "IX_Payments_TenantId_PaymentDate" ON "Payments"("TenantId", "PaymentDate" DESC) WHERE "PaymentDate" IS NOT NULL;

-- TenantId + SaleId (payment lookup by sale)
CREATE INDEX IF NOT EXISTS "IX_Payments_TenantId_SaleId" ON "Payments"("TenantId", "SaleId") WHERE "SaleId" IS NOT NULL;

-- TenantId + Status (payment status filtering)
CREATE INDEX IF NOT EXISTS "IX_Payments_TenantId_Status" ON "Payments"("TenantId", "Status");

-- ============================================
-- ROUTE EXPENSES TABLE INDEXES
-- ============================================

-- TenantId + RouteId + ExpenseDate (route expense queries)
CREATE INDEX IF NOT EXISTS "IX_RouteExpenses_TenantId_RouteId_ExpenseDate" ON "RouteExpenses"("TenantId", "RouteId", "ExpenseDate" DESC);

-- ============================================
-- CUSTOMER VISITS TABLE INDEXES
-- ============================================

-- TenantId + RouteId + VisitDate (visit queries)
CREATE INDEX IF NOT EXISTS "IX_CustomerVisits_TenantId_RouteId_VisitDate" ON "CustomerVisits"("TenantId", "RouteId", "VisitDate" DESC);

-- TenantId + CustomerId + VisitDate (customer visit history)
CREATE INDEX IF NOT EXISTS "IX_CustomerVisits_TenantId_CustomerId_VisitDate" ON "CustomerVisits"("TenantId", "CustomerId", "VisitDate" DESC);

-- ============================================
-- INVENTORY TRANSACTIONS TABLE INDEXES
-- ============================================

-- TenantId + ProductId + CreatedAt (product transaction history)
CREATE INDEX IF NOT EXISTS "IX_InventoryTransactions_TenantId_ProductId_CreatedAt" ON "InventoryTransactions"("TenantId", "ProductId", "CreatedAt" DESC) WHERE "ProductId" IS NOT NULL;

-- TenantId + TransactionType + CreatedAt (transaction type filtering)
CREATE INDEX IF NOT EXISTS "IX_InventoryTransactions_TenantId_TransactionType_CreatedAt" ON "InventoryTransactions"("TenantId", "TransactionType", "CreatedAt" DESC);

-- ============================================
-- AUDIT LOGS TABLE INDEXES
-- ============================================

-- TenantId + CreatedAt (audit log queries - already exists but ensuring it's there)
-- Note: This may already exist, but ensuring composite index for common pattern
CREATE INDEX IF NOT EXISTS "IX_AuditLogs_TenantId_CreatedAt_Desc" ON "AuditLogs"("TenantId", "CreatedAt" DESC);

-- ============================================
-- ROUTES TABLE INDEXES
-- ============================================

-- TenantId + BranchId (route queries by branch)
CREATE INDEX IF NOT EXISTS "IX_Routes_TenantId_BranchId" ON "Routes"("TenantId", "BranchId") WHERE "BranchId" IS NOT NULL;

-- ============================================
-- BRANCHES TABLE INDEXES
-- ============================================

-- TenantId + IsActive (active branch filtering)
CREATE INDEX IF NOT EXISTS "IX_Branches_TenantId_IsActive" ON "Branches"("TenantId", "IsActive") WHERE "IsActive" = true;

-- ============================================
-- VERIFICATION QUERIES (PostgreSQL)
-- ============================================
-- Run these to verify indexes were created:
-- SELECT schemaname, tablename, indexname 
-- FROM pg_indexes 
-- WHERE tablename IN ('Sales', 'Expenses', 'Purchases', 'Customers', 'Payments', 'RouteExpenses', 'CustomerVisits', 'InventoryTransactions', 'AuditLogs', 'Routes', 'Branches')
-- ORDER BY tablename, indexname;
