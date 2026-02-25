-- Fix production migration failures (IsActive cast, SessionVersion, PaymentTerms)
-- Run against production DB if migrations fail. Use DATABASE_URL_EXTERNAL from .env
--
-- Usage (from backend/HexaBill.Api):
--   $env:PGPASSWORD='...'; psql -h dpg-xxx.singapore-postgres.render.com -U hexabill_user hexabill -f Scripts/FIX_PRODUCTION_MIGRATIONS.sql
-- Or run via Render PostgreSQL Shell (Connect → PSQL)

-- 1. Fix IsActive: integer -> boolean (PostgreSQL 42804 fix)
-- Run only if Routes/Branches have IsActive as integer. Skip if already boolean.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Routes' AND column_name = 'IsActive' 
    AND data_type IN ('integer', 'smallint')
  ) THEN
    ALTER TABLE "Routes" 
      ALTER COLUMN "IsActive" DROP DEFAULT,
      ALTER COLUMN "IsActive" TYPE boolean USING (CASE WHEN "IsActive"::int = 0 THEN false ELSE true END),
      ALTER COLUMN "IsActive" SET DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Branches' AND column_name = 'IsActive' 
    AND data_type IN ('integer', 'smallint')
  ) THEN
    ALTER TABLE "Branches" 
      ALTER COLUMN "IsActive" DROP DEFAULT,
      ALTER COLUMN "IsActive" TYPE boolean USING (CASE WHEN "IsActive"::int = 0 THEN false ELSE true END),
      ALTER COLUMN "IsActive" SET DEFAULT false;
  END IF;
END $$;

-- 2. Add SessionVersion to Users (if missing)
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "SessionVersion" integer NOT NULL DEFAULT 0;

-- 3. Add PaymentTerms to Customers (if missing)
ALTER TABLE "Customers" ADD COLUMN IF NOT EXISTS "PaymentTerms" character varying(100) NULL;

-- 4. Add BranchId and RouteId to Customers (fixes 42703: column "BranchId" does not exist)
ALTER TABLE "Customers" ADD COLUMN IF NOT EXISTS "BranchId" integer NULL;
ALTER TABLE "Customers" ADD COLUMN IF NOT EXISTS "RouteId" integer NULL;
CREATE INDEX IF NOT EXISTS "IX_Customers_BranchId" ON "Customers" ("BranchId");
CREATE INDEX IF NOT EXISTS "IX_Customers_RouteId" ON "Customers" ("RouteId");
-- FK constraints (run only if they don't exist - ignore errors if they do)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Customers_Branches_BranchId') THEN
    ALTER TABLE "Customers" ADD CONSTRAINT "FK_Customers_Branches_BranchId" FOREIGN KEY ("BranchId") REFERENCES "Branches"("Id") ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Customers_Routes_RouteId') THEN
    ALTER TABLE "Customers" ADD CONSTRAINT "FK_Customers_Routes_RouteId" FOREIGN KEY ("RouteId") REFERENCES "Routes"("Id") ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Add BranchId and RouteId to Sales (fixes 42703: column s.BranchId does not exist in GetCustomerLedgerAsync)
ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "BranchId" integer NULL;
ALTER TABLE "Sales" ADD COLUMN IF NOT EXISTS "RouteId" integer NULL;
CREATE INDEX IF NOT EXISTS "IX_Sales_BranchId" ON "Sales" ("BranchId");
CREATE INDEX IF NOT EXISTS "IX_Sales_RouteId" ON "Sales" ("RouteId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Sales_Branches_BranchId') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='Branches') THEN
    ALTER TABLE "Sales" ADD CONSTRAINT "FK_Sales_Branches_BranchId" FOREIGN KEY ("BranchId") REFERENCES "Branches"("Id") ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Sales_Routes_RouteId') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='Routes') THEN
    ALTER TABLE "Sales" ADD CONSTRAINT "FK_Sales_Routes_RouteId" FOREIGN KEY ("RouteId") REFERENCES "Routes"("Id") ON DELETE SET NULL;
  END IF;
END $$;

-- 5b. Optional backfill: set Sales.BranchId (and RouteId) for existing sales where NULL,
--     so branch/route reports and branch summary show data. Per tenant: assign first branch by id.
--     Run after section 5. Safe to run multiple times (only updates WHERE "BranchId" IS NULL).
DO $$
DECLARE
  r RECORD;
  first_branch_id int;
  first_route_id int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Sales' AND column_name='BranchId') THEN
    RETURN;
  END IF;
  FOR r IN (SELECT DISTINCT "TenantId" FROM "Sales" WHERE "TenantId" IS NOT NULL AND "TenantId" > 0)
  LOOP
    SELECT "Id" INTO first_branch_id FROM "Branches" WHERE "TenantId" = r."TenantId" ORDER BY "Id" ASC LIMIT 1;
    IF first_branch_id IS NOT NULL THEN
      UPDATE "Sales" SET "BranchId" = first_branch_id WHERE "TenantId" = r."TenantId" AND "BranchId" IS NULL AND "IsDeleted" = false;
      SELECT "Id" INTO first_route_id FROM "Routes" WHERE "BranchId" = first_branch_id AND ("TenantId" = r."TenantId" OR "TenantId" IS NULL) ORDER BY "Id" ASC LIMIT 1;
      IF first_route_id IS NOT NULL THEN
        UPDATE "Sales" SET "RouteId" = first_route_id WHERE "TenantId" = r."TenantId" AND "BranchId" = first_branch_id AND "RouteId" IS NULL AND "IsDeleted" = false;
      END IF;
    END IF;
  END LOOP;
END $$;

-- 6. Add IsActive to Routes/Branches if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Routes' AND column_name='IsActive') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='Routes') THEN
    ALTER TABLE "Routes" ADD COLUMN "IsActive" boolean NOT NULL DEFAULT true;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Branches' AND column_name='IsActive') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='Branches') THEN
    ALTER TABLE "Branches" ADD COLUMN "IsActive" boolean NOT NULL DEFAULT true;
  END IF;
END $$;
