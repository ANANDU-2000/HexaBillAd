using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace HexaBill.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261003180000_AddCashDrawerMovement")]
public class AddCashDrawerMovement : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "CashDrawerMovements",
            columns: table => new
            {
                Id = table.Column<int>(type: "integer", nullable: false)
                    .Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                TenantId = table.Column<int>(type: "integer", nullable: false),
                OwnerId = table.Column<int>(type: "integer", nullable: false),
                BranchId = table.Column<int>(type: "integer", nullable: true),
                MovementDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                Kind = table.Column<int>(type: "integer", nullable: false),
                Amount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                CreatedByUserId = table.Column<int>(type: "integer", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_CashDrawerMovements", x => x.Id);
            });

        migrationBuilder.CreateIndex(
            name: "IX_CashDrawerMovements_TenantId_MovementDate",
            table: "CashDrawerMovements",
            columns: new[] { "TenantId", "MovementDate" });
    }

    protected override void Down(MigrationBuilder migrationBuilder) =>
        throw new NotSupportedException("Roll back the application while retaining cash drawer movement evidence. Schema removal requires a reviewed data-preservation plan.");
}
