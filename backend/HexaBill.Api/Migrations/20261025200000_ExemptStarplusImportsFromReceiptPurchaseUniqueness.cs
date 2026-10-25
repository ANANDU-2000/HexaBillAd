using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace HexaBill.Api.Migrations;

/// <summary>
/// Owner decision 2026-10-25: Starplus receipts and purchases keep their original numbers, so imported rows are
/// exempt from the per-tenant number uniqueness. Every non-imported row stays unique exactly as before.
/// Markers (written only by tools/migration/starplus_import.py):
///   Purchases.ExternalReference LIKE 'starplus:%'
///   PaymentReceipts.SnapshotJson LIKE '{"marker": "starplus:%'
/// Index names are kept unchanged because the importer verifies them by name (pg_indexes) before it runs.
/// Down re-creates the original unpartitioned indexes and fails if imported duplicates still exist; roll the
/// import back first.
/// </summary>
[DbContext(typeof(AppDbContext))]
[Migration("20261025200000_ExemptStarplusImportsFromReceiptPurchaseUniqueness")]
public sealed class ExemptStarplusImportsFromReceiptPurchaseUniqueness : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        if (migrationBuilder.ActiveProvider != "Npgsql.EntityFrameworkCore.PostgreSQL") return;
        migrationBuilder.Sql(@"
DROP INDEX IF EXISTS ""IX_Purchases_OwnerId_InvoiceNo"";
CREATE UNIQUE INDEX ""IX_Purchases_OwnerId_InvoiceNo"" ON ""Purchases"" (""OwnerId"", ""InvoiceNo"")
    WHERE COALESCE(""ExternalReference"", '') NOT LIKE 'starplus:%';
DROP INDEX IF EXISTS ""IX_PaymentReceipts_TenantId_ReceiptNumber"";
CREATE UNIQUE INDEX ""IX_PaymentReceipts_TenantId_ReceiptNumber"" ON ""PaymentReceipts"" (""TenantId"", ""ReceiptNumber"")
    WHERE COALESCE(""SnapshotJson"", '') NOT LIKE '{""marker"": ""starplus:%';
DROP INDEX IF EXISTS ""IX_PaymentReceipts_TenantId_PaymentId"";
CREATE UNIQUE INDEX ""IX_PaymentReceipts_TenantId_PaymentId"" ON ""PaymentReceipts"" (""TenantId"", ""PaymentId"")
    WHERE ""SnapshotJson"" IS NOT NULL AND ""SnapshotJson"" NOT LIKE '{""marker"": ""starplus:%';");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        if (migrationBuilder.ActiveProvider != "Npgsql.EntityFrameworkCore.PostgreSQL") return;
        migrationBuilder.Sql(@"
DROP INDEX IF EXISTS ""IX_Purchases_OwnerId_InvoiceNo"";
CREATE UNIQUE INDEX ""IX_Purchases_OwnerId_InvoiceNo"" ON ""Purchases"" (""OwnerId"", ""InvoiceNo"");
DROP INDEX IF EXISTS ""IX_PaymentReceipts_TenantId_ReceiptNumber"";
CREATE UNIQUE INDEX ""IX_PaymentReceipts_TenantId_ReceiptNumber"" ON ""PaymentReceipts"" (""TenantId"", ""ReceiptNumber"");
DROP INDEX IF EXISTS ""IX_PaymentReceipts_TenantId_PaymentId"";
CREATE UNIQUE INDEX ""IX_PaymentReceipts_TenantId_PaymentId"" ON ""PaymentReceipts"" (""TenantId"", ""PaymentId"")
    WHERE ""SnapshotJson"" IS NOT NULL;");
    }
}
