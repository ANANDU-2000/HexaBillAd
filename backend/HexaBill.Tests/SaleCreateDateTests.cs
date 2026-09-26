using HexaBill.Api.Shared.Extensions;
using HexaBill.Api.Shared.Validation;

namespace HexaBill.Tests;

public class SaleCreateDateTests
{
    [Fact]
    public void DefaultInvoiceDate_IsUtcKind_AndDoesNotThrow()
    {
        var service = new TimeZoneService();
        var invoiceDate = service.GetDefaultInvoiceDateUtc().ToUtcKind();

        Assert.Equal(DateTimeKind.Utc, invoiceDate.Kind);
    }

    [Fact]
    public void UnspecifiedInvoiceDate_IsStoredAsUtcKind()
    {
        var unspecified = new DateTime(2026, 3, 31, 0, 0, 0, DateTimeKind.Unspecified);
        var stored = unspecified.ToUtcKind();

        Assert.Equal(DateTimeKind.Utc, stored.Kind);
        Assert.Equal(2026, stored.Year);
        Assert.Equal(3, stored.Month);
        Assert.Equal(31, stored.Day);
    }

    [Fact]
    public void ConvertToUtc_OnAlreadyUtcGstStamp_Throws()
    {
        var service = new TimeZoneService();
        var alreadyUtc = service.GetCurrentTime();

        Assert.Equal(DateTimeKind.Utc, alreadyUtc.Kind);
        Assert.Throws<ArgumentException>(() => service.ConvertToUtc(alreadyUtc));
    }
}
