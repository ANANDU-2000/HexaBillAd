using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace HexaBill.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261003190000_AddPaymentParentPaymentId")]
public class AddPaymentParentPaymentId : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "ParentPaymentId",
            table: "Payments",
            type: "integer",
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_Payments_ParentPaymentId",
            table: "Payments",
            column: "ParentPaymentId");
    }

    protected override void Down(MigrationBuilder migrationBuilder) =>
        throw new NotSupportedException("Roll back the application while retaining settlement parent links. Schema removal requires a reviewed data-preservation plan.");
}
