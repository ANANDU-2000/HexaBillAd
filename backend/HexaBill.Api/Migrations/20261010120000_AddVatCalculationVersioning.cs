using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HexaBill.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261010120000_AddVatCalculationVersioning")]
public partial class AddVatCalculationVersioning : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>("CalculationVersion", "VatReturnPeriods", type: "INTEGER", nullable: false, defaultValue: 0);
        migrationBuilder.AddColumn<string>("SourceFingerprint", "VatReturnPeriods", type: "TEXT", maxLength: 64, nullable: true);
        migrationBuilder.AddColumn<DateTime>("ReviewedAt", "VatReturnPeriods", type: "timestamp with time zone", nullable: true);
        migrationBuilder.AddColumn<int>("ReviewedByUserId", "VatReturnPeriods", type: "INTEGER", nullable: true);
        migrationBuilder.AddColumn<int>("ReviewedCalculationVersion", "VatReturnPeriods", type: "INTEGER", nullable: true);
        migrationBuilder.AddColumn<DateTime>("ReviewInvalidatedAt", "VatReturnPeriods", type: "timestamp with time zone", nullable: true);
        migrationBuilder.AddColumn<string>("ReviewInvalidatedReason", "VatReturnPeriods", type: "TEXT", maxLength: 200, nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        foreach (var column in new[] { "CalculationVersion", "SourceFingerprint", "ReviewedAt", "ReviewedByUserId",
                     "ReviewedCalculationVersion", "ReviewInvalidatedAt", "ReviewInvalidatedReason" })
            migrationBuilder.DropColumn(column, "VatReturnPeriods");
    }
}
