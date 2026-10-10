using HexaBill.Api.Models;

namespace HexaBill.Tests;

/// <summary>D5: profit × 5% must never be treated as filing VAT.</summary>
public class VatProfitEstimateD5Tests
{
    [Fact]
    public void VatReturn201Dto_Defaults_ProfitVatZero_AndEstimateFlagOff()
    {
        var dto = new VatReturn201Dto();
        Assert.Equal(0m, dto.ProfitVat);
        Assert.Null(dto.ProfitVatEstimate);
        Assert.False(dto.ProfitEstimateNotForFiling);
    }

    [Fact]
    public void ProfitEstimate_DoesNotImplyFilingVat()
    {
        var dto = new VatReturn201Dto
        {
            ProfitAmount = 1000m,
            ProfitVat = 0m,
            ProfitEstimateNotForFiling = true,
            Box1b = 50m,
            Box13a = 40m
        };
        Assert.Equal(0m, dto.ProfitVat);
        Assert.True(dto.ProfitEstimateNotForFiling);
        Assert.Equal(50m, dto.Box1b);
        Assert.NotEqual(dto.ProfitAmount * 0.05m, dto.ProfitVat);
    }
}
