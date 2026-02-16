-- Performance indexes for HexaBill (SQLite & PostgreSQL compatible)
-- Use quoted identifiers for PostgreSQL (preserves case; unquoted becomes lowercase)
-- Tenant+date indexes for list/filter queries
CREATE INDEX IF NOT EXISTS idx_sales_tenant_created ON "Sales"("TenantId", "CreatedAt" DESC);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_invoicedate ON "Sales"("TenantId", "InvoiceDate" DESC);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_deleted ON "Sales"("TenantId", "IsDeleted");
CREATE INDEX IF NOT EXISTS idx_customers_tenant_name ON "Customers"("TenantId", "Name");
CREATE INDEX IF NOT EXISTS idx_products_tenant_sku ON "Products"("TenantId", "Sku");
CREATE INDEX IF NOT EXISTS idx_products_tenant_name ON "Products"("TenantId", "NameEn");
CREATE INDEX IF NOT EXISTS idx_payments_tenant_created ON "Payments"("TenantId", "CreatedAt" DESC);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON "Payments"("CustomerId", "CreatedAt" DESC);
