using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Models.Legacy;
using HexaBill.Api.Modules.Customers;
using HexaBill.Api.Modules.Legacy;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HexaBill.Tests.Billing
{
    /// <summary>
    /// Customers list: natural name order, server-side tab filters and counts, tenant isolation.
    /// Payments: merged current + historical history, source filter, tenant isolation.
    /// </summary>
    public class CustomerListAndPaymentHistoryTests
    {
        private static readonly DateTime Now = DateTime.UtcNow;

        // Seeding spans several tenants, which the context only allows in platform scope; tests then switch to a
        // tenant scope exactly as a real request would have.
        private static async Task<AppDbContext> DbAsync()
        {
            var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
            db.SetRequestTenantScope(null, true);
            await db.Database.OpenConnectionAsync();
            await db.Database.EnsureCreatedAsync();
            return db;
        }

        private static Customer Cust(int id, int tenant, string name, decimal balance = 0, DateTime? last = null) => new()
        {
            Id = id, TenantId = tenant, OwnerId = tenant, Name = name, Balance = balance, PendingBalance = balance,
            LastActivity = last, CreatedAt = Now.AddDays(-400), UpdatedAt = Now
        };

        [Fact]
        public void NaturalComparer_OrdersNumbersByValue_IgnoringCase()
        {
            var names = new[] { "Shop 10", "Shop 2", "shop 1", "Shop 007", "Al Noor", "Shop 2a", "Zed" };
            var sorted = names.OrderBy(n => n, NaturalStringComparer.Instance).ToArray();
            Assert.Equal(new[] { "Al Noor", "shop 1", "Shop 2", "Shop 2a", "Shop 007", "Shop 10", "Zed" }, sorted);
            Assert.Equal(0, NaturalStringComparer.Instance.Compare("a", "a"));
            Assert.True(NaturalStringComparer.Instance.Compare(null, "a") < 0);
        }

        [Fact]
        public async Task CustomerList_NameOrderIsNatural_AcrossPages_AndScopedToTenant()
        {
            await using var db = await DbAsync();
            for (var i = 1; i <= 12; i++) db.Customers.Add(Cust(i, 10, $"Ajman Frozen Goods {i}"));
            db.Customers.Add(Cust(100, 20, "Ajman Frozen Goods 1 OTHER TENANT"));
            await db.SaveChangesAsync();
            db.ChangeTracker.Clear();
            db.SetRequestTenantScope(10, false);
            var svc = new CustomerService(db);

            var p1 = await svc.GetCustomersAsync(10, 1, 5);
            var p2 = await svc.GetCustomersAsync(10, 2, 5);
            var p3 = await svc.GetCustomersAsync(10, 3, 5);

            Assert.Equal(12, p1.TotalCount);
            Assert.Equal(3, p1.TotalPages);
            Assert.Equal(Enumerable.Range(1, 5).Select(i => $"Ajman Frozen Goods {i}"), p1.Items.Select(c => c.Name));
            Assert.Equal(Enumerable.Range(6, 5).Select(i => $"Ajman Frozen Goods {i}"), p2.Items.Select(c => c.Name));
            Assert.Equal(new[] { "Ajman Frozen Goods 11", "Ajman Frozen Goods 12" }, p3.Items.Select(c => c.Name));
            Assert.DoesNotContain(p1.Items.Concat(p2.Items).Concat(p3.Items), c => c.Name.Contains("OTHER TENANT"));
        }

        [Fact]
        public async Task CustomerFilters_CoverAllPages_AndCountsMatchTheList()
        {
            await using var db = await DbAsync();
            // 150 customers: ids 1-60 owe money and were active recently, 61-90 owe money but are stale (overdue),
            // 91-150 owe nothing and have no activity (inactive).
            for (var i = 1; i <= 60; i++) db.Customers.Add(Cust(i, 10, $"Cust {i:D3}", 100, Now.AddDays(-5)));
            for (var i = 61; i <= 90; i++) db.Customers.Add(Cust(i, 10, $"Cust {i:D3}", 50, Now.AddDays(-45)));
            for (var i = 91; i <= 150; i++) db.Customers.Add(Cust(i, 10, $"Cust {i:D3}", 0, null));
            db.Customers.Add(Cust(500, 99, "Other tenant debtor", 9999, Now));
            await db.SaveChangesAsync();
            db.ChangeTracker.Clear();
            db.SetRequestTenantScope(10, false);
            var svc = new CustomerService(db);

            var counts = await svc.GetCustomerFilterCountsAsync(10);
            Assert.Equal(150, counts.All);
            Assert.Equal(90, counts.Outstanding);
            Assert.Equal(90, counts.Active);   // active within 90 days: the 60 recent plus the 30 last seen 45 days ago
            Assert.Equal(30, counts.Overdue);  // owe money and quiet for more than 30 days
            Assert.Equal(60, counts.Inactive); // never active

            // Page 2 of the outstanding tab still has rows: the old in-browser filter only ever saw the first 100 customers.
            var outstandingP1 = await svc.GetCustomersAsync(10, 1, 50, filter: "outstanding");
            var outstandingP2 = await svc.GetCustomersAsync(10, 2, 50, filter: "outstanding");
            Assert.Equal(90, outstandingP1.TotalCount);
            Assert.Equal(50, outstandingP1.Items.Count);
            Assert.Equal(40, outstandingP2.Items.Count);
            Assert.All(outstandingP1.Items.Concat(outstandingP2.Items), c => Assert.True(c.Balance > 0));

            var overdue = await svc.GetCustomersAsync(10, 1, 100, filter: "overdue");
            Assert.Equal(30, overdue.TotalCount);
            Assert.All(overdue.Items, c => Assert.InRange(c.Id, 61, 90));

            var search = await svc.GetCustomerFilterCountsAsync(10, "Cust 07");
            Assert.Equal(10, search.All); // Cust 070 .. Cust 079
            Assert.Equal(10, search.Overdue);

            // Another tenant's data never leaks into these numbers.
            db.SetRequestTenantScope(99, false);
            var other = await svc.GetCustomerFilterCountsAsync(99);
            Assert.Equal(1, other.All);
            Assert.Equal(1, other.Outstanding);
        }

        private static LegacyController Legacy(AppDbContext db, int tenantId)
        {
            var controller = new LegacyController(db, NullLogger<LegacyController>.Instance)
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext
                    {
                        User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                        {
                            new Claim("tid", tenantId.ToString()),
                            new Claim(ClaimTypes.Role, "Owner"),
                            new Claim(ClaimTypes.NameIdentifier, "1")
                        }, "Test"))
                    }
                }
            };
            return controller;
        }

        private static async Task SeedPaymentsAsync(AppDbContext db)
        {
            db.Tenants.Add(new Tenant { Id = 10, Name = "Tenant ten", Subdomain = "history-10" });
            db.Tenants.Add(new Tenant { Id = 20, Name = "Tenant twenty", Subdomain = "history-20" });
            db.Users.Add(new User { Id = 1, TenantId = 10, OwnerId = 10, Name = "Owner ten", Email = "ten@example.test", PasswordHash = "fixture", Role = UserRole.Owner, CreatedAt = Now });
            db.Customers.Add(Cust(1, 10, "Gulf Fresh Foods"));
            db.Customers.Add(Cust(2, 20, "Other Tenant Customer"));
            // Tenant 10: two current payments
            db.Payments.Add(new Payment { Id = 1, TenantId = 10, OwnerId = 10, CustomerId = 1, Amount = 100m, Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED, PaymentDate = new DateTime(2026, 11, 5, 0, 0, 0, DateTimeKind.Utc), CreatedBy = 1, CreatedAt = new DateTime(2026, 11, 5, 9, 0, 0, DateTimeKind.Utc), UpdatedAt = Now, Reference = "CUR-A" });
            db.Payments.Add(new Payment { Id = 2, TenantId = 10, OwnerId = 10, CustomerId = 1, Amount = 250m, Mode = PaymentMode.CHEQUE, Status = PaymentStatus.PENDING, PaymentDate = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc), CreatedBy = 1, CreatedAt = new DateTime(2026, 9, 1, 9, 0, 0, DateTimeKind.Utc), UpdatedAt = Now, Reference = "CUR-B" });
            // Tenant 10: two historical payments
            db.LegacyPayments.Add(new LegacyPayment { Id = 11, TenantId = 10, SourcePaymentId = 9001, SourceCustomerId = 77, DestinationCustomerId = 1, Amount = 400m, Mode = "Cash", Status = "Cleared", PaymentDate = new DateTime(2026, 3, 10, 0, 0, 0, DateTimeKind.Utc), Reference = "OLD-A" });
            db.LegacyPayments.Add(new LegacyPayment { Id = 12, TenantId = 10, SourcePaymentId = 9002, SourceCustomerId = 77, DestinationCustomerId = 1, Amount = 75m, Mode = "Cheque", Status = "Pending", PaymentDate = new DateTime(2026, 10, 20, 0, 0, 0, DateTimeKind.Utc), Reference = "OLD-B" });
            db.LegacyCustomers.Add(new LegacyCustomer { Id = 1, TenantId = 10, SourceCustomerId = 77, Name = "Gulf Fresh Foods (old)", DestinationCustomerId = 1 });
            // Tenant 20: its own payments, which tenant 10 must never see
            db.Payments.Add(new Payment { Id = 3, TenantId = 20, OwnerId = 20, CustomerId = 2, Amount = 999m, Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED, PaymentDate = new DateTime(2026, 11, 6, 0, 0, 0, DateTimeKind.Utc), CreatedBy = 1, CreatedAt = Now, UpdatedAt = Now, Reference = "T20-CUR" });
            db.LegacyPayments.Add(new LegacyPayment { Id = 13, TenantId = 20, SourcePaymentId = 9003, Amount = 888m, Mode = "Cash", Status = "Cleared", PaymentDate = new DateTime(2026, 11, 6, 0, 0, 0, DateTimeKind.Utc), Reference = "T20-OLD" });
            await db.SaveChangesAsync();
            db.ChangeTracker.Clear();
        }

        private static List<UnifiedPaymentDto> Items(ActionResult<HexaBill.Api.Models.ApiResponse<HexaBill.Api.Models.PagedResponse<UnifiedPaymentDto>>> r)
        {
            var ok = Assert.IsType<OkObjectResult>(r.Result);
            var body = Assert.IsType<HexaBill.Api.Models.ApiResponse<HexaBill.Api.Models.PagedResponse<UnifiedPaymentDto>>>(ok.Value);
            return body.Data!.Items.ToList();
        }

        [Fact]
        public async Task UnifiedPayments_MergeCurrentAndHistorical_NewestFirst_OnlyForTheTenant()
        {
            await using var db = await DbAsync();
            await SeedPaymentsAsync(db);
            db.SetRequestTenantScope(10, false);
            var controller = Legacy(db, 10);

            var all = Items(await controller.GetUnifiedPayments());
            Assert.Equal(new[] { "CUR-A", "OLD-B", "CUR-B", "OLD-A" }, all.Select(p => p.Reference));
            Assert.Equal(new[] { false, true, false, true }, all.Select(p => p.IsHistorical));
            Assert.DoesNotContain(all, p => p.Reference!.StartsWith("T20"));
            Assert.Equal("Gulf Fresh Foods (old)", all.Single(p => p.Reference == "OLD-A").CustomerName);
            Assert.Equal("Gulf Fresh Foods", all.Single(p => p.Reference == "CUR-A").CustomerName);

            var current = Items(await controller.GetUnifiedPayments(source: "current"));
            Assert.Equal(new[] { "CUR-A", "CUR-B" }, current.Select(p => p.Reference));
            var historical = Items(await controller.GetUnifiedPayments(source: "historical"));
            Assert.Equal(new[] { "OLD-B", "OLD-A" }, historical.Select(p => p.Reference));
            Assert.All(historical, p => Assert.True(p.IsHistorical));
        }

        [Fact]
        public async Task UnifiedPayments_FiltersApplyToBothSources_AndPagingIsServerSide()
        {
            await using var db = await DbAsync();
            await SeedPaymentsAsync(db);
            db.SetRequestTenantScope(10, false);
            var controller = Legacy(db, 10);

            var cheques = Items(await controller.GetUnifiedPayments(method: "CHEQUE"));
            Assert.Equal(new[] { "OLD-B", "CUR-B" }, cheques.Select(p => p.Reference));

            var cleared = Items(await controller.GetUnifiedPayments(status: "CLEARED"));
            Assert.Equal(new[] { "CUR-A", "OLD-A" }, cleared.Select(p => p.Reference));

            var bySearch = Items(await controller.GetUnifiedPayments(search: "old-a"));
            Assert.Equal(new[] { "OLD-A" }, bySearch.Select(p => p.Reference));

            var range = Items(await controller.GetUnifiedPayments(fromDate: new DateTime(2026, 10, 1), toDate: new DateTime(2026, 11, 30)));
            Assert.Equal(new[] { "CUR-A", "OLD-B" }, range.Select(p => p.Reference));

            var page2 = await controller.GetUnifiedPayments(page: 2, pageSize: 3);
            var body = Assert.IsType<HexaBill.Api.Models.ApiResponse<HexaBill.Api.Models.PagedResponse<UnifiedPaymentDto>>>(Assert.IsType<OkObjectResult>(page2.Result).Value);
            Assert.Equal(4, body.Data!.TotalCount);
            Assert.Equal(new[] { "OLD-A" }, body.Data.Items.Select(p => p.Reference));
        }

        [Fact]
        public async Task UnifiedPayments_RejectBadInput_AndTenantWithoutHistoryGetsOnlyCurrent()
        {
            await using var db = await DbAsync();
            await SeedPaymentsAsync(db);
            db.SetRequestTenantScope(10, false);

            Assert.IsType<BadRequestObjectResult>((await Legacy(db, 10).GetUnifiedPayments(source: "everything")).Result);
            Assert.IsType<BadRequestObjectResult>((await Legacy(db, 10).GetUnifiedPayments(method: "BITCOIN")).Result);
            Assert.IsType<BadRequestObjectResult>((await Legacy(db, 10).GetUnifiedPayments(fromDate: new DateTime(2026, 5, 2), toDate: new DateTime(2026, 5, 1))).Result);

            // Tenant 30 owns no historical rows and no payments: nothing from tenants 10 or 20 may appear.
            var summary = Assert.IsType<OkObjectResult>((await Legacy(db, 10).GetPaymentsSummary()).Result);
            Assert.Equal(2, Assert.IsType<HexaBill.Api.Models.ApiResponse<LegacyPaymentsSummaryDto>>(summary.Value).Data!.HistoricalCount);
            db.SetRequestTenantScope(30, false);
            Assert.Empty(Items(await Legacy(db, 30).GetUnifiedPayments()));
            var none = Assert.IsType<OkObjectResult>((await Legacy(db, 30).GetPaymentsSummary()).Result);
            Assert.Equal(0, Assert.IsType<HexaBill.Api.Models.ApiResponse<LegacyPaymentsSummaryDto>>(none.Value).Data!.HistoricalCount);
        }
    }
}
