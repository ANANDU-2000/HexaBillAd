using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HexaBill.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDamageCategoriesAndReturnExtensions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BranchId",
                table: "SaleReturns",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReturnType",
                table: "SaleReturns",
                type: "TEXT",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RouteId",
                table: "SaleReturns",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DamageCategoryId",
                table: "SaleReturnItems",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "StockEffect",
                table: "SaleReturnItems",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RouteId",
                table: "Expenses",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ResolvedAt",
                table: "ErrorLogs",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "DamageCategories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    TenantId = table.Column<int>(type: "INTEGER", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    AffectsStock = table.Column<bool>(type: "INTEGER", nullable: false),
                    AffectsLedger = table.Column<bool>(type: "INTEGER", nullable: false),
                    IsResaleable = table.Column<bool>(type: "INTEGER", nullable: false),
                    SortOrder = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DamageCategories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DamageCategories_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FailedLoginAttempts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Email = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    FailedCount = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 1),
                    LockoutUntil = table.Column<DateTime>(type: "TEXT", nullable: true),
                    LastAttemptAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FailedLoginAttempts", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SaleReturns_BranchId",
                table: "SaleReturns",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_SaleReturns_ReturnDate",
                table: "SaleReturns",
                column: "ReturnDate");

            migrationBuilder.CreateIndex(
                name: "IX_SaleReturns_RouteId",
                table: "SaleReturns",
                column: "RouteId");

            migrationBuilder.CreateIndex(
                name: "IX_SaleReturns_TenantId_ReturnDate",
                table: "SaleReturns",
                columns: new[] { "TenantId", "ReturnDate" });

            migrationBuilder.CreateIndex(
                name: "IX_SaleReturnItems_DamageCategoryId",
                table: "SaleReturnItems",
                column: "DamageCategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_RouteId",
                table: "Expenses",
                column: "RouteId");

            migrationBuilder.CreateIndex(
                name: "IX_ErrorLogs_ResolvedAt",
                table: "ErrorLogs",
                column: "ResolvedAt");

            migrationBuilder.CreateIndex(
                name: "IX_DamageCategories_TenantId",
                table: "DamageCategories",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_FailedLoginAttempts_Email",
                table: "FailedLoginAttempts",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FailedLoginAttempts_LastAttemptAt",
                table: "FailedLoginAttempts",
                column: "LastAttemptAt");

            migrationBuilder.CreateIndex(
                name: "IX_FailedLoginAttempts_LockoutUntil",
                table: "FailedLoginAttempts",
                column: "LockoutUntil");

            migrationBuilder.AddForeignKey(
                name: "FK_Expenses_Routes_RouteId",
                table: "Expenses",
                column: "RouteId",
                principalTable: "Routes",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_SaleReturnItems_DamageCategories_DamageCategoryId",
                table: "SaleReturnItems",
                column: "DamageCategoryId",
                principalTable: "DamageCategories",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SaleReturns_Branches_BranchId",
                table: "SaleReturns",
                column: "BranchId",
                principalTable: "Branches",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SaleReturns_Routes_RouteId",
                table: "SaleReturns",
                column: "RouteId",
                principalTable: "Routes",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Expenses_Routes_RouteId",
                table: "Expenses");

            migrationBuilder.DropForeignKey(
                name: "FK_SaleReturnItems_DamageCategories_DamageCategoryId",
                table: "SaleReturnItems");

            migrationBuilder.DropForeignKey(
                name: "FK_SaleReturns_Branches_BranchId",
                table: "SaleReturns");

            migrationBuilder.DropForeignKey(
                name: "FK_SaleReturns_Routes_RouteId",
                table: "SaleReturns");

            migrationBuilder.DropTable(
                name: "DamageCategories");

            migrationBuilder.DropTable(
                name: "FailedLoginAttempts");

            migrationBuilder.DropIndex(
                name: "IX_SaleReturns_BranchId",
                table: "SaleReturns");

            migrationBuilder.DropIndex(
                name: "IX_SaleReturns_ReturnDate",
                table: "SaleReturns");

            migrationBuilder.DropIndex(
                name: "IX_SaleReturns_RouteId",
                table: "SaleReturns");

            migrationBuilder.DropIndex(
                name: "IX_SaleReturns_TenantId_ReturnDate",
                table: "SaleReturns");

            migrationBuilder.DropIndex(
                name: "IX_SaleReturnItems_DamageCategoryId",
                table: "SaleReturnItems");

            migrationBuilder.DropIndex(
                name: "IX_Expenses_RouteId",
                table: "Expenses");

            migrationBuilder.DropIndex(
                name: "IX_ErrorLogs_ResolvedAt",
                table: "ErrorLogs");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "SaleReturns");

            migrationBuilder.DropColumn(
                name: "ReturnType",
                table: "SaleReturns");

            migrationBuilder.DropColumn(
                name: "RouteId",
                table: "SaleReturns");

            migrationBuilder.DropColumn(
                name: "DamageCategoryId",
                table: "SaleReturnItems");

            migrationBuilder.DropColumn(
                name: "StockEffect",
                table: "SaleReturnItems");

            migrationBuilder.DropColumn(
                name: "RouteId",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "ResolvedAt",
                table: "ErrorLogs");
        }
    }
}
