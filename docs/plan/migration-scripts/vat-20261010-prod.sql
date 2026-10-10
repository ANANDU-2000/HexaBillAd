-- HexaBill production VAT migrations (hand-written, idempotent, additive only).
-- Covers: 20261010090000_AddVatManagementSnapshot, 20261010120000_AddVatCalculationVersioning
-- Prerequisites: verified backup of database "hexabill" (Render). Apply BEFORE deploying the new backend.
-- Run:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f vat-20261010-prod.sql
-- Verify afterwards with vat-20261010-verify.sql
BEGIN;
SET LOCAL lock_timeout = '5s';

-- 20261010090000_AddVatManagementSnapshot
ALTER TABLE "VatReturnPeriods" ADD COLUMN IF NOT EXISTS "SnapshotJson" text NULL;
ALTER TABLE "VatReturnPeriods" ADD COLUMN IF NOT EXISTS "SnapshotHash" character varying(64) NULL;
ALTER TABLE "VatReturnPeriods" ADD COLUMN IF NOT EXISTS "SnapshotHistoryJson" text NULL;
ALTER TABLE "VatReturnPeriods" ADD COLUMN IF NOT EXISTS "SnapshotVersion" integer NOT NULL DEFAULT 0;
ALTER TABLE "VatReturnPeriods" ADD COLUMN IF NOT EXISTS "SnapshotAt" timestamp with time zone NULL;
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
SELECT '20261010090000_AddVatManagementSnapshot', '9.0.0'
WHERE NOT EXISTS (SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261010090000_AddVatManagementSnapshot');

-- 20261010120000_AddVatCalculationVersioning
ALTER TABLE "VatReturnPeriods" ADD COLUMN IF NOT EXISTS "CalculationVersion" integer NOT NULL DEFAULT 0;
ALTER TABLE "VatReturnPeriods" ADD COLUMN IF NOT EXISTS "SourceFingerprint" character varying(64) NULL;
ALTER TABLE "VatReturnPeriods" ADD COLUMN IF NOT EXISTS "ReviewedAt" timestamp with time zone NULL;
ALTER TABLE "VatReturnPeriods" ADD COLUMN IF NOT EXISTS "ReviewedByUserId" integer NULL;
ALTER TABLE "VatReturnPeriods" ADD COLUMN IF NOT EXISTS "ReviewedCalculationVersion" integer NULL;
ALTER TABLE "VatReturnPeriods" ADD COLUMN IF NOT EXISTS "ReviewInvalidatedAt" timestamp with time zone NULL;
ALTER TABLE "VatReturnPeriods" ADD COLUMN IF NOT EXISTS "ReviewInvalidatedReason" character varying(200) NULL;
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
SELECT '20261010120000_AddVatCalculationVersioning', '9.0.0'
WHERE NOT EXISTS (SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261010120000_AddVatCalculationVersioning');

COMMIT;

-- Verification (read-only):
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'VatReturnPeriods'
--   AND column_name IN ('SnapshotJson','SnapshotHash','SnapshotHistoryJson','SnapshotVersion','SnapshotAt','CalculationVersion',
--     'SourceFingerprint','ReviewedAt','ReviewedByUserId','ReviewedCalculationVersion','ReviewInvalidatedAt','ReviewInvalidatedReason');  -- expect 12
-- SELECT "MigrationId" FROM "__EFMigrationsHistory" WHERE "MigrationId" LIKE '202610101%' OR "MigrationId" LIKE '20261010090000%';  -- expect 2

-- Rollback: normally leave the additive columns (old code ignores them). If removal is ever required, drop the 12 columns
-- above and delete the two __EFMigrationsHistory rows in a transaction after taking a fresh backup.
