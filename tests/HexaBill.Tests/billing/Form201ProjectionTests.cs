using HexaBill.Api.Models;
using HexaBill.Api.Modules.Reports;
using Microsoft.AspNetCore.Mvc;

namespace HexaBill.Tests;

public sealed class Form201ProjectionTests
{
    [Fact]
    public async Task ZayogyaFixture_BoxStatesAndAmounts()
    {
        await using var context = await ZayogyaVatManagementGoldenBaselineTests.CreateFixtureAsync();
        var controller = ZayogyaVatManagementGoldenBaselineTests.CreateController(context);
        var ok = Assert.IsType<OkObjectResult>((await controller.GetVatReturn(
            ZayogyaVatManagementGoldenBaselineTests.PeriodFrom, ZayogyaVatManagementGoldenBaselineTests.PeriodTo, null, null)).Result);
        var report = Assert.IsType<ApiResponse<VatReturn201Dto>>(ok.Value).Data!;
        var boxes = report.Form201Projection.ToDictionary(b => b.BoxId);

        Assert.Equal(800m, boxes["1"].Amount);
        Assert.Equal(40m, boxes["1"].VatAmount);
        Assert.Equal(2000m, boxes["4"].Amount);
        Assert.Equal("VerifiedZero", boxes["5"].CalculationState);   // exempt: source exists, no rows
        Assert.Equal(20m, boxes["13"].VatAmount);                    // recoverable 25 - 5
        Assert.Equal(20m, boxes["14"].VatAmount);                    // payable
        foreach (var id in new[] { "2", "3", "6", "7" })
        {
            Assert.Null(boxes[id].Amount);                           // never silently 0
            Assert.Null(boxes[id].VatAmount);
            Assert.Equal("Unavailable", boxes[id].SourceCompleteness);
        }
        Assert.All(report.Form201Projection, b => Assert.Equal("PendingAccountantReview", b.ReviewState));
        Assert.Equal("Partial", boxes["1"].SourceCompleteness);
    }
}
