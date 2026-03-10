using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HexaBill.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddExpenseCategoryVatDefaults : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "DefaultVatRate",
                table: "ExpenseCategories",
                type: "numeric(5,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "DefaultTaxType",
                table: "ExpenseCategories",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Standard");

            migrationBuilder.AddColumn<bool>(
                name: "DefaultIsTaxClaimable",
                table: "ExpenseCategories",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "DefaultIsEntertainment",
                table: "ExpenseCategories",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "VatDefaultLocked",
                table: "ExpenseCategories",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "DefaultVatRate", table: "ExpenseCategories");
            migrationBuilder.DropColumn(name: "DefaultTaxType", table: "ExpenseCategories");
            migrationBuilder.DropColumn(name: "DefaultIsTaxClaimable", table: "ExpenseCategories");
            migrationBuilder.DropColumn(name: "DefaultIsEntertainment", table: "ExpenseCategories");
            migrationBuilder.DropColumn(name: "VatDefaultLocked", table: "ExpenseCategories");
        }
    }
}
