-- Ensure Quotes/Agreements feature flag on for Zayoga (TenantId / OwnerId 6). Additive only.
INSERT INTO "Settings" ("OwnerId", "TenantId", "Key", "Value", "CreatedAt", "UpdatedAt")
SELECT 6, 6, 'Feature_QuotesAgreements', 'true', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Settings"
  WHERE "Key" = 'Feature_QuotesAgreements'
    AND ("OwnerId" = 6 OR "TenantId" = 6)
);

UPDATE "Settings"
SET "Value" = 'true', "UpdatedAt" = NOW()
WHERE "Key" = 'Feature_QuotesAgreements'
  AND ("OwnerId" = 6 OR "TenantId" = 6)
  AND LOWER(TRIM("Value")) IN ('false', '0', 'no');

SELECT "OwnerId", "TenantId", "Key", "Value"
FROM "Settings"
WHERE "Key" = 'Feature_QuotesAgreements'
  AND ("OwnerId" = 6 OR "TenantId" = 6 OR "OwnerId" IS NULL);
