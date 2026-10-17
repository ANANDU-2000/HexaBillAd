using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace HexaBill.Api.Migrations;

/// <summary>
/// Purchase return numbers are per tenant. The global unique index rejected another tenant's same number.
/// </summary>
[DbContext(typeof(AppDbContext))]
[Migration("20261017110000_ScopePurchaseReturnNumberToTenant")]
public class ScopePurchaseReturnNumberToTenant : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_PurchaseReturns_ReturnNo",
            table: "PurchaseReturns");

        migrationBuilder.CreateIndex(
            name: "IX_PurchaseReturns_TenantId_ReturnNo",
            table: "PurchaseReturns",
            columns: new[] { "TenantId", "ReturnNo" },
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_PurchaseReturns_TenantId_ReturnNo",
            table: "PurchaseReturns");

        migrationBuilder.CreateIndex(
            name: "IX_PurchaseReturns_ReturnNo",
            table: "PurchaseReturns",
            column: "ReturnNo",
            unique: true);
    }
}
