using HexaBill.Api.Core.Tenancy;
using HexaBill.Api.Models;

namespace HexaBill.Tests;

public class SampleVatTrnTests
{
    [Theory]
    [InlineData(SampleVatTrn.FrozenHub1)]
    [InlineData(SampleVatTrn.FrozenHub2)]
    [InlineData(SampleVatTrn.GulfHarvest)]
    [InlineData(SampleVatTrn.UnitFixture)]
    public void Production_AllowsHexaBillSampleTrn(string trn)
    {
        SampleVatTrn.RequireTaxInvoiceVatTrn(trn, "Production");
        SampleVatTrn.RequireTaxInvoiceVatTrn(trn, "Development");
    }

    [Fact]
    public void Production_RejectsCrystalFreezeReferenceTrn()
    {
        var ex = Assert.Throws<TaxInvoiceSettingsException>(() =>
            SampleVatTrn.RequireTaxInvoiceVatTrn(SampleVatTrn.CrystalFreezeForbidden, "Production"));
        Assert.Contains("layout reference", ex.Message);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("123")]
    [InlineData("12345678901234A")]
    public void EmptyOrInvalid_AlwaysRejected(string? trn)
    {
        Assert.Throws<TaxInvoiceSettingsException>(() =>
            SampleVatTrn.RequireTaxInvoiceVatTrn(trn, "Development"));
    }

    [Theory]
    [InlineData("frozenhub1", SampleVatTrn.FrozenHub1)]
    [InlineData("frozenhub2", SampleVatTrn.FrozenHub2)]
    [InlineData("gulfharvest", SampleVatTrn.GulfHarvest)]
    [InlineData("zayoga", null)]
    [InlineData("zayogya", null)]
    public void SampleForSlug_MapsKnownTenants_ExcludesZayogya(string slug, string? expected)
    {
        Assert.Equal(expected, SampleVatTrn.SampleForSlug(slug));
    }
}
