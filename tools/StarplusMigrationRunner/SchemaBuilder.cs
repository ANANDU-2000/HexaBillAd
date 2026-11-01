using System;
using System.Threading.Tasks;
using Npgsql;

namespace StarplusMigrationRunner
{
    public static class SchemaBuilder
    {
        public static async Task EnsureSchemaAndTablesAsync(NpgsqlConnection conn, string schemaName)
        {
            await using var cmd = new NpgsqlCommand($@"
                CREATE SCHEMA IF NOT EXISTS ""{schemaName}"";

                -- 1. MigrationRuns
                CREATE TABLE IF NOT EXISTS ""{schemaName}"".""MigrationRuns"" (
                    ""Id"" VARCHAR(100) PRIMARY KEY,
                    ""TenantId"" INT NOT NULL,
                    ""SourceSystem"" VARCHAR(50) NOT NULL DEFAULT 'Starplus',
                    ""Status"" VARCHAR(50) NOT NULL,
                    ""StartedAt"" TIMESTAMPTZ NOT NULL,
                    ""CompletedAt"" TIMESTAMPTZ,
                    ""TotalCustomers"" INT NOT NULL DEFAULT 0,
                    ""TotalProducts"" INT NOT NULL DEFAULT 0,
                    ""TotalInvoices"" INT NOT NULL DEFAULT 0,
                    ""TotalItems"" INT NOT NULL DEFAULT 0,
                    ""TotalPayments"" INT NOT NULL DEFAULT 0,
                    ""TotalOutstanding"" NUMERIC(18,2) NOT NULL DEFAULT 0,
                    ""Checksum"" VARCHAR(128),
                    ""AuditSummary"" TEXT
                );

                -- 2. LegacyCustomers
                CREATE TABLE IF NOT EXISTS ""{schemaName}"".""LegacyCustomers"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""TenantId"" INT NOT NULL,
                    ""SourceCustomerId"" INT NOT NULL,
                    ""SourceSystem"" VARCHAR(50) NOT NULL DEFAULT 'Starplus',
                    ""Name"" VARCHAR(255) NOT NULL,
                    ""Phone"" VARCHAR(50),
                    ""Email"" VARCHAR(100),
                    ""Address"" TEXT,
                    ""Trn"" VARCHAR(50),
                    ""DestinationCustomerId"" INT,
                    ""InvoiceCount"" INT NOT NULL DEFAULT 0,
                    ""DeletedInvoiceCount"" INT NOT NULL DEFAULT 0,
                    ""UnpaidInvoiceCount"" INT NOT NULL DEFAULT 0,
                    ""UnpaidInvoiceAmount"" NUMERIC(18,2) NOT NULL DEFAULT 0,
                    ""LedgerCachedPendingBalance"" NUMERIC(18,2) NOT NULL DEFAULT 0,
                    ""LedgerCachedBalance"" NUMERIC(18,2) NOT NULL DEFAULT 0,
                    ""ApprovedOpeningBalance"" NUMERIC(18,2) NOT NULL DEFAULT 0,
                    ""CreatedAt"" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT ""UQ_{schemaName}_LegacyCustomers_Source"" UNIQUE (""TenantId"", ""SourceSystem"", ""SourceCustomerId"")
                );
                CREATE INDEX IF NOT EXISTS ""IX_{schemaName}_LegacyCustomers_Tenant"" ON ""{schemaName}"".""LegacyCustomers"" (""TenantId"");
                CREATE INDEX IF NOT EXISTS ""IX_{schemaName}_LegacyCustomers_Dest"" ON ""{schemaName}"".""LegacyCustomers"" (""TenantId"", ""DestinationCustomerId"");

                -- 3. LegacyProducts
                CREATE TABLE IF NOT EXISTS ""{schemaName}"".""LegacyProducts"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""TenantId"" INT NOT NULL,
                    ""SourceProductId"" INT NOT NULL,
                    ""SourceSystem"" VARCHAR(50) NOT NULL DEFAULT 'Starplus',
                    ""Sku"" VARCHAR(100) NOT NULL,
                    ""NameEn"" VARCHAR(255) NOT NULL,
                    ""NameAr"" VARCHAR(255),
                    ""UnitType"" VARCHAR(50) NOT NULL,
                    ""ConversionToBase"" NUMERIC(18,4) NOT NULL DEFAULT 1,
                    ""CostPrice"" NUMERIC(18,2) NOT NULL DEFAULT 0,
                    ""SellPrice"" NUMERIC(18,2) NOT NULL DEFAULT 0,
                    ""StockQtyLegacy"" NUMERIC(18,2) NOT NULL DEFAULT 0,
                    ""Barcode"" VARCHAR(100),
                    ""DestinationProductId"" INT,
                    ""CreatedAt"" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT ""UQ_{schemaName}_LegacyProducts_Source"" UNIQUE (""TenantId"", ""SourceSystem"", ""SourceProductId"")
                );
                CREATE INDEX IF NOT EXISTS ""IX_{schemaName}_LegacyProducts_Tenant"" ON ""{schemaName}"".""LegacyProducts"" (""TenantId"");
                CREATE INDEX IF NOT EXISTS ""IX_{schemaName}_LegacyProducts_Sku"" ON ""{schemaName}"".""LegacyProducts"" (""TenantId"", ""Sku"");

                -- 4. LegacyInvoices
                CREATE TABLE IF NOT EXISTS ""{schemaName}"".""LegacyInvoices"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""TenantId"" INT NOT NULL,
                    ""SourceInvoiceId"" INT NOT NULL,
                    ""SourceSystem"" VARCHAR(50) NOT NULL DEFAULT 'Starplus',
                    ""LegacyInvoiceNumber"" VARCHAR(100) NOT NULL,
                    ""LegacyIssuer"" VARCHAR(255) NOT NULL DEFAULT 'STARPLUS FOODSTUFF TRADING',
                    ""SourceLegalTaxId"" VARCHAR(50) NOT NULL DEFAULT '100366253100003',
                    ""InvoiceDate"" TIMESTAMPTZ NOT NULL,
                    ""DueDate"" TIMESTAMPTZ,
                    ""DueDateSource"" VARCHAR(50),
                    ""SourceCustomerId"" INT,
                    ""CustomerName"" VARCHAR(255),
                    ""DestinationCustomerId"" INT,
                    ""Status"" VARCHAR(50) NOT NULL,
                    ""IsDeleted"" BOOLEAN NOT NULL DEFAULT FALSE,
                    ""IsFinalized"" BOOLEAN NOT NULL DEFAULT TRUE,
                    ""IsLocked"" BOOLEAN NOT NULL DEFAULT FALSE,
                    ""Subtotal"" NUMERIC(18,2) NOT NULL DEFAULT 0,
                    ""VatTotal"" NUMERIC(18,2) NOT NULL DEFAULT 0,
                    ""Discount"" NUMERIC(18,2) NOT NULL DEFAULT 0,
                    ""RoundOff"" NUMERIC(18,4) NOT NULL DEFAULT 0,
                    ""GrandTotal"" NUMERIC(18,2) NOT NULL DEFAULT 0,
                    ""TotalAmount"" NUMERIC(18,2) NOT NULL DEFAULT 0,
                    ""PaidAmount"" NUMERIC(18,2) NOT NULL DEFAULT 0,
                    ""OutstandingCalculated"" NUMERIC(18,2) NOT NULL DEFAULT 0,
                    ""ReportedAsPending"" BOOLEAN NOT NULL DEFAULT FALSE,
                    ""HasLineItems"" BOOLEAN NOT NULL DEFAULT TRUE,
                    ""ItemsCount"" INT NOT NULL DEFAULT 0,
                    ""PaymentsCount"" INT NOT NULL DEFAULT 0,
                    ""SourceExternalReference"" VARCHAR(255),
                    ""Notes"" TEXT,
                    ""MigrationRunId"" VARCHAR(100) NOT NULL,
                    ""CreatedAt"" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT ""UQ_{schemaName}_LegacyInvoices_Source"" UNIQUE (""TenantId"", ""SourceSystem"", ""SourceInvoiceId"")
                );
                CREATE INDEX IF NOT EXISTS ""IX_{schemaName}_LegacyInvoices_Tenant"" ON ""{schemaName}"".""LegacyInvoices"" (""TenantId"");
                CREATE INDEX IF NOT EXISTS ""IX_{schemaName}_LegacyInvoices_Number"" ON ""{schemaName}"".""LegacyInvoices"" (""TenantId"", ""LegacyInvoiceNumber"");
                CREATE INDEX IF NOT EXISTS ""IX_{schemaName}_LegacyInvoices_Date"" ON ""{schemaName}"".""LegacyInvoices"" (""TenantId"", ""InvoiceDate"");
                CREATE INDEX IF NOT EXISTS ""IX_{schemaName}_LegacyInvoices_Cust"" ON ""{schemaName}"".""LegacyInvoices"" (""TenantId"", ""DestinationCustomerId"");
                CREATE INDEX IF NOT EXISTS ""IX_{schemaName}_LegacyInvoices_SrcCust"" ON ""{schemaName}"".""LegacyInvoices"" (""TenantId"", ""SourceCustomerId"");
                CREATE INDEX IF NOT EXISTS ""IX_{schemaName}_LegacyInvoices_Pending"" ON ""{schemaName}"".""LegacyInvoices"" (""TenantId"", ""ReportedAsPending"");

                -- 5. LegacyInvoiceItems
                CREATE TABLE IF NOT EXISTS ""{schemaName}"".""LegacyInvoiceItems"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""TenantId"" INT NOT NULL,
                    ""LegacyInvoiceId"" INT NOT NULL REFERENCES ""{schemaName}"".""LegacyInvoices""(""Id"") ON DELETE CASCADE,
                    ""SourceItemId"" INT NOT NULL,
                    ""SourceSystem"" VARCHAR(50) NOT NULL DEFAULT 'Starplus',
                    ""SourceProductId"" INT,
                    ""DestinationProductId"" INT,
                    ""Sku"" VARCHAR(100),
                    ""ProductName"" VARCHAR(255) NOT NULL,
                    ""UnitType"" VARCHAR(50) NOT NULL,
                    ""Quantity"" NUMERIC(18,4) NOT NULL,
                    ""UnitPrice"" NUMERIC(18,2) NOT NULL,
                    ""Discount"" NUMERIC(18,2) NOT NULL DEFAULT 0,
                    ""VatAmount"" NUMERIC(18,2) NOT NULL DEFAULT 0,
                    ""LineTotal"" NUMERIC(18,2) NOT NULL,
                    ""CreatedAt"" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT ""UQ_{schemaName}_LegacyInvoiceItems_Source"" UNIQUE (""TenantId"", ""SourceSystem"", ""SourceItemId"")
                );
                CREATE INDEX IF NOT EXISTS ""IX_{schemaName}_LegacyInvoiceItems_Inv"" ON ""{schemaName}"".""LegacyInvoiceItems"" (""LegacyInvoiceId"");
                CREATE INDEX IF NOT EXISTS ""IX_{schemaName}_LegacyInvoiceItems_Prod"" ON ""{schemaName}"".""LegacyInvoiceItems"" (""TenantId"", ""SourceProductId"");

                -- 6. LegacyPayments
                CREATE TABLE IF NOT EXISTS ""{schemaName}"".""LegacyPayments"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""TenantId"" INT NOT NULL,
                    ""LegacyInvoiceId"" INT REFERENCES ""{schemaName}"".""LegacyInvoices""(""Id"") ON DELETE SET NULL,
                    ""SourcePaymentId"" INT NOT NULL,
                    ""SourceSystem"" VARCHAR(50) NOT NULL DEFAULT 'Starplus',
                    ""SourceCustomerId"" INT,
                    ""DestinationCustomerId"" INT,
                    ""Amount"" NUMERIC(18,2) NOT NULL,
                    ""Mode"" VARCHAR(50) NOT NULL,
                    ""Status"" VARCHAR(50) NOT NULL,
                    ""PaymentDate"" TIMESTAMPTZ NOT NULL,
                    ""Reference"" VARCHAR(255),
                    ""MigrationRunId"" VARCHAR(100) NOT NULL,
                    ""CreatedAt"" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT ""UQ_{schemaName}_LegacyPayments_Source"" UNIQUE (""TenantId"", ""SourceSystem"", ""SourcePaymentId"")
                );
                CREATE INDEX IF NOT EXISTS ""IX_{schemaName}_LegacyPayments_Tenant"" ON ""{schemaName}"".""LegacyPayments"" (""TenantId"");
                CREATE INDEX IF NOT EXISTS ""IX_{schemaName}_LegacyPayments_Inv"" ON ""{schemaName}"".""LegacyPayments"" (""LegacyInvoiceId"");
                CREATE INDEX IF NOT EXISTS ""IX_{schemaName}_LegacyPayments_Cust"" ON ""{schemaName}"".""LegacyPayments"" (""TenantId"", ""DestinationCustomerId"");

                -- 7. LegacyCustomerMappings
                CREATE TABLE IF NOT EXISTS ""{schemaName}"".""LegacyCustomerMappings"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""TenantId"" INT NOT NULL,
                    ""SourceCustomerId"" INT NOT NULL,
                    ""SourceCustomerName"" VARCHAR(255) NOT NULL,
                    ""DestinationCustomerId"" INT,
                    ""MatchType"" VARCHAR(50) NOT NULL,
                    ""ApprovalStatus"" VARCHAR(50) NOT NULL DEFAULT 'APPROVED',
                    ""ApprovedAt"" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    ""ApprovedBy"" INT NOT NULL DEFAULT 34,
                    CONSTRAINT ""UQ_{schemaName}_LegacyCustomerMappings_Src"" UNIQUE (""TenantId"", ""SourceCustomerId"")
                );

                -- 8. LegacyOpeningReceivables
                CREATE TABLE IF NOT EXISTS ""{schemaName}"".""LegacyOpeningReceivables"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""TenantId"" INT NOT NULL,
                    ""SourceCustomerId"" INT NOT NULL,
                    ""DestinationCustomerId"" INT,
                    ""SourceSystem"" VARCHAR(50) NOT NULL DEFAULT 'Starplus',
                    ""OpeningBalance"" NUMERIC(18,2) NOT NULL,
                    ""ReconciledInvoicesCount"" INT NOT NULL,
                    ""CutoffDate"" TIMESTAMPTZ NOT NULL,
                    ""ApprovedAt"" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    ""ApprovedBy"" INT NOT NULL DEFAULT 34,
                    ""Notes"" TEXT,
                    CONSTRAINT ""UQ_{schemaName}_LegacyOpeningReceivables"" UNIQUE (""TenantId"", ""SourceCustomerId"", ""SourceSystem"")
                );
                CREATE INDEX IF NOT EXISTS ""IX_{schemaName}_LegacyOpeningReceivables_DestCust"" ON ""{schemaName}"".""LegacyOpeningReceivables"" (""TenantId"", ""DestinationCustomerId"");
            ", conn);

            await cmd.ExecuteNonQueryAsync();

            // Additive migration for schema alignment
            await using (var altCmd = new NpgsqlCommand($@"
                ALTER TABLE ""{schemaName}"".""LegacyInvoices"" ADD COLUMN IF NOT EXISTS ""DueDateSource"" VARCHAR(50);
                ALTER TABLE ""{schemaName}"".""LegacyInvoices"" ADD COLUMN IF NOT EXISTS ""Notes"" TEXT;
            ", conn))
            {
                await altCmd.ExecuteNonQueryAsync();
            }
            Console.WriteLine($"[INFO] Successfully ensured all legacy tables and indexes in schema '{schemaName}'.");
        }

        public static async Task DropRehearsalSchemaAsync(NpgsqlConnection conn, string schemaName)
        {
            if (schemaName == "public") throw new InvalidOperationException("Cannot drop public schema!");
            await using var cmd = new NpgsqlCommand($@"DROP SCHEMA IF EXISTS ""{schemaName}"" CASCADE;", conn);
            await cmd.ExecuteNonQueryAsync();
            Console.WriteLine($"[INFO] Dropped rehearsal schema '{schemaName}'.");
        }
    }
}

