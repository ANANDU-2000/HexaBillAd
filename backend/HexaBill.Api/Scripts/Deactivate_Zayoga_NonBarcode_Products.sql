-- Soft-deactivate Zayoga (TenantId 6) products that are NOT in the BARCODE-folder keep set.
-- Keeps invoice history; reversible via ActivateProduct / IsActive = true.
-- Run: dotnet run --project backend/HexaBill.Api/Scripts/RunSql -- Deactivate_Zayoga_NonBarcode_Products.sql
-- Preview first (read-only) recommended via Render query or SELECT below.

-- Keep barcodes (12 from BARCODE folder):
-- 6296000005402 Passionfruit Sipup
-- 6296000005426 Mango Sipup
-- 6296000005419 Grape Sipup
-- 6296000005440 Chikoo Sipup
-- 6296000005433 Tender Sipup
-- 6296000005471 Mango Popsicle
-- 6296000005464 Strawberry popsicle
-- 6296000005457 tender Popsicle
-- 6296000005488 Jackfruit Popsicle
-- 6296000005495 Guava Popsicle
-- 6296000005501 Chikoo Popsicle
-- 6296000005518 Avocado Popsicle

SELECT 'PREVIEW_DEACTIVATE' AS phase, p."Id", p."Sku", p."NameEn", COALESCE(p."Barcode", '') AS "Barcode"
FROM "Products" p
WHERE p."TenantId" = 6
  AND p."IsActive" = true
  AND COALESCE(TRIM(p."Barcode"), '') NOT IN (
    '6296000005402','6296000005426','6296000005419','6296000005440',
    '6296000005433','6296000005471','6296000005464','6296000005457',
    '6296000005488','6296000005495','6296000005501','6296000005518'
  )
ORDER BY p."NameEn";

UPDATE "Products" p
SET "IsActive" = false
WHERE p."TenantId" = 6
  AND p."IsActive" = true
  AND COALESCE(TRIM(p."Barcode"), '') NOT IN (
    '6296000005402','6296000005426','6296000005419','6296000005440',
    '6296000005433','6296000005471','6296000005464','6296000005457',
    '6296000005488','6296000005495','6296000005501','6296000005518'
  );

SELECT 'KEPT_ACTIVE' AS phase, COUNT(*) AS cnt
FROM "Products"
WHERE "TenantId" = 6 AND "IsActive" = true;

SELECT 'KEPT_ROWS' AS phase, p."Id", p."Sku", p."NameEn", p."Barcode"
FROM "Products" p
WHERE p."TenantId" = 6 AND p."IsActive" = true
ORDER BY p."NameEn";

SELECT 'DEACTIVATED_TOTAL' AS phase, COUNT(*) AS cnt
FROM "Products"
WHERE "TenantId" = 6 AND "IsActive" = false;
