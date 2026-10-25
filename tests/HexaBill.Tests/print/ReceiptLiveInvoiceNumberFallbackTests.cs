using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;
using static HexaBill.Tests.ReceiptLiveInvoiceNumberTests;

namespace HexaBill.Tests;

/// <summary>P0-PRINT-013: the live invoice-number lookup only trusts a live, same-tenant sale; otherwise the snapshot number stays.</summary>
public class ReceiptLiveInvoiceNumberFallbackTests
{
    private static PaymentReceiptDetailDto Doc(string no) => new()
    {
        ReceiptNumber = "REC-1", AmountReceived = 1m,
        Invoices = [new PaymentReceiptInvoiceLineDto { InvoiceNo = no, InvoiceTotal = 1m, AmountApplied = 1m }]
    };

    [Fact]
    public async Task OtherTenantSale_FallsBackToSnapshot()
    {
        await using var db = await NewDbAsync();
        db.Sales.Add(new Sale { Id = 2, TenantId = OtherTenantId, OwnerId = OtherTenantId, InvoiceNo = "9999", CreatedBy = 1 });
        await db.SaveChangesAsync();
        var d = Doc("SNAP-1");
        await Receipts(db).ApplyLiveInvoiceNumbersAsync(TenantId, [(2, d)]);
        Assert.Equal("SNAP-1", d.Invoices[0].InvoiceNo);
    }

    [Fact]
    public async Task MissingSale_FallsBackToSnapshot()
    {
        await using var db = await NewDbAsync();
        var d = Doc("SNAP-1");
        await Receipts(db).ApplyLiveInvoiceNumbersAsync(TenantId, [(424242, d)]);
        Assert.Equal("SNAP-1", d.Invoices[0].InvoiceNo);
    }

    [Fact]
    public async Task DeletedSale_FallsBackToSnapshot()
    {
        await using var db = await NewDbAsync();
        db.Sales.Add(new Sale { Id = 3, TenantId = TenantId, OwnerId = TenantId, InvoiceNo = "7009", IsDeleted = true, CreatedBy = 1 });
        await db.SaveChangesAsync();
        var d = Doc("SNAP-1");
        await Receipts(db).ApplyLiveInvoiceNumbersAsync(TenantId, [(3, d)]);
        Assert.Equal("SNAP-1", d.Invoices[0].InvoiceNo);
    }

    [Fact]
    public async Task SameTenantLiveSale_UsesCurrentNumber_AndWritesNothing()
    {
        await using var db = await NewDbAsync();
        var d1 = Doc("SNAP-1"); var d2 = Doc("SNAP-2");
        await Receipts(db).ApplyLiveInvoiceNumbersAsync(TenantId, [(1, d1), (1, d2), (null, Doc("On account"))]);
        Assert.Equal(OldNo, d1.Invoices[0].InvoiceNo);
        Assert.Equal(OldNo, d2.Invoices[0].InvoiceNo);
        Assert.False(db.ChangeTracker.HasChanges());
    }
}
