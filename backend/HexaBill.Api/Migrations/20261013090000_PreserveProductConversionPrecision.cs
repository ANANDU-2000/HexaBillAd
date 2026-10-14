using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace HexaBill.Api.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20261013090000_PreserveProductConversionPrecision")]
public class PreserveProductConversionPrecision : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        if (migrationBuilder.ActiveProvider != "Npgsql.EntityFrameworkCore.PostgreSQL") return;
        // Four decimals match the existing API minimum and product form contract.
        // Existing values retain their meaning; do not rewrite stock or history.
        migrationBuilder.Sql("ALTER TABLE \"Products\" ALTER COLUMN \"ConversionToBase\" TYPE numeric(18,4);");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        if (migrationBuilder.ActiveProvider != "Npgsql.EntityFrameworkCore.PostgreSQL") return;
        // Refuse a lossy rollback when finer conversions have been saved.
        migrationBuilder.Sql("""
            DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM "Products" WHERE "ConversionToBase" <> round("ConversionToBase", 2)) THEN
                    RAISE EXCEPTION 'Cannot reduce product conversion precision without losing data. Keep the expanded schema for application rollback.';
                END IF;
            END $$;
            ALTER TABLE "Products" ALTER COLUMN "ConversionToBase" TYPE numeric(18,2);
            """);
    }
}
