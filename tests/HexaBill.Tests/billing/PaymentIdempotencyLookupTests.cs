using HexaBill.Api.Data;
using HexaBill.Api.Modules.Payments;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HexaBill.Tests.Billing
{
    // Reconciliation: a client that lost its response asks the server whether its Idempotency-Key was saved.
    public class PaymentIdempotencyLookupTests
    {
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

        [Fact]
        public async Task SavedKey_ResolvesToTheSavedPayment()
        {
            await using var db = await DatabaseAsync();
            db.SetRequestTenantScope(10, false);
            var created = await PaymentIdempotencyTests.PostAsync(db, false, 10, 1, 40m, "lookup-saved-key");
            db.ChangeTracker.Clear();

            var found = await new PaymentService(db, NullLogger<PaymentService>.Instance, new ValidationService(db), null!, null!)
                .FindSavedPaymentByIdempotencyKeyAsync("lookup-saved-key", 10);

            Assert.NotNull(found);
            Assert.Equal(created.Payment.Id, found!.Payment.Id);
        }

        [Fact]
        public async Task UnknownKey_ReportsNotSaved()
        {
            await using var db = await DatabaseAsync();
            var service = new PaymentService(db, NullLogger<PaymentService>.Instance, new ValidationService(db), null!, null!);
            Assert.Null(await service.FindSavedPaymentByIdempotencyKeyAsync("never-sent-key", 10));
            Assert.Null(await service.FindSavedPaymentByIdempotencyKeyAsync("   ", 10));
        }

        [Fact]
        public async Task KeyFromAnotherTenant_NeverResolves()
        {
            await using var db = await DatabaseAsync();
            db.SetRequestTenantScope(10, false);
            await PaymentIdempotencyTests.PostAsync(db, false, 10, 1, 40m, "lookup-tenant-key");
            db.ChangeTracker.Clear();

            var service = new PaymentService(db, NullLogger<PaymentService>.Instance, new ValidationService(db), null!, null!);
            Assert.Null(await service.FindSavedPaymentByIdempotencyKeyAsync("lookup-tenant-key", 11));
            Assert.NotNull(await service.FindSavedPaymentByIdempotencyKeyAsync("lookup-tenant-key", 10));
        }
    }
}
