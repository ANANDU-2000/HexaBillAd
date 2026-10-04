using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace HexaBill.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261003090000_AddPaymentReceiptSnapshot")]
public class AddPaymentReceiptSnapshot : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(name: "SnapshotJson", table: "PaymentReceipts", nullable: true);
        migrationBuilder.CreateIndex(name: "IX_PaymentReceipts_TenantId_PaymentId", table: "PaymentReceipts",
            columns: new[] { "TenantId", "PaymentId" }, unique: true, filter: "\"SnapshotJson\" IS NOT NULL");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Retain captured financial evidence when rolling the application back.
        // The nullable additive column is compatible with the previous application.
        throw new NotSupportedException("Roll back the application while retaining receipt snapshots. Removing this migration requires a separately reviewed data-preservation plan.");
    }
}
