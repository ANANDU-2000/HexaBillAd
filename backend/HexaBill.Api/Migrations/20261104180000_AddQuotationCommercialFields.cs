using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HexaBill.Api.Migrations
{
    /// <summary>
    /// Quotation commercial fields: ValidUntil, CustomerTrn, Subject, TermsAndConditions.
    /// Raw idempotent SQL (no snapshot update) so it is safe where migrations are applied outside startup.
    /// </summary>
    [global::Microsoft.EntityFrameworkCore.Infrastructure.DbContext(typeof(HexaBill.Api.Data.AppDbContext))]
    [Migration("20261104180000_AddQuotationCommercialFields")]
    public sealed class AddQuotationCommercialFields : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            if (migrationBuilder.ActiveProvider != "Npgsql.EntityFrameworkCore.PostgreSQL") return;
            migrationBuilder.Sql(@"
ALTER TABLE ""Quotations"" ADD COLUMN IF NOT EXISTS ""ValidUntil"" timestamp with time zone NULL;
ALTER TABLE ""Quotations"" ADD COLUMN IF NOT EXISTS ""CustomerTrn"" character varying(50) NULL;
ALTER TABLE ""Quotations"" ADD COLUMN IF NOT EXISTS ""Subject"" character varying(300) NULL;
ALTER TABLE ""Quotations"" ADD COLUMN IF NOT EXISTS ""TermsAndConditions"" text NULL;");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            if (migrationBuilder.ActiveProvider != "Npgsql.EntityFrameworkCore.PostgreSQL") return;
            migrationBuilder.Sql(@"
ALTER TABLE ""Quotations"" DROP COLUMN IF EXISTS ""ValidUntil"";
ALTER TABLE ""Quotations"" DROP COLUMN IF EXISTS ""CustomerTrn"";
ALTER TABLE ""Quotations"" DROP COLUMN IF EXISTS ""Subject"";
ALTER TABLE ""Quotations"" DROP COLUMN IF EXISTS ""TermsAndConditions"";");
        }
    }
}
