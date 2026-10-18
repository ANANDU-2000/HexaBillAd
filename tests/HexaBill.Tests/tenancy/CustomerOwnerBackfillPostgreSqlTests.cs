using HexaBill.Api.Data;
using HexaBill.Api.Migrations;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;

namespace HexaBill.Tests;

[Collection("HttpPostgresIntegration")]
public class CustomerOwnerBackfillPostgreSqlTests
{
    [SkippableFact]
    public async Task Backfill_RefusesAnUnsetOwnerWithoutTenant_AndPreservesTheWholeBatch()
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(connection), PostgresIntegrationSkip.Reason);
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection!).Options);
        await PostgresTestSchema.EnsureCreatedAsync(db);
        db.SetRequestTenantScope(null, true);
        await using var tx = await db.Database.BeginTransactionAsync();
        var tenant = 2_700_000 + Random.Shared.Next(1, 100_000);
        db.Tenants.Add(new Tenant { Id = tenant, Name = "Synthetic guard", Subdomain = $"backfill-guard-{tenant}" });
        var valid = new Customer { TenantId = tenant, OwnerId = 0, Name = "Valid legacy" };
        var invalid = new Customer { TenantId = null, OwnerId = 0, Name = "No verified tenant" };
        db.Customers.AddRange(valid, invalid);
        await db.SaveChangesAsync();
        await tx.CreateSavepointAsync("before_backfill");
        var sql = new BackfillCustomerOwnerId { ActiveProvider = "Npgsql.EntityFrameworkCore.PostgreSQL" }
            .UpOperations.Cast<SqlOperation>().Single().Sql;
        var error = await Assert.ThrowsAsync<Npgsql.PostgresException>(() => db.Database.ExecuteSqlRawAsync(sql));
        Assert.Equal("P0001", error.SqlState);
        await tx.RollbackToSavepointAsync("before_backfill");
        await db.Entry(valid).ReloadAsync();
        await db.Entry(invalid).ReloadAsync();
        Assert.Equal(0, valid.OwnerId);
        Assert.Equal(0, invalid.OwnerId);
        Assert.Equal(tenant, valid.TenantId);
        Assert.Null(invalid.TenantId);
        await tx.RollbackAsync();
    }

    [SkippableFact]
    public async Task Backfill_PreservesTenantAndBalances_LeavesExistingOwners_AndIsRepeatable()
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(connection), PostgresIntegrationSkip.Reason);
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection!).Options);
        await PostgresTestSchema.EnsureCreatedAsync(db);
        db.SetRequestTenantScope(null, true);
        await using var tx = await db.Database.BeginTransactionAsync();
        var tenant = 2_500_000 + Random.Shared.Next(1, 100_000);
        db.Tenants.AddRange(
            new Tenant { Id = tenant, Name = "Synthetic A", Subdomain = $"backfill-a-{tenant}" },
            new Tenant { Id = tenant + 1, Name = "Synthetic B", Subdomain = $"backfill-b-{tenant}" });
        var first = new Customer { TenantId = tenant, OwnerId = 0, Name = "Legacy A", Balance = 123.45m, PendingBalance = 23.45m, TotalSales = 200m, TotalPayments = 176.55m };
        var other = new Customer { TenantId = tenant + 1, OwnerId = 0, Name = "Legacy B", Balance = -5m };
        var existing = new Customer { TenantId = tenant, OwnerId = tenant + 99, Name = "Existing owner" };
        db.Customers.AddRange(first, other, existing);
        await db.SaveChangesAsync();
        var sql = new BackfillCustomerOwnerId { ActiveProvider = "Npgsql.EntityFrameworkCore.PostgreSQL" }
            .UpOperations.Cast<SqlOperation>().Single().Sql;
        await db.Database.ExecuteSqlRawAsync(sql);
        await db.Database.ExecuteSqlRawAsync(sql);
        await db.Entry(first).ReloadAsync();
        await db.Entry(other).ReloadAsync();
        await db.Entry(existing).ReloadAsync();
        Assert.Equal(tenant, first.TenantId);
        Assert.Equal(tenant, first.OwnerId);
        Assert.Equal("Legacy A", first.Name);
        Assert.Equal(123.45m, first.Balance);
        Assert.Equal(23.45m, first.PendingBalance);
        Assert.Equal(200m, first.TotalSales);
        Assert.Equal(176.55m, first.TotalPayments);
        Assert.Equal(tenant + 1, other.TenantId);
        Assert.Equal(tenant + 1, other.OwnerId);
        Assert.Equal(-5m, other.Balance);
        Assert.Equal(tenant + 99, existing.OwnerId);
        await tx.RollbackAsync();
    }
}
