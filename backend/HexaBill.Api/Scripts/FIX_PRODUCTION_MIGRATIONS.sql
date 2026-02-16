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
