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
                // Try to add columns, catch and ignore "column already exists" errors (SQLSTATE 42701)
                migrationBuilder.Sql(@"
                    DO $$ BEGIN
                        ALTER TABLE ""Users"" ADD COLUMN ""SessionVersion"" integer NOT NULL DEFAULT 0;
                    EXCEPTION WHEN SQLSTATE '42701' THEN NULL;
                    END $$");
                
                migrationBuilder.Sql(@"
                    DO $$ BEGIN
                        ALTER TABLE ""Users"" ADD COLUMN ""LastLoginAt"" timestamp with time zone NULL;
                    EXCEPTION WHEN SQLSTATE '42701' THEN NULL;
                    END $$");
                
                migrationBuilder.Sql(@"
                    DO $$ BEGIN
                        ALTER TABLE ""Users"" ADD COLUMN ""LastActiveAt"" timestamp with time zone NULL;
                    EXCEPTION WHEN SQLSTATE '42701' THEN NULL;
                    END $$");
                
                migrationBuilder.Sql(@"
                    DO $$ BEGIN
                        ALTER TABLE ""Customers"" ADD COLUMN ""PaymentTerms"" character varying(100) NULL;
                    EXCEPTION WHEN SQLSTATE '42701' THEN NULL;
                    END $$");
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
