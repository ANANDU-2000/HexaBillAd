-- Migration script to add Barcode field to Products table
-- This enables barcode scanning in POS
-- Date: 2026-02-17

-- Add Barcode column (nullable, optional field)
ALTER TABLE "Products" 
ADD COLUMN "Barcode" character varying(100) NULL;

-- Create index for better query performance when searching by barcode
CREATE INDEX IF NOT EXISTS "IX_Products_Barcode" ON "Products" ("Barcode");

-- Create unique index on Barcode per tenant (barcode should be unique within a tenant)
-- Note: NULL values are not included in unique constraint, so multiple NULLs are allowed
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Products_TenantId_Barcode" 
ON "Products" ("TenantId", "Barcode") 
WHERE "Barcode" IS NOT NULL;

-- Comment
COMMENT ON COLUMN "Products"."Barcode" IS 'Barcode for POS scanning (EAN-13, UPC, etc.). Optional field.';
