using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace HexaBill.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261003160000_AddDailyCashCloseBankSnapshot")]
public class AddDailyCashCloseBankSnapshot : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<decimal>(
            name: "BankPaidOut",
            table: "DailyCashCloses",
            type: "numeric(18,2)",
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.AddColumn<decimal>(
            name: "BankReceived",
            table: "DailyCashCloses",
            type: "numeric(18,2)",
            nullable: false,
            defaultValue: 0m);

        migrationBuilder.DropIndex(
            name: "IX_DailyCashCloses_TenantId_BusinessDate_BranchId_Version",
            table: "DailyCashCloses");

        migrationBuilder.CreateIndex(
            name: "IX_DailyCashCloses_TenantId_BusinessDate_BranchId_Version",
            table: "DailyCashCloses",
            columns: new[] { "TenantId", "BusinessDate", "BranchId", "Version" },
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder) =>
        throw new NotSupportedException("Roll back the application while retaining daily close records. Schema removal requires a reviewed data-preservation plan.");
}
