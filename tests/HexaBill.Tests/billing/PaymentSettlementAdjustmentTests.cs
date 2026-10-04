using System.Text.Json;
using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Payments;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

public class PaymentSettlementAdjustmentTests
{
    [Fact]
    public async Task CreatePayment_WithAdjustment_ClosesInvoiceWithoutInflatingCash()
    {
        await using var db = await DatabaseAsync(enableAdjustments: true);
        var validation = new ValidationService(db);
        var service = new PaymentService(db, NullLogger<PaymentService>.Instance, validation, null!, null!);

        var result = await service.CreatePaymentAsync(
            new CreatePaymentRequest
            {
                SaleId = 1,
                CustomerId = 1,
                Amount = 1330m,
                Mode = "CASH",
                SettlementAdjustmentAmount = 1m,
                SettlementAdjustmentReason = "Rounding at counter"
            },
            userId: 1,
            tenantId: 10);

        Assert.Equal(1330m, result.Payment.Amount);
        Assert.False(result.Payment.IsSettlementAdjustment);
        Assert.NotNull(result.SettlementAdjustment);
        Assert.Equal(1m, result.SettlementAdjustment!.Amount);
        Assert.True(result.SettlementAdjustment.IsSettlementAdjustment);
        Assert.Equal(result.Payment.Id, result.SettlementAdjustment.ParentPaymentId);
        Assert.Equal("Paid", result.Invoice!.Status, StringComparer.OrdinalIgnoreCase);
        Assert.Equal(1331m, result.Invoice.PaidAmount);

        var payments = await db.Payments.Where(p => p.SaleId == 1).OrderBy(p => p.Id).ToListAsync();
        Assert.Equal(2, payments.Count);
        Assert.Equal(1330m, payments[0].Amount);
        Assert.Equal(1m, payments[1].Amount);
        Assert.True(payments[1].IsSettlementAdjustment);

        var sale = await db.Sales.SingleAsync(s => s.Id == 1);
        Assert.Equal(SalePaymentStatus.Paid, sale.PaymentStatus);
        Assert.Equal(1331m, sale.PaidAmount);
    }

    [Fact]
    public async Task CreatePayment_Adjustment_RejectedWhenFlagOff()
    {
        await using var db = await DatabaseAsync(enableAdjustments: false);
        var validation = new ValidationService(db);
        var service = new PaymentService(db, NullLogger<PaymentService>.Instance, validation, null!, null!);

        await Assert.ThrowsAsync<ArgumentException>(() => service.CreatePaymentAsync(
            new CreatePaymentRequest
            {
                SaleId = 1,
                CustomerId = 1,
                Amount = 1330m,
                Mode = "CASH",
                SettlementAdjustmentAmount = 1m,
                SettlementAdjustmentReason = "Not allowed yet"
            },
            userId: 1,
            tenantId: 10));
    }

    private static async Task<AppDbContext> DatabaseAsync(bool enableAdjustments)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        db.SetRequestTenantScope(10, false);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        var now = DateTime.UtcNow;
        var features = enableAdjustments
            ? JsonSerializer.Serialize(new[] { TenantFeatureFlags.SettlementAdjustments })
            : null;
        db.Tenants.Add(new Tenant { Id = 10, Name = "Settlement fixture", Subdomain = "settle-fix", FeaturesJson = features });
        db.Users.Add(new User
        {
            Id = 1,
            TenantId = 10,
            OwnerId = 10,
            Name = "Owner",
            Email = "owner@example.test",
            PasswordHash = "x",
            Role = UserRole.Owner,
            CreatedAt = now
        });
        db.Customers.Add(new Customer
        {
            Id = 1,
            TenantId = 10,
            OwnerId = 10,
            Name = "Ledger customer",
            Balance = 1331m,
            CreatedAt = now,
            UpdatedAt = now
        });
        db.Sales.Add(new Sale
        {
            Id = 1,
            TenantId = 10,
            OwnerId = 10,
            CustomerId = 1,
            InvoiceNo = "INV-1331",
            InvoiceDate = now,
            GrandTotal = 1331m,
            TotalAmount = 1331m,
            PaidAmount = 0,
            PaymentStatus = SalePaymentStatus.Pending,
            CreatedBy = 1,
            CreatedAt = now
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return db;
    }
}
