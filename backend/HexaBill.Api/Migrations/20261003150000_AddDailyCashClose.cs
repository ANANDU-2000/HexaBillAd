using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace HexaBill.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261003150000_AddDailyCashClose")]
public class AddDailyCashClose : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "DailyCashCloses",
            columns: table => new
            {
                Id = table.Column<int>(type: "integer", nullable: false)
                    .Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                TenantId = table.Column<int>(type: "integer", nullable: false),
                OwnerId = table.Column<int>(type: "integer", nullable: false),
                BranchId = table.Column<int>(type: "integer", nullable: true),
                BusinessDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                Version = table.Column<int>(type: "integer", nullable: false),
                Status = table.Column<string>(type: "text", nullable: false),
                OpeningCash = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                CashReceived = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                CashPaidOut = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                ExpectedCash = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                CountedCash = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                Variance = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                VarianceReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                Comment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                ClosedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                ClosedByUserId = table.Column<int>(type: "integer", nullable: true),
                ReopenedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                ReopenReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                CreatedByUserId = table.Column<int>(type: "integer", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_DailyCashCloses", x => x.Id);
            });

        migrationBuilder.CreateIndex(
            name: "IX_DailyCashCloses_TenantId_BusinessDate_BranchId_Version",
            table: "DailyCashCloses",
            columns: new[] { "TenantId", "BusinessDate", "BranchId", "Version" });
    }

    protected override void Down(MigrationBuilder migrationBuilder) =>
        throw new NotSupportedException("Roll back the application while retaining daily close records. Schema removal requires a reviewed data-preservation plan.");
}
