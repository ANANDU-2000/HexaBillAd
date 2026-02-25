-- Migration script to add ImageUrl field to Products table
-- This enables product image uploads for POS use
-- Date: 2026-02-17

-- Add ImageUrl column (nullable, stores relative path like "products/product_123_guid.jpg")
ALTER TABLE "Products" 
ADD COLUMN IF NOT EXISTS "ImageUrl" character varying(500) NULL;

-- Create index for better query performance (optional, but useful if filtering by products with images)
CREATE INDEX IF NOT EXISTS "IX_Products_ImageUrl" ON "Products" ("ImageUrl") WHERE "ImageUrl" IS NOT NULL;

-- Comment
COMMENT ON COLUMN "Products"."ImageUrl" IS 'Product image URL (relative path from /uploads/, e.g., products/product_123_guid.jpg)';
