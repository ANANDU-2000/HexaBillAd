using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HexaBill.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUserSessionVersion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Use PostgreSQL native IF NOT EXISTS syntax (PostgreSQL 9.6+)
            if (migrationBuilder.ActiveProvider == "Npgsql.EntityFrameworkCore.PostgreSQL")
            {
                // PostgreSQL 9.6+ supports ADD COLUMN IF NOT EXISTS natively
                migrationBuilder.Sql(@"ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""SessionVersion"" integer NOT NULL DEFAULT 0;");
                migrationBuilder.Sql(@"ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""LastLoginAt"" timestamp with time zone NULL;");
                migrationBuilder.Sql(@"ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""LastActiveAt"" timestamp with time zone NULL;");
                migrationBuilder.Sql(@"ALTER TABLE ""Customers"" ADD COLUMN IF NOT EXISTS ""PaymentTerms"" character varying(100) NULL;");
            }
            else
            {
                // SQLite - use standard AddColumn (will be caught by try-catch if exists)
                migrationBuilder.AddColumn<int>(
                    name: "SessionVersion",
                    table: "Users",
                    type: "INTEGER",
                    nullable: false,
                    defaultValue: 0);

                migrationBuilder.AddColumn<DateTime>(
                    name: "LastLoginAt",
                    table: "Users",
                    type: "TEXT",
                    nullable: true);

                migrationBuilder.AddColumn<DateTime>(
                    name: "LastActiveAt",
                    table: "Users",
                    type: "TEXT",
                    nullable: true);

                migrationBuilder.AddColumn<string>(
                    name: "PaymentTerms",
                    table: "Customers",
                    type: "TEXT",
                    maxLength: 100,
                    nullable: true);
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SessionVersion",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PaymentTerms",
                table: "Customers");
        }
    }
}
