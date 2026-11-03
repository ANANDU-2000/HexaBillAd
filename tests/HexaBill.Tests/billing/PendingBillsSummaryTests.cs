using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Models.Legacy;
using HexaBill.Api.Modules.Customers;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Tests;

public class PendingBillsSummaryTests
{
    private static readonly DateTime Today = new(2026, 11, 3, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task PendingSummary_CountsGrossReceivables_SubtractsPaymentsAndReturns_AndAddsHistorical()
    {
        await using var db = Seed();
        var rows = await PendingBillsSummary.BuildAsync(db, 10, Today);

        var khan = Assert.Single(rows, r => r.CustomerId == 1);
        // Live: 1,510 gross − 0 paid  +  second bill 521 − 100 paid − 105 approved return(incl VAT)
        // Historical: 343 outstanding.  Receivables include VAT, so the customer owes gross amounts.
        Assert.Equal(3, khan.PendingBillCount);
        Assert.Equal(1510m + (521m - 100m - 105m) + 343m, khan.TotalOutstanding);
        Assert.Equal(new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc), khan.OldestInvoiceDate);
        Assert.Contains(khan.Bills, b => b.Source == "Historical" && b.BalanceDue == 343m);
        Assert.DoesNotContain(khan.Bills, b => b.InvoiceNo == "PAID-1");
    }

    [Fact]
    public async Task PendingSummary_SortsLargestBalanceFirst_AndExcludesFullyPaidAndOtherTenants()
    {
        await using var db = Seed();
        var rows = await PendingBillsSummary.BuildAsync(db, 10, Today);

        Assert.Equal(new[] { 1, 2 }, rows.Select(r => r.CustomerId).ToArray());
        Assert.DoesNotContain(rows, r => r.CustomerId == 3); // fully paid
        Assert.DoesNotContain(rows, r => r.CustomerId == 99); // other tenant
        Assert.Equal(1, rows[1].PendingBillCount);
    }

    [Fact]
    public async Task PendingSummary_OverdueDaysUseDueDateOrThirtyDaysAfterInvoice()
    {
        await using var db = Seed();
        var rows = await PendingBillsSummary.BuildAsync(db, 10, Today);
        var khan = rows.Single(r => r.CustomerId == 1);
        // Oldest due date is the historical bill (invoice 1 Oct + 30 days = 31 Oct) → 3 days overdue on 3 Nov.
        Assert.Equal(new DateTime(2026, 10, 31, 0, 0, 0, DateTimeKind.Utc), khan.OldestDueDate);
        Assert.Equal(3, khan.OverdueDays);
    }

    private static AppDbContext Seed()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase("Pending_" + Guid.NewGuid()).Options);
        db.SetRequestTenantScope(10, false);
        db.Customers.Add(new Customer { Id = 1, TenantId = 10, OwnerId = 10, Name = "Khan", CreatedAt = Today, UpdatedAt = Today });
        db.Customers.Add(new Customer { Id = 2, TenantId = 10, OwnerId = 10, Name = "Stick", CreatedAt = Today, UpdatedAt = Today });
        db.Customers.Add(new Customer { Id = 3, TenantId = 10, OwnerId = 10, Name = "Paid up", CreatedAt = Today, UpdatedAt = Today });
        db.Sales.Add(new Sale { Id = 1, TenantId = 10, OwnerId = 10, CustomerId = 1, InvoiceNo = "L1", InvoiceDate = Today, GrandTotal = 1510m, TotalAmount = 1510m, PaidAmount = 0m, PaymentStatus = SalePaymentStatus.Pending, CreatedBy = 1, CreatedAt = Today });
        db.Sales.Add(new Sale { Id = 2, TenantId = 10, OwnerId = 10, CustomerId = 1, InvoiceNo = "L2", InvoiceDate = Today, GrandTotal = 521m, TotalAmount = 521m, PaidAmount = 100m, PaymentStatus = SalePaymentStatus.Partial, CreatedBy = 1, CreatedAt = Today });
        db.Sales.Add(new Sale { Id = 3, TenantId = 10, OwnerId = 10, CustomerId = 3, InvoiceNo = "PAID-1", InvoiceDate = Today, GrandTotal = 200m, TotalAmount = 200m, PaidAmount = 200m, PaymentStatus = SalePaymentStatus.Paid, CreatedBy = 1, CreatedAt = Today });
        db.Sales.Add(new Sale { Id = 4, TenantId = 10, OwnerId = 10, CustomerId = 2, InvoiceNo = "S1", InvoiceDate = Today, GrandTotal = 575m, TotalAmount = 575m, PaidAmount = 0m, PaymentStatus = SalePaymentStatus.Pending, CreatedBy = 1, CreatedAt = Today });
        db.SaleReturns.Add(new SaleReturn { Id = 1, TenantId = 10, OwnerId = 10, SaleId = 2, ReturnNo = "R1", ReturnDate = Today, Subtotal = 100m, VatTotal = 5m, GrandTotal = 105m, Status = ReturnStatus.Approved });
        db.LegacyInvoices.Add(new LegacyInvoice
        {
            Id = 701, TenantId = 10, SourceInvoiceId = 7701, SourceSystem = "Starplus", LegacyInvoiceNumber = "6991",
            LegacyIssuer = "Starplus", InvoiceDate = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc), DestinationCustomerId = 1,
            GrandTotal = 343m, TotalAmount = 343m, PaidAmount = 0m, OutstandingCalculated = 343m, Status = "Pending", IsDeleted = false
        });
        db.SaveChanges();
        db.ChangeTracker.Clear();
        // Another tenant's open bill: written under its own scope (the write guard rejects cross-tenant entities).
        db.SetRequestTenantScope(11, false);
        db.Customers.Add(new Customer { Id = 99, TenantId = 11, OwnerId = 11, Name = "Other tenant", CreatedAt = Today, UpdatedAt = Today });
        db.Sales.Add(new Sale { Id = 90, TenantId = 11, OwnerId = 11, CustomerId = 99, InvoiceNo = "OTHER", InvoiceDate = Today, GrandTotal = 9999m, TotalAmount = 9999m, PaidAmount = 0m, PaymentStatus = SalePaymentStatus.Pending, CreatedBy = 1, CreatedAt = Today });
        db.SaveChanges();
        db.ChangeTracker.Clear();
        db.SetRequestTenantScope(10, false);
        return db;
    }
}
