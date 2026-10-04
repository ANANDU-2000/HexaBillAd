using HexaBill.Api.Core.Tenancy;
using HexaBill.Api.Models;

namespace HexaBill.Tests;

public class SampleVatTrnTests
{
    [Theory]
    [InlineData(null, "INVOICE")]
    [InlineData("", "INVOICE")]
    [InlineData(SampleVatTrn.FrozenHub1, "SAMPLE INVOICE")]
    [InlineData(SampleVatTrn.GulfHarvest, "SAMPLE INVOICE")]
    [InlineData("100000000000099", "TAX INVOICE")]
    public void DocumentTitle_NeverTaxInvoice_ForEmptyOrSample(string? trn, string expected)
    {
        Assert.Equal(expected, SampleVatTrn.DocumentTitle(trn));
    }

    [Fact]
    public void DocumentTrnDisplay_OmitsEmpty_PrefixesSample()
    {
        Assert.Null(SampleVatTrn.DocumentTrnDisplay(null));
        Assert.Null(SampleVatTrn.DocumentTrnDisplay(""));
        Assert.Equal("SAMPLE 900000000000001", SampleVatTrn.DocumentTrnDisplay(SampleVatTrn.FrozenHub1));
        Assert.Equal("100000000000099", SampleVatTrn.DocumentTrnDisplay("100000000000099"));
    }

    [Fact]
    public void RequireTaxInvoiceVatTrn_RejectsEmptyAndSample()
    {
        Assert.Throws<TaxInvoiceSettingsException>(() => SampleVatTrn.RequireTaxInvoiceVatTrn(null, "Production"));
        Assert.Throws<TaxInvoiceSettingsException>(() => SampleVatTrn.RequireTaxInvoiceVatTrn(SampleVatTrn.FrozenHub1, "Development"));
        SampleVatTrn.RequireTaxInvoiceVatTrn("100000000000099", "Production");
    }

    [Theory]
    [InlineData("frozenhub1", SampleVatTrn.FrozenHub1)]
    [InlineData("frozenhub2", SampleVatTrn.FrozenHub2)]
    [InlineData("gulfharvest", SampleVatTrn.GulfHarvest)]
    [InlineData("zayoga", null)]
    public void SampleForSlug_MapsKnownTenants_ExcludesZayogya(string slug, string? expected)
    {
        Assert.Equal(expected, SampleVatTrn.SampleForSlug(slug));
    }
}
