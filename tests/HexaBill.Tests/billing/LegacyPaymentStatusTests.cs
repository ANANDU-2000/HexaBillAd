using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Models.Legacy;
using HexaBill.Api.Modules.Payments;
using HexaBill.Api.Core.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HexaBill.Tests.Billing
{
    // A historical invoice's stored Status must follow its balance. It was left at "Pending" after a full payment,
    // while the outstanding amount was already 0.
    public class LegacyPaymentStatusTests
    {
        private static async Task<AppDbContext> DatabaseAsync()
        {
            var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
            db.SetRequestTenantScope(10, false);
            await db.Database.OpenConnectionAsync();
            await db.Database.EnsureCreatedAsync();
            PaymentAllocationTests.Seed(db, 10, 1);
            db.LegacyInvoices.Add(new LegacyInvoice
            {
                Id = 701, TenantId = 10, SourceInvoiceId = 7701, SourceSystem = "Starplus", LegacyInvoiceNumber = "7701",
                LegacyIssuer = "Starplus Foodstuff Trading", InvoiceDate = new DateTime(2026, 10, 30, 0, 0, 0, DateTimeKind.Utc),
                DestinationCustomerId = 1, GrandTotal = 945m, TotalAmount = 945m, PaidAmount = 0m,
                OutstandingCalculated = 945m, Status = "Pending", IsDeleted = false
            });
            await db.SaveChangesAsync();
            db.ChangeTracker.Clear();
            return db;
        }

        [Fact]
        public async Task LegacyStatus_FollowsBalance_PartialThenPaid()
        {
            await using var db = await DatabaseAsync();
            var service = new PaymentService(db, NullLogger<PaymentService>.Instance, new ValidationService(db), null!, null!);

            await service.CreatePaymentAsync(new CreatePaymentRequest { SaleId = -701, CustomerId = 1, Amount = 500m, Mode = "CASH" }, 1, 10);
            db.ChangeTracker.Clear();
            var partial = await db.LegacyInvoices.AsNoTracking().SingleAsync(i => i.Id == 701);
            Assert.Equal(445m, partial.OutstandingCalculated);
            Assert.Equal("Partial", partial.Status);

            await service.CreatePaymentAsync(new CreatePaymentRequest { SaleId = -701, CustomerId = 1, Amount = 445m, Mode = "CASH" }, 1, 10);
            db.ChangeTracker.Clear();
            var paid = await db.LegacyInvoices.AsNoTracking().SingleAsync(i => i.Id == 701);
            Assert.Equal(0m, paid.OutstandingCalculated);
            Assert.Equal("Paid", paid.Status);
        }
    }
}
