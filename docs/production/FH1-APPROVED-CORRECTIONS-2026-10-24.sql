-- FrozenHub 1 (tenant 20) approved production corrections — 2026-10-24
-- Approved by the platform owner in the Claude Code session on 2026-10-24 (A2, A3 and approved header).
-- Target: Render Postgres dpg-d68jhpk9c44c73ft047g-a (HexaBill, Singapore). NEVER run against the Starplus source.
--
-- Before running:
--   1. Take a fresh Render backup/export of the HexaBill database and confirm it completed.
--   2. Confirm release b44e316f (INVOICE_SERIES_START support) is live on srv-d68jpdvpm1nc7393q4d0.
--   3. Run as ONE psql session: psql "<connection from Render dashboard>" -v ON_ERROR_STOP=1 -f this-file.sql
--      Do not paste the connection string into chat or commit it.
--
-- Every step checks the exact expected "before" state and aborts the whole transaction if anything differs.
-- Audit rows are written as platform admin user 1 (not the tenant owner).

\set ON_ERROR_STOP on
BEGIN;

-- ---------------------------------------------------------------------------------------------
-- Guards: expected state as observed read-only on 2026-10-24 ~08:00 UTC
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT count(*) FROM "Payments" WHERE "Id" = 1462 AND "TenantId" = 20 AND "SaleId" = 1618
        AND "CustomerId" = 115 AND "Amount" = 10.50 AND "Status" = 'Completed') <> 1 THEN
    RAISE EXCEPTION 'A2 guard: payment 1462 is not in the expected Completed/10.50 state';
  END IF;
  IF (SELECT count(*) FROM "Payments" WHERE "Status" NOT IN ('PENDING','CLEARED','RETURNED','VOID')) <> 1 THEN
    RAISE EXCEPTION 'A2 guard: expected exactly one non-standard payment status row';
  END IF;
  IF (SELECT count(*) FROM "Customers" WHERE "Id" = 115 AND "TenantId" = 20
        AND "PendingBalance" = 21.00 AND "Balance" = 21.00 AND "TotalSales" = 52.50 AND "TotalPayments" = 31.50) <> 1 THEN
    RAISE EXCEPTION 'A2 guard: customer 115 balances differ from the reviewed 21.00/52.50/31.50';
  END IF;
  IF EXISTS (SELECT 1 FROM "Sales" WHERE "TenantId" = 20 AND "InvoiceNo" ~ '^[0-9]+$'
               AND "InvoiceNo"::numeric >= 7000 AND "InvoiceNo"::numeric < 1007000) THEN
    RAISE EXCEPTION 'A3 guard: tenant 20 already has an invoice number inside the 7000 series';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- A2. Payment 1462: legacy status "Completed" -> "CLEARED" (same meaning: settled cash payment)
-- ---------------------------------------------------------------------------------------------
UPDATE "Payments" SET "Status" = 'CLEARED', "UpdatedAt" = now()
WHERE "Id" = 1462 AND "TenantId" = 20 AND "Status" = 'Completed';

INSERT INTO "AuditLogs" ("OwnerId","TenantId","UserId","Action","EntityType","EntityId","OldValues","NewValues","Details","CreatedAt")
VALUES (20, 20, 1, 'DATA_CORRECTION', 'Payment', 1462, '{"Status":"Completed"}', '{"Status":"CLEARED"}',
        'Approved one-row correction 2026-10-24: legacy Completed status made CLEARED; amount/sale/customer unchanged.', now());

-- A2. Customer 115 balance: same formula as BalanceService.RecalculateCustomerBalanceAsync
--     pending = live sales - CLEARED non-refund payments - approved returns + non-void refunds
WITH agg AS (
  SELECT
    (SELECT coalesce(sum("GrandTotal"),0) FROM "Sales" WHERE "CustomerId" = 115 AND "TenantId" = 20 AND NOT "IsDeleted") AS sales,
    (SELECT coalesce(sum("Amount"),0) FROM "Payments" WHERE "CustomerId" = 115 AND "TenantId" = 20 AND "Status" = 'CLEARED' AND "SaleReturnId" IS NULL) AS paid,
    (SELECT coalesce(sum("GrandTotal"),0) FROM "SaleReturns" WHERE "CustomerId" = 115 AND "TenantId" = 20 AND "Status" = 'Approved') AS returns,
    (SELECT coalesce(sum("Amount"),0) FROM "Payments" WHERE "CustomerId" = 115 AND "TenantId" = 20 AND "SaleReturnId" IS NOT NULL AND "Status" <> 'VOID') AS refunds
)
UPDATE "Customers" c
SET "TotalSales" = agg.sales, "TotalPayments" = agg.paid,
    "PendingBalance" = agg.sales - agg.paid - agg.returns + agg.refunds,
    "Balance" = agg.sales - agg.paid - agg.returns + agg.refunds,
    "UpdatedAt" = now()
FROM agg WHERE c."Id" = 115 AND c."TenantId" = 20;

DO $$
BEGIN
  IF (SELECT count(*) FROM "Customers" WHERE "Id" = 115 AND "PendingBalance" = 10.50 AND "Balance" = 10.50
        AND "TotalSales" = 52.50 AND "TotalPayments" = 42.00) <> 1 THEN
    RAISE EXCEPTION 'A2 check: customer 115 did not recalculate to 10.50 / 52.50 / 42.00';
  END IF;
END $$;

INSERT INTO "AuditLogs" ("OwnerId","TenantId","UserId","Action","EntityType","EntityId","OldValues","NewValues","Details","CreatedAt")
VALUES (20, 20, 1, 'BALANCE_RECALCULATED', 'Customer', 115,
        '{"PendingBalance":21.00,"Balance":21.00,"TotalPayments":31.50}', '{"PendingBalance":10.50,"Balance":10.50,"TotalPayments":42.00}',
        'Recalculated after payment 1462 status correction (BalanceService formula).', now());

-- ---------------------------------------------------------------------------------------------
-- Approved print header: locked bilingual header ("Abu Dhabi, Musaffah 17", no phone/email).
-- Stored COMPANY_ADDRESS / COMPANY_PHONE / COMPANY_EMAIL are NOT changed.
-- INVOICE_HEADER_STYLE was last saved as "Legacy" on 2026-10-21 12:26 UTC.
-- ---------------------------------------------------------------------------------------------
INSERT INTO "Settings" ("Key","OwnerId","TenantId","Value","CreatedAt","UpdatedAt") VALUES
  ('INVOICE_HEADER_STYLE', 20, 20, 'BilingualMonochrome', now(), now()),
  ('INVOICE_HEADER_STYLE_LOCKED', 20, 20, 'true', now(), now())
ON CONFLICT ("Key","OwnerId") DO UPDATE SET "Value" = EXCLUDED."Value", "TenantId" = 20, "UpdatedAt" = now();

INSERT INTO "AuditLogs" ("OwnerId","TenantId","UserId","Action","EntityType","EntityId","OldValues","NewValues","Details","CreatedAt")
VALUES (20, 20, 1, 'SETTINGS_UPDATED', 'Settings', NULL, '{"INVOICE_HEADER_STYLE":"Legacy"}',
        '{"INVOICE_HEADER_STYLE":"BilingualMonochrome","INVOICE_HEADER_STYLE_LOCKED":"true"}',
        'Approved FrozenHub bilingual invoice header, 2026-10-24.', now());

-- ---------------------------------------------------------------------------------------------
-- A3. New FrozenHub 1 invoice series starts at 7000 (issued 10-digit numbers stay unchanged)
-- ---------------------------------------------------------------------------------------------
INSERT INTO "Settings" ("Key","OwnerId","TenantId","Value","CreatedAt","UpdatedAt")
VALUES ('INVOICE_SERIES_START', 20, 20, '7000', now(), now())
ON CONFLICT ("Key","OwnerId") DO UPDATE SET "Value" = EXCLUDED."Value", "TenantId" = 20, "UpdatedAt" = now();

INSERT INTO "AuditLogs" ("OwnerId","TenantId","UserId","Action","EntityType","EntityId","OldValues","NewValues","Details","CreatedAt")
VALUES (20, 20, 1, 'SETTINGS_UPDATED', 'Settings', NULL, '{"INVOICE_SERIES_START":null}', '{"INVOICE_SERIES_START":"7000"}',
        'Approved invoice series cutover, 2026-10-24. Starplus must stop issuing before it reaches 7000.', now());

-- Final read-back (shown before COMMIT)
SELECT 'payment_1462' AS item, "Status" AS value FROM "Payments" WHERE "Id" = 1462
UNION ALL SELECT 'customer_115_pending', "PendingBalance"::text FROM "Customers" WHERE "Id" = 115
UNION ALL SELECT "Key", "Value" FROM "Settings" WHERE "TenantId" = 20
  AND "Key" IN ('INVOICE_HEADER_STYLE','INVOICE_HEADER_STYLE_LOCKED','INVOICE_SERIES_START');

COMMIT;

-- ---------------------------------------------------------------------------------------------
-- ROLLBACK (only if needed; run as a separate transaction):
-- BEGIN;
-- UPDATE "Payments" SET "Status" = 'Completed', "UpdatedAt" = now() WHERE "Id" = 1462 AND "TenantId" = 20 AND "Status" = 'CLEARED';
-- UPDATE "Customers" SET "PendingBalance" = 21.00, "Balance" = 21.00, "TotalPayments" = 31.50, "UpdatedAt" = now() WHERE "Id" = 115 AND "TenantId" = 20;
-- UPDATE "Settings" SET "Value" = 'Legacy', "UpdatedAt" = now() WHERE "Key" = 'INVOICE_HEADER_STYLE' AND "OwnerId" = 20;
-- DELETE FROM "Settings" WHERE "OwnerId" = 20 AND "Key" IN ('INVOICE_HEADER_STYLE_LOCKED','INVOICE_SERIES_START');
-- COMMIT;
-- Note: once any 7000-series invoice has been issued, do NOT remove INVOICE_SERIES_START — numbering would
-- fall back to the 10-digit sequence; issued numbers are never reused or renumbered either way.
