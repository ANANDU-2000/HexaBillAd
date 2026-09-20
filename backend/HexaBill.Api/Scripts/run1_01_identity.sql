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

ALTER TABLE "Users"
    ADD COLUMN IF NOT EXISTS "MustChangePassword" boolean NOT NULL DEFAULT false;

UPDATE "Users"
SET "IsPlatformAdmin" = true
WHERE "TenantId" IS NULL;

ALTER TABLE "Users"
    DROP CONSTRAINT IF EXISTS "CK_Users_PlatformTenantIdentity";

ALTER TABLE "Users"
    ADD CONSTRAINT "CK_Users_PlatformTenantIdentity"
    CHECK (("IsPlatformAdmin" = true AND "TenantId" IS NULL)
        OR ("IsPlatformAdmin" = false AND "TenantId" IS NOT NULL));

-- Tenant subdomains are the only tenant-host authority.
ALTER TABLE "Tenants"
    ADD COLUMN IF NOT EXISTS "Subdomain" varchar(30);
UPDATE "Tenants"
SET "Subdomain" = 'tenant-' || "Id"
WHERE "Subdomain" IS NULL OR btrim("Subdomain") = '';
ALTER TABLE "Tenants" ALTER COLUMN "Subdomain" SET NOT NULL;
DROP INDEX IF EXISTS "IX_Tenants_Subdomain";
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Tenants_Subdomain" ON "Tenants" ("Subdomain");

-- Owner invites and server-issued read-only support sessions.
CREATE TABLE IF NOT EXISTS "TenantInvites" (
    "Id" serial PRIMARY KEY,
    "TenantId" integer NOT NULL REFERENCES "Tenants"("Id") ON DELETE CASCADE,
    "UserId" integer NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
    "TokenHash" varchar(128) NOT NULL,
    "HostSubdomain" varchar(30) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    "ExpiresAt" timestamp with time zone NOT NULL,
    "UsedAt" timestamp with time zone NULL,
    "RevokedAt" timestamp with time zone NULL,
    "CreatedByUserId" integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_TenantInvites_TokenHash" ON "TenantInvites" ("TokenHash");
CREATE INDEX IF NOT EXISTS "IX_TenantInvites_TenantId_UserId_ExpiresAt" ON "TenantInvites" ("TenantId", "UserId", "ExpiresAt");

CREATE TABLE IF NOT EXISTS "SupportSessions" (
    "Id" serial PRIMARY KEY,
    "TenantId" integer NOT NULL REFERENCES "Tenants"("Id") ON DELETE CASCADE,
    "PlatformUserId" integer NOT NULL REFERENCES "Users"("Id") ON DELETE RESTRICT,
    "Reason" varchar(500) NOT NULL,
    "StartedAt" timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    "ExpiresAt" timestamp with time zone NOT NULL,
    "EndedAt" timestamp with time zone NULL,
    "ReadOnly" boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS "IX_SupportSessions_TenantId_PlatformUserId_ExpiresAt" ON "SupportSessions" ("TenantId", "PlatformUserId", "ExpiresAt");

DROP INDEX IF EXISTS "IX_Users_Email";
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Users_TenantId_Email" ON "Users" ("TenantId", "Email");

-- Rollback note:
-- Restore the database backup, or drop the constraint and columns only after
-- stopping the Run 1 application version and validating the prior schema.
