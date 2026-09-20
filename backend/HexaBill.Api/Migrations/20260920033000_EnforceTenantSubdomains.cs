using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using HexaBill.Api.Data;

#nullable disable

namespace HexaBill.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260920033000_EnforceTenantSubdomains")]
public partial class EnforceTenantSubdomains : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("UPDATE \"Tenants\" SET \"Subdomain\" = 'tenant-' || \"Id\" WHERE \"Subdomain\" IS NULL OR trim(\"Subdomain\") = '';");

        migrationBuilder.DropIndex(
            name: "IX_Tenants_Subdomain",
            table: "Tenants");

        migrationBuilder.AlterColumn<string>(
            name: "Subdomain",
            table: "Tenants",
            type: "TEXT",
            maxLength: 30,
            nullable: false,
            oldClrType: typeof(string),
            oldType: "TEXT",
            oldMaxLength: 100,
            oldNullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_Tenants_Subdomain",
            table: "Tenants",
            column: "Subdomain",
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex("IX_Tenants_Subdomain", "Tenants");
        migrationBuilder.AlterColumn<string>(
            name: "Subdomain",
            table: "Tenants",
            type: "TEXT",
            maxLength: 100,
            nullable: true,
            oldClrType: typeof(string),
            oldType: "TEXT",
            oldMaxLength: 30);
        migrationBuilder.CreateIndex(
            name: "IX_Tenants_Subdomain",
            table: "Tenants",
            column: "Subdomain",
            unique: true,
            filter: "\"Subdomain\" IS NOT NULL");
    }
}
