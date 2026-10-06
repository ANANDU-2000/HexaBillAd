using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Customers;
using HexaBill.Api.Modules.Notifications;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

public class BalanceRecalcTests
{
    [Fact]
    public async Task Recalculate_OnOneContext_MatchesSalesMinusClearedPayments()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("Bal_" + Guid.NewGuid())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        await using var db = new AppDbContext(options);
        db.SetRequestTenantScope(8, isPlatformScope: false);
        await db.Database.EnsureCreatedAsync();

        db.Customers.Add(new Customer { Id = 1, TenantId = 8, OwnerId = 8, Name = "Tenant 8 customer" });
        db.Sales.Add(new Sale
        {
            Id = 1,
            TenantId = 8,
            OwnerId = 8,
            CustomerId = 1,
            InvoiceNo = "T8-1",
            InvoiceDate = DateTime.UtcNow,
            GrandTotal = 100m,
            TotalAmount = 100m,
            CreatedBy = 1,
            CreatedAt = DateTime.UtcNow
        });
        db.Payments.Add(new Payment
        {
            Id = 1,
            TenantId = 8,
            OwnerId = 8,
            CustomerId = 1,
            Amount = 40m,
            Status = PaymentStatus.CLEARED,
            PaymentDate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = 1
        });
        await db.SaveChangesAsync();

        var service = new BalanceService(db, NullLogger<BalanceService>.Instance, new NoopAlertService());
        await service.RecalculateCustomerBalanceAsync(1, 8);

        var customer = await db.Customers.FindAsync(1);
        Assert.NotNull(customer);
        Assert.Equal(100m, customer!.TotalSales);
        Assert.Equal(40m, customer.TotalPayments);
        Assert.Equal(60m, customer.PendingBalance);
    }

    [Fact]
    public async Task Recalculate_WithExplicitTenant_DoesNotRewriteForeignCustomerUnderPlatformScope()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("BalIsolation_" + Guid.NewGuid())
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        await using var db = new AppDbContext(options);
        db.SetRequestTenantScope(null, isPlatformScope: true);
        await db.Database.EnsureCreatedAsync();

        db.Customers.Add(new Customer
        {
            Id = 1, TenantId = 9, OwnerId = 9, Name = "Foreign customer",
            Balance = 777m, PendingBalance = 777m, TotalSales = 500m
        });
        db.Sales.Add(new Sale
        {
            Id = 1, TenantId = 8, OwnerId = 8, CustomerId = 1, InvoiceNo = "CROSS-1",
            InvoiceDate = DateTime.UtcNow, GrandTotal = 100m, TotalAmount = 100m,
            CreatedBy = 1, CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var service = new BalanceService(db, NullLogger<BalanceService>.Instance, new NoopAlertService());
        await service.RecalculateCustomerBalanceAsync(customerId: 1, tenantId: 8);

        db.ChangeTracker.Clear();
        var foreignCustomer = await db.Customers.SingleAsync(c => c.Id == 1);
        Assert.Equal(777m, foreignCustomer.Balance);
        Assert.Equal(777m, foreignCustomer.PendingBalance);
        Assert.Equal(500m, foreignCustomer.TotalSales);
    }

    private sealed class NoopAlertService : IAlertService
    {
        public Task CreateAlertAsync(AlertType type, string title, string? message = null, AlertSeverity severity = AlertSeverity.Info, Dictionary<string, object>? metadata = null, int? tenantId = null) => Task.CompletedTask;
        public Task<List<Alert>> GetAlertsAsync(bool unreadOnly = false, int limit = 50, int? tenantId = null) => Task.FromResult(new List<Alert>());
        public Task<Alert?> GetAlertByIdAsync(int id, int? tenantId = null) => Task.FromResult<Alert?>(null);
        public Task MarkAsReadAsync(int id, int? tenantId = null) => Task.CompletedTask;
        public Task MarkAsResolvedAsync(int id, int userId, int? tenantId = null) => Task.CompletedTask;
        public Task<int> GetUnreadCountAsync(int? tenantId = null) => Task.FromResult(0);
        public Task<int> MarkAllAsReadAsync(int? tenantId = null) => Task.FromResult(0);
        public Task<int> MarkAllAsResolvedAsync(int userId, int? tenantId = null) => Task.FromResult(0);
        public Task<int> ClearResolvedAlertsAsync(int? tenantId = null) => Task.FromResult(0);
        public Task CheckAndCreateAlertsAsync() => Task.CompletedTask;
        public Task DismissSimilarAlertsAsync(AlertType type, DateTime cutoffTime) => Task.CompletedTask;
    }
}
