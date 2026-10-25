using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace HexaBill.Api.Migrations;

/// <summary>
/// An issued invoice number belongs to one sale per tenant, deleted or not. The only exemption is deleted rows
/// imported from Starplus (ExternalReference 'starplus:&lt;id&gt;'): Starplus history holds 97 deleted duplicates that
/// keep their original numbers. Pre-check: docs/production/INVOICE-NUMBER-UNIQUENESS-SCAN.sql must be clean.
/// The legacy (OwnerId, InvoiceNo) live-rows index is left in place.
/// </summary>
[DbContext(typeof(AppDbContext))]
[Migration("20261025190000_AddTenantInvoiceNoIssuedUniqueIndex")]
public sealed class AddTenantInvoiceNoIssuedUniqueIndex : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        if (migrationBuilder.ActiveProvider != "Npgsql.EntityFrameworkCore.PostgreSQL") return;
        migrationBuilder.Sql(@"
CREATE UNIQUE INDEX IF NOT EXISTS ""UX_Sales_TenantId_InvoiceNo_Issued""
    ON ""Sales"" (""TenantId"", ""InvoiceNo"")
    WHERE NOT (""IsDeleted"" = true AND ""ExternalReference"" IS NOT NULL AND ""ExternalReference"" LIKE 'starplus:%');");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        if (migrationBuilder.ActiveProvider != "Npgsql.EntityFrameworkCore.PostgreSQL") return;
        migrationBuilder.Sql("DROP INDEX IF EXISTS \"UX_Sales_TenantId_InvoiceNo_Issued\";");
    }
}
