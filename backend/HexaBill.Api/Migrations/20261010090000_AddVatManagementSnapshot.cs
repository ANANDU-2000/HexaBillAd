using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HexaBill.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261010090000_AddVatManagementSnapshot")]
public partial class AddVatManagementSnapshot : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>("SnapshotJson", "VatReturnPeriods", type: "TEXT", nullable: true);
        migrationBuilder.AddColumn<string>("SnapshotHash", "VatReturnPeriods", type: "TEXT", maxLength: 64, nullable: true);
        migrationBuilder.AddColumn<string>("SnapshotHistoryJson", "VatReturnPeriods", type: "TEXT", nullable: true);
        migrationBuilder.AddColumn<int>("SnapshotVersion", "VatReturnPeriods", type: "INTEGER", nullable: false, defaultValue: 0);
        migrationBuilder.AddColumn<DateTime>("SnapshotAt", "VatReturnPeriods", type: "timestamp with time zone", nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn("SnapshotJson", "VatReturnPeriods");
        migrationBuilder.DropColumn("SnapshotHash", "VatReturnPeriods");
        migrationBuilder.DropColumn("SnapshotHistoryJson", "VatReturnPeriods");
        migrationBuilder.DropColumn("SnapshotVersion", "VatReturnPeriods");
        migrationBuilder.DropColumn("SnapshotAt", "VatReturnPeriods");
    }
}
