-- CRITICAL FIX: Replace single InvoiceNo index with composite (OwnerId, InvoiceNo) index
-- This allows each owner to have independent invoice number sequences

-- Step 1: Drop old unique index
DROP INDEX IF EXISTS "IX_Sales_InvoiceNo";

-- Step 2: Create new composite unique index on (OwnerId, InvoiceNo)
CREATE UNIQUE INDEX "IX_Sales_OwnerId_InvoiceNo" 
ON "Sales" ("OwnerId", "InvoiceNo") 
WHERE "IsDeleted" = false;

-- Step 3: Verify the index was created
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'Sales' 
  AND indexname = 'IX_Sales_OwnerId_InvoiceNo';

-- Step 4: Check for duplicate invoice numbers within same owner (should be 0)
SELECT 
    "InvoiceNo",
    "OwnerId",
    COUNT(*) as count
FROM "Sales"
WHERE "IsDeleted" = false
GROUP BY "InvoiceNo", "OwnerId"
HAVING COUNT(*) > 1;
