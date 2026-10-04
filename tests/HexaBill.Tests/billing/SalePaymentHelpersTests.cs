using HexaBill.Api.Models;

namespace HexaBill.Tests;

public class SalePaymentHelpersTests
{
    [Fact]
    public void ComputeSalePaymentState_FullPaymentWithinTolerance_IsPaid()
    {
        var (paid, status, _) = SalePaymentHelpers.ComputeSalePaymentStateFromClearedTotal(104.96m, 105.00m, DateTime.UtcNow);
        Assert.Equal(105.00m, paid);
        Assert.Equal(SalePaymentStatus.Paid, status);
    }

    [Fact]
    public void ComputeSalePaymentState_PartialPayment_IsPartial()
    {
        var (paid, status, _) = SalePaymentHelpers.ComputeSalePaymentStateFromClearedTotal(40m, 100m, DateTime.UtcNow);
        Assert.Equal(40m, paid);
        Assert.Equal(SalePaymentStatus.Partial, status);
    }

    [Fact]
    public void ComputeSalePaymentState_ZeroGrandTotal_IsPaid()
    {
        var (paid, status, _) = SalePaymentHelpers.ComputeSalePaymentStateFromClearedTotal(0m, 0m, null);
        Assert.Equal(0m, paid);
        Assert.Equal(SalePaymentStatus.Paid, status);
    }

    [Fact]
    public void ComputeSalePaymentState_NoCleared_IsPending()
    {
        var (paid, status, last) = SalePaymentHelpers.ComputeSalePaymentStateFromClearedTotal(0m, 50m, null);
        Assert.Equal(0m, paid);
        Assert.Equal(SalePaymentStatus.Pending, status);
        Assert.Null(last);
    }

    [Fact]
    public void ComputeSalePaymentState_WithExplicitAdjustment_ClosesInvoiceWithoutToleranceInflation()
    {
        var (paid, status, _) = SalePaymentHelpers.ComputeSalePaymentStateFromClearedAndAdjustments(1330m, 1m, 1331m, DateTime.UtcNow);
        Assert.Equal(1331m, paid);
        Assert.Equal(SalePaymentStatus.Paid, status);
    }

    [Fact]
    public void ComputeSalePaymentState_CashOnlyLargeShortfall_StaysPartial()
    {
        var (paid, status, _) = SalePaymentHelpers.ComputeSalePaymentStateFromClearedAndAdjustments(1330m, 0m, 1331m, DateTime.UtcNow);
        Assert.Equal(1330m, paid);
        Assert.Equal(SalePaymentStatus.Partial, status);
    }

    [Fact]
    public void GetPaymentLineStatus_ChequeIsPending_CashIsCleared()
    {
        Assert.Equal(PaymentStatus.PENDING, SalePaymentHelpers.GetPaymentLineStatus(PaymentMode.CHEQUE));
        Assert.Equal(PaymentStatus.CLEARED, SalePaymentHelpers.GetPaymentLineStatus(PaymentMode.CASH));
    }
}
