-- Read-only pre-check for a (TenantId, InvoiceNo) unique index on "Sales".
-- Run inside a READ ONLY transaction. Every query must return zero rows before the index migration is written.
-- The index would cover ALL rows (deleted, voided, drafts) because an issued number is never reused.
BEGIN TRANSACTION READ ONLY;

-- 1. Exact duplicates per tenant, any state.
SELECT "TenantId", "InvoiceNo", COUNT(*) AS copies,
       array_agg("Id" ORDER BY "Id") AS sale_ids,
       array_agg("IsDeleted" ORDER BY "Id") AS deleted_flags
FROM "Sales"
WHERE "InvoiceNo" IS NOT NULL AND "InvoiceNo" <> ''
GROUP BY "TenantId", "InvoiceNo"
HAVING COUNT(*) > 1
ORDER BY "TenantId", "InvoiceNo";

-- 2. Duplicates that differ only by surrounding whitespace (the app trims before comparing).
SELECT "TenantId", btrim("InvoiceNo") AS invoice_no, COUNT(*) AS copies, array_agg("Id" ORDER BY "Id") AS sale_ids
FROM "Sales"
WHERE "InvoiceNo" IS NOT NULL AND btrim("InvoiceNo") <> ''
GROUP BY "TenantId", btrim("InvoiceNo")
HAVING COUNT(*) > 1
ORDER BY 1, 2;

-- 3. Rows with no tenant (would escape a TenantId-scoped index).
SELECT "Id", "OwnerId", "InvoiceNo" FROM "Sales" WHERE "TenantId" IS NULL;

-- 4. Rows where TenantId and the legacy OwnerId disagree (the current unique index is on OwnerId).
SELECT "Id", "TenantId", "OwnerId", "InvoiceNo" FROM "Sales"
WHERE "TenantId" IS DISTINCT FROM "OwnerId" ORDER BY "TenantId", "Id";

-- 5. Summary per tenant for the evidence log.
SELECT "TenantId", COUNT(*) AS sales, COUNT(*) FILTER (WHERE "IsDeleted") AS deleted,
       COUNT(*) FILTER (WHERE btrim("InvoiceNo") ~ '^[0-9]+$') AS numeric_numbers,
       MAX(CASE WHEN btrim("InvoiceNo") ~ '^[0-9]{1,9}$' THEN btrim("InvoiceNo")::bigint END) AS max_numeric
FROM "Sales" GROUP BY "TenantId" ORDER BY "TenantId";

ROLLBACK;
