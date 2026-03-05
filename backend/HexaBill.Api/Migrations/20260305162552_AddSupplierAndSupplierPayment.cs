using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HexaBill.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSupplierAndSupplierPayment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ManagerUserId",
                table: "Branches");

            migrationBuilder.AddColumn<string>(
                name: "FeaturesJson",
                table: "Tenants",
                type: "TEXT",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RefundStatus",
                table: "SaleReturns",
                type: "TEXT",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SaleReturnId",
                table: "Payments",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "AppliedAmount",
                table: "CreditNotes",
                type: "TEXT",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.RestartSequence(
                name: "invoice_number_seq",
                startValue: 1L);

            migrationBuilder.CreateTable(
                name: "SupplierPayments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    TenantId = table.Column<int>(type: "INTEGER", nullable: false),
                    SupplierName = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PaymentDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Mode = table.Column<string>(type: "TEXT", nullable: false),
                    Reference = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    Notes = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    CreatedBy = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SupplierPayments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Suppliers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    TenantId = table.Column<int>(type: "INTEGER", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Phone = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    Email = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    Address = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    CreditLimit = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PaymentTerms = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Suppliers", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Payments_SaleReturnId",
                table: "Payments",
                column: "SaleReturnId");

            migrationBuilder.CreateIndex(
                name: "IX_InvoiceTemplates_TenantId",
                table: "InvoiceTemplates",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_CreditNotes_CreatedBy",
                table: "CreditNotes",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_SupplierPayments_TenantId_PaymentDate",
                table: "SupplierPayments",
                columns: new[] { "TenantId", "PaymentDate" });

            migrationBuilder.CreateIndex(
                name: "IX_SupplierPayments_TenantId_SupplierName",
                table: "SupplierPayments",
                columns: new[] { "TenantId", "SupplierName" });

            migrationBuilder.CreateIndex(
                name: "IX_Suppliers_TenantId_Name",
                table: "Suppliers",
                columns: new[] { "TenantId", "Name" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Payments_SaleReturns_SaleReturnId",
                table: "Payments",
                column: "SaleReturnId",
                principalTable: "SaleReturns",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Payments_SaleReturns_SaleReturnId",
                table: "Payments");

            migrationBuilder.DropTable(
                name: "SupplierPayments");

            migrationBuilder.DropTable(
                name: "Suppliers");

            migrationBuilder.DropIndex(
                name: "IX_Payments_SaleReturnId",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_InvoiceTemplates_TenantId",
                table: "InvoiceTemplates");

            migrationBuilder.DropIndex(
                name: "IX_CreditNotes_CreatedBy",
                table: "CreditNotes");

            migrationBuilder.DropColumn(
                name: "FeaturesJson",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "RefundStatus",
                table: "SaleReturns");

            migrationBuilder.DropColumn(
                name: "SaleReturnId",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "AppliedAmount",
                table: "CreditNotes");

            migrationBuilder.AddColumn<int>(
                name: "ManagerUserId",
                table: "Branches",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.RestartSequence(
                name: "invoice_number_seq",
                startValue: 2000L);
        }
    }
}
