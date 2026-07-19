using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HexaBill.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddQuotationLetterFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Salutation",
                table: "Quotations",
                type: "TEXT",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IntroLine",
                table: "Quotations",
                type: "TEXT",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ClosingLine",
                table: "Quotations",
                type: "TEXT",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DescriptionSubtitle",
                table: "QuotationItems",
                type: "TEXT",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "Salutation", table: "Quotations");
            migrationBuilder.DropColumn(name: "IntroLine", table: "Quotations");
            migrationBuilder.DropColumn(name: "ClosingLine", table: "Quotations");
            migrationBuilder.DropColumn(name: "DescriptionSubtitle", table: "QuotationItems");
        }
    }
}
