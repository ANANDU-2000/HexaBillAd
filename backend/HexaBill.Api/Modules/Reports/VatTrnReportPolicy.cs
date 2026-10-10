using HexaBill.Api.Core.Tenancy;

namespace HexaBill.Api.Modules.Reports;

public static class VatTrnReportPolicy
{
    public static bool CanFreeze(string? vatTrn, string? environmentName, string? allowSampleInTests) =>
        SampleVatTrn.IsRealVatTrn(vatTrn)
        || (SampleVatTrn.IsSample(vatTrn)
            && string.Equals(environmentName, "Testing", StringComparison.OrdinalIgnoreCase)
            && string.Equals(allowSampleInTests, "true", StringComparison.OrdinalIgnoreCase));
}
