using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Customers;
using HexaBill.Api.Modules.Payments;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

public class PaymentIdempotencyTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task EquivalentDecimalScale_ReplaysSamePayment(bool allocate)
    {
        await using var db = await DatabaseAsync();
        db.SetRequestTenantScope(10, false);
        var first = await PostAsync(db, allocate, 10, 1, 40m, "scale-fixture-key");
        db.ChangeTracker.Clear();
        var replay = await PostAsync(db, allocate, 10, 1, 40.00m, "scale-fixture-key");
        Assert.Equal(first.Payment.Id, replay.Payment.Id);
        Assert.Single(await db.Payments.ToListAsync());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task SameClientKey_InDifferentTenants_IsIndependent(bool allocate)
    {
        await using var db = await DatabaseAsync();
        db.SetRequestTenantScope(10, false);
        var first = await PostAsync(db, allocate, 10, 1, 40m, "shared-fixture-key");
        db.ChangeTracker.Clear();
        db.SetRequestTenantScope(11, false);
        var second = await PostAsync(db, allocate, 11, 2, 40m, "shared-fixture-key");

        Assert.NotEqual(first.Payment.Id, second.Payment.Id);
        Assert.Equal(2, second.Payment.CustomerId);
        db.ChangeTracker.Clear();
        db.SetRequestTenantScope(null, true);
        Assert.Equal(2, await db.Payments.CountAsync());
        Assert.Equal(2, await db.PaymentIdempotencies.CountAsync());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ReusedKey_WithDifferentAmount_IsRejectedWithoutAnotherWrite(bool allocate)
    {
        await using var db = await DatabaseAsync();
        db.SetRequestTenantScope(10, false);
        await PostAsync(db, allocate, 10, 1, 40m, "amount-fixture-key");
        db.ChangeTracker.Clear();
        await Assert.ThrowsAsync<ArgumentException>(() => PostAsync(db, allocate, 10, 1, 30m, "amount-fixture-key"));
        Assert.Single(await db.Payments.ToListAsync());
        Assert.Single(await db.AuditLogs.ToListAsync());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Retry_ReplaysOriginalResponseAfterAnotherPayment(bool allocate)
    {
        await using var db = await DatabaseAsync();
        db.SetRequestTenantScope(10, false);
        var first = await PostAsync(db, allocate, 10, 1, 40m, "response-fixture-key");
        await PostAsync(db, allocate, 10, 1, 20m, "later-fixture-key");
        db.ChangeTracker.Clear();
        var replay = await PostAsync(db, allocate, 10, 1, 40m, "response-fixture-key");

        Assert.Equal(first.Customer?.Balance, replay.Customer?.Balance);
        Assert.Equal(System.Text.Json.JsonSerializer.Serialize(first), System.Text.Json.JsonSerializer.Serialize(replay));
        Assert.Equal(2, await db.Payments.CountAsync());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task LegacyUnscopedKey_ReplaysOnlyItsTenantPayment(bool allocate)
    {
        await using var db = await DatabaseAsync();
        db.SetRequestTenantScope(10, false);
        var first = await PostAsync(db, allocate, 10, 1, 40m, null);
        db.PaymentIdempotencies.Add(new PaymentIdempotency
        {
            IdempotencyKey = "legacy-fixture-key", PaymentId = first.Payment.Id, UserId = 1,
            CreatedAt = DateTime.UtcNow, ResponseSnapshot = "{\"PaymentId\":1}"
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var replay = await PostAsync(db, allocate, 10, 1, 40m, "legacy-fixture-key");
        Assert.Equal(first.Payment.Id, replay.Payment.Id);
        Assert.Single(await db.Payments.ToListAsync());
        db.ChangeTracker.Clear();
        db.SetRequestTenantScope(11, false);
        var otherTenant = await PostAsync(db, allocate, 11, 2, 40m, "legacy-fixture-key");
        Assert.NotEqual(first.Payment.Id, otherTenant.Payment.Id);
        Assert.Equal(2, otherTenant.Payment.CustomerId);
    }

    internal static Task<CreatePaymentResponse> PostAsync(AppDbContext db, bool allocate, int tenantId, int recordId, decimal amount, string? key)
    {
        var service = new PaymentService(db, NullLogger<PaymentService>.Instance, new ValidationService(db), null!, null!);
        return allocate
            ? service.AllocatePaymentAsync(PaymentAllocationTests.Request(amount, recordId, recordId), recordId, tenantId, key)
            : service.CreatePaymentAsync(new CreatePaymentRequest { SaleId = recordId, CustomerId = recordId, Amount = amount, Mode = "CASH" }, recordId, tenantId, key);
    }

    private static async Task<AppDbContext> DatabaseAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        db.SetRequestTenantScope(null, true);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        PaymentAllocationTests.Seed(db, 10, 1);
        PaymentAllocationTests.Seed(db, 11, 2);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return db;
    }
}
