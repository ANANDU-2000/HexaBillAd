using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Customers;
using HexaBill.Api.Modules.Notifications;
using HexaBill.Api.Modules.Payments;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

public class SettlementAdjustmentPaymentTests
{
    [Fact]
    public async Task FIN04_CashPlusAuthorizedAdjustment_ClosesInvoiceWithoutInflatingCash()
    {
        await using var db = await DatabaseAsync(enableAdjustments: true);
        var service = Service(db);
        var result = await service.CreatePaymentAsync(new CreatePaymentRequest
        {
            SaleId = 1,
            CustomerId = 1,
            Amount = 1330m,
            SettlementAdjustmentAmount = 1m,
            SettlementAdjustmentReason = "Customer paid 1330 cash; 1 AED rounding agreed",
            Mode = "CASH"
        }, 1, 10);

        Assert.Equal(1330m, result.Payment.Amount);
        Assert.NotNull(result.SettlementAdjustment);
        Assert.Equal(1m, result.SettlementAdjustment!.Amount);
        Assert.Equal("Paid", result.Invoice!.Status);
        Assert.Equal(1331m, result.Invoice!.PaidAmount);
        Assert.Equal(2, await db.Payments.CountAsync());
        var adjustment = await db.Payments.SingleAsync(p => p.IsSettlementAdjustment);
        Assert.Equal(result.Payment.Id, adjustment.ParentPaymentId);
    }

    [Fact]
    public async Task SettlementAdjustment_RejectedWhenFlagOff()
    {
        await using var db = await DatabaseAsync(enableAdjustments: false);
        var service = Service(db);
        await Assert.ThrowsAsync<ArgumentException>(() => service.CreatePaymentAsync(new CreatePaymentRequest
        {
            SaleId = 1,
            CustomerId = 1,
            Amount = 1330m,
            SettlementAdjustmentAmount = 1m,
            SettlementAdjustmentReason = "not enabled",
            Mode = "CASH"
        }, 1, 10));
    }

    private static PaymentService Service(AppDbContext db)
    {
        var balances = new BalanceStub();
        var alerts = new AlertStub();
        return new PaymentService(db, NullLogger<PaymentService>.Instance, new ValidationService(db), balances.Object, alerts.Object);
    }

    private sealed class BalanceStub : InterfaceStub<IBalanceService>
    {
        public BalanceStub() => When("RecalculateCustomerBalanceAsync", _ => Task.CompletedTask);
    }

    private sealed class AlertStub : InterfaceStub<IAlertService> { }

    private static async Task<AppDbContext> DatabaseAsync(bool enableAdjustments)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        db.SetRequestTenantScope(10, false);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        var now = DateTime.UtcNow;
        var features = enableAdjustments ? """["settlement_adjustments"]""" : null;
        db.Tenants.Add(new Tenant { Id = 10, Name = "Settlement fixture", Subdomain = "settle", FeaturesJson = features });
        db.Users.Add(new User { Id = 1, TenantId = 10, OwnerId = 10, Name = "Owner", Email = "o@example.test", PasswordHash = "x", Role = UserRole.Owner, CreatedAt = now });
        db.Customers.Add(new Customer { Id = 1, TenantId = 10, OwnerId = 10, Name = "Buyer", Balance = 1331m, CreatedAt = now, UpdatedAt = now });
        db.Sales.Add(new Sale
        {
            Id = 1,
            TenantId = 10,
            OwnerId = 10,
            CustomerId = 1,
            InvoiceNo = "INV-1331",
            GrandTotal = 1331m,
            PaidAmount = 0,
            PaymentStatus = SalePaymentStatus.Pending,
            CreatedBy = 1,
            CreatedAt = now,
            InvoiceDate = now
        });
        await db.SaveChangesAsync();
        return db;
    }
}
