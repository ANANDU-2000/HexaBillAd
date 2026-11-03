using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Models.Legacy;
using HexaBill.Api.Modules.Customers;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HexaBill.Tests.Billing
{
    // Customer 139 (FrozenHub 1) shape: one current pending sale, three pending historical invoices and one paid
    // historical invoice with its payment. The ledger closing balance, the outstanding list and the header figure
    // must agree, and every invoice must be debited exactly once.
    public class CustomerBalanceCanonicalTests
    {
        private static async Task<AppDbContext> SeedAsync()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options;
            var db = new AppDbContext(options);
            await db.Database.OpenConnectionAsync();
            await db.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys = OFF;"); // fixture-only; see SalesReportLegacyContinuityTests
            await db.Database.EnsureCreatedAsync();

            db.Tenants.Add(new Tenant { Id = 20, Name = "FrozenHub 1 fixture", Subdomain = "frozenhub-fixture-balance" });
            db.Customers.Add(new Customer { Id = 139, TenantId = 20, OwnerId = 20, Name = "KHAN DARBAR RESTAURANT", Balance = 1475m, PendingBalance = 1475m, CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc) });

            db.Sales.Add(new Sale
            {
                Id = 7013, TenantId = 20, OwnerId = 20, InvoiceNo = "7013", CustomerId = 139,
                InvoiceDate = new DateTime(2026, 11, 2, 12, 0, 0, DateTimeKind.Utc),
                Subtotal = 1475m, GrandTotal = 1475m, TotalAmount = 1475m, PaidAmount = 0m,
                PaymentStatus = SalePaymentStatus.Pending
            });

            AddLegacy(db, 1352, "6955", new DateTime(2026, 10, 30, 12, 0, 0, DateTimeKind.Utc), 1485m, 0m);
            AddLegacy(db, 1353, "6974", new DateTime(2026, 10, 31, 12, 0, 0, DateTimeKind.Utc), 1465m, 0m);
            AddLegacy(db, 1354, "6995", new DateTime(2026, 10, 31, 12, 0, 0, DateTimeKind.Utc), 1455m, 0m);
            AddLegacy(db, 1349, "6912", new DateTime(2026, 10, 27, 12, 0, 0, DateTimeKind.Utc), 1405m, 1405m);

            db.LegacyPayments.Add(new LegacyPayment
            {
                Id = 9001, TenantId = 20, LegacyInvoiceId = 1349, SourcePaymentId = 9001, SourceSystem = "Starplus",
                DestinationCustomerId = 139, Amount = 1405m, Mode = "Cash", Status = "Cleared",
                PaymentDate = new DateTime(2026, 10, 27, 12, 0, 0, DateTimeKind.Utc), MigrationRunId = "TEST"
            });

            await db.SaveChangesAsync();
            db.SetRequestTenantScope(20, false);
            return db;
        }

        private static void AddLegacy(AppDbContext db, int id, string number, DateTime date, decimal total, decimal paid)
        {
            db.LegacyInvoices.Add(new LegacyInvoice
            {
                Id = id, TenantId = 20, SourceInvoiceId = id + 10000, SourceSystem = "Starplus",
                LegacyInvoiceNumber = number, LegacyIssuer = "Starplus Foodstuff Trading",
                InvoiceDate = date, DestinationCustomerId = 139, CustomerName = "KHAN DARBAR RESTAURANT",
                GrandTotal = total, TotalAmount = total, PaidAmount = paid,
                OutstandingCalculated = Math.Max(0m, total - paid),
                Status = paid >= total ? "Paid" : "Pending", IsDeleted = false
            });
        }

        [Fact]
        public async Task OutstandingList_TotalsTheCustomersTrueBalance_AcrossCurrentAndHistorical()
        {
            await using var db = await SeedAsync();
            var outstanding = await new CustomerService(db).GetOutstandingInvoicesAsync(139, 20);

            Assert.Equal(4, outstanding.Count);
            Assert.Equal(5880m, outstanding.Sum(o => o.BalanceAmount));
            Assert.Equal(3, outstanding.Count(o => o.IsLegacy));
            Assert.Equal(1, outstanding.Count(o => !o.IsLegacy));
        }

        [Fact]
        public async Task LedgerClosingBalance_EqualsOutstandingTotal_AndEachInvoiceIsDebitedOnce()
        {
            await using var db = await SeedAsync();
            var service = new CustomerService(db);

            var ledger = await service.GetCustomerLedgerAsync(139, 20);
            var outstanding = await service.GetOutstandingInvoicesAsync(139, 20);

            var closing = ledger.Last().Balance;
            Assert.Equal(outstanding.Sum(o => o.BalanceAmount), closing);

            // Each billed invoice contributes one debit: 1475 + 1485 + 1465 + 1455 + 1405 (historical paid).
            Assert.Equal(7285m, ledger.Sum(e => e.Debit));
            Assert.Equal(1405m, ledger.Sum(e => e.Credit));
        }
    }
}
