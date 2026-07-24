-- Ensure letterhead-only print + stamp/signature feature for Zayoga (TenantId / OwnerId 6). Additive only.

INSERT INTO "Settings" ("OwnerId", "TenantId", "Key", "Value", "CreatedAt", "UpdatedAt")
SELECT 6, 6, 'Feature_LetterheadOnlyPrint', 'true', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Settings" WHERE "Key" = 'Feature_LetterheadOnlyPrint' AND ("OwnerId" = 6 OR "TenantId" = 6)
);
UPDATE "Settings" SET "Value" = 'true', "UpdatedAt" = NOW()
WHERE "Key" = 'Feature_LetterheadOnlyPrint' AND ("OwnerId" = 6 OR "TenantId" = 6)
  AND LOWER(TRIM(COALESCE("Value", ''))) IN ('false', '0', 'no', '');

INSERT INTO "Settings" ("OwnerId", "TenantId", "Key", "Value", "CreatedAt", "UpdatedAt")
SELECT 6, 6, 'Feature_DocumentStampSignature', 'true', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Settings" WHERE "Key" = 'Feature_DocumentStampSignature' AND ("OwnerId" = 6 OR "TenantId" = 6)
);
UPDATE "Settings" SET "Value" = 'true', "UpdatedAt" = NOW()
WHERE "Key" = 'Feature_DocumentStampSignature' AND ("OwnerId" = 6 OR "TenantId" = 6)
  AND LOWER(TRIM(COALESCE("Value", ''))) IN ('false', '0', 'no', '');

INSERT INTO "Settings" ("OwnerId", "TenantId", "Key", "Value", "CreatedAt", "UpdatedAt")
SELECT 6, 6, 'PRINT_MARGIN_TOP_MM', '52', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Settings" WHERE "Key" = 'PRINT_MARGIN_TOP_MM' AND ("OwnerId" = 6 OR "TenantId" = 6)
);
INSERT INTO "Settings" ("OwnerId", "TenantId", "Key", "Value", "CreatedAt", "UpdatedAt")
SELECT 6, 6, 'PRINT_MARGIN_BOTTOM_MM', '35', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Settings" WHERE "Key" = 'PRINT_MARGIN_BOTTOM_MM' AND ("OwnerId" = 6 OR "TenantId" = 6)
);
INSERT INTO "Settings" ("OwnerId", "TenantId", "Key", "Value", "CreatedAt", "UpdatedAt")
SELECT 6, 6, 'STAMP_WIDTH_MM', '38', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Settings" WHERE "Key" = 'STAMP_WIDTH_MM' AND ("OwnerId" = 6 OR "TenantId" = 6)
);
INSERT INTO "Settings" ("OwnerId", "TenantId", "Key", "Value", "CreatedAt", "UpdatedAt")
SELECT 6, 6, 'SIGNATURE_WIDTH_MM', '42', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Settings" WHERE "Key" = 'SIGNATURE_WIDTH_MM' AND ("OwnerId" = 6 OR "TenantId" = 6)
);
INSERT INTO "Settings" ("OwnerId", "TenantId", "Key", "Value", "CreatedAt", "UpdatedAt")
SELECT 6, 6, 'STAMP_OFFSET_RIGHT_MM', '55', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Settings" WHERE "Key" = 'STAMP_OFFSET_RIGHT_MM' AND ("OwnerId" = 6 OR "TenantId" = 6)
);
INSERT INTO "Settings" ("OwnerId", "TenantId", "Key", "Value", "CreatedAt", "UpdatedAt")
SELECT 6, 6, 'STAMP_OFFSET_BOTTOM_MM', '18', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Settings" WHERE "Key" = 'STAMP_OFFSET_BOTTOM_MM' AND ("OwnerId" = 6 OR "TenantId" = 6)
);
INSERT INTO "Settings" ("OwnerId", "TenantId", "Key", "Value", "CreatedAt", "UpdatedAt")
SELECT 6, 6, 'SIGNATURE_OFFSET_RIGHT_MM', '12', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Settings" WHERE "Key" = 'SIGNATURE_OFFSET_RIGHT_MM' AND ("OwnerId" = 6 OR "TenantId" = 6)
);
INSERT INTO "Settings" ("OwnerId", "TenantId", "Key", "Value", "CreatedAt", "UpdatedAt")
SELECT 6, 6, 'SIGNATURE_OFFSET_BOTTOM_MM', '14', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Settings" WHERE "Key" = 'SIGNATURE_OFFSET_BOTTOM_MM' AND ("OwnerId" = 6 OR "TenantId" = 6)
);

SELECT "OwnerId", "TenantId", "Key", "Value"
FROM "Settings"
WHERE ("OwnerId" = 6 OR "TenantId" = 6)
  AND "Key" IN (
    'Feature_LetterheadOnlyPrint',
    'Feature_DocumentStampSignature',
    'PRINT_MARGIN_TOP_MM',
    'PRINT_MARGIN_BOTTOM_MM',
    'STAMP_WIDTH_MM',
    'SIGNATURE_WIDTH_MM',
    'STAMP_OFFSET_RIGHT_MM',
    'STAMP_OFFSET_BOTTOM_MM',
    'SIGNATURE_OFFSET_RIGHT_MM',
    'SIGNATURE_OFFSET_BOTTOM_MM',
    'STAMP_STORAGE_KEY',
    'SIGNATURE_STORAGE_KEY'
  )
ORDER BY "Key";
