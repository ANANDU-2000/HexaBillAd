using HexaBill.Api.Core.Tenancy;

namespace HexaBill.Tests;

/// <summary>VAT-001: FrozenHub registered with TRN 105607243000003 effective 2026-11-01. Earlier invoices are not tax invoices.</summary>
public class VatEffectiveDateTitleTests
{
    private const string Trn = "105607243000003";

    [Theory]
    [InlineData("2026-11-01")]
    [InlineData("01-11-2026")]
    [InlineData("01/11/2026")]
    public void InvoiceBeforeEffectiveDate_IsNotTaxInvoice(string effective)
    {
        Assert.Equal("INVOICE", SampleVatTrn.DocumentTitle(Trn, new DateTime(2026, 10, 24), effective));
        Assert.Equal("INVOICE", SampleVatTrn.DocumentTitle(Trn, new DateTime(2026, 10, 31, 23, 59, 0), effective));
    }

    [Theory]
    [InlineData("2026-11-01")]
    [InlineData("01-11-2026")]
    public void InvoiceOnOrAfterEffectiveDate_IsTaxInvoice(string effective)
    {
        Assert.Equal("TAX INVOICE", SampleVatTrn.DocumentTitle(Trn, new DateTime(2026, 11, 1), effective));
        Assert.Equal("TAX INVOICE", SampleVatTrn.DocumentTitle(Trn, new DateTime(2027, 1, 5), effective));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("soon")]
    public void MissingEffectiveDate_DoesNotAssumeJanuary_KeepsTrnRule(string? effective)
    {
        Assert.Null(SampleVatTrn.ParseVatEffectiveDate(effective));
        Assert.Equal("TAX INVOICE", SampleVatTrn.DocumentTitle(Trn, new DateTime(2026, 10, 24), effective));
    }

    [Fact]
    public void NoOrSampleTrn_NeverTaxInvoice_RegardlessOfDate()
    {
        Assert.Equal("INVOICE", SampleVatTrn.DocumentTitle("", new DateTime(2027, 1, 1), "2026-11-01"));
        Assert.Equal("INVOICE", SampleVatTrn.DocumentTitle("105543085200001X", new DateTime(2027, 1, 1), "2026-11-01"));
    }

    [Fact]
    public void NewTenantSettingsDefault_HasNoAssumedEffectiveDate()
    {
        Assert.Equal("", new HexaBill.Api.Models.CompanySettings().VatEffectiveDate);
    }
}
