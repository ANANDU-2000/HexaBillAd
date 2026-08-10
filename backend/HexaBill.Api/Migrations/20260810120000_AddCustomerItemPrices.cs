using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace HexaBill.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerItemPrices : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CustomerItemPrices",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TenantId = table.Column<int>(type: "integer", nullable: false),
                    CustomerId = table.Column<int>(type: "integer", nullable: false),
                    ProductId = table.Column<int>(type: "integer", nullable: false),
                    LastUnitPrice = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    LastSaleId = table.Column<int>(type: "integer", nullable: true),
                    LastSaleDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomerItemPrices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CustomerItemPrices_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CustomerItemPrices_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CustomerItemPrices_Sales_LastSaleId",
                        column: x => x.LastSaleId,
                        principalTable: "Sales",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CustomerItemPrices_CustomerId",
                table: "CustomerItemPrices",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerItemPrices_LastSaleId",
                table: "CustomerItemPrices",
                column: "LastSaleId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerItemPrices_ProductId",
                table: "CustomerItemPrices",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerItemPrices_TenantId_CustomerId_ProductId",
                table: "CustomerItemPrices",
                columns: new[] { "TenantId", "CustomerId", "ProductId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "CustomerItemPrices");
        }
    }
}
