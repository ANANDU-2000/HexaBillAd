using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HexaBill.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddVatReturnEngineFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsZeroInvoice",
                table: "Sales",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "VatScenario",
                table: "Sales",
                type: "TEXT",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "VatRate",
                table: "SaleItems",
                type: "decimal(18,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "VatScenario",
                table: "SaleItems",
                type: "TEXT",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsReverseCharge",
                table: "Purchases",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsTaxClaimable",
                table: "Purchases",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "ReverseChargeVat",
                table: "Purchases",
                type: "decimal(18,4)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ClaimableVat",
                table: "Expenses",
                type: "decimal(18,4)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsEntertainment",
                table: "Expenses",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsTaxClaimable",
                table: "Expenses",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "PartialCreditPct",
                table: "Expenses",
                type: "decimal(18,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "TaxType",
                table: "Expenses",
                type: "TEXT",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalAmount",
                table: "Expenses",
                type: "decimal(18,4)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "VatAmount",
                table: "Expenses",
                type: "decimal(18,4)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "VatRate",
                table: "Expenses",
                type: "decimal(18,4)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "RecurringInvoices",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    TenantId = table.Column<int>(type: "INTEGER", nullable: false),
                    CustomerId = table.Column<int>(type: "INTEGER", nullable: false),
                    BranchId = table.Column<int>(type: "INTEGER", nullable: true),
                    RouteId = table.Column<int>(type: "INTEGER", nullable: true),
                    Frequency = table.Column<int>(type: "INTEGER", nullable: false),
                    DayOfRecurrence = table.Column<int>(type: "INTEGER", nullable: true),
                    StartDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    EndDate = table.Column<DateTime>(type: "TEXT", nullable: true),
                    NextRunDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    LastRunDate = table.Column<DateTime>(type: "TEXT", nullable: true),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    Notes = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedBy = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecurringInvoices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RecurringInvoices_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_RecurringInvoices_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RecurringInvoices_Routes_RouteId",
                        column: x => x.RouteId,
                        principalTable: "Routes",
                        principalColumn: "Id");
                });

            if (migrationBuilder.ActiveProvider?.Contains("Npgsql") != true)
            {
                migrationBuilder.CreateTable(
                    name: "SupplierLedgerCredits",
                    columns: table => new
                    {
                        Id = table.Column<int>(type: "INTEGER", nullable: false)
                            .Annotation("Sqlite:Autoincrement", true),
                        TenantId = table.Column<int>(type: "INTEGER", nullable: false),
                        SupplierName = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                        Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                        CreditDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                        CreditType = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                        Notes = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                        CreatedBy = table.Column<int>(type: "INTEGER", nullable: false),
                        CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                    },
                    constraints: table =>
                    {
                        table.PrimaryKey("PK_SupplierLedgerCredits", x => x.Id);
                    });
            }
            else
            {
                migrationBuilder.Sql(@"
CREATE TABLE IF NOT EXISTS ""SupplierLedgerCredits"" (
    ""Id"" SERIAL PRIMARY KEY,
    ""TenantId"" INTEGER NOT NULL,
    ""SupplierName"" VARCHAR(200) NOT NULL,
    ""Amount"" decimal(18,2) NOT NULL,
    ""CreditDate"" TIMESTAMP WITH TIME ZONE NOT NULL,
    ""CreditType"" VARCHAR(50) NOT NULL,
    ""Notes"" VARCHAR(500) NULL,
    ""CreatedBy"" INTEGER NOT NULL,
    ""CreatedAt"" TIMESTAMP WITH TIME ZONE NOT NULL
);");
            }

            migrationBuilder.CreateTable(
                name: "VatReturnPeriods",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    TenantId = table.Column<int>(type: "INTEGER", nullable: false),
                    PeriodType = table.Column<string>(type: "TEXT", maxLength: 10, nullable: false),
                    PeriodLabel = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    PeriodStart = table.Column<DateTime>(type: "TEXT", nullable: false),
                    PeriodEnd = table.Column<DateTime>(type: "TEXT", nullable: false),
                    DueDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", maxLength: 15, nullable: false),
                    Box1a = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    Box1b = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    Box2 = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    Box3 = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    Box4 = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    Box9b = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    Box10 = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    Box11 = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    Box12 = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    Box13a = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    Box13b = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    PetroleumExcluded = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    CalculatedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    SubmittedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    SubmittedByUserId = table.Column<int>(type: "INTEGER", nullable: true),
                    LockedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    LockedByUserId = table.Column<int>(type: "INTEGER", nullable: true),
                    Notes = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VatReturnPeriods", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RecurringInvoiceItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    RecurringInvoiceId = table.Column<int>(type: "INTEGER", nullable: false),
                    ProductId = table.Column<int>(type: "INTEGER", nullable: false),
                    Qty = table.Column<decimal>(type: "TEXT", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "TEXT", nullable: false),
                    UnitType = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecurringInvoiceItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RecurringInvoiceItems_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RecurringInvoiceItems_RecurringInvoices_RecurringInvoiceId",
                        column: x => x.RecurringInvoiceId,
                        principalTable: "RecurringInvoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RecurringInvoiceItems_ProductId",
                table: "RecurringInvoiceItems",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_RecurringInvoiceItems_RecurringInvoiceId",
                table: "RecurringInvoiceItems",
                column: "RecurringInvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_RecurringInvoices_BranchId",
                table: "RecurringInvoices",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_RecurringInvoices_CustomerId",
                table: "RecurringInvoices",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_RecurringInvoices_RouteId",
                table: "RecurringInvoices",
                column: "RouteId");

            if (migrationBuilder.ActiveProvider?.Contains("Npgsql") == true)
            {
                migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS \"IX_SupplierLedgerCredits_CreditDate\" ON \"SupplierLedgerCredits\" (\"CreditDate\");");
                migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS \"IX_SupplierLedgerCredits_TenantId_SupplierName\" ON \"SupplierLedgerCredits\" (\"TenantId\", \"SupplierName\");");
            }
            else
            {
                migrationBuilder.CreateIndex(
                    name: "IX_SupplierLedgerCredits_CreditDate",
                    table: "SupplierLedgerCredits",
                    column: "CreditDate");
                migrationBuilder.CreateIndex(
                    name: "IX_SupplierLedgerCredits_TenantId_SupplierName",
                    table: "SupplierLedgerCredits",
                    columns: new[] { "TenantId", "SupplierName" });
            }

            migrationBuilder.CreateIndex(
                name: "IX_VatReturnPeriods_TenantId",
                table: "VatReturnPeriods",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_VatReturnPeriods_TenantId_PeriodStart_PeriodEnd",
                table: "VatReturnPeriods",
                columns: new[] { "TenantId", "PeriodStart", "PeriodEnd" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RecurringInvoiceItems");

            migrationBuilder.DropTable(
                name: "SupplierLedgerCredits");

            migrationBuilder.DropTable(
                name: "VatReturnPeriods");

            migrationBuilder.DropTable(
                name: "RecurringInvoices");

            migrationBuilder.DropColumn(
                name: "IsZeroInvoice",
                table: "Sales");

            migrationBuilder.DropColumn(
                name: "VatScenario",
                table: "Sales");

            migrationBuilder.DropColumn(
                name: "VatRate",
                table: "SaleItems");

            migrationBuilder.DropColumn(
                name: "VatScenario",
                table: "SaleItems");

            migrationBuilder.DropColumn(
                name: "IsReverseCharge",
                table: "Purchases");

            migrationBuilder.DropColumn(
                name: "IsTaxClaimable",
                table: "Purchases");

            migrationBuilder.DropColumn(
                name: "ReverseChargeVat",
                table: "Purchases");

            migrationBuilder.DropColumn(
                name: "ClaimableVat",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "IsEntertainment",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "IsTaxClaimable",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "PartialCreditPct",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "TaxType",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "TotalAmount",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "VatAmount",
                table: "Expenses");

            migrationBuilder.DropColumn(
                name: "VatRate",
                table: "Expenses");
        }
    }
}
