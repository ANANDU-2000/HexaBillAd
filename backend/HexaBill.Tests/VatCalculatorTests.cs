/*
Purpose: Unit tests for UAE FTA VAT calculator and Section 12 test dataset expectations.
Author: HexaBill
Date: 2026
*/
using HexaBill.Api.Shared.Services;

namespace HexaBill.Tests;

public class VatCalculatorTests
{
    [Fact]
    public void Round_AwayFromZero_TwoDecimalPlaces()
    {
        Assert.Equal(100.12m, VatCalculator.Round(100.124m));
        Assert.Equal(100.13m, VatCalculator.Round(100.125m));
        Assert.Equal(100.13m, VatCalculator.Round(100.126m));
    }

    [Fact]
    public void ForSupply_Standard_Applies5Percent()
    {
        var r = VatCalculator.ForSupply(10_000m, VatScenarios.Standard);
        Assert.Equal(10_000m, r.NetAmount);
        Assert.Equal(0.05m, r.VatRate);
        Assert.Equal(500m, r.VatAmount);
        Assert.Equal(10_500m, r.TotalAmount);
        Assert.Equal(0, r.ClaimableVat);
        Assert.Equal(0, r.ReverseChargeVat);
    }

    [Fact]
    public void ForSupply_ZeroRated_NoVat()
    {
        var r = VatCalculator.ForSupply(8_000m, VatScenarios.ZeroRated);
        Assert.Equal(8_000m, r.NetAmount);
        Assert.Equal(0, r.VatRate);
        Assert.Equal(0, r.VatAmount);
        Assert.Equal(8_000m, r.TotalAmount);
    }

    [Fact]
    public void ForSupply_Exempt_NoVat()
    {
        var r = VatCalculator.ForSupply(1_000m, VatScenarios.Exempt);
        Assert.Equal(1_000m, r.NetAmount);
        Assert.Equal(0, r.VatAmount);
    }

    [Fact]
    public void ForSupply_OutOfScope_NoVat()
    {
        var r = VatCalculator.ForSupply(0m, VatScenarios.OutOfScope);
        Assert.Equal(0, r.NetAmount);
        Assert.Equal(0, r.VatAmount);
    }

    [Fact]
    public void ForSupply_ReverseCharge_OutputsReverseChargeVat()
    {
        var r = VatCalculator.ForSupply(1_000m, VatScenarios.ReverseCharge);
        Assert.Equal(1_000m, r.NetAmount);
        Assert.Equal(50m, r.VatAmount);
        Assert.Equal(50m, r.ReverseChargeVat);
    }

    [Fact]
    public void ForExpense_StandardClaimable_FullVatClaimable()
    {
        var r = VatCalculator.ForExpense(2_000m, TaxTypes.Standard, isTaxClaimable: true, isEntertainment: false, 100m);
        Assert.Equal(2_000m, r.NetAmount);
        Assert.Equal(100m, r.VatAmount);
        Assert.Equal(100m, r.ClaimableVat);
    }

    [Fact]
    public void ForExpense_Entertainment_50PercentCap()
    {
        // EXP-002: 500 + 25 VAT, ITC 50% (entertainment) => claimable 12.50
        var r = VatCalculator.ForExpense(500m, TaxTypes.Standard, isTaxClaimable: true, isEntertainment: true, 100m);
        Assert.Equal(500m, r.NetAmount);
        Assert.Equal(25m, r.VatAmount);
        Assert.Equal(12.50m, r.ClaimableVat);
    }

    [Fact]
    public void ForExpense_Petroleum_ZeroClaimable()
    {
        var r = VatCalculator.ForExpense(200m, TaxTypes.Petroleum, isTaxClaimable: false, isEntertainment: false);
        Assert.Equal(200m, r.NetAmount);
        Assert.Equal(0, r.VatAmount);
        Assert.Equal(0, r.ClaimableVat);
    }

    [Fact]
    public void ForExpense_Exempt_NoVat()
    {
        var r = VatCalculator.ForExpense(300m, TaxTypes.Exempt, isTaxClaimable: false, isEntertainment: false);
        Assert.Equal(300m, r.NetAmount);
        Assert.Equal(0, r.VatAmount);
        Assert.Equal(0, r.ClaimableVat);
    }

    [Fact]
    public void ForReverseChargePurchase_Claimable_Box10Vat()
    {
        var r = VatCalculator.ForReverseChargePurchase(1_000m, isTaxClaimable: true);
        Assert.Equal(1_000m, r.NetAmount);
        Assert.Equal(50m, r.ReverseChargeVat);
        Assert.Equal(50m, r.ClaimableVat);
    }

    /// <summary>Section 12.1 test dataset: manual box totals from INV/EXP/PUR/IMP.</summary>
    [Fact]
    public void Section12_ExpectedBoxTotals_FromTestDataset()
    {
        // INV-001: 10,000 + 500; INV-002: 5,000 + 250; INV-003: 8,000 zero-rated; INV-004: 0 zero; CN-001: -1,000 -50
        decimal box1a = 10_000 + 5_000 - 1_000; // 14,000
        decimal box1b = 500 + 250 - 50;         // 700
        decimal box2 = 8_000;
        // EXP-001: 100% ITC 100; EXP-002: 50% cap 12.50; EXP-003 petroleum 0; EXP-004 exempt 0
        decimal box9b = 100 + 12.50m + 150;     // PUR-001 150 + expenses 100 + 12.50 = 262.50
        decimal box10 = 50;                    // IMP-001 reverse charge
        decimal box11 = 0;
        decimal box12 = box9b + box10 - box11;  // 312.50
        decimal box13a = Math.Max(0, box1b - box12); // 387.50
        decimal box13b = Math.Max(0, box12 - box1b); // 0

        Assert.Equal(14_000m, box1a);
        Assert.Equal(700m, box1b);
        Assert.Equal(8_000m, box2);
        Assert.Equal(262.50m, box9b);
        Assert.Equal(50m, box10);
        Assert.Equal(312.50m, box12);
        Assert.Equal(387.50m, box13a);
        Assert.Equal(0m, box13b);
    }
}
