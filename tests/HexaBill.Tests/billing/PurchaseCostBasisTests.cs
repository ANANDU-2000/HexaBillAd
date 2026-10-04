using HexaBill.Api.Models;
using HexaBill.Api.Modules.Purchases;

namespace HexaBill.Tests;

public class PurchaseCostBasisTests
{
    [Fact]
    public void Capture_WhenEnabled_FreezesConversionAndTimestamp()
    {
        var product = new Product { Id = 1, TenantId = 10, ConversionToBase = 12 };
        var line = new PurchaseItem { ProductId = 1, UnitType = "CRTN", UnitCost = 50, UnitCostExclVat = 47.62m };
        PurchaseCostBasis.Capture(line, product, 10, enabled: true);
        Assert.True(PurchaseCostBasis.HasSnapshot(line));
        Assert.Equal(12m, line.ConversionAtPurchase);
        Assert.NotNull(line.CostCapturedAt);
    }

    [Fact]
    public void Capture_WhenDisabled_LeavesEvidenceUnset()
    {
        var product = new Product { Id = 1, TenantId = 10, ConversionToBase = 12 };
        var line = new PurchaseItem { ProductId = 1, UnitType = "CRTN", UnitCost = 50 };
        PurchaseCostBasis.Capture(line, product, 10, enabled: false);
        Assert.False(PurchaseCostBasis.HasSnapshot(line));
        Assert.Null(line.ConversionAtPurchase);
    }

    [Fact]
    public void FIN11_ProductConversionEdit_DoesNotRewriteSavedPurchaseLine()
    {
        var product = new Product { Id = 1, TenantId = 10, ConversionToBase = 24 };
        var saved = new PurchaseItem
        {
            ProductId = 1,
            UnitType = "CRTN",
            UnitCost = 50,
            UnitCostExclVat = 47.62m,
            ConversionAtPurchase = 12,
            CostCapturedAt = DateTime.UtcNow.AddDays(-1)
        };
        var replacement = new PurchaseItem { ProductId = 1, UnitType = "CRTN", UnitCost = 99, UnitCostExclVat = 90 };
        PurchaseCostBasis.Capture(replacement, product, 10, enabled: true, previous: [saved]);
        Assert.Equal(50m, replacement.UnitCost);
        Assert.Equal(47.62m, replacement.UnitCostExclVat);
        Assert.Equal(12m, replacement.ConversionAtPurchase);
        Assert.Equal(saved.CostCapturedAt, replacement.CostCapturedAt);
    }
}
