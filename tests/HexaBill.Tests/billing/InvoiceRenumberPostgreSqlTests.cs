using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Sales;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace HexaBill.Tests;

/// <summary>P0-NUM-004 on real Postgres: transaction + tenant lock + UX_Sales_TenantId_InvoiceNo_Issued, then next = 7004.</summary>
public class InvoiceRenumberPostgreSqlTests
{
    [SkippableFact]
    public async Task FrozenHubFourInvoices_RenumberOnPostgres_NextIs7004_AndDuplicateRefused()
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(connection), PostgresIntegrationSkip.Reason);
        var tenantId = 1_800_000 + Random.Shared.Next(1, 50_000);
        var now = DateTime.UtcNow;
        var plan = new[] { ("1791254852", "7000"), ("1791254853", "7001"), ("1791254858", "7002"), ("1791254859", "7003") };
        var ids = new List<int>();
        await using (var seed = Open(connection!, tenantId))
        {
            await PostgresTestSchema.EnsureCreatedAsync(seed);
            seed.Tenants.Add(new Tenant { Id = tenantId, Name = "Renumber fixture", Subdomain = $"renum-{tenantId}" });
            seed.Users.Add(new User { Id = tenantId, TenantId = tenantId, OwnerId = tenantId, Name = "Owner", Email = $"renum-{tenantId}@example.test", PasswordHash = "fixture", Role = UserRole.Owner, CreatedAt = now });
            seed.Settings.Add(new Setting { TenantId = tenantId, OwnerId = tenantId, Key = InvoiceNumberService.SeriesStartSettingKey, Value = "7000" });
            var sales = plan.Select((p, i) => new Sale
            {
                TenantId = tenantId, OwnerId = tenantId, CreatedBy = tenantId, InvoiceNo = p.Item1, InvoiceDate = now.AddDays(i), CreatedAt = now.AddDays(i),
                Subtotal = 100m, VatTotal = 5m, GrandTotal = 105m, TotalAmount = 105m, PaymentStatus = SalePaymentStatus.Pending, IsFinalized = true
            }).ToList();
            seed.Sales.AddRange(sales);
            await seed.SaveChangesAsync();
            ids.AddRange(sales.Select(s => s.Id));
        }

        try
        {
            for (var i = 0; i < plan.Length; i++)
            {
                await using var db = Open(connection!, tenantId);
                var (outcome, problem, _) = await new InvoiceRenumberService(db, new InvoiceNumberService(db, new ConfigurationBuilder().Build()))
                    .ChangeAsync(ids[i], tenantId, tenantId, new ChangeInvoiceNumberRequest { NewInvoiceNumber = plan[i].Item2 }, dryRun: false);
                Assert.True(outcome == InvoiceNumberChangeOutcome.Ok, problem);
            }

            await using var check = Open(connection!, tenantId);
            Assert.Equal(plan.Select(p => p.Item2), await check.Sales.Where(s => s.TenantId == tenantId).OrderBy(s => s.Id).Select(s => s.InvoiceNo).ToListAsync());
            Assert.Equal(4, await check.AuditLogs.CountAsync(a => a.TenantId == tenantId && a.Action == "InvoiceNumberChanged"));
            Assert.Equal(420m, await check.Sales.Where(s => s.TenantId == tenantId).SumAsync(s => s.GrandTotal));
            Assert.Equal("7004", await new InvoiceNumberService(check, new ConfigurationBuilder().Build()).GenerateNextInvoiceNumberAsync(tenantId));
            var dup = await new InvoiceRenumberService(check, new InvoiceNumberService(check, new ConfigurationBuilder().Build()))
                .ChangeAsync(ids[0], tenantId, tenantId, new ChangeInvoiceNumberRequest { NewInvoiceNumber = "7003" }, dryRun: false);
            Assert.Equal(InvoiceNumberChangeOutcome.Invalid, dup.Outcome);
        }
        finally
        {
            await using var cleanup = Open(connection!, tenantId);
            await cleanup.AuditLogs.Where(a => a.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.Sales.IgnoreQueryFilters().Where(s => s.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.Settings.Where(s => s.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.Users.Where(u => u.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.Tenants.Where(t => t.Id == tenantId).ExecuteDeleteAsync();
        }
    }

    private static AppDbContext Open(string connection, int tenantId)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection).Options);
        db.SetRequestTenantScope(tenantId, false);
        return db;
    }
}
