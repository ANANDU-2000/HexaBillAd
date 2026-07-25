-- Bump Zayoga (tenant 6) stamp size for letterhead A4/A5 prints. Additive upsert only.
UPDATE "Settings" SET "Value" = '62', "UpdatedAt" = NOW()
WHERE "Key" = 'STAMP_WIDTH_MM' AND ("OwnerId" = 6 OR "TenantId" = 6);

INSERT INTO "Settings" ("OwnerId", "TenantId", "Key", "Value", "CreatedAt", "UpdatedAt")
SELECT 6, 6, 'STAMP_WIDTH_MM', '62', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Settings" WHERE "Key" = 'STAMP_WIDTH_MM' AND ("OwnerId" = 6 OR "TenantId" = 6)
);

UPDATE "Settings" SET "Value" = '52', "UpdatedAt" = NOW()
WHERE "Key" = 'PRINT_MARGIN_BOTTOM_MM' AND ("OwnerId" = 6 OR "TenantId" = 6);

INSERT INTO "Settings" ("OwnerId", "TenantId", "Key", "Value", "CreatedAt", "UpdatedAt")
SELECT 6, 6, 'PRINT_MARGIN_BOTTOM_MM', '52', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Settings" WHERE "Key" = 'PRINT_MARGIN_BOTTOM_MM' AND ("OwnerId" = 6 OR "TenantId" = 6)
);

SELECT "Key", "Value" FROM "Settings"
WHERE ("OwnerId" = 6 OR "TenantId" = 6)
  AND "Key" IN ('STAMP_WIDTH_MM', 'PRINT_MARGIN_BOTTOM_MM', 'Feature_LetterheadOnlyPrint', 'Feature_DocumentStampSignature')
ORDER BY "Key";
