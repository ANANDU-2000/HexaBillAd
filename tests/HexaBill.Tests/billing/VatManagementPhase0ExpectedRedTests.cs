using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Reports;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using UglyToad.PdfPig;

namespace HexaBill.Tests;

/// <summary>Expected-red regressions for the VAT management report build, assigned to owning phases.</summary>
public sealed class VatManagementPhase0ExpectedRedTests
{
    [Fact(DisplayName = "VATMGMT_F02_ProfitUsesNetSalesApprovedExpensesAndPostedReturns")]
    public async Task ProfitUsesNetSalesApprovedExpensesAndPostedReturns()
    {
        await using var context = await ZayogyaVatManagementGoldenBaselineTests.CreateFixtureAsync();
        var tenant = await context.Tenants.SingleAsync(t => t.Id == ZayogyaVatManagementGoldenBaselineTests.ZayogyaTenantId);
        tenant.VatCalculationBasis = VatCalculationBasis.ProfitBased;
        context.Expenses.Add(new Expense
        {
            TenantId = tenant.Id, OwnerId = tenant.Id, CategoryId = 1, Amount = 900m,
            Date = new DateTime(2025, 2, 1, 12, 0, 0, DateTimeKind.Utc),
            Status = ExpenseStatus.Pending, IsTaxClaimable = true
        });
        await context.SaveChangesAsync();

        var report = await CalculateAsync(context);

        Assert.Equal(2_800m, report.ProfitSales); // (1000 + 2000) - approved return 200
        Assert.Equal(100m, report.ProfitExpenses); // pending 900 is excluded
        Assert.Equal(2_700m, report.ProfitAmount);
    }

    [Fact(DisplayName = "VATMGMT_F03_DerivedVATLinesExposeProvenance")]
    public async Task DerivedVatLinesExposeProvenance()
    {
        await using var context = await ZayogyaVatManagementBaselineWithDerivedSaleAsync();

        var report = await CalculateAsync(context);

        Assert.NotEmpty(report.OutputLines);
        Assert.All(report.OutputLines, line =>
            Assert.NotNull(line.GetType().GetProperty("IsDerived")));
    }

    [Fact(DisplayName = "VATMGMT_F04_ZeroRatedSaleReturnReducesItsOriginalScenario")]
    public async Task ZeroRatedSaleReturnReducesItsOriginalScenario()
    {
        await using var context = await ZayogyaVatManagementBaselineWithDerivedSaleAsync();
        var sale = await context.Sales.SingleAsync(s => s.Id == 1);
        sale.VatScenario = "ZeroRated";
        await context.SaveChangesAsync();

        var report = await CalculateAsync(context);

        Assert.Equal(0m, report.Box1a);
        Assert.Equal(0m, report.Box1b);
        Assert.Equal(2_800m, report.Box2);
    }

    [Fact(DisplayName = "VATMGMT_F04_ReturnUsesOriginalSaleLineScenarioAndTaxEvidence")]
    public async Task SaleReturnUsesOriginalLineScenarioWhenHeaderTaxIsStandard()
    {
        await using var context = await ZayogyaVatManagementGoldenBaselineTests.CreateFixtureAsync();
        var sale = await context.Sales.SingleAsync(s => s.Id == 1);
        var originalLine = new SaleItem
        {
            SaleId = sale.Id, ProductId = 1, UnitType = "PCS", Qty = 2,
            UnitPrice = 100m, VatAmount = 10m, VatRate = 5m, VatScenario = VatScenarios.ZeroRated
        };
        var saleReturn = await context.SaleReturns.SingleAsync(r => r.SaleId == sale.Id);
        context.SaleItems.Add(originalLine);
        context.SaleReturnItems.Add(new SaleReturnItem
        {
            SaleReturn = saleReturn, SaleItem = originalLine, ProductId = 1,
            UnitType = "PCS", Qty = 2, UnitPrice = 100m, VatAmount = 10m, LineTotal = 210m
        });
        await context.SaveChangesAsync();

        var report = await CalculateAsync(context);

        Assert.Equal(1_000m, report.Box1a);
        Assert.Equal(50m, report.Box1b);
        Assert.Equal(1_800m, report.Box2);
        var creditNote = Assert.Single(report.CreditNoteLines, line => line.Reference == "ZY-RET-1");
        Assert.Equal(0m, creditNote.VatAmount);
    }

    [Fact(DisplayName = "VATMGMT_F05_PriorPeriodReturnRetainsSignedAmounts")]
    public async Task PriorPeriodReturnRetainsSignedAmounts()
    {
        await using var context = await ZayogyaVatManagementGoldenBaselineTests.CreateFixtureAsync();
        var originalSale = await context.Sales.SingleAsync(s => s.Id == 1);
        originalSale.InvoiceDate = new DateTime(2024, 12, 15, 12, 0, 0, DateTimeKind.Utc);
        (await context.Sales.SingleAsync(s => s.Id == 2)).IsDeleted = true;
        await context.SaveChangesAsync();

        var report = await CalculateAsync(context);

        Assert.Equal(-200m, report.Box1a);
        Assert.Equal(-10m, report.Box1b);
    }

    [Fact(DisplayName = "VATMGMT_F06_CalculationFailurePropagatesAsTypedError")]
    public async Task CalculationFailurePropagatesAsTypedError()
    {
        await using var context = await ZayogyaVatManagementGoldenBaselineTests.CreateFixtureAsync();
        var service = new VatReturnReportService(context,
            Microsoft.Extensions.Logging.Abstractions.NullLogger<VatReturnReportService>.Instance);
        var calculationError = typeof(VatReturnReportService).Assembly
            .GetType("HexaBill.Api.Modules.Reports.VatCalculationException");
        Assert.NotNull(calculationError);

        await context.DisposeAsync();
        Exception? thrown = null;
        try
        {
            await service.GetVatReturn201Async(ZayogyaVatManagementGoldenBaselineTests.ZayogyaTenantId,
                new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                new DateTime(2025, 4, 1, 0, 0, 0, DateTimeKind.Utc));
        }
        catch (Exception ex)
        {
            thrown = ex;
        }

        Assert.NotNull(thrown);
        Assert.Equal(calculationError, thrown!.GetType());
    }

    [Fact(DisplayName = "VATMGMT_F06_ControllerDoesNotReplaceCalculationFailureWithSYS001Zeros")]
    public async Task ControllerReturnsSafeServerErrorForCalculationFailure()
    {
        await using var context = await ZayogyaVatManagementGoldenBaselineTests.CreateFixtureAsync();
        var controller = ZayogyaVatManagementGoldenBaselineTests.CreateController(context);
        await context.DisposeAsync();

        var response = await controller.GetVatReturn(ZayogyaVatManagementGoldenBaselineTests.PeriodFrom,
            ZayogyaVatManagementGoldenBaselineTests.PeriodTo, null, null);

        var error = Assert.IsType<ObjectResult>(response.Result);
        Assert.Equal(StatusCodes.Status500InternalServerError, error.StatusCode);
        var body = Assert.IsType<ApiResponse<object>>(error.Value);
        Assert.Contains("correlation id", body.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("SYS001", System.Text.Json.JsonSerializer.Serialize(body));
        Assert.DoesNotContain("disposed", body.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Theory(DisplayName = "VATMGMT_F07_LockedAndSubmittedPeriodsRejectRecalculation")]
    [InlineData("Locked")]
    [InlineData("Submitted")]
    public async Task LockedAndSubmittedPeriodsRejectRecalculation(string status)
    {
        await using var context = await ZayogyaVatManagementGoldenBaselineTests.CreateFixtureAsync();
        var periodId = await AddExistingPeriodAsync(context, status);
        var controller = ZayogyaVatManagementGoldenBaselineTests.CreateController(context);

        var result = await controller.CalculateVatReturn(new VatReturnCalculateRequest
        {
            From = ZayogyaVatManagementGoldenBaselineTests.PeriodFrom,
            To = ZayogyaVatManagementGoldenBaselineTests.PeriodTo
        });

        var conflict = Assert.IsType<ConflictObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status409Conflict, conflict.StatusCode);
        var stored = await context.VatReturnPeriods.SingleAsync(p => p.Id == periodId);
        Assert.Equal(status, stored.Status);
        Assert.Equal(123m, stored.Box1a);
    }

    [Fact(DisplayName = "VATMGMT_F08_LockedReadsServeThePersistedSnapshot")]
    public async Task LockedReadsServeThePersistedSnapshot()
    {
        await using var context = await ZayogyaVatManagementGoldenBaselineTests.CreateFixtureAsync();
        var controller = ZayogyaVatManagementGoldenBaselineTests.CreateController(context);
        var period = new VatReturnPeriod
        {
            TenantId = ZayogyaVatManagementGoldenBaselineTests.ZayogyaTenantId,
            PeriodStart = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd = new DateTime(2025, 3, 31, 0, 0, 0, DateTimeKind.Utc),
            PeriodLabel = "Q1-2025", DueDate = new DateTime(2025, 4, 28, 0, 0, 0, DateTimeKind.Utc),
            Status = "Locked", Box1a = 123m, Box1b = 6m, Box13a = 6m
        };
        context.VatReturnPeriods.Add(period);
        await context.SaveChangesAsync();
        var snapshot = new VatReturn201Dto
        {
            PeriodLabel = period.PeriodLabel, PeriodStart = period.PeriodStart, PeriodEnd = period.PeriodEnd,
            DueDate = period.DueDate, Status = "Locked", PeriodId = period.Id,
            Box1a = period.Box1a, Box1b = period.Box1b, Box13a = period.Box13a,
            StandardOutputVat = period.Box1b, NetVatPayable = period.Box13a,
            SnapshotVersion = 1, ValidationIssues = []
        };
        period.SnapshotVersion = 1;
        period.SnapshotAt = DateTime.UtcNow;
        period.SnapshotJson = System.Text.Json.JsonSerializer.Serialize(snapshot);
        period.SnapshotHash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes(period.SnapshotJson)));
        await context.SaveChangesAsync();

        var sale = await context.Sales.SingleAsync(s => s.Id == 1);
        sale.Subtotal = 5_000m;
        sale.VatTotal = 250m;
        sale.GrandTotal = 5_250m;
        await context.SaveChangesAsync();

        var response = await controller.GetVatReturn(ZayogyaVatManagementGoldenBaselineTests.PeriodFrom,
            ZayogyaVatManagementGoldenBaselineTests.PeriodTo, null, null);
        var body = Assert.IsType<ApiResponse<VatReturn201Dto>>(
            Assert.IsType<OkObjectResult>(response.Result).Value);

        Assert.Equal("Locked", body.Data!.Status);
        Assert.Equal(period.Box1a, body.Data.Box1a);
        Assert.Equal(period.Box1b, body.Data.Box1b);
        Assert.Empty(body.Data.ValidationIssues);

        var csvAction = await controller.ExportVatReturnCsv(
            ZayogyaVatManagementGoldenBaselineTests.PeriodFrom,
            ZayogyaVatManagementGoldenBaselineTests.PeriodTo, null);
        var csv = Assert.IsType<FileContentResult>(csvAction);
        Assert.DoesNotContain("ZY-1", System.Text.Encoding.UTF8.GetString(csv.FileContents));
    }

    [Fact(DisplayName = "VATMGMT_F03_GrossDerivedPurchaseVATBlocksFreezeAsDerived")]
    public async Task GrossDerivedPurchaseVatIsMarkedDerived()
    {
        await using var context = await ZayogyaVatManagementGoldenBaselineTests.CreateFixtureAsync();
        context.Purchases.Add(new Purchase
        {
            TenantId = ZayogyaVatManagementGoldenBaselineTests.ZayogyaTenantId,
            OwnerId = ZayogyaVatManagementGoldenBaselineTests.ZayogyaTenantId,
            InvoiceNo = "ZY-DERIVED-PURCHASE",
            PurchaseDate = new DateTime(2025, 2, 15, 12, 0, 0, DateTimeKind.Utc),
            Subtotal = 1_000m, VatTotal = null, TotalAmount = 1_050m,
            IsReverseCharge = false, IsTaxClaimable = true
        });
        await context.SaveChangesAsync();

        var report = await CalculateAsync(context);

        var derivedLine = Assert.Single(report.InputLines, line => line.Reference == "ZY-DERIVED-PURCHASE");
        Assert.True(derivedLine.IsDerived);
        Assert.True(report.HasDerivedValues);
    }

    [Fact(DisplayName = "VATMGMT_F05_V010_PreservesNegativeInputAdjustment")]
    public async Task ValidationAcceptsSignedInputAdjustmentArithmetic()
    {
        await using var context = await ZayogyaVatManagementGoldenBaselineTests.CreateFixtureAsync();
        var report = new VatReturn201Dto
        {
            Box1b = 0m, Box9b = 0m, Box10 = 0m, Box11 = 5m, Box12 = -5m,
            Box13a = 0m, Box13b = 5m
        };

        var issues = await new VatReturnValidationService(context).ValidatePeriodAsync(
            ZayogyaVatManagementGoldenBaselineTests.ZayogyaTenantId,
            new DateTime(2025, 1, 1), new DateTime(2025, 4, 1), report);

        Assert.DoesNotContain(issues, issue => issue.RuleId == "V010");
    }

    [Fact(DisplayName = "VATMGMT_EXPORTS_ManagementSummaryMatchesScreenTotals")]
    public async Task ManagementExcelAndCsvExportTheServerScreenTotals()
    {
        await using var context = await ZayogyaVatManagementGoldenBaselineTests.CreateFixtureAsync();
        var controller = ZayogyaVatManagementGoldenBaselineTests.CreateController(context);
        var screenResult = await controller.GetVatReturn(
            ZayogyaVatManagementGoldenBaselineTests.PeriodFrom,
            ZayogyaVatManagementGoldenBaselineTests.PeriodTo, null, null);
        var screen = Assert.IsType<ApiResponse<VatReturn201Dto>>(
            Assert.IsType<OkObjectResult>(screenResult.Result).Value).Data!;

        var excelResult = await controller.ExportVatManagementExcel(
            ZayogyaVatManagementGoldenBaselineTests.PeriodFrom,
            ZayogyaVatManagementGoldenBaselineTests.PeriodTo, null);
        var excel = Assert.IsType<FileContentResult>(excelResult);
        OfficeOpenXml.ExcelPackage.LicenseContext = OfficeOpenXml.LicenseContext.NonCommercial;
        using (var package = new OfficeOpenXml.ExcelPackage(new MemoryStream(excel.FileContents)))
        {
            var summary = package.Workbook.Worksheets["Management Summary"]!;
            Assert.Equal(screen.StandardOutputVat, summary.Cells[5, 2].GetValue<decimal>());
            Assert.Equal(screen.RecoverableInputVat, summary.Cells[6, 2].GetValue<decimal>());
            Assert.Equal(screen.NetVatPayable, summary.Cells[7, 2].GetValue<decimal>());
            Assert.Contains("Not an FTA filing", summary.Cells[1, 1].Text);
        }

        var csvResult = await controller.ExportVatManagementCsv(
            ZayogyaVatManagementGoldenBaselineTests.PeriodFrom,
            ZayogyaVatManagementGoldenBaselineTests.PeriodTo, null);
        var csv = Assert.IsType<FileContentResult>(csvResult);
        var csvText = System.Text.Encoding.UTF8.GetString(csv.FileContents);
        Assert.Contains($"StandardOutputVat,{screen.StandardOutputVat}", csvText);
        Assert.Contains($"RecoverableInputVat,{screen.RecoverableInputVat}", csvText);
        Assert.Contains($"NetVatPayable,{screen.NetVatPayable}", csvText);
        Assert.StartsWith("\uFEFF", csvText);

        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        var pdfService = new PdfService(context, null!, fonts, new SettingsService(context), null!,
            NullLogger<PdfService>.Instance, null!);
        var pdfBytes = await pdfService.GenerateVatManagementReportPdfAsync(screen, ZayogyaVatManagementGoldenBaselineTests.ZayogyaTenantId);
        using var pdfDocument = PdfDocument.Open(new MemoryStream(pdfBytes));
        var pdfText = string.Join("\n", pdfDocument.GetPages().Select(page => page.Text));
        Assert.Contains("Reference", pdfText);
        Assert.Contains("Taxable", pdfText);
        Assert.Contains("Party", pdfText);
        Assert.Contains(screen.StandardOutputVat.ToString("N2"), pdfText);
        Assert.Contains(screen.RecoverableInputVat.ToString("N2"), pdfText);
        Assert.Contains(screen.NetVatPayable.ToString("N2"), pdfText);
    }

    [Fact(DisplayName = "VATMGMT_FIXTURE_B_RefundableNegativeMatchesAllExports")]
    public async Task RefundablePurchaseOnlyFixtureMatchesScreenPdfExcelAndCsv()
    {
        await using var context = await ZayogyaVatManagementGoldenBaselineTests.CreateFixtureAsync();
        context.SaleReturns.RemoveRange(context.SaleReturns);
        context.PurchaseReturns.RemoveRange(context.PurchaseReturns);
        context.Sales.RemoveRange(context.Sales);
        context.Expenses.RemoveRange(context.Expenses);
        var purchase = await context.Purchases.SingleAsync();
        purchase.Subtotal = 10_000m;
        purchase.VatTotal = 500m;
        purchase.TotalAmount = 10_500m;
        purchase.IsTaxClaimable = true;
        await context.SaveChangesAsync();

        var controller = ZayogyaVatManagementGoldenBaselineTests.CreateController(context);
        var screen = await GetScreenReportAsync(controller);
        Assert.Equal(0m, screen.StandardOutputVat);
        Assert.Equal(500m, screen.RecoverableInputVat);
        Assert.Equal(-500m, screen.NetVatPayable);
        await AssertManagementExportParityAsync(context, controller, screen);
    }

    [Fact(DisplayName = "VATMGMT_FIXTURE_C_PriorPeriodReturnNegativeMatchesAllExports")]
    public async Task PriorPeriodSaleReturnFixtureMatchesScreenPdfExcelAndCsv()
    {
        await using var context = await ZayogyaVatManagementGoldenBaselineTests.CreateFixtureAsync();
        context.Sales.Remove(await context.Sales.SingleAsync(sale => sale.InvoiceNo == "ZY-ZERO-1"));
        context.Purchases.RemoveRange(context.Purchases);
        context.PurchaseReturns.RemoveRange(context.PurchaseReturns);
        context.Expenses.RemoveRange(context.Expenses);
        var sale = await context.Sales.SingleAsync(item => item.InvoiceNo == "ZY-1");
        sale.InvoiceDate = new DateTime(2024, 12, 15, 12, 0, 0, DateTimeKind.Utc);
        var credit = await context.SaleReturns.SingleAsync();
        credit.Subtotal = 1_000m;
        credit.VatTotal = 50m;
        credit.GrandTotal = 1_050m;
        await context.SaveChangesAsync();

        var controller = ZayogyaVatManagementGoldenBaselineTests.CreateController(context);
        var screen = await GetScreenReportAsync(controller);
        Assert.Equal(-50m, screen.StandardOutputVat);
        Assert.Equal(0m, screen.RecoverableInputVat);
        Assert.Equal(-50m, screen.NetVatPayable);
        await AssertManagementExportParityAsync(context, controller, screen);
    }

    [Fact(DisplayName = "VATMGMT_PHASE6_LockBlocksWritesThenOwnerAmendCreatesNewVersion")]
    public async Task LockedReportBlocksWritesAndOwnerAmendArchivesPreviousSnapshot()
    {
        await using var context = await ZayogyaVatManagementGoldenBaselineTests.CreateFixtureAsync();
        context.Settings.Add(new Setting
        {
            TenantId = ZayogyaVatManagementGoldenBaselineTests.ZayogyaTenantId,
            OwnerId = ZayogyaVatManagementGoldenBaselineTests.ZayogyaTenantId,
            Key = "COMPANY_TRN", Value = "100000000000099"
        });
        await context.SaveChangesAsync();
        var controller = ZayogyaVatManagementGoldenBaselineTests.CreateController(context);
        var calculated = await controller.CalculateVatReturn(new VatReturnCalculateRequest
        {
            From = ZayogyaVatManagementGoldenBaselineTests.PeriodFrom,
            To = ZayogyaVatManagementGoldenBaselineTests.PeriodTo
        });
        Assert.IsType<OkObjectResult>(calculated.Result);
        var period = await context.VatReturnPeriods.SingleAsync(item => item.TenantId == ZayogyaVatManagementGoldenBaselineTests.ZayogyaTenantId);

        var lockResult = await controller.LockVatReturnPeriod(period.Id);
        Assert.IsType<OkObjectResult>(lockResult.Result);
        var frozenHash = period.SnapshotHash;
        Assert.Equal("Locked", period.Status);
        await Assert.ThrowsAsync<InvalidOperationException>(() => VatReturnWriteGuard.EnsurePeriodOpenAsync(
            context, period.TenantId, new DateTime(2025, 2, 15, 12, 0, 0, DateTimeKind.Utc)));

        var amendResult = await controller.AmendVatReturnPeriod(period.Id,
            new VatReturnAmendRequest { Reason = "Correct source document" });
        var amendBody = Assert.IsType<ApiResponse<object>>(Assert.IsType<OkObjectResult>(amendResult.Result).Value);
        Assert.True(amendBody.Success);
        Assert.Equal("Calculated", period.Status);
        Assert.Equal(2, period.SnapshotVersion);
        Assert.Contains(frozenHash!, period.SnapshotHistoryJson, StringComparison.Ordinal);
        Assert.Contains("Correct source document", period.SnapshotHistoryJson, StringComparison.Ordinal);
        Assert.NotEqual(frozenHash, period.SnapshotHash);
    }

    private static async Task<VatReturn201Dto> GetScreenReportAsync(ReportsController controller)
    {
        var result = await controller.GetVatReturn(ZayogyaVatManagementGoldenBaselineTests.PeriodFrom,
            ZayogyaVatManagementGoldenBaselineTests.PeriodTo, null, null);
        return Assert.IsType<ApiResponse<VatReturn201Dto>>(
            Assert.IsType<OkObjectResult>(result.Result).Value).Data!;
    }

    private static async Task AssertManagementExportParityAsync(
        HexaBill.Api.Data.AppDbContext context, ReportsController controller, VatReturn201Dto screen)
    {
        var from = ZayogyaVatManagementGoldenBaselineTests.PeriodFrom;
        var to = ZayogyaVatManagementGoldenBaselineTests.PeriodTo;
        var excel = Assert.IsType<FileContentResult>(await controller.ExportVatManagementExcel(from, to, null));
        OfficeOpenXml.ExcelPackage.LicenseContext = OfficeOpenXml.LicenseContext.NonCommercial;
        using (var package = new OfficeOpenXml.ExcelPackage(new MemoryStream(excel.FileContents)))
        {
            var summary = package.Workbook.Worksheets["Management Summary"]!;
            Assert.Equal(screen.StandardOutputVat, summary.Cells[5, 2].GetValue<decimal>());
            Assert.Equal(screen.RecoverableInputVat, summary.Cells[6, 2].GetValue<decimal>());
            Assert.Equal(screen.NetVatPayable, summary.Cells[7, 2].GetValue<decimal>());
            Assert.NotNull(package.Workbook.Worksheets["Sales"]);
            Assert.NotNull(package.Workbook.Worksheets["Purchases"]);
            Assert.NotNull(package.Workbook.Worksheets["Expenses"]);
            Assert.NotNull(package.Workbook.Worksheets["Credit Notes"]);
        }
        var csv = Assert.IsType<FileContentResult>(await controller.ExportVatManagementCsv(from, to, null));
        var csvText = System.Text.Encoding.UTF8.GetString(csv.FileContents);
        Assert.Contains($"StandardOutputVat,{screen.StandardOutputVat}", csvText);
        Assert.Contains($"RecoverableInputVat,{screen.RecoverableInputVat}", csvText);
        Assert.Contains($"NetVatPayable,{screen.NetVatPayable}", csvText);
        Assert.Contains("Reference,Date,Party,Taxable,VAT,RecoverableVat,Total,ScenarioOrType", csvText);

        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        var pdf = new PdfService(context, null!, fonts, new SettingsService(context), null!,
            NullLogger<PdfService>.Instance, null!);
        var bytes = await pdf.GenerateVatManagementReportPdfAsync(screen, ZayogyaVatManagementGoldenBaselineTests.ZayogyaTenantId);
        using var document = PdfDocument.Open(new MemoryStream(bytes));
        var extracted = string.Join("\n", document.GetPages().Select(page => page.Text));
        Assert.Contains("Reference", extracted);
        Assert.Contains("Taxable", extracted);
        Assert.Contains(screen.StandardOutputVat.ToString("N2"), extracted);
        Assert.Contains(screen.RecoverableInputVat.ToString("N2"), extracted);
        Assert.Contains(screen.NetVatPayable.ToString("N2"), extracted);
    }

    [Fact(DisplayName = "VATMGMT_F09_SubmittedPeriodsStillGuardVATWrites")]
    public async Task SubmittedPeriodIsConsideredClosedForVATWrites()
    {
        await using var context = await ZayogyaVatManagementGoldenBaselineTests.CreateFixtureAsync();
        var tenantId = ZayogyaVatManagementGoldenBaselineTests.ZayogyaTenantId;
        await AddExistingPeriodAsync(context, "Submitted");

        var validation = new VatReturnValidationService(context);
        var blocked = await validation.IsTransactionDateInLockedPeriodAsync(tenantId,
            new DateTime(2025, 2, 1, 12, 0, 0, DateTimeKind.Utc));

        Assert.True(blocked);
    }

    [Fact(DisplayName = "VATMGMT_F09_ReturnServiceRejectsVATWritesIntoLockedPeriod")]
    public async Task PurchaseReturnServiceRejectsWritesIntoLockedPeriod()
    {
        await using var context = await ZayogyaVatManagementGoldenBaselineTests.CreateFixtureAsync();
        var today = DateTime.UtcNow.Date;
        context.VatReturnPeriods.Add(new VatReturnPeriod
        {
            TenantId = ZayogyaVatManagementGoldenBaselineTests.ZayogyaTenantId,
            PeriodStart = today, PeriodEnd = today, PeriodLabel = "Current day",
            DueDate = today.AddDays(28), Status = "Locked"
        });
        await context.SaveChangesAsync();

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() => VatReturnWriteGuard.EnsurePeriodOpenAsync(
            context, ZayogyaVatManagementGoldenBaselineTests.ZayogyaTenantId, DateTime.UtcNow));

        Assert.Contains("locked or marked as filed", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact(DisplayName = "VATMGMT_LOCK_WRITE_RACE_TenantLockSerializesFreezeAndWriteGuard")]
    public async Task TenantLockSerializesFreezeAndWriteGuard()
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        if (string.IsNullOrWhiteSpace(connection))
            return;

        var tenantId = 1_700_000 + Random.Shared.Next(1, 50_000);
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection).Options;
        await using var freezingContext = new AppDbContext(options);
        freezingContext.SetRequestTenantScope(null, isPlatformScope: true);
        await PostgresTestSchema.EnsureCreatedAsync(freezingContext);
        freezingContext.Tenants.Add(new Tenant
        {
            Id = tenantId,
            Name = $"VAT lock race fixture {tenantId}",
            Subdomain = $"vlr{tenantId}"
        });
        await freezingContext.SaveChangesAsync();
        await using var freezeTransaction = await freezingContext.Database.BeginTransactionAsync();
        await VatReturnWriteGuard.AcquireTenantWriteLockAsync(freezingContext, tenantId);

        var writeAttempted = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var guardedWrite = Task.Run(async () =>
        {
            await using var writeContext = new AppDbContext(options);
            writeContext.SetRequestTenantScope(null, isPlatformScope: true);
            await using var writeTransaction = await writeContext.Database.BeginTransactionAsync();
            writeAttempted.SetResult();
            try
            {
                await VatReturnWriteGuard.EnsurePeriodOpenAsync(writeContext, tenantId,
                    new DateTime(2025, 1, 15, 12, 0, 0, DateTimeKind.Utc));
                await writeTransaction.CommitAsync();
                return false;
            }
            catch (InvalidOperationException)
            {
                return true;
            }
        });

        await writeAttempted.Task;
        var beforeFreezeCommit = await Task.WhenAny(guardedWrite, Task.Delay(TimeSpan.FromMilliseconds(150)));
        Assert.NotSame(guardedWrite, beforeFreezeCommit);

        freezingContext.VatReturnPeriods.Add(new VatReturnPeriod
        {
            TenantId = tenantId,
            PeriodStart = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd = new DateTime(2025, 1, 31, 0, 0, 0, DateTimeKind.Utc),
            PeriodLabel = "VAT lock race",
            DueDate = new DateTime(2025, 2, 28, 0, 0, 0, DateTimeKind.Utc),
            Status = "Locked"
        });
        await freezingContext.SaveChangesAsync();
        await freezeTransaction.CommitAsync();

        Assert.True(await guardedWrite);
        freezingContext.VatReturnPeriods.RemoveRange(
            freezingContext.VatReturnPeriods.Where(p => p.TenantId == tenantId));
        freezingContext.Tenants.Remove(await freezingContext.Tenants.SingleAsync(t => t.Id == tenantId));
        await freezingContext.SaveChangesAsync();
    }

    [Fact(DisplayName = "VATMGMT_F10_OverlappingFilingPeriodsAreRejected")]
    public async Task OverlappingFilingPeriodsAreRejected()
    {
        await using var context = await ZayogyaVatManagementGoldenBaselineTests.CreateFixtureAsync();
        var controller = ZayogyaVatManagementGoldenBaselineTests.CreateController(context);
        var first = await controller.CalculateVatReturn(new VatReturnCalculateRequest
        {
            From = new DateTime(2025, 1, 1), To = new DateTime(2025, 3, 31)
        });
        Assert.IsType<OkObjectResult>(first.Result);

        var second = await controller.CalculateVatReturn(new VatReturnCalculateRequest
        {
            From = new DateTime(2025, 2, 1), To = new DateTime(2025, 4, 30)
        });

        Assert.IsType<ConflictObjectResult>(second.Result);
        Assert.Single(await context.VatReturnPeriods.Where(p => p.TenantId == ZayogyaVatManagementGoldenBaselineTests.ZayogyaTenantId)
            .ToListAsync());
    }

    [Fact(DisplayName = "VATMGMT_F11_GetAndCalculateUseTheSamePeriodKey")]
    public async Task GetAndCalculateUseTheSamePeriodKey()
    {
        await using var context = await ZayogyaVatManagementGoldenBaselineTests.CreateFixtureAsync();
        var controller = ZayogyaVatManagementGoldenBaselineTests.CreateController(context);
        var calculate = await controller.CalculateVatReturn(new VatReturnCalculateRequest
        {
            From = ZayogyaVatManagementGoldenBaselineTests.PeriodFrom,
            To = ZayogyaVatManagementGoldenBaselineTests.PeriodTo
        });
        if (calculate.Result is ObjectResult failed)
            Assert.True(failed is OkObjectResult, $"calculate status={failed.StatusCode}; body={System.Text.Json.JsonSerializer.Serialize(failed.Value)}");
        var calculated = Assert.IsType<ApiResponse<VatReturn201Dto>>(
            Assert.IsType<OkObjectResult>(calculate.Result).Value);
        var get = await controller.GetVatReturn(ZayogyaVatManagementGoldenBaselineTests.PeriodFrom,
            ZayogyaVatManagementGoldenBaselineTests.PeriodTo, null, null);
        var read = Assert.IsType<ApiResponse<VatReturn201Dto>>(
            Assert.IsType<OkObjectResult>(get.Result).Value);

        Assert.Equal(calculated.Data!.PeriodId, read.Data!.PeriodId);
        Assert.Equal("Calculated", read.Data.Status);
    }

    [Fact(DisplayName = "VATMGMT_F13_ExplicitZeroClaimableVATOverridesGrossVAT")]
    public async Task ExplicitZeroClaimableVatOverridesVatAmount()
    {
        await using var context = await ZayogyaVatManagementGoldenBaselineTests.CreateFixtureAsync();
        var expense = await context.Expenses.SingleAsync();
        expense.ClaimableVat = 0m;
        expense.VatAmount = 5m;
        expense.IsTaxClaimable = true;
        await context.SaveChangesAsync();

        var report = await CalculateAsync(context);

        Assert.Equal(0m, report.InputLines.Where(line => line.Type == "Expense").Sum(line => line.ClaimableVat));
        Assert.Equal(20m, report.Box9b);
    }

    [Fact(DisplayName = "VATMGMT_F21_CSVQuotesFieldsAndGuardsFormulaText")]
    public async Task CsvQuotesReferenceAndNeutralizesFormulaText()
    {
        await using var context = await ZayogyaVatManagementGoldenBaselineTests.CreateFixtureAsync();
        var sale = await context.Sales.SingleAsync(s => s.Id == 1);
        sale.InvoiceNo = "=1+1,Injected";
        await context.SaveChangesAsync();

        var result = await ZayogyaVatManagementGoldenBaselineTests.CreateController(context)
            .ExportVatReturnCsv(ZayogyaVatManagementGoldenBaselineTests.PeriodFrom,
                ZayogyaVatManagementGoldenBaselineTests.PeriodTo, null);
        var csv = Assert.IsType<FileContentResult>(result);
        var text = System.Text.Encoding.UTF8.GetString(csv.FileContents);

        Assert.StartsWith("\uFEFF", text);
        Assert.Contains("Output,\"'=1+1,Injected\",2025-01-15,1000,50,,Standard", text);
    }

    [Fact(DisplayName = "VATMGMT_DUE_DATES_28DaysAfterMonthlyPeriodEnd")]
    public void MonthlyDeadlineIs28DaysAfterPeriodEnd()
    {
        var (_, dueDate) = VatReturnReportService.GetPeriodLabelAndDue(
            new DateTime(2025, 1, 1), new DateTime(2025, 1, 31));

        Assert.Equal(new DateTime(2025, 2, 28), dueDate.Date);
    }

    [Theory(DisplayName = "VATMGMT_DUE_DATES_28DaysAcrossLeapAndYearBoundaries")]
    [InlineData(2024, 2, 29, 2024, 3, 28)]
    [InlineData(2025, 12, 31, 2026, 1, 28)]
    public void MonthlyDeadlineUses28DaysAcrossCalendarBoundaries(int y, int m, int d, int dueY, int dueM, int dueD)
    {
        var (_, dueDate) = VatReturnReportService.GetPeriodLabelAndDue(
            new DateTime(y, m, 1), new DateTime(y, m, d));
        Assert.Equal(new DateTime(dueY, dueM, dueD), dueDate.Date);
    }

    [Fact(DisplayName = "VATMGMT_RETURNS_PendingSaleReturnDoesNotChangePostedVAT")]
    public async Task PendingSaleReturnDoesNotReduceOutputVat()
    {
        await using var context = await ZayogyaVatManagementGoldenBaselineTests.CreateFixtureAsync();
        var saleReturn = await context.SaleReturns.SingleAsync();
        saleReturn.Status = ReturnStatus.Pending;
        await context.SaveChangesAsync();

        var report = await CalculateAsync(context);

        Assert.Equal(1_000m, report.Box1a);
        Assert.Equal(50m, report.Box1b);
    }

    private static async Task<VatReturn201Dto> CalculateAsync(HexaBill.Api.Data.AppDbContext context)
    {
        var from = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2025, 4, 1, 0, 0, 0, DateTimeKind.Utc);
        return await new VatReturnReportService(context,
            Microsoft.Extensions.Logging.Abstractions.NullLogger<VatReturnReportService>.Instance)
            .GetVatReturn201Async(ZayogyaVatManagementGoldenBaselineTests.ZayogyaTenantId, from, to);
    }

    private static async Task<int> AddExistingPeriodAsync(HexaBill.Api.Data.AppDbContext context, string status)
    {
        var period = new VatReturnPeriod
        {
            TenantId = ZayogyaVatManagementGoldenBaselineTests.ZayogyaTenantId,
            PeriodStart = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd = new DateTime(2025, 3, 31, 0, 0, 0, DateTimeKind.Utc),
            PeriodLabel = "Q1-2025", DueDate = new DateTime(2025, 4, 28, 0, 0, 0, DateTimeKind.Utc),
            Status = status, Box1a = 123m, Box1b = 6m, Box13a = 6m
        };
        context.VatReturnPeriods.Add(period);
        await context.SaveChangesAsync();
        return period.Id;
    }

    private static async Task<HexaBill.Api.Data.AppDbContext> ZayogyaVatManagementBaselineWithDerivedSaleAsync()
    {
        var context = await ZayogyaVatManagementGoldenBaselineTests.CreateFixtureAsync();
        var sale = await context.Sales.SingleAsync(s => s.Id == 1);
        sale.Subtotal = 0m;
        sale.VatTotal = 0m;
        sale.GrandTotal = 1_050m;
        await context.SaveChangesAsync();
        return context;
    }
}
