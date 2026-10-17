using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace HexaBill.Api.Migrations;

/// <summary>
/// Sale return numbers are issued per tenant per day (RET-yyyyMMdd-NNNN). The original global unique
/// index on SaleReturns.ReturnNo made a second tenant's first return of the day fail with a duplicate key.
/// Existing rows keep their numbers; the new index only relaxes uniqueness across tenants.
/// Down fails if two tenants already share a return number, so run it only on a database without such rows.
/// </summary>
[DbContext(typeof(AppDbContext))]
[Migration("20261017100000_ScopeSaleReturnNumberToTenant")]
public class ScopeSaleReturnNumberToTenant : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_SaleReturns_ReturnNo",
            table: "SaleReturns");

        migrationBuilder.CreateIndex(
            name: "IX_SaleReturns_TenantId_ReturnNo",
            table: "SaleReturns",
            columns: new[] { "TenantId", "ReturnNo" },
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_SaleReturns_TenantId_ReturnNo",
            table: "SaleReturns");

        migrationBuilder.CreateIndex(
            name: "IX_SaleReturns_ReturnNo",
            table: "SaleReturns",
            column: "ReturnNo",
            unique: true);
    }
}
