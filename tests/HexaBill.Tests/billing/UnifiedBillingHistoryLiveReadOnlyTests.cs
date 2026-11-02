using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
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
    /// Opt-in verification of the unified Billing History query on real PostgreSQL data.
    /// Runs only when HEXABILL_LIVE_READONLY_PG is set, and refuses to run unless the session is
    /// read-only (connection string must carry Options=-c default_transaction_read_only=on).
    /// Expected values are computed with direct SQL in the same session, never hard-coded.
    /// </summary>
    public class UnifiedBillingHistoryLiveReadOnlyTests
    {
        private static async Task<AppDbContext?> OpenAsync(int tenantId)
        {
            var conn = Environment.GetEnvironmentVariable("HEXABILL_LIVE_READONLY_PG");
            if (string.IsNullOrWhiteSpace(conn)) return null;
            var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(conn).Options);
            await db.Database.OpenConnectionAsync();
            await using (var cmd = db.Database.GetDbConnection().CreateCommand())
            {
                cmd.CommandText = "SHOW default_transaction_read_only";
                var ro = (string?)await cmd.ExecuteScalarAsync();
                Assert.True(ro == "on", "Refusing to run: session is not read-only.");
            }
            db.SetRequestTenantScope(tenantId, isPlatformScope: false);
            return db;
        }

        private static LegacyController Controller(AppDbContext db, int tenantId) => new(db, NullLogger<LegacyController>.Instance)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim("tid", tenantId.ToString()), new Claim(ClaimTypes.Role, "Owner") }, "fixture"))
                }
            }
        };

        private static PagedResponse<UnifiedInvoiceSummaryDto> Page(ActionResult<ApiResponse<PagedResponse<UnifiedInvoiceSummaryDto>>> a)
        {
            var ok = Assert.IsType<OkObjectResult>(a.Result);
            var p = Assert.IsType<ApiResponse<PagedResponse<UnifiedInvoiceSummaryDto>>>(ok.Value);
            Assert.True(p.Success, p.Message);
            return p.Data!;
        }

        [Fact]
        public async Task Live_Tenant20_UnifiedCount_EqualsActiveOperatingPlusActiveHistorical()
        {
            await using var db = await OpenAsync(20);
            if (db == null) return;
            var expected = await db.Sales.CountAsync(s => s.TenantId == 20 && !s.IsDeleted)
                         + await db.LegacyInvoices.CountAsync(i => i.TenantId == 20 && !i.IsDeleted);
            var c = Controller(db, 20);
            var first = Page(await c.GetUnifiedInvoices(pageSize: 200));
            Assert.Equal(expected, first.TotalCount);

            // Every row exactly once across all pages.
            var ids = new HashSet<string>(first.Items.Select(i => i.Id));
            for (var p = 2; p <= first.TotalPages; p++)
                foreach (var row in Page(await c.GetUnifiedInvoices(page: p, pageSize: 200)).Items)
                    Assert.True(ids.Add(row.Id), $"duplicate row {row.Id}");
            Assert.Equal(expected, ids.Count);

            // Status partitions add up to the whole list.
            var paid = Page(await c.GetUnifiedInvoices(pageSize: 1, status: "paid")).TotalCount;
            var partial = Page(await c.GetUnifiedInvoices(pageSize: 1, status: "partial")).TotalCount;
            var unpaid = Page(await c.GetUnifiedInvoices(pageSize: 1, status: "unpaid")).TotalCount;
            Assert.Equal(expected, paid + partial + unpaid);

            Console.WriteLine($"LIVE tenant20 unified={first.TotalCount} paid={paid} partial={partial} unpaid={unpaid}");
        }

        [Theory]
        [InlineData("6996", true)]
        [InlineData("6997", false)]
        [InlineData("7012", false)]
        public async Task Live_Tenant20_SearchFindsBoundaryInvoices(string number, bool historical)
        {
            await using var db = await OpenAsync(20);
            if (db == null) return;
            var rows = Page(await Controller(db, 20).GetUnifiedInvoices(search: number, pageSize: 50)).Items;
            var hit = Assert.Single(rows, r => r.InvoiceNumber == number);
            Assert.Equal(historical, hit.IsLegacy);
        }

        [Fact]
        public async Task Live_Tenant20_RollingWeek_MatchesDubaiDaySql()
        {
            await using var db = await OpenAsync(20);
            if (db == null) return;
            var from = new DateTime(2026, 10, 26);
            var to = new DateTime(2026, 11, 1);
            var startUtc = new DateTime(2026, 10, 25, 20, 0, 0, DateTimeKind.Utc);
            var endUtc = new DateTime(2026, 11, 1, 20, 0, 0, DateTimeKind.Utc);
            var expected = await db.Sales.CountAsync(s => s.TenantId == 20 && !s.IsDeleted && s.InvoiceDate >= startUtc && s.InvoiceDate < endUtc)
                         + await db.LegacyInvoices.CountAsync(i => i.TenantId == 20 && !i.IsDeleted && i.InvoiceDate >= startUtc && i.InvoiceDate < endUtc);
            var data = Page(await Controller(db, 20).GetUnifiedInvoices(pageSize: 200, fromDate: from, toDate: to));
            Assert.Equal(expected, data.TotalCount);
            Assert.All(data.Items, i => Assert.InRange(i.InvoiceDate, startUtc, endUtc.AddTicks(-1)));
            Console.WriteLine($"LIVE tenant20 week 26 Oct-1 Nov unified={data.TotalCount} grand={data.Items.Sum(i => i.GrandTotal)}");
        }

        [Theory]
        [InlineData(22)]
        [InlineData(23)]
        public async Task Live_OtherTenants_HaveNoHistoricalRows(int tenantId)
        {
            await using var db = await OpenAsync(tenantId);
            if (db == null) return;
            var data = Page(await Controller(db, tenantId).GetUnifiedInvoices(pageSize: 200));
            Assert.DoesNotContain(data.Items, i => i.IsLegacy);
            Assert.Equal(await db.Sales.CountAsync(s => s.TenantId == tenantId && !s.IsDeleted), data.TotalCount);
        }
    }
}
