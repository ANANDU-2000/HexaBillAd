using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Models.Legacy;
using HexaBill.Api.Modules.Reports;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HexaBill.Tests.Billing
{
    // Regression coverage for the FrozenHub 1 (tenant 20) duplicate-invoice defect: historical Starplus invoices
    // were emitted by the sales report AND again by the customer ledger. These tests pin the report side:
    // one row per historical invoice, correct flags and ids, stable paging, explicit windows, tenant isolation.
    public class SalesReportLegacyContinuityTests
    {
        private static readonly DateTime WindowFrom = new(2025, 11, 1, 0, 0, 0, DateTimeKind.Utc);
        private static readonly DateTime WindowTo = new(2026, 11, 4, 0, 0, 0, DateTimeKind.Utc);

        private sealed class SalesSchemaWithBranches : ISalesSchemaService
        {
            public Task<bool> SalesHasBranchIdAndRouteIdAsync() => Task.FromResult(true);
            public void ClearColumnCheckCache() { }
        }

        private static async Task<AppDbContext> SeedAsync()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options;
            var db = new AppDbContext(options);
            await db.Database.OpenConnectionAsync();
            // Fixture-only: this suite checks report logic, not referential integrity of unrelated tables.
            await db.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys = OFF;");
            await db.Database.EnsureCreatedAsync();

            db.Tenants.Add(new Tenant { Id = 20, Name = "FrozenHub 1 fixture", Subdomain = "frozenhub-fixture" });
            db.Tenants.Add(new Tenant { Id = 23, Name = "FrozenHub 2 fixture", Subdomain = "frozenhub2-fixture" });
            db.Customers.Add(new Customer { Id = 139, TenantId = 20, OwnerId = 20, Name = "KHAN DARBAR RESTAURANT", Balance = 1475m, PendingBalance = 1475m, CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc) });
            db.Customers.Add(new Customer { Id = 143, TenantId = 20, OwnerId = 20, Name = "ABAYAN MANDI REST & KITCHEN", Balance = 0m, PendingBalance = 0m, CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc) });

            // Current FrozenHub sale for customer 139 (pending).
            db.Sales.Add(new Sale
            {
                Id = 7013, TenantId = 20, OwnerId = 20, InvoiceNo = "7013", CustomerId = 139,
                InvoiceDate = new DateTime(2026, 11, 2, 12, 0, 0, DateTimeKind.Utc),
                Subtotal = 1475m, GrandTotal = 1475m, TotalAmount = 1475m, PaidAmount = 0m,
                PaymentStatus = SalePaymentStatus.Pending
            });

            // Historical Starplus invoices for customer 139: three pending, one paid.
            AddLegacy(db, 1352, 20, "6955", 139, new DateTime(2026, 10, 30, 12, 0, 0, DateTimeKind.Utc), 1485m, 0m);
            AddLegacy(db, 1353, 20, "6974", 139, new DateTime(2026, 10, 31, 12, 0, 0, DateTimeKind.Utc), 1465m, 0m);
            AddLegacy(db, 1354, 20, "6995", 139, new DateTime(2026, 10, 31, 12, 0, 0, DateTimeKind.Utc), 1455m, 0m);
            AddLegacy(db, 1349, 20, "6912", 139, new DateTime(2026, 10, 27, 12, 0, 0, DateTimeKind.Utc), 1405m, 1405m);

            // Historical invoice for customer 143 with the same number as a customer-139 invoice: must stay distinct.
            AddLegacy(db, 1908, 20, "6989", 143, new DateTime(2026, 10, 31, 12, 0, 0, DateTimeKind.Utc), 432m, 0m);

            // Deleted historical invoice: never shown.
            AddLegacy(db, 1500, 20, "6900", 139, new DateTime(2026, 10, 20, 12, 0, 0, DateTimeKind.Utc), 999m, 0m, isDeleted: true);

            // Another tenant's historical invoice pointing at the same destination customer id: must never leak.
            AddLegacy(db, 2500, 23, "6995", 139, new DateTime(2026, 10, 31, 12, 0, 0, DateTimeKind.Utc), 1455m, 0m);

            await db.SaveChangesAsync();
            db.SetRequestTenantScope(20, false);
            return db;
        }

        private static void AddLegacy(AppDbContext db, int id, int tenantId, string number, int destinationCustomerId, DateTime date, decimal total, decimal paid, bool isDeleted = false)
        {
            db.LegacyInvoices.Add(new LegacyInvoice
            {
                Id = id, TenantId = tenantId, SourceInvoiceId = id + 10000, SourceSystem = "Starplus",
                LegacyInvoiceNumber = number, LegacyIssuer = "Starplus Foodstuff Trading",
                InvoiceDate = date, DestinationCustomerId = destinationCustomerId,
                CustomerName = "fixture", GrandTotal = total, TotalAmount = total,
                PaidAmount = paid, OutstandingCalculated = Math.Max(0m, total - paid),
                Status = paid >= total ? "Paid" : "Pending", IsDeleted = isDeleted
            });
        }

        private static ReportService Reports(AppDbContext db) =>
            new(db, null!, null!, null!, new SalesSchemaWithBranches(), new MemoryCache(new MemoryCacheOptions()),
                NullLogger<ReportService>.Instance, new TimeZoneService(),
                new VatReturnReportService(db, NullLogger<VatReturnReportService>.Instance));

        private static string Key(SaleDto s) => s.IsLegacy ? $"leg:{s.LegacyInvoiceId}" : $"op:{s.Id}";

        [Fact]
        public async Task CustomerLedgerRequest_WithIncludeLegacyFalse_ReturnsOperatingRowsOnly()
        {
            await using var db = await SeedAsync();
            var page = await Reports(db).GetSalesReportAsync(20, WindowFrom, WindowTo, customerId: 139, page: 1, pageSize: 25, includeLegacy: false);

            var row = Assert.Single(page.Items);
            Assert.Equal("7013", row.InvoiceNo);
            Assert.False(row.IsLegacy);
            Assert.Equal(1, page.TotalCount);
        }

        [Fact]
        public async Task HistoricalInvoices_AppearExactlyOnce_WithLegacyFlagsAndSourceIds()
        {
            await using var db = await SeedAsync();
            var page = await Reports(db).GetSalesReportAsync(20, WindowFrom, WindowTo, customerId: 139, page: 1, pageSize: 25, includeLegacy: true);

            Assert.Equal(5, page.TotalCount);                       // 1 current sale + 4 historical (deleted excluded)
            Assert.Equal(5, page.Items.Count);
            var historical = page.Items.Where(s => s.IsLegacy).ToList();
            Assert.Equal(4, historical.Count);
            Assert.Equal(4, historical.Select(s => s.InvoiceNo).Distinct().Count());
            Assert.All(historical, s => Assert.True(s.Id < 0 && s.LegacyInvoiceId > 0 && s.Id == -s.LegacyInvoiceId));
            Assert.DoesNotContain(page.Items, s => s.InvoiceNo == "6900");
        }

        [Fact]
        public async Task SameInvoiceNumber_ForDifferentCustomers_RemainsDistinct()
        {
            await using var db = await SeedAsync();
            var c139 = await Reports(db).GetSalesReportAsync(20, WindowFrom, WindowTo, customerId: 139, page: 1, pageSize: 25, includeLegacy: true);
            var c143 = await Reports(db).GetSalesReportAsync(20, WindowFrom, WindowTo, customerId: 143, page: 1, pageSize: 25, includeLegacy: true);

            Assert.Equal(1, c143.TotalCount);
            Assert.Equal("6995", c139.Items.Single(s => s.IsLegacy && s.InvoiceNo == "6995").InvoiceNo);
            Assert.Equal("6989", c143.Items.Single().InvoiceNo);
        }

        [Fact]
        public async Task TenantIsolation_OtherTenantHistoricalInvoice_IsNeverReturned()
        {
            await using var db = await SeedAsync();
            var page = await Reports(db).GetSalesReportAsync(20, WindowFrom, WindowTo, customerId: 139, page: 1, pageSize: 25, includeLegacy: true);

            Assert.Equal(1, page.Items.Count(s => s.InvoiceNo == "6995"));
            Assert.DoesNotContain(page.Items, s => s.LegacyInvoiceId == 2500);
        }

        [Fact]
        public async Task Paging_AcrossPages_NeitherRepeatsNorSkipsRows_AndTotalsStayConstant()
        {
            await using var db = await SeedAsync();
            var reports = Reports(db);
            var keys = new List<string>();
            int? total = null;

            for (var p = 1; p <= 3; p++)
            {
                var page = await reports.GetSalesReportAsync(20, WindowFrom, WindowTo, customerId: 139, page: p, pageSize: 2, includeLegacy: true);
                total ??= page.TotalCount;
                Assert.Equal(total, page.TotalCount);
                keys.AddRange(page.Items.Select(Key));
            }

            Assert.Equal(5, total);
            Assert.Equal(5, keys.Count);
            Assert.Equal(5, keys.Distinct().Count());
        }

        [Fact]
        public async Task ExplicitMonthWindow_ReturnsOnlyInvoicesInsideItsBoundaries()
        {
            await using var db = await SeedAsync();
            // October 2026 only (to is exclusive, as the controller passes it). The 2 Nov sale must be excluded and
            // the 27 Oct invoice must be included at the start boundary.
            var from = new DateTime(2026, 10, 27, 0, 0, 0, DateTimeKind.Utc);
            var to = new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc);
            var page = await Reports(db).GetSalesReportAsync(20, from, to, customerId: 139, page: 1, pageSize: 25, includeLegacy: true);

            Assert.Equal(4, page.TotalCount);
            Assert.Contains(page.Items, s => s.InvoiceNo == "6912");
            Assert.DoesNotContain(page.Items, s => s.InvoiceNo == "7013");
        }
    }
}
