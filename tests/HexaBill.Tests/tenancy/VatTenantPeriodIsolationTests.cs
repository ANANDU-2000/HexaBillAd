using HexaBill.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Tests;

public sealed class VatTenantPeriodIsolationTests
{
    [Fact(DisplayName = "VAT_TENANCY_ForeignPeriodIdReturns404AcrossPeriodActionsAndExports")]
    public async Task ForeignPeriodIdReturns404AcrossPeriodActionsAndExports()
    {
        await using var context = await ZayogyaVatManagementGoldenBaselineTests.CreateFixtureAsync();
        context.SetRequestTenantScope(null, isPlatformScope: true);
        const int foreignTenantId = ZayogyaVatManagementGoldenBaselineTests.ZayogyaTenantId + 1;
        var foreignPeriod = new VatReturnPeriod
        {
            TenantId = foreignTenantId,
            PeriodStart = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd = new DateTime(2025, 3, 31, 0, 0, 0, DateTimeKind.Utc),
            PeriodLabel = "Foreign period",
            DueDate = new DateTime(2025, 4, 28, 0, 0, 0, DateTimeKind.Utc),
            Status = "Calculated"
        };
        context.VatReturnPeriods.Add(foreignPeriod);
        await context.SaveChangesAsync();
        var controller = ZayogyaVatManagementGoldenBaselineTests.CreateController(context);

        var validation = await controller.GetVatReturnValidation(null, null, foreignPeriod.Id);
        Assert.IsType<NotFoundObjectResult>(validation.Result);
        Assert.IsType<NotFoundResult>(await controller.ExportVatReturnExcelFta201(null, null, foreignPeriod.Id));
        Assert.IsType<NotFoundResult>(await controller.ExportVatReturnCsv(null, null, foreignPeriod.Id));
        Assert.IsType<NotFoundResult>(await controller.ExportVatManagementExcel(null, null, foreignPeriod.Id));
        Assert.IsType<NotFoundResult>(await controller.ExportVatManagementCsv(null, null, foreignPeriod.Id));
        Assert.IsType<NotFoundResult>(await controller.ExportVatManagementPdf(null, null, foreignPeriod.Id));
        var lockAttempt = await controller.LockVatReturnPeriod(foreignPeriod.Id);
        Assert.IsType<NotFoundObjectResult>(lockAttempt.Result);
        var submitAttempt = await controller.SubmitVatReturnPeriod(foreignPeriod.Id);
        Assert.IsType<NotFoundObjectResult>(submitAttempt.Result);
    }
}
