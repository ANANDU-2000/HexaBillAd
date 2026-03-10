-- Mark EF migration as applied (column already exists from RUN_ON_RENDER_PSQL.sql)
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES ('20260307135822_AddVendorDiscountsTable', '10.0.3') ON CONFLICT ("MigrationId") DO NOTHING;
