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
            // Use idempotent SQL for PostgreSQL to prevent "column already exists" errors
            if (migrationBuilder.ActiveProvider == "Npgsql.EntityFrameworkCore.PostgreSQL")
            {
                migrationBuilder.Sql(@"
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Users' AND column_name='SessionVersion') THEN
                            ALTER TABLE ""Users"" ADD COLUMN ""SessionVersion"" integer NOT NULL DEFAULT 0;
                        END IF;
                    END $$");
                
                migrationBuilder.Sql(@"
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Customers' AND column_name='PaymentTerms') THEN
                            ALTER TABLE ""Customers"" ADD COLUMN ""PaymentTerms"" character varying(100) NULL;
                        END IF;
                    END $$");
            }
            else
            {
                // SQLite - use standard AddColumn (will be caught by try-catch if exists)
                migrationBuilder.AddColumn<int>(
                    name: "SessionVersion",
                    table: "Users",
                    type: "integer",
                    nullable: false,
                    defaultValue: 0);

                migrationBuilder.AddColumn<string>(
                    name: "PaymentTerms",
                    table: "Customers",
                    type: "character varying(100)",
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
