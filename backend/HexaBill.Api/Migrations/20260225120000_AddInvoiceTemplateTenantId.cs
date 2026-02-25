using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HexaBill.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddInvoiceTemplateTenantId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            if (migrationBuilder.ActiveProvider == "Npgsql.EntityFrameworkCore.PostgreSQL")
            {
                migrationBuilder.Sql(@"ALTER TABLE ""InvoiceTemplates"" ADD COLUMN IF NOT EXISTS ""TenantId"" integer NULL;");
                migrationBuilder.Sql(@"CREATE INDEX IF NOT EXISTS ""IX_InvoiceTemplates_TenantId"" ON ""InvoiceTemplates"" (""TenantId"");");
                // Backfill: assign TenantId from CreatedBy user's TenantId or OwnerId
                migrationBuilder.Sql(@"
                    UPDATE ""InvoiceTemplates"" t
                    SET ""TenantId"" = COALESCE(
                        (SELECT u.""TenantId"" FROM ""Users"" u WHERE u.""Id"" = t.""CreatedBy"" LIMIT 1),
                        (SELECT u.""OwnerId"" FROM ""Users"" u WHERE u.""Id"" = t.""CreatedBy"" AND u.""OwnerId"" IS NOT NULL AND u.""OwnerId"" > 0 LIMIT 1),
                        (SELECT ""Id"" FROM ""Tenants"" ORDER BY ""Id"" ASC LIMIT 1)
                    )
                    WHERE t.""TenantId"" IS NULL;
                ");
            }
            else
            {
                migrationBuilder.AddColumn<int>(
                    name: "TenantId",
                    table: "InvoiceTemplates",
                    type: "INTEGER",
                    nullable: true);
                migrationBuilder.CreateIndex(
                    name: "IX_InvoiceTemplates_TenantId",
                    table: "InvoiceTemplates",
                    column: "TenantId");
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_InvoiceTemplates_TenantId",
                table: "InvoiceTemplates");
            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "InvoiceTemplates");
        }
    }
}
