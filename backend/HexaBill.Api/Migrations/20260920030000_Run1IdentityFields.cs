using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using HexaBill.Api.Data;

#nullable disable

namespace HexaBill.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260920030000_Run1IdentityFields")]
public partial class Run1IdentityFields : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>(
            name: "IsPlatformAdmin",
            table: "Users",
            type: "boolean",
            nullable: false,
            defaultValue: false);

        migrationBuilder.AddColumn<bool>(
            name: "IsActive",
            table: "Users",
            type: "boolean",
            nullable: false,
            defaultValue: true);

        migrationBuilder.Sql("UPDATE \"Users\" SET \"IsPlatformAdmin\" = TRUE WHERE \"TenantId\" IS NULL;");

        migrationBuilder.AddCheckConstraint(
            name: "CK_Users_PlatformTenantIdentity",
            table: "Users",
            sql: "(\"IsPlatformAdmin\" = TRUE AND \"TenantId\" IS NULL) OR (\"IsPlatformAdmin\" = FALSE AND \"TenantId\" IS NOT NULL)");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint("CK_Users_PlatformTenantIdentity", "Users");
        migrationBuilder.DropColumn("IsPlatformAdmin", "Users");
        migrationBuilder.DropColumn("IsActive", "Users");
    }
}
