-- HexaBill production runbook, prepared 2026-10-18. NOT RUN. Nothing here has been applied to any real database.
--
-- Purpose: (1) create the AssistantDrafts table the new backend needs, (2) backfill Customers.OwnerId where it is 0.
-- Run in the Render PostgreSQL shell (or psql) connected as the APPLICATION's database role, so that role owns the table.
-- Both steps are small and reversible. Do them only after a backup you have verified you can restore.
--
-- Preconditions (check first, and write the answers down):
--   * A backup exists that you could restore: Render dashboard, hexabill database, Backups. The app's own alert says
--     "No backup found in last 24 hours" for several companies, so do not assume one exists. Create a manual backup if the
--     plan allows it, or export with pg_dump from a trusted machine.
--   * Low-traffic time. Both statements are quick and take only brief locks.
--   * The numbers below match what you see now (they were read on 2026-10-18 and can change).
--
-- Read-only checks (safe to run any time):
--   select count(*) from "Customers" where "OwnerId" = 0;                                   -- was 52
--   select count(*) from "Customers" where "OwnerId" = 0 and "TenantId" is null;            -- was 0 (must stay 0)
--   select count(*) from "Customers" where "OwnerId" <> 0 and "OwnerId" <> "TenantId";      -- was 0
--   select to_regclass('public."AssistantDrafts"');                                         -- was NULL (table absent)
--   select count(*) from "__EFMigrationsHistory";                                           -- was 55

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- Step 1: AssistantDrafts (idempotent; same statements as migration 20261018090000_AddAssistantDrafts)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "AssistantDrafts" (
    "Id" uuid NOT NULL,
    "TenantId" integer NOT NULL,
    "UserId" integer NOT NULL,
    "Kind" character varying(40) NOT NULL,
    "PayloadJson" text NOT NULL,
    "PayloadHash" character varying(64) NOT NULL,
    "Status" character varying(20) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "ExpiresAt" timestamp with time zone NOT NULL,
    "ConfirmedAt" timestamp with time zone NULL,
    "IdempotencyKey" character varying(80) NULL,
    "ResultJson" text NULL,
    CONSTRAINT "PK_AssistantDrafts" PRIMARY KEY ("Id")
);
CREATE INDEX IF NOT EXISTS "IX_AssistantDrafts_TenantId_UserId_Status" ON "AssistantDrafts" ("TenantId", "UserId", "Status");
CREATE UNIQUE INDEX IF NOT EXISTS "IX_AssistantDrafts_TenantId_IdempotencyKey" ON "AssistantDrafts" ("TenantId", "IdempotencyKey") WHERE "IdempotencyKey" IS NOT NULL;

-- Record it in the EF history so readiness shows the schema as current once the new backend is deployed.
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
SELECT '20261018090000_AddAssistantDrafts', '9.0.0'
WHERE NOT EXISTS (SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261018090000_AddAssistantDrafts');

-- ---------------------------------------------------------------------------------------------
-- Step 2: Customers.OwnerId backfill. OwnerId equals TenantId everywhere it is set (checked), and the fixed create path
-- stores the tenant id, so the 52 rows with 0 get the same value. A copy of the affected rows is kept first.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "_bak_Customers_OwnerId_20261018" AS
SELECT "Id", "TenantId", "OwnerId" FROM "Customers" WHERE "OwnerId" = 0;

UPDATE "Customers" SET "OwnerId" = "TenantId" WHERE "OwnerId" = 0 AND "TenantId" IS NOT NULL;

-- Verification inside the transaction. Expect: 0 rows left with OwnerId 0, table present, history row present.
SELECT
  (SELECT count(*) FROM "Customers" WHERE "OwnerId" = 0)                                             AS owner_zero_left,
  (SELECT count(*) FROM "_bak_Customers_OwnerId_20261018")                                           AS rows_backed_up,
  (SELECT count(*) FROM "Customers" c JOIN "_bak_Customers_OwnerId_20261018" b ON b."Id" = c."Id"
     WHERE c."OwnerId" <> c."TenantId")                                                              AS rows_not_matching_tenant,
  to_regclass('public."AssistantDrafts"') IS NOT NULL                                                AS drafts_table_present,
  (SELECT count(*) FROM "__EFMigrationsHistory")                                                     AS migration_rows;

-- If the numbers are as expected, COMMIT; otherwise ROLLBACK and stop.
-- COMMIT;
-- ROLLBACK;

-- ---------------------------------------------------------------------------------------------
-- Undo (only if needed after COMMIT):
--   UPDATE "Customers" c SET "OwnerId" = b."OwnerId" FROM "_bak_Customers_OwnerId_20261018" b WHERE b."Id" = c."Id";
--   DROP TABLE IF EXISTS "AssistantDrafts";
--   DELETE FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261018090000_AddAssistantDrafts';
-- Keep "_bak_Customers_OwnerId_20261018" until you are satisfied, then DROP TABLE it.
--
-- Not covered here, on purpose: the 2 SupplierPayments rows with a NULL SupplierName, the 3 stricter NOT NULL columns, the
-- six live-only columns (two hold data), removing runtime schema repair, and any environment variable or key change.
-- The AI provider keys must be set by you in the Render dashboard (Environment); never paste them into chat or a file in Git.
