-- ============================================================================
-- ROLLBACK SCRIPT: Remove Products Migration Changes
-- WARNING: This will remove all product categories and reset products
-- Only use if you need to rollback the migration
-- ============================================================================

-- Remove foreign key constraint
ALTER TABLE "Products" 
DROP CONSTRAINT IF EXISTS "FK_Products_ProductCategories_CategoryId";

-- Remove indexes
DROP INDEX IF EXISTS "IX_Products_ImageUrl";
DROP INDEX IF EXISTS "IX_Products_CategoryId";
DROP INDEX IF EXISTS "IX_Products_TenantId_Barcode";
DROP INDEX IF EXISTS "IX_Products_Barcode";
DROP INDEX IF EXISTS "IX_Products_IsActive";

-- Remove columns from Products table
ALTER TABLE "Products" 
DROP COLUMN IF EXISTS "ImageUrl",
DROP COLUMN IF EXISTS "CategoryId",
DROP COLUMN IF EXISTS "Barcode",
DROP COLUMN IF EXISTS "IsActive";

-- Drop ProductCategories table (WARNING: This will delete all categories)
-- Uncomment the line below only if you want to remove the table
-- DROP TABLE IF EXISTS "ProductCategories" CASCADE;

-- Note: ProductCategories table is NOT dropped by default to prevent data loss
-- If you need to drop it, uncomment the line above
