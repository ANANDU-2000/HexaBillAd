using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HexaBill.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerStopLocation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "MainLatitude",
                table: "Customers",
                type: "numeric(9,6)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MainLongitude",
                table: "Customers",
                type: "numeric(9,6)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LocationUpdatedAt",
                table: "Customers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LocationUpdatedBy",
                table: "Customers",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Latitude",
                table: "CustomerVisits",
                type: "numeric(9,6)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Longitude",
                table: "CustomerVisits",
                type: "numeric(9,6)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReachedAt",
                table: "CustomerVisits",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                table: "RouteCustomers",
                type: "integer",
                nullable: true);

            migrationBuilder.Sql("""
                CREATE INDEX IF NOT EXISTS "IX_Customers_TenantId_HasMainPin"
                ON "Customers" ("TenantId")
                WHERE "MainLatitude" IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""DROP INDEX IF EXISTS "IX_Customers_TenantId_HasMainPin";""");

            migrationBuilder.DropColumn(name: "MainLatitude", table: "Customers");
            migrationBuilder.DropColumn(name: "MainLongitude", table: "Customers");
            migrationBuilder.DropColumn(name: "LocationUpdatedAt", table: "Customers");
            migrationBuilder.DropColumn(name: "LocationUpdatedBy", table: "Customers");
            migrationBuilder.DropColumn(name: "Latitude", table: "CustomerVisits");
            migrationBuilder.DropColumn(name: "Longitude", table: "CustomerVisits");
            migrationBuilder.DropColumn(name: "ReachedAt", table: "CustomerVisits");
            migrationBuilder.DropColumn(name: "SortOrder", table: "RouteCustomers");
        }
    }
}
