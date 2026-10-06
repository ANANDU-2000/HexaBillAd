using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Payments;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

public class PaymentAllocationTests
{
    [Theory]
    [InlineData("0.03", "0.015")]
    [InlineData("0.015", "0.01")]
    [InlineData("0.004", "0.004")]
    public async Task SubCentAllocation_IsRejectedWithoutMoneyWrites(string total, string perInvoice)
    {
        await using var db = await DatabaseAsync();
        AddSecondInvoice(db);
        await db.SaveChangesAsync();
        var amount = decimal.Parse(total, System.Globalization.CultureInfo.InvariantCulture);
        var itemAmount = decimal.Parse(perInvoice, System.Globalization.CultureInfo.InvariantCulture);
        var request = Request(amount);
        request.Allocations = [new() { InvoiceId = 1, Amount = itemAmount }, new() { InvoiceId = 2, Amount = itemAmount }];

        var error = await Record.ExceptionAsync(() => Service(db).AllocatePaymentAsync(request, 1, 10));
        if (error == null)
        {
            var posted = (await db.Payments.ToListAsync()).Sum(p => p.Amount);
            Assert.Fail($"Sub-cent input was accepted: receipt budget {amount}, posted payments {posted}.");
        }
        Assert.IsType<ArgumentException>(error);

        db.ChangeTracker.Clear();
        Assert.Empty(await db.Payments.ToListAsync());
        Assert.Empty(await db.AuditLogs.ToListAsync());
        Assert.All(await db.Sales.ToListAsync(), sale => Assert.Equal(0m, sale.PaidAmount));
    }

    [Fact]
    public async Task CentPrecisionAllocations_CannotExceedTotalReceiptBudget()
    {
        await using var db = await DatabaseAsync();
        AddSecondInvoice(db);
        await db.SaveChangesAsync();
        var request = Request(0.03m);
        request.Allocations = [new() { InvoiceId = 1, Amount = 0.02m }, new() { InvoiceId = 2, Amount = 0.02m }];

        await Service(db).AllocatePaymentAsync(request, 1, 10);

        db.ChangeTracker.Clear();
        var payments = await db.Payments.OrderBy(p => p.SaleId).ToListAsync();
        Assert.Equal(2, payments.Count);
        Assert.Equal(0.02m, payments[0].Amount);
        Assert.Equal(0.01m, payments[1].Amount);
        Assert.Equal(request.Amount, payments.Sum(p => p.Amount));
        Assert.Equal(199.97m, (await db.Customers.SingleAsync()).Balance);
    }

    [Fact]
    public async Task DuplicateInvoiceAllocations_AreRejectedWithoutMoneyWrites()
    {
        await using var db = await DatabaseAsync();
        var request = Request(200m);
        request.Allocations = [new() { InvoiceId = 1, Amount = 100m }, new() { InvoiceId = 1, Amount = 100m }];

        await Assert.ThrowsAsync<ArgumentException>(() => Service(db).AllocatePaymentAsync(request, 1, 10));

        db.ChangeTracker.Clear();
        Assert.Empty(await db.Payments.ToListAsync());
        Assert.Empty(await db.AuditLogs.ToListAsync());
        Assert.Equal(0m, (await db.Sales.SingleAsync()).PaidAmount);
        Assert.Equal(100m, (await db.Customers.SingleAsync()).Balance);
    }

    [Fact]
    public async Task DistinctAllocation_PostsOnceAndRefreshesInvoiceAndCustomerBalance()
    {
        await using var db = await DatabaseAsync();
        await Service(db).AllocatePaymentAsync(Request(60m), 1, 10);

        db.ChangeTracker.Clear();
        Assert.Equal(60m, (await db.Payments.SingleAsync()).Amount);
        Assert.Equal(60m, (await db.Sales.SingleAsync()).PaidAmount);
        Assert.Equal(SalePaymentStatus.Partial, (await db.Sales.SingleAsync()).PaymentStatus);
        Assert.Equal(40m, (await db.Customers.SingleAsync()).Balance);
    }

    [Fact]
    public async Task NoOutstandingAllocation_DoesNotCommitAnAuditOrIdempotencyRecord()
    {
        await using var db = await DatabaseAsync();
        var sale = await db.Sales.SingleAsync();
        sale.PaidAmount = sale.GrandTotal;
        sale.PaymentStatus = SalePaymentStatus.Paid;
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Service(db).AllocatePaymentAsync(Request(100m), 1, 10, "empty-allocation-fixture"));

        db.ChangeTracker.Clear();
        Assert.Empty(await db.Payments.ToListAsync());
        Assert.Empty(await db.AuditLogs.ToListAsync());
        Assert.Empty(await db.PaymentIdempotencies.ToListAsync());
    }

    internal static PaymentService Service(AppDbContext db) =>
        new(db, NullLogger<PaymentService>.Instance, null!, null!, null!);

    internal static AllocatePaymentRequest Request(decimal amount, int customerId = 1, int invoiceId = 1) => new()
    {
        CustomerId = customerId, Amount = amount, Mode = "CASH",
        Allocations = [new() { InvoiceId = invoiceId, Amount = amount }]
    };

    private static void AddSecondInvoice(AppDbContext db)
    {
        var now = DateTime.UtcNow;
        db.Sales.Add(new Sale { Id = 2, TenantId = 10, OwnerId = 10, CustomerId = 1, InvoiceNo = "ALLOCATION-SECOND", GrandTotal = 100m, PaidAmount = 0m, PaymentStatus = SalePaymentStatus.Pending, CreatedBy = 1, CreatedAt = now, InvoiceDate = now });
    }

    private static async Task<AppDbContext> DatabaseAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        db.SetRequestTenantScope(10, false);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        Seed(db, 10, 1);
        await db.SaveChangesAsync();
        return db;
    }

    internal static void Seed(AppDbContext db, int tenantId, int recordId)
    {
        var now = DateTime.UtcNow;
        db.Tenants.Add(new Tenant { Id = tenantId, Name = "Allocation fixture", Subdomain = $"allocation-{tenantId}" });
        db.Users.Add(new User { Id = recordId, TenantId = tenantId, OwnerId = tenantId, Name = "Fixture owner", Email = $"allocation-{tenantId}@example.test", PasswordHash = "fixture", Role = UserRole.Owner, CreatedAt = now });
        db.Customers.Add(new Customer { Id = recordId, TenantId = tenantId, OwnerId = tenantId, Name = "Fixture buyer", Balance = 100m, PendingBalance = 100m, CreatedAt = now, UpdatedAt = now });
        db.Sales.Add(new Sale { Id = recordId, TenantId = tenantId, OwnerId = tenantId, CustomerId = recordId, InvoiceNo = $"ALLOCATION-{tenantId}", GrandTotal = 100m, PaidAmount = 0m, PaymentStatus = SalePaymentStatus.Pending, CreatedBy = recordId, CreatedAt = now, InvoiceDate = now });
    }
}
