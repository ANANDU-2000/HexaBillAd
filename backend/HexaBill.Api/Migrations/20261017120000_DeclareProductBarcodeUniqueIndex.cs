using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace HexaBill.Api.Migrations;

/// <summary>
/// Declares IX_Products_TenantId_Barcode in migrations. Live already has this unique partial index, which
/// was created outside the migrations. IF NOT EXISTS makes Up a no-op there. Up fails only if duplicate
/// (TenantId, Barcode) pairs exist, which the live index already prevents.
/// Do not run Down on live data casually: it drops the constraint that the create path relies on.
/// </summary>
[DbContext(typeof(AppDbContext))]
[Migration("20261017120000_DeclareProductBarcodeUniqueIndex")]
public class DeclareProductBarcodeUniqueIndex : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("CREATE UNIQUE INDEX IF NOT EXISTS \"IX_Products_TenantId_Barcode\" ON \"Products\" (\"TenantId\", \"Barcode\") WHERE \"Barcode\" IS NOT NULL;");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DROP INDEX IF EXISTS \"IX_Products_TenantId_Barcode\";");
    }
}
