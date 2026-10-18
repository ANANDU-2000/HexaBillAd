using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace HexaBill.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261018180000_AddTenantAiConsent")]
public sealed class AddTenantAiConsent : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        if (migrationBuilder.ActiveProvider != "Npgsql.EntityFrameworkCore.PostgreSQL") return;
        migrationBuilder.Sql(@"
CREATE TABLE IF NOT EXISTS ""TenantAiConsents"" (
    ""TenantId"" integer NOT NULL,
    ""Enabled"" boolean NOT NULL,
    ""PolicyFingerprint"" character varying(64) NOT NULL,
    ""UpdatedByUserId"" integer NOT NULL,
    ""UpdatedAt"" timestamp with time zone NOT NULL,
    CONSTRAINT ""PK_TenantAiConsents"" PRIMARY KEY (""TenantId"")
);");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        if (migrationBuilder.ActiveProvider != "Npgsql.EntityFrameworkCore.PostgreSQL") return;
        migrationBuilder.Sql("DROP TABLE IF EXISTS \"TenantAiConsents\";");
    }
}
