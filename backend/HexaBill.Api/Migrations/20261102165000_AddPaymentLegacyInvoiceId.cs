using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HexaBill.Api.Migrations
{
    /// <summary>
    /// FrozenHub 1 / Starplus continuity — adds LegacyInvoiceId to Payments so payments
    /// collected against historical Starplus invoices reference the correct LegacyInvoices row
    /// rather than (incorrectly) pointing at a Sales row via SaleId.
    ///
    /// Design decisions:
    ///   • Column is nullable: existing payments are unchanged; new history payments set this.
    ///   • No FK constraint enforced at DB level (Restrict delete) — historical rows are immutable.
    ///   • An index is added for the customer-ledger and reconciliation queries.
    ///   • Raw SQL is used (no EF snapshot update needed) so Render's no-MigrateAsync guard is safe.
    /// </summary>
    [global::Microsoft.EntityFrameworkCore.Infrastructure.DbContext(typeof(HexaBill.Api.Data.AppDbContext))]
    [Migration("20261102165000_AddPaymentLegacyInvoiceId")]
    public sealed class AddPaymentLegacyInvoiceId : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            if (migrationBuilder.ActiveProvider != "Npgsql.EntityFrameworkCore.PostgreSQL") return;

            migrationBuilder.Sql(@"
-- FROZENHUB 1 / STARPLUS CONTINUITY: Safe column add – idempotent.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_name = 'Payments' AND column_name = 'LegacyInvoiceId'
    ) THEN
        ALTER TABLE ""Payments"" ADD COLUMN ""LegacyInvoiceId"" integer NULL
            REFERENCES ""LegacyInvoices""(""Id"") ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ""IX_Payments_LegacyInvoiceId""
            ON ""Payments"" (""LegacyInvoiceId"")
            WHERE ""LegacyInvoiceId"" IS NOT NULL;
        RAISE NOTICE 'AddPaymentLegacyInvoiceId: column and index created.';
    ELSE
        RAISE NOTICE 'AddPaymentLegacyInvoiceId: column already exists – skipped.';
    END IF;
END
$$;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            if (migrationBuilder.ActiveProvider != "Npgsql.EntityFrameworkCore.PostgreSQL") return;

            migrationBuilder.Sql(@"
DROP INDEX IF EXISTS ""IX_Payments_LegacyInvoiceId"";
ALTER TABLE ""Payments"" DROP COLUMN IF EXISTS ""LegacyInvoiceId"";
");
        }
    }
}
