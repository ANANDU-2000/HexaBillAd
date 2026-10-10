using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Reports;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

public sealed class VatTenantFilterPostgreSqlTests
{
    [Fact(DisplayName = "VAT_TENANCY_RawSqlAndPlatformScopeExcludeLegacyNullTenantRows")]
    public async Task RawSqlAndPlatformScopeExcludeLegacyNullTenantRows()
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        if (string.IsNullOrWhiteSpace(connection))
            return;

        var tenantId = 1_800_000 + Random.Shared.Next(1, 40_000);
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection).Options;
        await using var context = new AppDbContext(options);
        context.SetRequestTenantScope(null, isPlatformScope: true);
        await PostgresTestSchema.EnsureCreatedAsync(context);

        var now = DateTime.UtcNow;
        context.Tenants.Add(new Tenant
        {
            Id = tenantId,
            Name = $"VAT tenant filter {tenantId}",
            Subdomain = $"vt{tenantId}"
        });
        context.Users.Add(new User
        {
            Id = tenantId,
            TenantId = tenantId,
            OwnerId = tenantId,
            Name = "Synthetic VAT owner",
            Email = $"vat-filter-{tenantId}@example.test",
            PasswordHash = "fixture",
            Role = UserRole.Owner,
            CreatedAt = now
        });
        context.Sales.AddRange(
            new Sale
            {
                TenantId = tenantId, OwnerId = tenantId, CreatedBy = tenantId,
                InvoiceNo = $"VT-{tenantId}-TAGGED", InvoiceDate = new DateTime(2025, 1, 15, 12, 0, 0, DateTimeKind.Utc),
                Subtotal = 1_000m, VatTotal = 50m, GrandTotal = 1_050m, VatScenario = "Standard",
                IsDeleted = false, CreatedAt = now
            },
            new Sale
            {
                TenantId = null, OwnerId = tenantId, CreatedBy = tenantId,
                InvoiceNo = $"VT-{tenantId}-LEGACY", InvoiceDate = new DateTime(2025, 1, 16, 12, 0, 0, DateTimeKind.Utc),
                Subtotal = 2_000m, VatTotal = 100m, GrandTotal = 2_100m, VatScenario = "Standard",
                IsDeleted = false, CreatedAt = now
            });
        await context.SaveChangesAsync();

        var report = await new VatReturnReportService(context, NullLogger<VatReturnReportService>.Instance)
            .GetVatReturn201Async(tenantId,
                new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                new DateTime(2025, 4, 1, 0, 0, 0, DateTimeKind.Utc));

        Assert.Equal(1_000m, report.Box1a);
        Assert.Equal(50m, report.Box1b);
        Assert.Single(report.OutputLines);
        Assert.Equal($"VT-{tenantId}-TAGGED", report.OutputLines[0].Reference);

        context.Sales.RemoveRange(context.Sales.Where(s => s.OwnerId == tenantId));
        context.Users.Remove(await context.Users.SingleAsync(u => u.Id == tenantId));
        context.Tenants.Remove(await context.Tenants.SingleAsync(t => t.Id == tenantId));
        await context.SaveChangesAsync();
    }
}
