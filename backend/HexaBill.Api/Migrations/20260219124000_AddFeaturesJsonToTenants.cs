using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HexaBill.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFeaturesJsonToTenants : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Use PostgreSQL native IF NOT EXISTS syntax (PostgreSQL 9.6+)
            if (migrationBuilder.ActiveProvider == "Npgsql.EntityFrameworkCore.PostgreSQL")
            {
                migrationBuilder.Sql(@"ALTER TABLE ""Tenants"" ADD COLUMN IF NOT EXISTS ""FeaturesJson"" character varying(2000) NULL;");
            }
            else
            {
                // SQLite - use standard AddColumn (will be caught by try-catch if exists)
                migrationBuilder.AddColumn<string>(
                    name: "FeaturesJson",
                    table: "Tenants",
                    type: "TEXT",
                    maxLength: 2000,
                    nullable: true);
            }
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FeaturesJson",
                table: "Tenants");
        }
    }
}
