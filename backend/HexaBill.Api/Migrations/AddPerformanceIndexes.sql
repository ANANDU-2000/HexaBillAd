-- Performance indexes for HexaBill (SQLite & PostgreSQL compatible)
-- Use quoted identifiers for PostgreSQL (preserves case; unquoted becomes lowercase)
-- Tenant+date indexes for list/filter queries

-- SALES TABLE INDEXES
CREATE INDEX IF NOT EXISTS idx_sales_tenant_created ON "Sales"("TenantId", "CreatedAt" DESC);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_invoicedate ON "Sales"("TenantId", "InvoiceDate" DESC);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_deleted ON "Sales"("TenantId", "IsDeleted");
-- PROD-5: Additional composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS "IX_Sales_TenantId_BranchId" ON "Sales"("TenantId", "BranchId") WHERE "BranchId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "IX_Sales_TenantId_RouteId" ON "Sales"("TenantId", "RouteId") WHERE "RouteId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "IX_Sales_TenantId_CustomerId" ON "Sales"("TenantId", "CustomerId") WHERE "CustomerId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "IX_Sales_TenantId_PaymentStatus" ON "Sales"("TenantId", "PaymentStatus");
CREATE INDEX IF NOT EXISTS "IX_Sales_TenantId_InvoiceDate_IsDeleted" ON "Sales"("TenantId", "InvoiceDate" DESC, "IsDeleted") WHERE "IsDeleted" = false;

-- CUSTOMERS TABLE INDEXES
CREATE INDEX IF NOT EXISTS idx_customers_tenant_name ON "Customers"("TenantId", "Name");
-- PROD-5: Additional composite indexes
CREATE INDEX IF NOT EXISTS "IX_Customers_TenantId_BranchId" ON "Customers"("TenantId", "BranchId") WHERE "BranchId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "IX_Customers_TenantId_RouteId" ON "Customers"("TenantId", "RouteId") WHERE "RouteId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "IX_Customers_TenantId_IsActive" ON "Customers"("TenantId", "IsActive") WHERE "IsActive" = true;

-- PRODUCTS TABLE INDEXES
CREATE INDEX IF NOT EXISTS idx_products_tenant_sku ON "Products"("TenantId", "Sku");
CREATE INDEX IF NOT EXISTS idx_products_tenant_name ON "Products"("TenantId", "NameEn");

-- PAYMENTS TABLE INDEXES
CREATE INDEX IF NOT EXISTS idx_payments_tenant_created ON "Payments"("TenantId", "CreatedAt" DESC);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON "Payments"("CustomerId", "CreatedAt" DESC);
-- PROD-5: Additional composite indexes
CREATE INDEX IF NOT EXISTS "IX_Payments_TenantId_PaymentDate" ON "Payments"("TenantId", "PaymentDate" DESC) WHERE "PaymentDate" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "IX_Payments_TenantId_SaleId" ON "Payments"("TenantId", "SaleId") WHERE "SaleId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "IX_Payments_TenantId_Status" ON "Payments"("TenantId", "Status");

-- EXPENSES TABLE INDEXES (PROD-5: Added)
CREATE INDEX IF NOT EXISTS "IX_Expenses_TenantId_Date" ON "Expenses"("TenantId", "Date" DESC);
CREATE INDEX IF NOT EXISTS "IX_Expenses_TenantId_BranchId" ON "Expenses"("TenantId", "BranchId") WHERE "BranchId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "IX_Expenses_TenantId_RouteId" ON "Expenses"("TenantId", "RouteId") WHERE "RouteId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "IX_Expenses_TenantId_CategoryId" ON "Expenses"("TenantId", "CategoryId") WHERE "CategoryId" IS NOT NULL;

-- PURCHASES TABLE INDEXES (PROD-5: Added)
CREATE INDEX IF NOT EXISTS "IX_Purchases_TenantId_PurchaseDate" ON "Purchases"("TenantId", "PurchaseDate" DESC);
CREATE INDEX IF NOT EXISTS "IX_Purchases_TenantId_SupplierName" ON "Purchases"("TenantId", "SupplierName") WHERE "SupplierName" IS NOT NULL;

-- ROUTE EXPENSES TABLE INDEXES (PROD-5: Added)
CREATE INDEX IF NOT EXISTS "IX_RouteExpenses_TenantId_RouteId_ExpenseDate" ON "RouteExpenses"("TenantId", "RouteId", "ExpenseDate" DESC);

-- CUSTOMER VISITS TABLE INDEXES (PROD-5: Added)
CREATE INDEX IF NOT EXISTS "IX_CustomerVisits_TenantId_RouteId_VisitDate" ON "CustomerVisits"("TenantId", "RouteId", "VisitDate" DESC);
CREATE INDEX IF NOT EXISTS "IX_CustomerVisits_TenantId_CustomerId_VisitDate" ON "CustomerVisits"("TenantId", "CustomerId", "VisitDate" DESC);

-- INVENTORY TRANSACTIONS TABLE INDEXES (PROD-5: Added)
CREATE INDEX IF NOT EXISTS "IX_InventoryTransactions_TenantId_ProductId_CreatedAt" ON "InventoryTransactions"("TenantId", "ProductId", "CreatedAt" DESC) WHERE "ProductId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "IX_InventoryTransactions_TenantId_TransactionType_CreatedAt" ON "InventoryTransactions"("TenantId", "TransactionType", "CreatedAt" DESC);

-- AUDIT LOGS TABLE INDEXES (PROD-5: Enhanced)
CREATE INDEX IF NOT EXISTS "IX_AuditLogs_TenantId_CreatedAt_Desc" ON "AuditLogs"("TenantId", "CreatedAt" DESC);

-- ROUTES TABLE INDEXES (PROD-5: Added)
CREATE INDEX IF NOT EXISTS "IX_Routes_TenantId_BranchId" ON "Routes"("TenantId", "BranchId") WHERE "BranchId" IS NOT NULL;

-- BRANCHES TABLE INDEXES (PROD-5: Added)
CREATE INDEX IF NOT EXISTS "IX_Branches_TenantId_IsActive" ON "Branches"("TenantId", "IsActive") WHERE "IsActive" = true;

-- USERS TABLE INDEXES (Production Stabilization Plan)
CREATE INDEX IF NOT EXISTS idx_users_tenantid ON "Users"("TenantId");
CREATE INDEX IF NOT EXISTS idx_users_ownerid ON "Users"("OwnerId") WHERE "OwnerId" IS NOT NULL;

-- SIMPLE TENANT ID INDEXES (Production Stabilization Plan - for quick tenant filtering)
CREATE INDEX IF NOT EXISTS idx_sales_tenantid ON "Sales"("TenantId");
CREATE INDEX IF NOT EXISTS idx_customers_tenantid ON "Customers"("TenantId");
CREATE INDEX IF NOT EXISTS idx_products_tenantid ON "Products"("TenantId");
CREATE INDEX IF NOT EXISTS idx_expenses_tenantid ON "Expenses"("TenantId");
CREATE INDEX IF NOT EXISTS idx_purchases_tenantid ON "Purchases"("TenantId");
CREATE INDEX IF NOT EXISTS idx_payments_tenantid ON "Payments"("TenantId");

-- CREATED AT INDEXES (Production Stabilization Plan - for date filtering)
CREATE INDEX IF NOT EXISTS idx_sales_createdat ON "Sales"("CreatedAt" DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_createdat ON "Expenses"("CreatedAt" DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_createdat ON "Purchases"("CreatedAt" DESC);
CREATE INDEX IF NOT EXISTS idx_payments_createdat ON "Payments"("CreatedAt" DESC);