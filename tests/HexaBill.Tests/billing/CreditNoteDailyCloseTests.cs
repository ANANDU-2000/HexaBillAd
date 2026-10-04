using System.Text.Json;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Customers;
using HexaBill.Api.Modules.DailyClose;
using HexaBill.Api.Modules.Returns;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Tests;

public class CreditNoteDailyCloseTests
{
    [Fact]
    public async Task ApplyCreditNote_OnClosedBusinessDay_IsRejectedAtomically()
    {
        await using var db = await DatabaseAsync();
        var service = Service(db);

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.ApplyCreditNoteAsync(1, 2, 20m, 1, 10));

        db.ChangeTracker.Clear();
        Assert.Empty(await db.Payments.IgnoreQueryFilters().ToListAsync());
        var note = await db.CreditNotes.IgnoreQueryFilters().SingleAsync(c => c.Id == 1);
        Assert.Equal(0m, note.AppliedAmount);
        Assert.Equal("unused", note.Status);
    }

    [Fact]
    public async Task RefundCreditNote_OnClosedBusinessDay_IsRejectedAtomically()
    {
        await using var db = await DatabaseAsync();
        var service = Service(db);

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.RefundCreditNoteAsync(1, 1, 10));

        db.ChangeTracker.Clear();
        Assert.Empty(await db.Payments.IgnoreQueryFilters().ToListAsync());
        var note = await db.CreditNotes.IgnoreQueryFilters().SingleAsync(c => c.Id == 1);
        Assert.Equal(0m, note.AppliedAmount);
        Assert.Equal("unused", note.Status);
    }

    private static ReturnService Service(AppDbContext db) => new(db, new CustomerService(db), null!, null!);

    private static async Task<AppDbContext> DatabaseAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        db.SetRequestTenantScope(10, false);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        var now = DateTime.UtcNow;
        db.Tenants.Add(new Tenant
        {
            Id = 10,
            Name = "Credit close fixture",
            Subdomain = "credit-close",
            FeaturesJson = JsonSerializer.Serialize(new[] { TenantFeatureFlags.DailyClose })
        });
        db.Users.Add(new User
        {
            Id = 1, TenantId = 10, OwnerId = 10, Name = "Owner", Email = "owner@credit.test",
            PasswordHash = "x", Role = UserRole.Owner, CreatedAt = now
        });
        db.Customers.Add(new Customer { Id = 1, TenantId = 10, OwnerId = 10, Name = "Customer", Balance = 100m, CreatedAt = now, UpdatedAt = now });
        db.Sales.AddRange(
            new Sale { Id = 1, TenantId = 10, OwnerId = 10, CustomerId = 1, InvoiceNo = "INV-ORIGIN", InvoiceDate = now, GrandTotal = 50m, TotalAmount = 50m, PaymentStatus = SalePaymentStatus.Paid, CreatedBy = 1, CreatedAt = now },
            new Sale { Id = 2, TenantId = 10, OwnerId = 10, CustomerId = 1, InvoiceNo = "INV-TARGET", InvoiceDate = now, GrandTotal = 100m, TotalAmount = 100m, PaymentStatus = SalePaymentStatus.Pending, CreatedBy = 1, CreatedAt = now });
        db.SaleReturns.Add(new SaleReturn
        {
            Id = 1, TenantId = 10, OwnerId = 10, SaleId = 1, CustomerId = 1, ReturnNo = "RET-CLOSE-1",
            ReturnDate = now, GrandTotal = 20m, Status = ReturnStatus.Approved, RefundStatus = "CreditIssued",
            CreatedBy = 1, CreatedAt = now
        });
        db.CreditNotes.Add(new CreditNote
        {
            Id = 1, TenantId = 10, CustomerId = 1, LinkedReturnId = 1, Amount = 20m, AppliedAmount = 0m,
            Status = "unused", Currency = "AED", CreatedAt = now, CreatedBy = 1
        });
        db.DailyCashCloses.Add(new DailyCashClose
        {
            Id = 1, TenantId = 10, OwnerId = 10, BusinessDate = DailyClosePostingGuard.ToBusinessDate(now),
            Version = 1, Status = DailyCashCloseStatus.Closed, CreatedByUserId = 1, CreatedAt = now, UpdatedAt = now
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return db;
    }
}
