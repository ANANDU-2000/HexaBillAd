-- Additive owner-consent migration, separate from the four earlier pending migrations.
-- Production requires backup/restore/rehearsal and environment-specific approval.
-- Run as the application role with psql -1 -v ON_ERROR_STOP=1.
CREATE TABLE IF NOT EXISTS "TenantAiConsents" (
    "TenantId" integer NOT NULL,
    "Enabled" boolean NOT NULL,
    "PolicyFingerprint" character varying(64) NOT NULL,
    "UpdatedByUserId" integer NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_TenantAiConsents" PRIMARY KEY ("TenantId")
);
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
SELECT '20261018180000_AddTenantAiConsent', '9.0.0'
WHERE NOT EXISTS (SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261018180000_AddTenantAiConsent');
