using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Models.Legacy;
using HexaBill.Api.Modules.Legacy;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HexaBill.Tests.Billing
{
    /// <summary>
    /// Regression tests for the normal Billing History list (GET /api/legacy/invoices/unified):
    /// one combined history of operating + historical invoices with Dubai business-day filters,
    /// tenant isolation and tenant-scoped customer mapping.
    /// </summary>
    public class UnifiedBillingHistoryTests
    {
        private const int Fh1 = 20;
        private const int Fh2 = 23;

        private static DateTime Noon(int y, int m, int d) => new(y, m, d, 12, 0, 0, DateTimeKind.Utc);

        private static async Task<AppDbContext> SeedAsync()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options;
            var db = new AppDbContext(options);
            await db.Database.OpenConnectionAsync();
            await db.Database.EnsureCreatedAsync();
            db.SetRequestTenantScope(null, isPlatformScope: true); // seeding only

            db.Tenants.Add(new Tenant { Id = Fh1, Name = "FrozenHub 1", Subdomain = "fh1-test", FeaturesJson = "[]" });
            db.Tenants.Add(new Tenant { Id = Fh2, Name = "FrozenHub 2", Subdomain = "fh2-test", FeaturesJson = "[]" });
            db.Users.Add(new User { Id = 1, TenantId = Fh1, OwnerId = Fh1, Name = "Owner", Email = "o@t", PasswordHash = "x", Role = UserRole.Owner, CreatedAt = DateTime.UtcNow });
            db.Users.Add(new User { Id = 2, TenantId = Fh2, OwnerId = Fh2, Name = "Owner2", Email = "o2@t", PasswordHash = "x", Role = UserRole.Owner, CreatedAt = DateTime.UtcNow });
            db.Customers.Add(new Customer { Id = 136, TenantId = Fh1, OwnerId = Fh1, Name = "CHAWARMA AALMASHI SNACK", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
            db.Customers.Add(new Customer { Id = 143, TenantId = Fh1, OwnerId = Fh1, Name = "ABAYAN MANDI", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
            db.Customers.Add(new Customer { Id = 500, TenantId = Fh2, OwnerId = Fh2, Name = "FH2 Buyer", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });

            // Operating sales, tenant 20
            db.Sales.Add(new Sale { Id = 1, TenantId = Fh1, OwnerId = Fh1, CustomerId = 136, InvoiceNo = "7012", GrandTotal = 415m, Subtotal = 415m, PaidAmount = 415m, PaymentStatus = SalePaymentStatus.Paid, InvoiceDate = Noon(2026, 10, 31), CreatedBy = 1 });
            db.Sales.Add(new Sale { Id = 2, TenantId = Fh1, OwnerId = Fh1, CustomerId = 143, InvoiceNo = "6997", GrandTotal = 720m, Subtotal = 720m, PaidAmount = 0m, PaymentStatus = SalePaymentStatus.Pending, InvoiceDate = Noon(2026, 10, 26), CreatedBy = 1 });
            db.Sales.Add(new Sale { Id = 3, TenantId = Fh1, OwnerId = Fh1, CustomerId = 143, InvoiceNo = "6998", GrandTotal = 300m, Subtotal = 300m, PaidAmount = 100m, PaymentStatus = SalePaymentStatus.Partial, InvoiceDate = Noon(2026, 10, 27), CreatedBy = 1 });
            // 2026-10-31 23:59 Dubai (19:59Z) belongs to 31 Oct; 2026-11-01 00:00 Dubai (20:00Z) belongs to 1 Nov.
            db.Sales.Add(new Sale { Id = 4, TenantId = Fh1, OwnerId = Fh1, CustomerId = 136, InvoiceNo = "7013", GrandTotal = 50m, Subtotal = 50m, InvoiceDate = new DateTime(2026, 10, 31, 19, 59, 0, DateTimeKind.Utc), CreatedBy = 1 });
            db.Sales.Add(new Sale { Id = 5, TenantId = Fh1, OwnerId = Fh1, CustomerId = 136, InvoiceNo = "7014", GrandTotal = 60m, Subtotal = 60m, InvoiceDate = new DateTime(2026, 10, 31, 20, 0, 0, DateTimeKind.Utc), CreatedBy = 1 });
            db.Sales.Add(new Sale { Id = 6, TenantId = Fh1, OwnerId = Fh1, CustomerId = 136, InvoiceNo = "FH-DEL-1", GrandTotal = 99m, Subtotal = 99m, InvoiceDate = Noon(2026, 10, 28), CreatedBy = 1, IsDeleted = true });
            // Operating sale, tenant 23
            db.Sales.Add(new Sale { Id = 7, TenantId = Fh2, OwnerId = Fh2, CustomerId = 500, InvoiceNo = "0001", GrandTotal = 10m, Subtotal = 10m, InvoiceDate = Noon(2026, 10, 31), CreatedBy = 2 });

            db.Payments.Add(new Payment { TenantId = Fh1, OwnerId = Fh1, CustomerId = 136, SaleId = 1, Amount = 415m, Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED, PaymentDate = Noon(2026, 10, 31), CreatedBy = 1, CreatedAt = DateTime.UtcNow });
            db.Payments.Add(new Payment { TenantId = Fh1, OwnerId = Fh1, CustomerId = 143, SaleId = 3, Amount = 100m, Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED, PaymentDate = Noon(2026, 10, 27), CreatedBy = 1, CreatedAt = DateTime.UtcNow });
            // Pending cheque on 6997 must not count as paid.
            db.Payments.Add(new Payment { TenantId = Fh1, OwnerId = Fh1, CustomerId = 143, SaleId = 2, Amount = 720m, Mode = PaymentMode.CHEQUE, Status = PaymentStatus.PENDING, PaymentDate = Noon(2026, 10, 26), CreatedBy = 1, CreatedAt = DateTime.UtcNow });

            // Historical invoices, tenant 20
            db.LegacyInvoices.Add(Legacy(101, "6996", Noon(2026, 10, 31), dest: 136, src: 136, total: 945m, paid: 0m));
            db.LegacyInvoices.Add(Legacy(102, "6990", Noon(2026, 10, 25), dest: 143, src: 143, total: 200m, paid: 200m));
            db.LegacyInvoices.Add(Legacy(103, "6991", Noon(2026, 10, 26), dest: 143, src: 143, total: 300m, paid: 299.99m));   // one-cent residual
            db.LegacyInvoices.Add(Legacy(104, "6000", Noon(2026, 3, 1), dest: 143, src: 136, total: 80m, paid: 0m));          // source id collides with destination 136
            db.LegacyInvoices.Add(Legacy(105, "5000", Noon(2026, 2, 1), dest: 136, src: 136, total: 70m, paid: 0m, deleted: true));

            await db.SaveChangesAsync();
            return db;
        }

        private static LegacyInvoice Legacy(int id, string no, DateTime date, int? dest, int? src, decimal total, decimal paid, bool deleted = false) => new()
        {
            Id = id,
            TenantId = Fh1,
            SourceInvoiceId = id,
            SourceSystem = "Starplus",
            LegacyInvoiceNumber = no,
            LegacyIssuer = "Starplus Foodstuff Trading",
            InvoiceDate = date,
            DestinationCustomerId = dest,
            SourceCustomerId = src,
            CustomerName = "Customer " + dest,
            GrandTotal = total,
            TotalAmount = total,
            Subtotal = total,
            PaidAmount = paid,
            OutstandingCalculated = Math.Max(0, total - paid),
            Status = deleted ? "Deleted" : "Final",
            IsDeleted = deleted,
            MigrationRunId = "test"
        };

        private static LegacyController Controller(AppDbContext db, int tenantId)
        {
            // Same request scope the tenant middleware establishes in production.
            db.SetRequestTenantScope(tenantId, isPlatformScope: false);
            db.ChangeTracker.Clear();
            return new(db, NullLogger<LegacyController>.Instance)
            {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                    {
                        new Claim("tid", tenantId.ToString()),
                        new Claim("UserId", "1"),
                        new Claim(ClaimTypes.Role, "Owner")
                    }, "fixture"))
                }
            }
            };
        }

        private static PagedResponse<UnifiedInvoiceSummaryDto> Page(ActionResult<ApiResponse<PagedResponse<UnifiedInvoiceSummaryDto>>> action)
        {
            var ok = Assert.IsType<OkObjectResult>(action.Result);
            var payload = Assert.IsType<ApiResponse<PagedResponse<UnifiedInvoiceSummaryDto>>>(ok.Value);
            Assert.True(payload.Success);
            return payload.Data!;
        }

        [Fact]
        public async Task DefaultList_CombinesActiveOperatingAndHistorical_ExcludesDeleted()
        {
            await using var db = await SeedAsync();
            var data = Page(await Controller(db, Fh1).GetUnifiedInvoices(pageSize: 100));

            // 5 active operating + 4 active historical; deleted rows of both kinds excluded.
            Assert.Equal(9, data.TotalCount);
            Assert.DoesNotContain(data.Items, i => i.IsDeleted);
            Assert.Contains(data.Items, i => i.InvoiceNumber == "6996" && i.IsLegacy && i.IsLocked && i.LegacyIssuer == "Starplus Foodstuff Trading");
            Assert.Contains(data.Items, i => i.InvoiceNumber == "7012" && !i.IsLegacy);
        }

        [Fact]
        public async Task Pagination_DoesNotChangeTotal_AndReturnsEveryRowOnce()
        {
            await using var db = await SeedAsync();
            var c = Controller(db, Fh1);
            var p1 = Page(await c.GetUnifiedInvoices(page: 1, pageSize: 4));
            var p2 = Page(await c.GetUnifiedInvoices(page: 2, pageSize: 4));
            var p3 = Page(await c.GetUnifiedInvoices(page: 3, pageSize: 4));
            Assert.Equal(9, p1.TotalCount);
            Assert.Equal(3, p1.TotalPages);
            var ids = p1.Items.Concat(p2.Items).Concat(p3.Items).Select(i => i.Id).ToList();
            Assert.Equal(9, ids.Count);
            Assert.Equal(9, ids.Distinct().Count());
        }

        [Fact]
        public async Task NewestFirst_ByDefault_OldestWhenRequested()
        {
            await using var db = await SeedAsync();
            var c = Controller(db, Fh1);
            var newest = Page(await c.GetUnifiedInvoices(pageSize: 100)).Items;
            var oldest = Page(await c.GetUnifiedInvoices(pageSize: 100, sort: "oldest")).Items;
            Assert.Equal("7014", newest.First().InvoiceNumber);
            Assert.Equal("6000", oldest.First().InvoiceNumber);
            Assert.True(newest.Select(i => i.InvoiceDate).SequenceEqual(newest.Select(i => i.InvoiceDate).OrderByDescending(d => d)));
        }

        [Fact]
        public async Task DateRange_UsesDubaiBusinessDays_IncludesWholeEndDay()
        {
            await using var db = await SeedAsync();
            var c = Controller(db, Fh1);

            // Single day 31 Oct: 7012 (noon), 7013 (23:59 Dubai), historical 6996. Not 7014 (00:00 Dubai on 1 Nov).
            var oct31 = Page(await c.GetUnifiedInvoices(pageSize: 100, fromDate: new DateTime(2026, 10, 31), toDate: new DateTime(2026, 10, 31)));
            Assert.Equal(new[] { "6996", "7012", "7013" }, oct31.Items.Select(i => i.InvoiceNumber).OrderBy(x => x).ToArray());

            // Rolling week 26 Oct - 1 Nov must not include 25 Oct.
            var week = Page(await c.GetUnifiedInvoices(pageSize: 100, fromDate: new DateTime(2026, 10, 26), toDate: new DateTime(2026, 11, 1)));
            Assert.DoesNotContain(week.Items, i => i.InvoiceNumber == "6990");
            Assert.Contains(week.Items, i => i.InvoiceNumber == "7014");
            Assert.Equal(7, week.TotalCount);
        }

        [Fact]
        public async Task InvertedDateRange_IsRejected()
        {
            await using var db = await SeedAsync();
            var action = await Controller(db, Fh1).GetUnifiedInvoices(fromDate: new DateTime(2026, 11, 2), toDate: new DateTime(2026, 11, 1));
            Assert.IsType<BadRequestObjectResult>(action.Result);
        }

        [Fact]
        public async Task CustomerFilter_UsesDestinationMappingOnly_NoSourceIdCollision()
        {
            await using var db = await SeedAsync();
            var rows = Page(await Controller(db, Fh1).GetUnifiedInvoices(pageSize: 100, customerId: 136)).Items;

            // Historical 6000 has SourceCustomerId 136 but belongs to destination customer 143: it must not appear.
            Assert.DoesNotContain(rows, i => i.InvoiceNumber == "6000");
            Assert.All(rows, i => Assert.Equal(136, i.CustomerId));
        }

        [Fact]
        public async Task OtherTenant_SeesOnlyItsOwnOperatingInvoices()
        {
            await using var db = await SeedAsync();
            var data = Page(await Controller(db, Fh2).GetUnifiedInvoices(pageSize: 100));
            Assert.Equal(1, data.TotalCount);
            Assert.Equal("0001", data.Items.Single().InvoiceNumber);
            Assert.DoesNotContain(data.Items, i => i.IsLegacy);
        }

        [Fact]
        public async Task OperatingPaid_UsesClearedPaymentsOnly()
        {
            await using var db = await SeedAsync();
            var rows = Page(await Controller(db, Fh1).GetUnifiedInvoices(pageSize: 100)).Items;
            var chequeOnly = rows.Single(i => i.InvoiceNumber == "6997");
            Assert.Equal(0m, chequeOnly.PaidAmount);
            Assert.Equal(720m, chequeOnly.OutstandingBalance);
            Assert.Equal("Pending", chequeOnly.PaymentStatus);
            Assert.Equal("Partial", rows.Single(i => i.InvoiceNumber == "6998").PaymentStatus);
            Assert.Equal("CASH", rows.Single(i => i.InvoiceNumber == "7012").PrimaryPaymentMode);
        }

        [Fact]
        public async Task StatusFilters_AreConsistentAcrossSources()
        {
            await using var db = await SeedAsync();
            var c = Controller(db, Fh1);
            var paid = Page(await c.GetUnifiedInvoices(pageSize: 100, status: "paid")).Items.Select(i => i.InvoiceNumber).OrderBy(x => x).ToArray();
            var partial = Page(await c.GetUnifiedInvoices(pageSize: 100, status: "partial")).Items.Select(i => i.InvoiceNumber).OrderBy(x => x).ToArray();
            var unpaid = Page(await c.GetUnifiedInvoices(pageSize: 100, status: "unpaid")).Items.Select(i => i.InvoiceNumber).OrderBy(x => x).ToArray();

            // One-cent historical residual (6991) is within settlement tolerance: shown as Paid, amount kept as-is.
            Assert.Equal(new[] { "6990", "6991", "7012" }, paid);
            Assert.Equal(new[] { "6998" }, partial);
            Assert.Equal(new[] { "6000", "6996", "6997", "7013", "7014" }, unpaid);
            Assert.Equal(9, paid.Length + partial.Length + unpaid.Length);

            var residual = Page(await c.GetUnifiedInvoices(pageSize: 100, search: "6991")).Items.Single();
            Assert.Equal(0.01m, residual.OutstandingBalance);
        }

        [Fact]
        public async Task VoidedFilter_ListsOnlyDeletedInvoices()
        {
            await using var db = await SeedAsync();
            var rows = Page(await Controller(db, Fh1).GetUnifiedInvoices(pageSize: 100, status: "voided")).Items;
            Assert.Equal(new[] { "5000", "FH-DEL-1" }, rows.Select(i => i.InvoiceNumber).OrderBy(x => x).ToArray());
            Assert.All(rows, i => { Assert.True(i.IsDeleted); Assert.Equal("Voided", i.PaymentStatus); Assert.Equal(0m, i.OutstandingBalance); });
        }

        [Fact]
        public async Task UnknownStatus_IsRejected()
        {
            await using var db = await SeedAsync();
            var action = await Controller(db, Fh1).GetUnifiedInvoices(status: "drop table");
            Assert.IsType<BadRequestObjectResult>(action.Result);
        }

        [Fact]
        public async Task Search_MatchesInvoiceNumberAndCustomerAcrossSources()
        {
            await using var db = await SeedAsync();
            var c = Controller(db, Fh1);
            Assert.Equal("6996", Page(await c.GetUnifiedInvoices(search: "6996")).Items.Single().InvoiceNumber);
            Assert.Equal("7012", Page(await c.GetUnifiedInvoices(search: "7012")).Items.Single().InvoiceNumber);
            var byCustomer = Page(await c.GetUnifiedInvoices(pageSize: 100, search: "abayan")).Items;
            Assert.Equal(new[] { "6997", "6998" }, byCustomer.Select(i => i.InvoiceNumber).OrderBy(x => x).ToArray());
        }

        [Theory]
        [InlineData("2026-11-01", "2026-10-31T20:00:00Z", "2026-11-01T20:00:00Z")]
        [InlineData("2026-12-31", "2026-12-30T20:00:00Z", "2026-12-31T20:00:00Z")]
        [InlineData("2027-01-01", "2026-12-31T20:00:00Z", "2027-01-01T20:00:00Z")]
        public void BusinessDateRange_DubaiBoundaries(string day, string startUtc, string endUtc)
        {
            var d = DateTime.Parse(day);
            Assert.Equal(DateTime.Parse(startUtc).ToUniversalTime(), BusinessDateRange.StartUtc(d));
            Assert.Equal(DateTime.Parse(endUtc).ToUniversalTime(), BusinessDateRange.EndExclusiveUtc(d));
            Assert.Equal(DateTimeKind.Utc, BusinessDateRange.StartUtc(d).Kind);
        }

        [Fact]
        public void BusinessDateOf_MapsLateEveningUtcToNextDubaiDay()
        {
            Assert.Equal(new DateTime(2026, 11, 1), BusinessDateRange.BusinessDateOf(new DateTime(2026, 10, 31, 20, 0, 0, DateTimeKind.Utc)));
            Assert.Equal(new DateTime(2026, 10, 31), BusinessDateRange.BusinessDateOf(new DateTime(2026, 10, 31, 19, 59, 59, DateTimeKind.Utc)));
            Assert.Equal(new DateTime(2026, 10, 31), BusinessDateRange.BusinessDateOf(new DateTime(2026, 10, 31, 12, 0, 0, DateTimeKind.Utc)));
        }
    }
}
