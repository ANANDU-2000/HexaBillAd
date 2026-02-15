using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HexaBill.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMissingTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BranchId",
                table: "Expenses",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "BranchStaff",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    BranchId = table.Column<int>(type: "INTEGER", nullable: false),
                    UserId = table.Column<int>(type: "INTEGER", nullable: false),
                    AssignedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BranchStaff", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BranchStaff_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BranchStaff_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_BranchId",
                table: "Expenses",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_BranchStaff_BranchId_UserId",
                table: "BranchStaff",
                columns: new[] { "BranchId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BranchStaff_UserId",
                table: "BranchStaff",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Expenses_Branches_BranchId",
                table: "Expenses",
                column: "BranchId",
                principalTable: "Branches",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Expenses_Branches_BranchId",
                table: "Expenses");

            migrationBuilder.DropTable(
                name: "BranchStaff");

            migrationBuilder.DropIndex(
                name: "IX_Expenses_BranchId",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "Expenses");
        }
    }
}
