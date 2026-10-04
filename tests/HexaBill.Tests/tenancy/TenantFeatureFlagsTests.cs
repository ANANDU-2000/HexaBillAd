using HexaBill.Api.Modules.SuperAdmin;

namespace HexaBill.Tests;

public class TenantFeatureFlagsTests
{
    [Theory]
    [InlineData("""["receipt_snapshots","sale_cost_snapshots"]""", "receipt_snapshots", true)]
    [InlineData("""["receipt_snapshots","sale_cost_snapshots","purchase_cost_snapshots"]""", "purchase_cost_snapshots", true)]
    [InlineData("""["receipt_snapshots","sale_cost_snapshots"]""", "sale_cost_snapshots", true)]
    [InlineData("""["receipt_snapshots"]""", "sale_cost_snapshots", false)]
    [InlineData(null, TenantFeatureFlags.SaleCostSnapshots, false)]
    public void SnapshotFlags_ParseFromTenantFeaturesJson(string? json, string key, bool expected)
    {
        Assert.Equal(expected, TenantFeatureFlags.IsEnabled(json, key));
    }
}
