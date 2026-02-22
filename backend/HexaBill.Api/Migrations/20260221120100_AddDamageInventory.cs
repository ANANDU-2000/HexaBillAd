using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HexaBill.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDamageInventory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DamageInventories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    TenantId = table.Column<int>(type: "INTEGER", nullable: false),
                    ProductId = table.Column<int>(type: "INTEGER", nullable: false),
                    BranchId = table.Column<int>(type: "INTEGER", nullable: true),
                    Quantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    SourceReturnId = table.Column<int>(type: "INTEGER", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DamageInventories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DamageInventories_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_DamageInventories_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DamageInventories_SaleReturns_SourceReturnId",
                        column: x => x.SourceReturnId,
                        principalTable: "SaleReturns",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_DamageInventories_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DamageInventories_BranchId",
                table: "DamageInventories",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_DamageInventories_ProductId",
                table: "DamageInventories",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_DamageInventories_SourceReturnId",
                table: "DamageInventories",
                column: "SourceReturnId");

            migrationBuilder.CreateIndex(
                name: "IX_DamageInventories_TenantId_ProductId_BranchId",
                table: "DamageInventories",
                columns: new[] { "TenantId", "ProductId", "BranchId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DamageInventories");
        }
    }
}
