using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Payments;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

/// <summary>
/// Same-day payment ordering on PostgreSQL. Bulk entries are stored at UTC midnight; a payment recorded later that day
/// must list first. Verifies the SQL translation of the date ordering, which the in-memory test cannot.
/// </summary>
public class PaymentListOrderingPostgreSqlTests
{
    [SkippableFact]
    public async Task PaymentList_NewestRecordedFirstWithinTheSameDay_OnPostgreSql()
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(connection), PostgresIntegrationSkip.Reason);
        var t = 1_850_000 + Random.Shared.Next(1, 50_000);
        var day = new DateTime(2026, 10, 24, 0, 0, 0, DateTimeKind.Utc);

        await using (var seed = Open(connection!, t))
        {
            await PostgresTestSchema.EnsureCreatedAsync(seed);
            seed.Tenants.Add(new Tenant { Id = t, Name = "Payment order fixture", Subdomain = $"porder-{t}" });
            seed.Users.Add(new User { Id = t, TenantId = t, OwnerId = t, Name = "Fixture owner", Email = $"porder-{t}@example.test", PasswordHash = "fixture", Role = UserRole.Owner, CreatedAt = day });
            seed.Customers.Add(new Customer { Id = t, TenantId = t, OwnerId = t, Name = "Fixture buyer", CreatedAt = day, UpdatedAt = day });
            seed.Payments.AddRange(
                Payment(t, 1, day.AddHours(9), day.AddHours(9)),        // timed, recorded 09:00
                Payment(t, 2, day, day.AddHours(10)),                    // date-only (midnight), recorded 10:00
                Payment(t, 3, day.AddDays(-1).AddHours(20), day.AddDays(-1).AddHours(20)));
            await seed.SaveChangesAsync();
        }

        try
        {
            await using var db = Open(connection!, t);
            var service = new PaymentService(db, NullLogger<PaymentService>.Instance, null!, null!, null!);
            var ids = (await service.GetPaymentsAsync(t, page: 1, pageSize: 10)).Items.Select(i => i.Id).ToArray();
            Assert.Equal(new[] { t * 10 + 2, t * 10 + 1, t * 10 + 3 }, ids);
        }
        finally
        {
            await using var cleanup = Open(connection!, t);
            await cleanup.Payments.IgnoreQueryFilters().Where(p => p.TenantId == t).ExecuteDeleteAsync();
            await cleanup.Customers.IgnoreQueryFilters().Where(c => c.TenantId == t).ExecuteDeleteAsync();
            await cleanup.Users.IgnoreQueryFilters().Where(u => u.TenantId == t).ExecuteDeleteAsync();
            await cleanup.Tenants.Where(x => x.Id == t).ExecuteDeleteAsync();
        }
    }

    private static Payment Payment(int tenantId, int id, DateTime paymentDate, DateTime createdAt) => new()
    {
        Id = tenantId * 10 + id, TenantId = tenantId, OwnerId = tenantId, CustomerId = tenantId, Amount = 10m,
        Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED, CreatedBy = tenantId,
        PaymentDate = paymentDate, CreatedAt = createdAt,
    };

    private static AppDbContext Open(string connection, int tenantId)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection).Options);
        db.SetRequestTenantScope(tenantId, false);
        return db;
    }
}
