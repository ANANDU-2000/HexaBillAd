-- SQLite (local) additive: SalaryCertificates. Safe to re-run.
CREATE TABLE IF NOT EXISTS "SalaryCertificates" (
    "Id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "OwnerId" INTEGER NOT NULL,
    "TenantId" INTEGER NULL,
    "CertificateNo" TEXT NOT NULL,
    "CertificateDate" TEXT NOT NULL,
    "Recipient" TEXT NULL,
    "EmployeeName" TEXT NULL,
    "PassportNumber" TEXT NULL,
    "EmployeeNationality" TEXT NULL,
    "JoiningDate" TEXT NULL,
    "Designation" TEXT NULL,
    "MonthlySalary" TEXT NULL,
    "MonthlySalaryWords" TEXT NULL,
    "EmployeePhone" TEXT NULL,
    "SignatoryName" TEXT NOT NULL DEFAULT 'Sudheesh Thampi',
    "SignatoryTitle" TEXT NOT NULL DEFAULT 'Manager',
    "Status" TEXT NOT NULL,
    "Notes" TEXT NULL,
    "CreatedBy" INTEGER NOT NULL,
    "CreatedAt" TEXT NOT NULL,
    "LastModifiedBy" INTEGER NULL,
    "LastModifiedAt" TEXT NULL,
    "IsDeleted" INTEGER NOT NULL DEFAULT 0,
    "DeletedBy" INTEGER NULL,
    "DeletedAt" TEXT NULL
);

CREATE INDEX IF NOT EXISTS "IX_SalaryCertificates_TenantId" ON "SalaryCertificates" ("TenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "IX_SalaryCertificates_TenantId_CertificateNo"
    ON "SalaryCertificates" ("TenantId", "CertificateNo") WHERE "IsDeleted" = 0;

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
SELECT '20260728120000_AddSalaryCertificates', '9.0.0'
WHERE NOT EXISTS (
  SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260728120000_AddSalaryCertificates'
);
