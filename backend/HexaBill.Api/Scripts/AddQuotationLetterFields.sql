-- A2b additive columns only (safe re-run). Does not touch money tables.
ALTER TABLE "Quotations" ADD COLUMN IF NOT EXISTS "Salutation" character varying(200) NULL;
ALTER TABLE "Quotations" ADD COLUMN IF NOT EXISTS "IntroLine" character varying(500) NULL;
ALTER TABLE "Quotations" ADD COLUMN IF NOT EXISTS "ClosingLine" character varying(500) NULL;
ALTER TABLE "QuotationItems" ADD COLUMN IF NOT EXISTS "DescriptionSubtitle" character varying(500) NULL;

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
SELECT '20260719190000_AddQuotationLetterFields', '9.0.0'
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '__EFMigrationsHistory')
  AND NOT EXISTS (
    SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260719190000_AddQuotationLetterFields'
  );
