using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HexaBill.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddExpenseCategoryTenantId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            if (migrationBuilder.ActiveProvider == "Npgsql.EntityFrameworkCore.PostgreSQL")
            {
                // Drop old unique index on Name
                migrationBuilder.Sql(@"DROP INDEX IF EXISTS ""IX_ExpenseCategories_Name"";");
                // Add TenantId column
                migrationBuilder.Sql(@"ALTER TABLE ""ExpenseCategories"" ADD COLUMN IF NOT EXISTS ""TenantId"" integer NULL;");
                // Backfill: set TenantId from first Expense that uses this category
                migrationBuilder.Sql(@"
                    UPDATE ""ExpenseCategories"" ec
                    SET ""TenantId"" = (
                        SELECT e.""TenantId"" FROM ""Expenses"" e
                        WHERE e.""CategoryId"" = ec.""Id"" AND e.""TenantId"" IS NOT NULL
                        LIMIT 1
                    )
                    WHERE ec.""TenantId"" IS NULL AND EXISTS (
                        SELECT 1 FROM ""Expenses"" e2 WHERE e2.""CategoryId"" = ec.""Id""
                    );
                ");
                // For categories with no expenses, assign to first tenant
                migrationBuilder.Sql(@"
                    UPDATE ""ExpenseCategories"" ec
                    SET ""TenantId"" = (SELECT ""Id"" FROM ""Tenants"" ORDER BY ""Id"" ASC LIMIT 1)
                    WHERE ec.""TenantId"" IS NULL;
                ");
                // Create new unique index on (TenantId, Name)
                migrationBuilder.Sql(@"CREATE UNIQUE INDEX IF NOT EXISTS ""IX_ExpenseCategories_TenantId_Name"" ON ""ExpenseCategories"" (""TenantId"", ""Name"");");
            }
            else
            {
                migrationBuilder.DropIndex(
                    name: "IX_ExpenseCategories_Name",
                    table: "ExpenseCategories");
                migrationBuilder.AddColumn<int>(
                    name: "TenantId",
                    table: "ExpenseCategories",
                    type: "INTEGER",
                    nullable: true);
                migrationBuilder.CreateIndex(
                    name: "IX_ExpenseCategories_TenantId_Name",
                    table: "ExpenseCategories",
                    columns: new[] { "TenantId", "Name" },
                    unique: true);
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            if (migrationBuilder.ActiveProvider == "Npgsql.EntityFrameworkCore.PostgreSQL")
            {
                migrationBuilder.Sql(@"DROP INDEX IF EXISTS ""IX_ExpenseCategories_TenantId_Name"";");
                migrationBuilder.Sql(@"ALTER TABLE ""ExpenseCategories"" DROP COLUMN IF EXISTS ""TenantId"";");
                migrationBuilder.Sql(@"CREATE UNIQUE INDEX IF NOT EXISTS ""IX_ExpenseCategories_Name"" ON ""ExpenseCategories"" (""Name"");");
            }
            else
            {
                migrationBuilder.DropIndex(
                    name: "IX_ExpenseCategories_TenantId_Name",
                    table: "ExpenseCategories");
                migrationBuilder.DropColumn(
                    name: "TenantId",
                    table: "ExpenseCategories");
                migrationBuilder.CreateIndex(
                    name: "IX_ExpenseCategories_Name",
                    table: "ExpenseCategories",
                    column: "Name",
                    unique: true);
            }
        }
    }
}
