-- Migration script to add IsActive field to Products table
-- This enables soft delete functionality for products
-- Date: 2026-02-17

-- Add IsActive column with default value true (all existing products are active)
ALTER TABLE "Products" 
ADD COLUMN "IsActive" boolean NOT NULL DEFAULT true;

-- Create index for better query performance when filtering by IsActive
CREATE INDEX IF NOT EXISTS "IX_Products_IsActive" ON "Products" ("IsActive");

-- Update any NULL values (shouldn't happen with NOT NULL DEFAULT, but just in case)
UPDATE "Products" SET "IsActive" = true WHERE "IsActive" IS NULL;

-- Comment
COMMENT ON COLUMN "Products"."IsActive" IS 'Soft delete flag: false = deactivated (hidden from POS), true = active';
