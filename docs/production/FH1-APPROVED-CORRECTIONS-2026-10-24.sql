-- FrozenHub 1 (tenant 20) approved production SETTINGS — 2026-10-24 (revision 2)
-- Approved by the platform owner on 2026-10-24 (approved header + A3 invoice series).
-- Target: Render Postgres dpg-d68jhpk9c44c73ft047g-a (HexaBill, Singapore). NEVER run against the Starplus source.
--
-- Revision 2 removes the former A2 block (payment 1462 Completed -> CLEARED, customer 115 -> 10.50).
-- Payment 1462 belongs to test invoice FH-SMK-1791254849 (sale 1618). The owner-approved test-bill clean-up
-- deletes that invoice through the app, which now VOIDS (keeps) its payments and recalculates the customer.
-- End state: payment 1462 VOID, customer 115 = 0.00. See docs/production/FH1-TEST-INVOICE-CLEANUP-MANIFEST.md.
--
-- Before running:
--   1. Release containing ecdfa514 (or later) is live on srv-d68jpdvpm1nc7393q4d0 (INVOICE_SERIES_START support
--      shipped in b44e316f; void-safe delete in 75a176a9).
--   2. Take a fresh Render backup/export of the HexaBill database and confirm it completed.
--   3. Run as ONE psql session: psql "<connection from Render dashboard>" -v ON_ERROR_STOP=1 -f this-file.sql
--      Do not paste the connection string into chat or commit it.
--
-- Independent of the test-invoice clean-up: safe to run before or after it. Aborts if the before-state differs.

\set ON_ERROR_STOP on
BEGIN;

DO $$
BEGIN
  -- Read-only state on 2026-10-24 09:49 UTC: INVOICE_HEADER_STYLE=Legacy (OwnerId 20); no lock; no series.
  IF (SELECT count(*) FROM "Settings" WHERE "OwnerId" = 20 AND "TenantId" = 20
        AND "Key" = 'INVOICE_HEADER_STYLE' AND "Value" = 'Legacy') <> 1 THEN
    RAISE EXCEPTION 'Guard: INVOICE_HEADER_STYLE for tenant 20 is not the reviewed "Legacy" value';
  END IF;
  IF EXISTS (SELECT 1 FROM "Settings" WHERE "OwnerId" = 20 AND "Key" IN ('INVOICE_HEADER_STYLE_LOCKED','INVOICE_SERIES_START')) THEN
    RAISE EXCEPTION 'Guard: header lock or invoice series already set for tenant 20 (already applied?)';
  END IF;
  IF EXISTS (SELECT 1 FROM "Sales" WHERE "TenantId" = 20 AND "InvoiceNo" ~ '^[0-9]+$'
               AND "InvoiceNo"::numeric >= 7000 AND "InvoiceNo"::numeric < 1007000) THEN
    RAISE EXCEPTION 'Guard: tenant 20 already has an invoice number inside the 7000 series';
  END IF;
END $$;

-- Approved print header: locked bilingual header ("Abu Dhabi, Musaffah 17", no phone/email on the printed header).
-- Stored COMPANY_ADDRESS / COMPANY_PHONE / COMPANY_EMAIL are NOT changed. The lock also makes Print default to plain paper.
UPDATE "Settings" SET "Value" = 'BilingualMonochrome', "UpdatedAt" = now()
WHERE "OwnerId" = 20 AND "TenantId" = 20 AND "Key" = 'INVOICE_HEADER_STYLE' AND "Value" = 'Legacy';

INSERT INTO "Settings" ("Key","OwnerId","TenantId","Value","CreatedAt","UpdatedAt")
VALUES ('INVOICE_HEADER_STYLE_LOCKED', 20, 20, 'true', now(), now());

-- A3: new FrozenHub 1 invoices start at 7000. Issued numbers (including 1791254850..59) are never changed.
INSERT INTO "Settings" ("Key","OwnerId","TenantId","Value","CreatedAt","UpdatedAt")
VALUES ('INVOICE_SERIES_START', 20, 20, '7000', now(), now());

INSERT INTO "AuditLogs" ("OwnerId","TenantId","UserId","Action","EntityType","EntityId","OldValues","NewValues","Details","CreatedAt")
VALUES (20, 20, 1, 'SETTINGS_UPDATED', 'Settings', NULL,
        '{"INVOICE_HEADER_STYLE":"Legacy","INVOICE_HEADER_STYLE_LOCKED":null,"INVOICE_SERIES_START":null}',
        '{"INVOICE_HEADER_STYLE":"BilingualMonochrome","INVOICE_HEADER_STYLE_LOCKED":"true","INVOICE_SERIES_START":"7000"}',
        'Owner-approved FrozenHub 1 bilingual invoice header and 7000 invoice series, 2026-10-24. Starplus must stop issuing before 7000.', now());

-- Read-back before COMMIT
SELECT "Key", "Value" FROM "Settings" WHERE "OwnerId" = 20
  AND "Key" IN ('INVOICE_HEADER_STYLE','INVOICE_HEADER_STYLE_LOCKED','INVOICE_SERIES_START') ORDER BY 1;

COMMIT;

-- ---------------------------------------------------------------------------------------------
-- ROLLBACK (only if needed; separate transaction). Do NOT remove INVOICE_SERIES_START once any 7000-series
-- invoice exists: numbering would fall back to the 10-digit sequence. Issued numbers never change either way.
-- BEGIN;
-- UPDATE "Settings" SET "Value" = 'Legacy', "UpdatedAt" = now() WHERE "Key" = 'INVOICE_HEADER_STYLE' AND "OwnerId" = 20;
-- DELETE FROM "Settings" WHERE "OwnerId" = 20 AND "Key" IN ('INVOICE_HEADER_STYLE_LOCKED','INVOICE_SERIES_START');
-- COMMIT;
