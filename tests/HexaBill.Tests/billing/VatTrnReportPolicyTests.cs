using HexaBill.Api.Core.Tenancy;
using HexaBill.Api.Modules.Reports;

namespace HexaBill.Tests;

public sealed class VatTrnReportPolicyTests
{
    [Fact]
    public void ValidNonSampleFormatIsAcceptedForLocalManagementLifecycleButMarkedUnverified()
    {
        Assert.True(VatTrnReportPolicy.CanFreeze("100000000000099", "Production", null));
        Assert.Equal("TRN not verified", StatusFor("100000000000099"));
    }

    [Theory]
    [InlineData("Production", null)]
    [InlineData("Testing", "false")]
    public void SampleTrnIsRejectedWithoutExplicitTestingOptIn(string environment, string? optIn)
    {
        Assert.False(VatTrnReportPolicy.CanFreeze(SampleVatTrn.FrozenHub1, environment, optIn));
    }

    [Fact]
    public void SampleTrnIsRejectedInProductionEvenWhenTestingOptInIsSet()
    {
        Assert.False(VatTrnReportPolicy.CanFreeze(SampleVatTrn.FrozenHub1, "Production", "true"));
    }

    [Fact]
    public void SampleTrnIsAllowedOnlyInExplicitTestingEnvironment()
    {
        Assert.True(VatTrnReportPolicy.CanFreeze(SampleVatTrn.FrozenHub1, "Testing", "true"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("12345")]
    [InlineData("10000000000009x")]
    public void MissingOrInvalidTrnIsRejected(string? trn)
    {
        Assert.False(VatTrnReportPolicy.CanFreeze(trn, "Production", null));
    }

    private static string StatusFor(string trn) =>
        SampleVatTrn.IsRealVatTrn(trn) ? "TRN not verified" : "Invalid format";
}
