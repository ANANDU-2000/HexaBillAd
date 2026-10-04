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
    [InlineData("104825619000003")] // Crystal Freeze — forbidden
    public void Production_RejectsSampleAndCrystalFreezeTrn(string trn)
    {
        var ex = Assert.Throws<TaxInvoiceSettingsException>(() =>
            SampleVatTrn.RequireTaxInvoiceVatTrn(trn, "Production"));
        Assert.Contains("Sample VAT", ex.Message);
    }

    [Fact]
    public void NonProduction_AllowsSampleFixtureTrn()
    {
        SampleVatTrn.RequireTaxInvoiceVatTrn(SampleVatTrn.UnitFixture, "Development");
        SampleVatTrn.RequireTaxInvoiceVatTrn(SampleVatTrn.FrozenHub1, "Staging");
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
}
