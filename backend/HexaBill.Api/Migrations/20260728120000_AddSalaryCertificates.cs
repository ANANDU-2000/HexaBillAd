using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HexaBill.Api.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(HexaBill.Api.Data.AppDbContext))]
    [Migration("20260728120000_AddSalaryCertificates")]
    public partial class AddSalaryCertificates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SalaryCertificates",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    OwnerId = table.Column<int>(type: "INTEGER", nullable: false),
                    TenantId = table.Column<int>(type: "INTEGER", nullable: true),
                    CertificateNo = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    CertificateDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Recipient = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    EmployeeName = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    PassportNumber = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    EmployeeNationality = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    JoiningDate = table.Column<DateTime>(type: "TEXT", nullable: true),
                    Designation = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    MonthlySalary = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    MonthlySalaryWords = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    EmployeePhone = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    SignatoryName = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    SignatoryTitle = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Status = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    Notes = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedBy = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    LastModifiedBy = table.Column<int>(type: "INTEGER", nullable: true),
                    LastModifiedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    IsDeleted = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false),
                    DeletedBy = table.Column<int>(type: "INTEGER", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalaryCertificates", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SalaryCertificates_TenantId",
                table: "SalaryCertificates",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_SalaryCertificates_TenantId_CertificateNo",
                table: "SalaryCertificates",
                columns: new[] { "TenantId", "CertificateNo" },
                unique: true,
                filter: "\"IsDeleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "SalaryCertificates");
        }
    }
}
