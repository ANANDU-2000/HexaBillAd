using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace HexaBill.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261003120000_AddPurchaseItemConversionAtPurchase")]
public class AddPurchaseItemConversionAtPurchase : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<decimal>(
            name: "ConversionAtPurchase",
            table: "PurchaseItems",
            type: "decimal(18,6)",
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder) =>
        throw new NotSupportedException("Roll back the application while retaining purchase conversion evidence. Schema removal requires a reviewed data-preservation plan.");
}
