using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Customers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

/// <summary>
/// Products and imported customers set OwnerId to the tenant. The API create path left it at 0
/// (56 live rows). Nothing scopes on Customers.OwnerId, but the column is NOT NULL and should match the tenant.
/// Skips without HEXABILL_TEST_POSTGRES.
/// </summary>
[Collection("HttpPostgresIntegration")]
public class CustomerCreateOwnerIdPostgreSqlTests
{
    [SkippableFact]
    public async Task CreateCustomer_SetsOwnerIdToTenant()
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(connection), PostgresIntegrationSkip.Reason);
        var tenantId = 1_950_000 + Random.Shared.Next(1, 100_000);
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection!).Options);
        db.SetRequestTenantScope(tenantId, false);
        await PostgresTestSchema.EnsureCreatedAsync(db);
        db.Tenants.Add(new Tenant { Id = tenantId, Name = "Synthetic owner id", Subdomain = $"owner-{tenantId}" });
        await db.SaveChangesAsync();

        var service = new CustomerService(db, NullLogger<CustomerService>.Instance);
        var created = await service.CreateCustomerAsync(new CreateCustomerRequest
        {
            Name = "Owner id synthetic customer", Phone = "0500000001", CustomerType = "Credit", CreditLimit = 0,
        }, tenantId);

        var stored = await db.Customers.AsNoTracking().SingleAsync(c => c.Id == created.Id);
        Assert.Equal(tenantId, stored.TenantId);
        Assert.Equal(tenantId, stored.OwnerId);
    }
}
