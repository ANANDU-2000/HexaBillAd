-- =============================================================================
-- Run this in Render: Connect → PSQL (or any PostgreSQL client connected to your DB)
-- Fixes: 42P01 relation "VendorDiscounts" does not exist
-- (Vendor Discounts tab / Add Vendor Discount / Save fails until this table exists)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "VendorDiscounts" (
  "Id" serial PRIMARY KEY,
  "TenantId" integer NOT NULL,
  "SupplierId" integer NOT NULL,
  "PurchaseId" integer NULL,
  "Amount" numeric(18,2) NOT NULL,
  "DiscountDate" timestamp with time zone NOT NULL,
  "DiscountType" character varying(50) NOT NULL,
  "Reason" character varying(500) NOT NULL DEFAULT '',
  "IsActive" boolean NOT NULL DEFAULT true,
  "CreatedBy" integer NOT NULL,
  "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  "UpdatedAt" timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
  CONSTRAINT "FK_VendorDiscounts_Suppliers_SupplierId" FOREIGN KEY ("SupplierId") REFERENCES "Suppliers" ("Id") ON DELETE RESTRICT,
  CONSTRAINT "FK_VendorDiscounts_Purchases_PurchaseId" FOREIGN KEY ("PurchaseId") REFERENCES "Purchases" ("Id") ON DELETE SET NULL,
  CONSTRAINT "FK_VendorDiscounts_Users_CreatedBy" FOREIGN KEY ("CreatedBy") REFERENCES "Users" ("Id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "IX_VendorDiscounts_TenantId" ON "VendorDiscounts" ("TenantId");
CREATE INDEX IF NOT EXISTS "IX_VendorDiscounts_SupplierId" ON "VendorDiscounts" ("SupplierId");
CREATE INDEX IF NOT EXISTS "IX_VendorDiscounts_PurchaseId" ON "VendorDiscounts" ("PurchaseId");
CREATE INDEX IF NOT EXISTS "IX_VendorDiscounts_CreatedBy" ON "VendorDiscounts" ("CreatedBy");
