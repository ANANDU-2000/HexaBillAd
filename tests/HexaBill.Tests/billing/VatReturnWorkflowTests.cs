using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Reports;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Tests;

/// <summary>Reviewed-state machine and stale-calculation protection (synthetic Zayogya fixture).</summary>
public sealed class VatReturnWorkflowTests
{

    private const int Tenant = ZayogyaVatManagementGoldenBaselineTests.ZayogyaTenantId;

    private static async Task<(AppDbContext Context, ReportsController Controller, VatReturnPeriod Period)> CalculatedAsync()
    {
        var context = await ZayogyaVatManagementGoldenBaselineTests.CreateFixtureAsync();
        var controller = ZayogyaVatManagementGoldenBaselineTests.CreateController(context);
        Assert.IsType<OkObjectResult>((await controller.CalculateVatReturn(new VatReturnCalculateRequest
        {
            From = ZayogyaVatManagementGoldenBaselineTests.PeriodFrom,
            To = ZayogyaVatManagementGoldenBaselineTests.PeriodTo
        })).Result);
        var period = await context.VatReturnPeriods.SingleAsync(p => p.TenantId == Tenant);
        context.Settings.Add(new Setting { Key = "COMPANY_TRN", TenantId = Tenant, OwnerId = Tenant, Value = "100555666777888" }); // synthetic, format-valid, not a sample: no process-wide env opt-in needed
        await context.SaveChangesAsync();
        return (context, controller, period);
    }


    [Theory]
    [InlineData("Draft", "Locked", false)]
    [InlineData("Calculated", "Locked", false)]
    [InlineData("Calculated", "Reviewed", true)]
    [InlineData("Reviewed", "Locked", true)]
    [InlineData("Reviewed", "Submitted", false)]
    [InlineData("Locked", "Submitted", true)]
    [InlineData("Submitted", "Calculated", false)]
    public void TransitionTable(string from, string to, bool legal) =>
        Assert.Equal(legal, VatReturnWorkflow.CanTransition(from, to));

    [Fact]
    public async Task Lock_WithoutReview_IsConflict()
    {
        var (context, controller, period) = await CalculatedAsync();
        await using var _ = context;
        Assert.IsType<ConflictObjectResult>((await controller.LockVatReturnPeriod(period.Id)).Result);
        Assert.Equal("Calculated", (await context.VatReturnPeriods.SingleAsync()).Status);
    }

    [Fact]
    public async Task Review_ThenSourceChange_InvalidatesReview_AndBlocksLock()
    {
        var (context, controller, period) = await CalculatedAsync();
        await using var _ = context;
        Assert.IsType<OkObjectResult>((await controller.ReviewVatReturnPeriod(period.Id)).Result);
        Assert.Equal("Reviewed", period.Status);

        // A financial change inside the period after review.
        context.Sales.Add(new Sale
        {
            TenantId = Tenant, OwnerId = Tenant, InvoiceNo = "ZY-LATE",
            InvoiceDate = new DateTime(2025, 2, 1, 12, 0, 0, DateTimeKind.Utc),
            Subtotal = 100m, VatTotal = 5m, GrandTotal = 105m, VatScenario = "Standard", CreatedBy = Tenant
        });
        await context.SaveChangesAsync();

        Assert.IsType<ConflictObjectResult>((await controller.LockVatReturnPeriod(period.Id)).Result);
        var after = await context.VatReturnPeriods.SingleAsync();
        Assert.Equal("Calculated", after.Status);
        Assert.Null(after.ReviewedAt);
        Assert.NotNull(after.ReviewInvalidatedAt);
    }

    [Fact]
    public async Task Review_WhenSourceChangedSinceCalculation_IsConflict()
    {
        var (context, controller, period) = await CalculatedAsync();
        await using var _ = context;
        context.Sales.Add(new Sale
        {
            TenantId = Tenant, OwnerId = Tenant, InvoiceNo = "ZY-LATE2",
            InvoiceDate = new DateTime(2025, 2, 2, 12, 0, 0, DateTimeKind.Utc),
            Subtotal = 100m, VatTotal = 5m, GrandTotal = 105m, VatScenario = "Standard", CreatedBy = Tenant
        });
        await context.SaveChangesAsync();
        Assert.IsType<ConflictObjectResult>((await controller.ReviewVatReturnPeriod(period.Id)).Result);
    }

    [Fact]
    public async Task Recalculate_RefreshesTotals_BumpsVersion_AndClearsReview()
    {
        var (context, controller, period) = await CalculatedAsync();
        await using var _ = context;
        Assert.Equal(1, period.CalculationVersion);
        Assert.IsType<OkObjectResult>((await controller.ReviewVatReturnPeriod(period.Id)).Result);
        context.Sales.Add(new Sale
        {
            TenantId = Tenant, OwnerId = Tenant, InvoiceNo = "ZY-LATE3",
            InvoiceDate = new DateTime(2025, 2, 3, 12, 0, 0, DateTimeKind.Utc),
            Subtotal = 100m, VatTotal = 5m, GrandTotal = 105m, VatScenario = "Standard", CreatedBy = Tenant
        });
        await context.SaveChangesAsync();
        var oldBox1a = period.Box1a;

        Assert.IsType<OkObjectResult>((await controller.CalculateVatReturn(new VatReturnCalculateRequest
        {
            From = ZayogyaVatManagementGoldenBaselineTests.PeriodFrom,
            To = ZayogyaVatManagementGoldenBaselineTests.PeriodTo
        })).Result);

        var after = await context.VatReturnPeriods.SingleAsync();
        Assert.Equal(2, after.CalculationVersion);
        Assert.Equal("Calculated", after.Status);
        Assert.Null(after.ReviewedAt);
        Assert.Equal(oldBox1a + 100m, after.Box1a);
        Assert.IsType<OkObjectResult>((await controller.ReviewVatReturnPeriod(after.Id)).Result);
        Assert.IsType<OkObjectResult>((await controller.LockVatReturnPeriod(after.Id)).Result);
    }
}
