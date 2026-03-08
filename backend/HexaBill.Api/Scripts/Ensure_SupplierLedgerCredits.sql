-- =============================================================================
-- Run with psql using .env (Render has no DB shell on free/basic).
-- From backend\HexaBill.Api (with PostgreSQL client installed):
--   PowerShell: $env:PGPASSWORD='<DB_PASSWORD from .env>'; psql -h <DB_HOST_EXTERNAL> -p 5432 -U hexabill_user -d hexabill -f Scripts\Ensure_SupplierLedgerCredits.sql
-- Ensures SupplierLedgerCredits exists so /api/suppliers/summary and ledger are correct.
-- Formula (must match app): Outstanding = TotalPurchases - PurchaseReturns - SupplierPayments - SupplierLedgerCredits.
-- =============================================================================

-- SupplierLedgerCredits – vendor discounts/credits (reduces supplier outstanding)
CREATE TABLE IF NOT EXISTS "SupplierLedgerCredits" (
  "Id" serial PRIMARY KEY,
  "TenantId" integer NOT NULL,
  "SupplierName" character varying(200) NOT NULL,
  "Amount" numeric(18,2) NOT NULL,
  "CreditDate" timestamp with time zone NOT NULL,
  "CreditType" character varying(50) NOT NULL,
  "Notes" character varying(500) NULL,
  "CreatedBy" integer NOT NULL,
  "CreatedAt" timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);
CREATE INDEX IF NOT EXISTS "IX_SupplierLedgerCredits_TenantId_SupplierName" ON "SupplierLedgerCredits" ("TenantId", "SupplierName");
CREATE INDEX IF NOT EXISTS "IX_SupplierLedgerCredits_CreditDate" ON "SupplierLedgerCredits" ("CreditDate");

-- Verify table exists (optional; remove if you don't want output)
SELECT 'SupplierLedgerCredits table ensured.' AS result;
