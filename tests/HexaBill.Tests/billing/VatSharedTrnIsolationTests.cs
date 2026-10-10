using HexaBill.Api.Models;
using HexaBill.Api.Modules.Reports;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

/// <summary>Two tenants under one VAT registration: data is never merged, consolidation is only flagged.</summary>
public sealed class VatSharedTrnIsolationTests
{
    private const int TenantA = ZayogyaVatManagementGoldenBaselineTests.ZayogyaTenantId;
    private const int TenantB = 60007;

    [Fact]
    public async Task SharedTrn_KeepsTotalsSeparate_AndFlagsConsolidationWithoutMerging()
    {
        await using var context = await ZayogyaVatManagementGoldenBaselineTests.CreateFixtureAsync();
        context.SetRequestTenantScope(null, isPlatformScope: true);
        const string trn = HexaBill.Api.Core.Tenancy.SampleVatTrn.UnitFixture;
        context.Tenants.Add(new Tenant { Id = TenantB, Name = "Sister company", Subdomain = "sister-vat", Country = "AE", Currency = "AED", VatCalculationBasis = VatCalculationBasis.SalesBased });
        context.Settings.AddRange(
            new Setting { Key = "COMPANY_TRN", TenantId = TenantA, OwnerId = TenantA, Value = trn },
            new Setting { Key = "COMPANY_TRN", TenantId = TenantB, OwnerId = TenantB, Value = trn });
        context.Sales.Add(new Sale
        {
            TenantId = TenantB, OwnerId = TenantB, InvoiceNo = "SISTER-1",
            InvoiceDate = new DateTime(2025, 1, 20, 12, 0, 0, DateTimeKind.Utc),
            Subtotal = 5_000m, VatTotal = 250m, GrandTotal = 5_250m, VatScenario = "Standard", CreatedBy = TenantB,
        });
        await context.SaveChangesAsync();

        var service = new VatReturnReportService(context, NullLogger<VatReturnReportService>.Instance);
        var from = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2025, 4, 1, 0, 0, 0, DateTimeKind.Utc);
        var a = await service.GetVatReturn201Async(TenantA, from, to);
        var b = await service.GetVatReturn201Async(TenantB, from, to);

        Assert.Equal(800m, a.Box1a);                 // Tenant A golden figure, unchanged by B
        Assert.Equal(40m, a.Box1b);
        Assert.Equal(5_000m, b.Box1a);               // Tenant B only sees its own sale
        Assert.Equal(250m, b.Box1b);
        Assert.DoesNotContain(a.OutputLines, l => l.Reference == "SISTER-1");
        Assert.DoesNotContain(b.OutputLines, l => l.Reference.StartsWith("ZY-"));
        Assert.Contains(a.Warnings, w => w.Contains("not a consolidated return", StringComparison.OrdinalIgnoreCase));
        Assert.Contains(b.Warnings, w => w.Contains("not a consolidated return", StringComparison.OrdinalIgnoreCase));
    }
}
