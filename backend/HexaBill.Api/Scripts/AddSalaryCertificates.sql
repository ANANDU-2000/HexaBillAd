-- Additive only: SalaryCertificates for PostgreSQL (Render / Zayoga tenant 6).
-- Safe to re-run: IF NOT EXISTS guards. Does NOT touch Sales/Payments/money tables.

CREATE TABLE IF NOT EXISTS "SalaryCertificates" (
    "Id" SERIAL PRIMARY KEY,
    "OwnerId" integer NOT NULL,
    "TenantId" integer NULL,
    "CertificateNo" character varying(50) NOT NULL,
    "CertificateDate" timestamp with time zone NOT NULL,
    "Recipient" character varying(200) NULL,
    "EmployeeName" character varying(200) NULL,
    "PassportNumber" character varying(50) NULL,
    "EmployeeNationality" character varying(100) NULL,
    "JoiningDate" timestamp with time zone NULL,
    "Designation" character varying(200) NULL,
    "MonthlySalary" numeric(18,2) NULL,
    "MonthlySalaryWords" character varying(200) NULL,
    "EmployeePhone" character varying(50) NULL,
    "SignatoryName" character varying(200) NOT NULL DEFAULT 'Sudheesh Thampi',
    "SignatoryTitle" character varying(100) NOT NULL DEFAULT 'Manager',
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

CREATE INDEX IF NOT EXISTS "IX_SalaryCertificates_TenantId" ON "SalaryCertificates" ("TenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "IX_SalaryCertificates_TenantId_CertificateNo"
    ON "SalaryCertificates" ("TenantId", "CertificateNo") WHERE "IsDeleted" = false;

-- Ensure Quotes/Agreements/Salary Certificates feature flag on for Zayoga (TenantId / OwnerId 6).
INSERT INTO "Settings" ("OwnerId", "TenantId", "Key", "Value", "CreatedAt", "UpdatedAt")
SELECT 6, 6, 'Feature_QuotesAgreements', 'true', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Settings"
  WHERE "Key" = 'Feature_QuotesAgreements'
    AND ("OwnerId" = 6 OR "TenantId" = 6)
);

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
SELECT '20260728120000_AddSalaryCertificates', '9.0.0'
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '__EFMigrationsHistory')
  AND NOT EXISTS (
    SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260728120000_AddSalaryCertificates'
  );
