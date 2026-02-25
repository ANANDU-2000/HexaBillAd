-- ============================================================================
-- VERIFICATION SCRIPT: Check Products Migration Status
-- Run this to verify all migrations are applied correctly
-- ============================================================================

-- Check Products table columns
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'Products'
    AND column_name IN ('IsActive', 'Barcode', 'CategoryId', 'ImageUrl')
ORDER BY column_name;

-- Check ProductCategories table exists
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'ProductCategories') as column_count
FROM information_schema.tables
WHERE table_name = 'ProductCategories';

-- Check ProductCategories table columns
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'ProductCategories'
ORDER BY ordinal_position;

-- Check indexes on Products table
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'Products'
    AND indexname LIKE 'IX_Products%'
ORDER BY indexname;

-- Check indexes on ProductCategories table
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'ProductCategories'
ORDER BY indexname;

-- Check foreign key constraints
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND (tc.table_name = 'Products' OR tc.table_name = 'ProductCategories')
ORDER BY tc.table_name, tc.constraint_name;

-- Summary
SELECT 
    'Products Columns' as check_type,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) = 4 THEN '✅ All columns present'
        ELSE '❌ Missing columns'
    END as status
FROM information_schema.columns
WHERE table_name = 'Products'
    AND column_name IN ('IsActive', 'Barcode', 'CategoryId', 'ImageUrl')

UNION ALL

SELECT 
    'ProductCategories Table' as check_type,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Table exists'
        ELSE '❌ Table missing'
    END as status
FROM information_schema.tables
WHERE table_name = 'ProductCategories'

UNION ALL

SELECT 
    'Products Indexes' as check_type,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) >= 5 THEN '✅ All indexes present'
        ELSE '❌ Missing indexes'
    END as status
FROM pg_indexes
WHERE tablename = 'Products'
    AND indexname LIKE 'IX_Products%'

UNION ALL

SELECT 
    'Foreign Keys' as check_type,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) >= 1 THEN '✅ FK constraint exists'
        ELSE '❌ FK constraint missing'
    END as status
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY'
    AND constraint_name = 'FK_Products_ProductCategories_CategoryId';
