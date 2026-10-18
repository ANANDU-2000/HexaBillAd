using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace HexaBill.Api.Migrations;

/// <summary>
/// Align legacy unset ownership metadata with the authenticated-tenant create/import contract.
/// Never changes TenantId, existing nonzero OwnerId, or financial/customer fields.
/// Production rollback must use the verified pre-migration backup, not guess prior values.
/// </summary>
[DbContext(typeof(AppDbContext))]
[Migration("20261018130000_BackfillCustomerOwnerId")]
public class BackfillCustomerOwnerId : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        if (migrationBuilder.ActiveProvider != "Npgsql.EntityFrameworkCore.PostgreSQL") return;
        migrationBuilder.Sql("""
            DO $$ BEGIN
                IF EXISTS (
                    SELECT 1 FROM "Customers" c
                    WHERE c."OwnerId" = 0 AND
                        (c."TenantId" IS NULL OR c."TenantId" <= 0 OR
                         NOT EXISTS (SELECT 1 FROM "Tenants" t WHERE t."Id" = c."TenantId"))
                ) THEN
                    RAISE EXCEPTION 'Customer ownership backfill refused: unset owner has no verified tenant';
                END IF;
            END $$;
            UPDATE "Customers" SET "OwnerId" = "TenantId" WHERE "OwnerId" = 0;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Intentionally preserve corrected metadata. Use the protected pre-state for a reviewed targeted rollback.
    }
}
