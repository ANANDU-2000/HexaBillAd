using System.Security.Claims;
using System.Text;
using System.Text.Json;
using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Reports;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using OfficeOpenXml;

namespace HexaBill.Tests;

/// <summary>
/// Phase 0 Zayogya compatibility checkpoint for the current management-return API,
/// legacy exports, and local period workflow. The inputs are synthetic and isolated.
/// </summary>
// Serialized: these tests read or set process-wide environment (DATA_PATH, ASPNETCORE_ENVIRONMENT) used by PDF/TRN code.
[Collection("HttpIntegration")]
public sealed class ZayogyaVatManagementGoldenBaselineTests
{
    internal const int ZayogyaTenantId = 60006;
    internal static readonly DateTime PeriodFrom = new(2025, 1, 1);
    internal static readonly DateTime PeriodTo = new(2025, 3, 31);

    [Fact]
    public async Task ZayogyaSyntheticStandardVatReturn_AmountsApiFieldsExportsAndWorkflowStayFrozen()
    {
        await using var context = await CreateFixtureAsync();
        var controller = CreateController(context);

        var get = await controller.GetVatReturn(PeriodFrom, PeriodTo, null, null);
        var getBody = Assert.IsType<ApiResponse<VatReturn201Dto>>(
            Assert.IsType<OkObjectResult>(get.Result).Value);
        Assert.True(getBody.Success);
        var report = Assert.IsType<VatReturn201Dto>(getBody.Data);

        // Hand-calculated fixture: output VAT (50 - 10) - input VAT
        // (20 + 5 - 5) = AED 20 payable.
        Assert.Equal(800m, report.Box1a);
        Assert.Equal(40m, report.Box1b);
        Assert.Equal(2_000m, report.Box2);
        Assert.Equal(0m, report.Box3);
        Assert.Equal(25m, report.Box9b);
        Assert.Equal(5m, report.Box11);
        Assert.Equal(20m, report.Box12);
        Assert.Equal(20m, report.Box13a);
        Assert.Equal(0m, report.Box13b);

        var json = JsonSerializer.SerializeToElement(report, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        var jsonFields = json.EnumerateObject().Select(property => property.Name).ToHashSet(StringComparer.Ordinal);
        var frozenFields = new HashSet<string>([
            "periodLabel", "periodStart", "periodEnd", "dueDate", "status", "vatCalculationBasis",
            "profitSales", "profitCogs", "estimatedCostLineCount", "profitExpenses", "profitAmount",
            "profitVat", "profitVatEstimate", "profitEstimateNotForFiling", "calculatedAt", "periodId",
            "box1a", "box1b", "box2", "box3", "box4", "box9b", "box10", "box11", "box12",
            "box13a", "box13b", "petroleumExcluded", "transactionCount", "purchaseCountInPeriod",
            "expenseCountInPeriod", "purchasesExcludedReasons", "expensesExcludedReasons", "outputLines",
            "inputLines", "creditNoteLines", "reverseChargeLines", "validationIssues"
        ], StringComparer.Ordinal);
        Assert.Subset(jsonFields, frozenFields);
        Assert.Contains("reportKind", jsonFields);
        Assert.Contains("standardOutputVat", jsonFields);
        Assert.Contains("recoverableInputVat", jsonFields);
        Assert.Contains("netVatPayable", jsonFields);

        var csvAction = await controller.ExportVatReturnCsv(PeriodFrom, PeriodTo, null);
        var csv = Assert.IsType<FileContentResult>(csvAction);
        var csvText = Encoding.UTF8.GetString(csv.FileContents);
        Assert.StartsWith("\uFEFFType,Reference,Date,NetAmount,VatAmount,ClaimableVat,VatScenario\r\n", csvText);
        Assert.Contains("Output,ZY-1,2025-01-15,1000,50,,Standard", csvText);
        Assert.Contains("CreditNote,ZY-RET-1,2025-02-15,200,10,Output,", csvText);
        Assert.Contains("Input,ZY-PUR-1,2025-01-15,400,20,20,Standard", csvText);
        Assert.Contains("Input,1,2025-01-15,100,5,5,Standard", csvText);

        var xlsxAction = await controller.ExportVatReturnExcelFta201(PeriodFrom, PeriodTo, null);
        var xlsx = Assert.IsType<FileContentResult>(xlsxAction);
        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        using (var package = new ExcelPackage(new MemoryStream(xlsx.FileContents)))
        {
            var sheet = package.Workbook.Worksheets["FTA 201 Summary"];
            Assert.NotNull(sheet);
            Assert.Equal("FTA Form 201 VAT Return", sheet!.Cells[1, 1].Text);
            Assert.Equal(800m, sheet.Cells[3, 2].GetValue<decimal>());
            Assert.Equal(40m, sheet.Cells[4, 2].GetValue<decimal>());
            Assert.Equal(20m, sheet.Cells[11, 2].GetValue<decimal>());
        }

        var calculate = await controller.CalculateVatReturn(new VatReturnCalculateRequest
        {
            From = PeriodFrom,
            To = PeriodTo
        });
        var calculateBody = Assert.IsType<ApiResponse<VatReturn201Dto>>(
            Assert.IsType<OkObjectResult>(calculate.Result).Value);
        Assert.Equal("Calculated", calculateBody.Data!.Status);
        Assert.Equal(report.Box1a, calculateBody.Data.Box1a);

        var period = await context.VatReturnPeriods.SingleAsync(p => p.TenantId == ZayogyaTenantId);
        context.Settings.Add(new Setting { Key = "COMPANY_TRN", TenantId = ZayogyaTenantId, OwnerId = ZayogyaTenantId, Value = HexaBill.Api.Core.Tenancy.SampleVatTrn.UnitFixture });
        await context.SaveChangesAsync();
        var oldEnvironment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");
        var oldSampleFlag = Environment.GetEnvironmentVariable("HEXABILL_ALLOW_SAMPLE_VAT_TRN");
        try
        {
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Testing");
            Environment.SetEnvironmentVariable("HEXABILL_ALLOW_SAMPLE_VAT_TRN", "true");
            Assert.IsType<OkObjectResult>((await controller.ReviewVatReturnPeriod(period.Id)).Result);
            var lockResult = await controller.LockVatReturnPeriod(period.Id);
            Assert.IsType<OkObjectResult>(lockResult.Result);
            Assert.Equal("Locked", (await context.VatReturnPeriods.SingleAsync(p => p.Id == period.Id)).Status);

            var submitResult = await controller.SubmitVatReturnPeriod(period.Id);
            Assert.IsType<OkObjectResult>(submitResult.Result);
            Assert.Equal("Submitted", (await context.VatReturnPeriods.SingleAsync(p => p.Id == period.Id)).Status);
        }
        finally
        {
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", oldEnvironment);
            Environment.SetEnvironmentVariable("HEXABILL_ALLOW_SAMPLE_VAT_TRN", oldSampleFlag);
        }
    }

    internal static async Task<AppDbContext> CreateFixtureAsync()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("ZayogyaVatGolden_" + Guid.NewGuid())
            .Options;
        var context = new AppDbContext(options);
        context.SetRequestTenantScope(null, isPlatformScope: true);
        await context.Database.EnsureCreatedAsync();

        context.Tenants.Add(new Tenant
        {
            Id = ZayogyaTenantId,
            Name = "Synthetic Zayogya regression",
            Subdomain = "zayogya-vat-golden-test",
            Country = "AE",
            Currency = "AED",
            VatCalculationBasis = VatCalculationBasis.SalesBased
        });
        context.Sales.AddRange(
            new Sale
            {
                TenantId = ZayogyaTenantId, OwnerId = ZayogyaTenantId, InvoiceNo = "ZY-1",
                InvoiceDate = new DateTime(2025, 1, 15, 12, 0, 0, DateTimeKind.Utc),
                Subtotal = 1_000m, VatTotal = 50m, GrandTotal = 1_050m,
                IsDeleted = false, IsZeroInvoice = false, VatScenario = "Standard", CreatedBy = ZayogyaTenantId
            },
            new Sale
            {
                TenantId = ZayogyaTenantId, OwnerId = ZayogyaTenantId, InvoiceNo = "ZY-ZERO-1",
                InvoiceDate = new DateTime(2025, 1, 16, 12, 0, 0, DateTimeKind.Utc),
                Subtotal = 2_000m, VatTotal = 0m, GrandTotal = 2_000m,
                IsDeleted = false, IsZeroInvoice = false, VatScenario = "ZeroRated", CreatedBy = ZayogyaTenantId
            });
        context.SaleReturns.Add(new SaleReturn
        {
            TenantId = ZayogyaTenantId, OwnerId = ZayogyaTenantId, SaleId = 1, ReturnNo = "ZY-RET-1",
            ReturnDate = new DateTime(2025, 2, 15, 12, 0, 0, DateTimeKind.Utc),
            Subtotal = 200m, VatTotal = 10m, GrandTotal = 210m, Status = ReturnStatus.Approved,
            CreatedBy = ZayogyaTenantId
        });
        context.Purchases.Add(new Purchase
        {
            TenantId = ZayogyaTenantId, OwnerId = ZayogyaTenantId, InvoiceNo = "ZY-PUR-1",
            PurchaseDate = new DateTime(2025, 1, 15, 12, 0, 0, DateTimeKind.Utc),
            Subtotal = 400m, VatTotal = 20m, TotalAmount = 420m,
            IsReverseCharge = false, IsTaxClaimable = true
        });
        context.Expenses.Add(new Expense
        {
            TenantId = ZayogyaTenantId, OwnerId = ZayogyaTenantId, CategoryId = 1,
            Date = new DateTime(2025, 1, 15, 12, 0, 0, DateTimeKind.Utc),
            Amount = 100m, TotalAmount = 105m, VatAmount = 5m, ClaimableVat = 5m,
            TaxType = TaxTypes.Standard, IsTaxClaimable = true, Status = ExpenseStatus.Approved
        });
        context.ExpenseCategories.Add(new ExpenseCategory
        {
            Id = 1, TenantId = ZayogyaTenantId, Name = "Synthetic VAT category", CreatedAt = PeriodFrom
        });
        context.PurchaseReturns.Add(new PurchaseReturn
        {
            TenantId = ZayogyaTenantId, OwnerId = ZayogyaTenantId, PurchaseId = 1, ReturnNo = "ZY-PRET-1",
            ReturnDate = new DateTime(2025, 2, 15, 12, 0, 0, DateTimeKind.Utc),
            Subtotal = 100m, VatTotal = 5m, GrandTotal = 105m, Status = ReturnStatus.Approved,
            CreatedBy = ZayogyaTenantId
        });
        await context.SaveChangesAsync();
        context.SetRequestTenantScope(ZayogyaTenantId, isPlatformScope: false);
        return context;
    }

    internal static ReportsController CreateController(AppDbContext context)
    {
        var report = new VatReturnReportService(context, NullLogger<VatReturnReportService>.Instance);
        var controller = new ReportsController(
            null!, report, new VatReturnValidationService(context), context,
            new TimeZoneService(), null!, null!, NullLogger<ReportsController>.Instance)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                    [
                        new Claim("tid", ZayogyaTenantId.ToString()),
                        new Claim(ClaimTypes.NameIdentifier, ZayogyaTenantId.ToString()),
                        new Claim(ClaimTypes.Role, "Owner")
                    ], "test"))
                }
            }
        };
        return controller;
    }
}
