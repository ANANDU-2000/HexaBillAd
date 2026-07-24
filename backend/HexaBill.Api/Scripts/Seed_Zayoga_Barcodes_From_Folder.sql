-- One-time Zayoga (TenantId 6) barcode seed from BARCODE folder label digits.
-- Maps by fuzzy NameEn match; skips rows that already have a barcode; reports unmatched labels.
-- Safe to re-run: only fills empty barcodes; does not overwrite existing codes.
-- Run: dotnet run --project backend/HexaBill.Api/Scripts/RunSql -- Seed_Zayoga_Barcodes_From_Folder.sql

CREATE TEMP TABLE IF NOT EXISTS zayoga_barcode_seed (
  label_name text PRIMARY KEY,
  barcode text NOT NULL,
  token1 text NOT NULL,
  token2 text NOT NULL
);

TRUNCATE zayoga_barcode_seed;

INSERT INTO zayoga_barcode_seed (label_name, barcode, token1, token2) VALUES
  ('Passionfruit Sipup', '6296000005402', 'passion', 'sip'),
  ('Mango Sipup',        '6296000005426', 'mango', 'sip'),
  ('Grape Sipup',        '6296000005419', 'grape', 'sip'),
  ('Chikoo Sipup',       '6296000005440', 'chikoo', 'sip'),
  ('Tender Sipup',       '6296000005433', 'tender', 'sip'),
  ('Mango Popsicle',     '6296000005471', 'mango', 'pop'),
  ('Strawberry popsicle','6296000005464', 'strawber', 'pop'),
  ('tender Popsicle',    '6296000005457', 'tender', 'pop'),
  ('Jackfruit Popsicle', '6296000005488', 'jackfruit', 'pop'),
  ('Guava Popsicle',     '6296000005495', 'guava', 'pop'),
  ('Chikoo Popsicle',    '6296000005501', 'chikoo', 'pop'),
  ('Avocado Popsicle',   '6296000005518', 'avacado', 'pop');

UPDATE "Products" p
SET "Barcode" = s.barcode
FROM zayoga_barcode_seed s
WHERE p."TenantId" = 6
  AND p."IsActive" = true
  AND (p."Barcode" IS NULL OR TRIM(p."Barcode") = '')
  AND LOWER(p."NameEn") LIKE '%' || s.token1 || '%'
  AND LOWER(p."NameEn") LIKE '%' || s.token2 || '%'
  AND p."Id" = (
    SELECT p2."Id"
    FROM "Products" p2
    WHERE p2."TenantId" = 6
      AND p2."IsActive" = true
      AND (p2."Barcode" IS NULL OR TRIM(p2."Barcode") = '')
      AND LOWER(p2."NameEn") LIKE '%' || s.token1 || '%'
      AND LOWER(p2."NameEn") LIKE '%' || s.token2 || '%'
    ORDER BY p2."Id"
    LIMIT 1
  );

SELECT p."Id", p."Sku", p."NameEn", p."Barcode", s.label_name
FROM "Products" p
JOIN zayoga_barcode_seed s ON p."Barcode" = s.barcode
WHERE p."TenantId" = 6
ORDER BY s.label_name;

SELECT s.label_name, s.barcode, 'UNMATCHED' AS status
FROM zayoga_barcode_seed s
WHERE NOT EXISTS (
  SELECT 1 FROM "Products" p
  WHERE p."TenantId" = 6 AND p."Barcode" = s.barcode
);
