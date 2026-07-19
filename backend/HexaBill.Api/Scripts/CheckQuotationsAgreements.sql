-- Read-only check (no secrets). Safe to run anytime.
SELECT current_database() AS db, inet_server_addr()::text AS server_addr;
SELECT "Id", "Name" FROM "Tenants" ORDER BY "Id";
SELECT
  to_regclass('"Quotations"')::text AS quotations,
  to_regclass('"Agreements"')::text AS agreements,
  to_regclass('"QuotationItems"')::text AS quotation_items;
