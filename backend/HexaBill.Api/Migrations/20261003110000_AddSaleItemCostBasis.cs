using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace HexaBill.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261003110000_AddSaleItemCostBasis")]
public class AddSaleItemCostBasis : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<decimal>(name: "UnitCostAtSale", table: "SaleItems", type: "decimal(18,6)", nullable: true);
        migrationBuilder.AddColumn<decimal>(name: "ConversionAtSale", table: "SaleItems", type: "decimal(18,6)", nullable: true);
        migrationBuilder.AddColumn<DateTime>(name: "CostCapturedAt", table: "SaleItems", nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder) =>
        throw new NotSupportedException("Roll back the application while retaining invoice cost evidence. Schema removal requires a reviewed data-preservation plan.");
}
