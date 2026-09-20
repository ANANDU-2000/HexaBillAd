-- HexaBill Run 1 identity migration
-- Run manually against the production PostgreSQL database after a backup.
-- Change expected_platform_admins only after reviewing the SELECT output below.

SELECT COUNT(*) AS existing_users_without_tenant
FROM "Users"
WHERE "TenantId" IS NULL;

DO $$
DECLARE
    expected_platform_admins integer := 1;
    actual_platform_admins integer;
BEGIN
    SELECT COUNT(*) INTO actual_platform_admins
    FROM "Users"
    WHERE "TenantId" IS NULL;

    IF actual_platform_admins <> expected_platform_admins THEN
        RAISE EXCEPTION 'run1_01_identity aborted: expected % users with NULL TenantId, found %',
            expected_platform_admins, actual_platform_admins;
    END IF;
END $$;

ALTER TABLE "Users"
    ADD COLUMN IF NOT EXISTS "IsPlatformAdmin" boolean NOT NULL DEFAULT false;

ALTER TABLE "Users"
    ADD COLUMN IF NOT EXISTS "IsActive" boolean NOT NULL DEFAULT true;

UPDATE "Users"
SET "IsPlatformAdmin" = true
WHERE "TenantId" IS NULL;

ALTER TABLE "Users"
    DROP CONSTRAINT IF EXISTS "CK_Users_PlatformTenantIdentity";

ALTER TABLE "Users"
    ADD CONSTRAINT "CK_Users_PlatformTenantIdentity"
    CHECK (("IsPlatformAdmin" = true AND "TenantId" IS NULL)
        OR ("IsPlatformAdmin" = false AND "TenantId" IS NOT NULL));

-- Rollback note:
-- Restore the database backup, or drop the constraint and columns only after
-- stopping the Run 1 application version and validating the prior schema.
