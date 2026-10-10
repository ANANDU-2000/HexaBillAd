using HexaBill.Api.Models;
using HexaBill.Api.Modules.Reports;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Tests;

public sealed class VatTaxPeriodConfigTests
{
    [Theory]
    [InlineData("Quarterly", 1, "2025-02-10", "2025-01-01", "2025-03-31")]
    [InlineData("Quarterly", 2, "2025-01-15", "2024-11-01", "2025-01-31")]
    [InlineData("Quarterly", 2, "2025-02-01", "2025-02-01", "2025-04-30")]
    [InlineData("Quarterly", 3, "2025-12-31", "2025-12-01", "2026-02-28")]
    [InlineData("Monthly", 1, "2025-02-10", "2025-02-01", "2025-02-28")]
    public void PeriodContaining_FollowsConfiguredSchedule(string freq, int anchor, string date, string start, string end)
    {
        Assert.True(VatTaxPeriodConfig.TryValidate(freq, anchor.ToString(), out var cfg, out _));
        var (s, e) = cfg.PeriodContaining(DateTime.Parse(date));
        Assert.Equal(DateTime.Parse(start), s);
        Assert.Equal(DateTime.Parse(end), e);
    }

    [Theory]
    [InlineData("Weekly", "1")]
    [InlineData("Quarterly", "13")]
    [InlineData("Quarterly", null)]
    public void Invalid_IsRejected(string freq, string? anchor) =>
        Assert.False(VatTaxPeriodConfig.TryValidate(freq, anchor, out _, out _));

    [Fact]
    public async Task Calendar_Quarter_IsNotFilingPeriod_WhenTenantStaggerIsFeb()
    {
        VatTaxPeriodConfig.TryValidate("Quarterly", "2", out var cfg, out _);
        Assert.False(cfg.IsFilingPeriod(new DateTime(2025, 1, 1), new DateTime(2025, 3, 31)));
        Assert.True(cfg.IsFilingPeriod(new DateTime(2025, 2, 1), new DateTime(2025, 4, 30)));
        Assert.False(VatTaxPeriodConfig.Unconfigured.IsFilingPeriod(new DateTime(2025, 2, 1), new DateTime(2025, 4, 30)));
    }

    [Fact]
    public async Task ConfiguredTenant_CannotFreezeAnalysisRange_AndConfigIsTenantScoped()
    {
        await using var context = await ZayogyaVatManagementGoldenBaselineTests.CreateFixtureAsync();
        var controller = ZayogyaVatManagementGoldenBaselineTests.CreateController(context);
        Assert.IsType<OkObjectResult>((await controller.SetVatPeriodConfig(new VatPeriodConfigRequest { Frequency = "Quarterly", AnchorMonth = 2 })).Result);
        Assert.IsType<BadRequestObjectResult>((await controller.SetVatPeriodConfig(new VatPeriodConfigRequest { Frequency = "Weekly" })).Result);

        // Jan-Mar is a valid analysis range (legacy) but not this tenant's filing period.
        Assert.IsType<OkObjectResult>((await controller.CalculateVatReturn(new VatReturnCalculateRequest
        { From = ZayogyaVatManagementGoldenBaselineTests.PeriodFrom, To = ZayogyaVatManagementGoldenBaselineTests.PeriodTo })).Result);
        var period = await context.VatReturnPeriods.SingleAsync();
        Assert.IsType<OkObjectResult>((await controller.ReviewVatReturnPeriod(period.Id)).Result);
        Assert.IsType<ConflictObjectResult>((await controller.LockVatReturnPeriod(period.Id)).Result);

        // Another tenant sees no configuration.
        Assert.False((await VatTaxPeriodConfig.LoadAsync(context, 99999)).Configured);
    }
}
