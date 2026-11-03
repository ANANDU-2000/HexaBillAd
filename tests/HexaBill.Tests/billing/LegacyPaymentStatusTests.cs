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

        // Ledger "Pay" on a Starplus row sends the negative legacy id. A customer whose only debt is historical has no live
        // Sales balance, so the payment must be judged by the legacy invoice alone, not refused as "no outstanding invoices".
        [Fact]
        public async Task HistoricalOnlyCustomer_CanPayHistoricalInvoice_WithoutLiveSales()
        {
            await using var db = await DatabaseAsync();
            db.Customers.Add(new Customer { Id = 2, TenantId = 10, OwnerId = 10, Name = "Historical-only buyer", Balance = 118m, PendingBalance = 118m, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
            db.LegacyInvoices.Add(new LegacyInvoice
            {
                Id = 702, TenantId = 10, SourceInvoiceId = 7702, SourceSystem = "Starplus", LegacyInvoiceNumber = "6971",
                LegacyIssuer = "Starplus Foodstuff Trading", InvoiceDate = new DateTime(2026, 10, 30, 0, 0, 0, DateTimeKind.Utc),
                DestinationCustomerId = 2, GrandTotal = 118m, TotalAmount = 118m, PaidAmount = 0m,
                OutstandingCalculated = 118m, Status = "Pending", IsDeleted = false
            });
            await db.SaveChangesAsync();
            db.ChangeTracker.Clear();
            var service = new PaymentService(db, NullLogger<PaymentService>.Instance, new ValidationService(db), null!, null!);

            await service.CreatePaymentAsync(new CreatePaymentRequest { SaleId = -702, CustomerId = 2, Amount = 118m, Mode = "CASH" }, 1, 10);

            db.ChangeTracker.Clear();
            var paid = await db.LegacyInvoices.AsNoTracking().SingleAsync(i => i.Id == 702);
            Assert.Equal(0m, paid.OutstandingCalculated);
            Assert.Equal("Paid", paid.Status);
        }

        // Live: STICK MAGIC (customer 140) paid Starplus invoice 6715 (1,202.00) while owing 585.00 on live bills; the cached
        // balance became -617.00 (a false credit) because the historical payment was subtracted from live sales.
        [Fact]
        public async Task HistoricalInvoicePayment_DoesNotReduceLiveCustomerBalance()
        {
            await using var db = await DatabaseAsync();
            db.Customers.Add(new Customer { Id = 3, TenantId = 10, OwnerId = 10, Name = "Stick fixture", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
            db.Sales.Add(new Sale { Id = 9003, TenantId = 10, OwnerId = 10, CustomerId = 3, InvoiceNo = "LIVE-585", InvoiceDate = DateTime.UtcNow, Subtotal = 557.14m, VatTotal = 27.86m, GrandTotal = 585m, TotalAmount = 585m, PaymentStatus = SalePaymentStatus.Pending, CreatedBy = 1, CreatedAt = DateTime.UtcNow });
            db.LegacyInvoices.Add(new LegacyInvoice
            {
                Id = 703, TenantId = 10, SourceInvoiceId = 7703, SourceSystem = "Starplus", LegacyInvoiceNumber = "6715",
                LegacyIssuer = "Starplus Foodstuff Trading", InvoiceDate = new DateTime(2026, 10, 20, 0, 0, 0, DateTimeKind.Utc),
                DestinationCustomerId = 3, GrandTotal = 1202m, TotalAmount = 1202m, PaidAmount = 0m,
                OutstandingCalculated = 1202m, Status = "Pending", IsDeleted = false
            });
            await db.SaveChangesAsync();
            db.ChangeTracker.Clear();
            var service = new PaymentService(db, NullLogger<PaymentService>.Instance, new ValidationService(db), null!, null!);

            await service.CreatePaymentAsync(new CreatePaymentRequest { SaleId = -703, CustomerId = 3, Amount = 1202m, Mode = "CASH" }, 1, 10);
            await new HexaBill.Api.Modules.Customers.CustomerService(db).RecalculateCustomerBalanceAsync(3, 10);

            db.ChangeTracker.Clear();
            var customer = await db.Customers.AsNoTracking().SingleAsync(c => c.Id == 3);
            Assert.Equal(585m, customer.Balance);
            Assert.Equal(585m, customer.PendingBalance);
            Assert.Equal("Paid", (await db.LegacyInvoices.AsNoTracking().SingleAsync(i => i.Id == 703)).Status);
        }
    }
}
