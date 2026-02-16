using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HexaBill.Api.Migrations
{
    /// <inheritdoc />
    public partial class FixBooleanColumnsType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // PostgreSQL cannot auto-cast integer to boolean (42804). Use explicit USING clause.
            migrationBuilder.Sql(@"
                ALTER TABLE ""Routes"" 
                  ALTER COLUMN ""IsActive"" DROP DEFAULT,
                  ALTER COLUMN ""IsActive"" TYPE boolean USING (CASE WHEN ""IsActive""::int = 0 THEN false ELSE true END),
                  ALTER COLUMN ""IsActive"" SET DEFAULT false;
            ");
            migrationBuilder.Sql(@"
                ALTER TABLE ""Branches"" 
                  ALTER COLUMN ""IsActive"" DROP DEFAULT,
                  ALTER COLUMN ""IsActive"" TYPE boolean USING (CASE WHEN ""IsActive""::int = 0 THEN false ELSE true END),
                  ALTER COLUMN ""IsActive"" SET DEFAULT false;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE ""Routes"" ALTER COLUMN ""IsActive"" TYPE integer USING (CASE WHEN ""IsActive"" THEN 1 ELSE 0 END);
            ");
            migrationBuilder.Sql(@"
                ALTER TABLE ""Branches"" ALTER COLUMN ""IsActive"" TYPE integer USING (CASE WHEN ""IsActive"" THEN 1 ELSE 0 END);
            ");
        }
    }
}
