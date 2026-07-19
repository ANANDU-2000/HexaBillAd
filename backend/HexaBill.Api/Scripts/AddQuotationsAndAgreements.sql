-- Additive only: Quotations + Agreements for PostgreSQL (Render / Zayoga).
-- Safe to re-run: IF NOT EXISTS / ADD COLUMN IF NOT EXISTS guards.
-- Does NOT touch Sales/Payments/money tables.

CREATE TABLE IF NOT EXISTS "Agreements" (
    "Id" SERIAL PRIMARY KEY,
    "OwnerId" integer NOT NULL,
    "TenantId" integer NULL,
    "AgreementNo" character varying(50) NOT NULL,
    "AgreementDate" timestamp with time zone NOT NULL,
    "SecondPartyName" character varying(200) NULL,
    "SecondPartyLicense" character varying(100) NULL,
    "SecondPartyAddress" character varying(500) NULL,
    "SecondPartyMobile" character varying(50) NULL,
    "TemplateVersion" character varying(20) NOT NULL,
    "Status" character varying(20) NOT NULL,
    "Notes" text NULL,
    "CreatedBy" integer NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "LastModifiedBy" integer NULL,
    "LastModifiedAt" timestamp with time zone NULL,
    "IsDeleted" boolean NOT NULL DEFAULT FALSE,
    "DeletedBy" integer NULL,
    "DeletedAt" timestamp with time zone NULL
);

CREATE TABLE IF NOT EXISTS "Quotations" (
    "Id" SERIAL PRIMARY KEY,
    "OwnerId" integer NOT NULL,
    "TenantId" integer NULL,
    "QuoteNo" character varying(50) NOT NULL,
    "QuoteDate" timestamp with time zone NOT NULL,
    "CustomerName" character varying(200) NULL,
    "CustomerAddress" character varying(500) NULL,
    "CustomerPhone" character varying(50) NULL,
    "CustomerEmail" character varying(100) NULL,
    "CustomerId" integer NULL,
    "Subtotal" numeric(18,2) NOT NULL,
    "VatTotal" numeric(18,2) NOT NULL,
    "Discount" numeric(18,2) NOT NULL,
    "GrandTotal" numeric(18,2) NOT NULL,
    "Status" character varying(20) NOT NULL,
    "Notes" text NULL,
    "Salutation" character varying(200) NULL,
    "IntroLine" character varying(500) NULL,
    "ClosingLine" character varying(500) NULL,
    "CreatedBy" integer NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "LastModifiedBy" integer NULL,
    "LastModifiedAt" timestamp with time zone NULL,
    "IsDeleted" boolean NOT NULL DEFAULT FALSE,
    "DeletedBy" integer NULL,
    "DeletedAt" timestamp with time zone NULL,
    CONSTRAINT "FK_Quotations_Customers_CustomerId" FOREIGN KEY ("CustomerId") REFERENCES "Customers" ("Id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "QuotationItems" (
    "Id" SERIAL PRIMARY KEY,
    "QuotationId" integer NOT NULL,
    "ProductId" integer NULL,
    "Description" character varying(500) NOT NULL,
    "DescriptionSubtitle" character varying(500) NULL,
    "UnitLabel" character varying(50) NOT NULL,
    "Qty" numeric(18,4) NOT NULL,
    "UnitPrice" numeric(18,4) NOT NULL,
    "VatRate" numeric(18,4) NOT NULL,
    "VatAmount" numeric(18,2) NOT NULL,
    "LineTotal" numeric(18,2) NOT NULL,
    "SortOrder" integer NOT NULL,
    CONSTRAINT "FK_QuotationItems_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE SET NULL,
    CONSTRAINT "FK_QuotationItems_Quotations_QuotationId" FOREIGN KEY ("QuotationId") REFERENCES "Quotations" ("Id") ON DELETE CASCADE
);

-- A2b columns if tables already existed without them
ALTER TABLE "Quotations" ADD COLUMN IF NOT EXISTS "Salutation" character varying(200) NULL;
ALTER TABLE "Quotations" ADD COLUMN IF NOT EXISTS "IntroLine" character varying(500) NULL;
ALTER TABLE "Quotations" ADD COLUMN IF NOT EXISTS "ClosingLine" character varying(500) NULL;
ALTER TABLE "QuotationItems" ADD COLUMN IF NOT EXISTS "DescriptionSubtitle" character varying(500) NULL;

CREATE INDEX IF NOT EXISTS "IX_Agreements_TenantId" ON "Agreements" ("TenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Agreements_TenantId_AgreementNo" ON "Agreements" ("TenantId", "AgreementNo") WHERE "IsDeleted" = false;
CREATE INDEX IF NOT EXISTS "IX_QuotationItems_ProductId" ON "QuotationItems" ("ProductId");
CREATE INDEX IF NOT EXISTS "IX_QuotationItems_QuotationId" ON "QuotationItems" ("QuotationId");
CREATE INDEX IF NOT EXISTS "IX_Quotations_CustomerId" ON "Quotations" ("CustomerId");
CREATE INDEX IF NOT EXISTS "IX_Quotations_TenantId" ON "Quotations" ("TenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Quotations_TenantId_QuoteNo" ON "Quotations" ("TenantId", "QuoteNo") WHERE "IsDeleted" = false;

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
SELECT '20260719171633_AddQuotationsAndAgreements', '9.0.0'
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '__EFMigrationsHistory')
  AND NOT EXISTS (
    SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260719171633_AddQuotationsAndAgreements'
  );
