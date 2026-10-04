using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Tests;

/// <summary>
/// PostgreSQL global query filter isolation. Set HEXABILL_TEST_POSTGRES to a dedicated test database URL.
/// </summary>
public class CustomerTenantIsolationPostgreSqlTests
{
    [Fact]
    public async Task Customers_GlobalFilter_HidesOtherTenantRows_BothDirections()
    {
        var connectionString = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        if (string.IsNullOrWhiteSpace(connectionString))
            return;

        var tenantA = 910_000 + Random.Shared.Next(1, 40_000);
        var tenantB = tenantA + 1;
        var customerAId = 0;
        var customerBId = 0;

        await using (var seed = await OpenAsync(connectionString, null, true))
        {
            var now = DateTime.UtcNow;
            seed.Tenants.AddRange(
                new Tenant { Id = tenantA, Name = $"PG A {tenantA}", Subdomain = $"pg-a-{tenantA}" },
                new Tenant { Id = tenantB, Name = $"PG B {tenantB}", Subdomain = $"pg-b-{tenantB}" });
            seed.Customers.AddRange(
                new Customer { TenantId = tenantA, OwnerId = tenantA, Name = "A", CreatedAt = now, UpdatedAt = now },
                new Customer { TenantId = tenantB, OwnerId = tenantB, Name = "B", CreatedAt = now, UpdatedAt = now });
            await seed.SaveChangesAsync();
            customerAId = seed.Customers.Single(c => c.TenantId == tenantA).Id;
            customerBId = seed.Customers.Single(c => c.TenantId == tenantB).Id;
        }

        await using (var dbA = await OpenAsync(connectionString, tenantA, false))
        {
            Assert.Single(await dbA.Customers.ToListAsync());
            Assert.Null(await dbA.Customers.SingleOrDefaultAsync(c => c.Id == customerBId));
        }

        await using (var dbB = await OpenAsync(connectionString, tenantB, false))
        {
            Assert.Single(await dbB.Customers.ToListAsync());
            Assert.Null(await dbB.Customers.SingleOrDefaultAsync(c => c.Id == customerAId));
        }

        await using (var cleanup = await OpenAsync(connectionString, null, true))
        {
            cleanup.Customers.RemoveRange(cleanup.Customers.Where(c => c.TenantId == tenantA || c.TenantId == tenantB));
            cleanup.Tenants.RemoveRange(cleanup.Tenants.Where(t => t.Id == tenantA || t.Id == tenantB));
            await cleanup.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task Payments_GlobalFilter_HidesOtherTenantRows_BothDirections()
    {
        var connectionString = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        if (string.IsNullOrWhiteSpace(connectionString))
            return;

        var tenantA = 920_000 + Random.Shared.Next(1, 40_000);
        var tenantB = tenantA + 1;
        var paymentAId = 0;
        var paymentBId = 0;

        await using (var seed = await OpenAsync(connectionString, null, true))
        {
            var now = DateTime.UtcNow;
            seed.Tenants.AddRange(
                new Tenant { Id = tenantA, Name = $"PG pay A {tenantA}", Subdomain = $"pg-pay-a-{tenantA}" },
                new Tenant { Id = tenantB, Name = $"PG pay B {tenantB}", Subdomain = $"pg-pay-b-{tenantB}" });
            seed.Users.AddRange(
                new User { Id = tenantA, TenantId = tenantA, OwnerId = tenantA, Name = "A", Email = $"a-{tenantA}@test.local", PasswordHash = "x", Role = UserRole.Owner, CreatedAt = now },
                new User { Id = tenantB, TenantId = tenantB, OwnerId = tenantB, Name = "B", Email = $"b-{tenantB}@test.local", PasswordHash = "x", Role = UserRole.Owner, CreatedAt = now });
            seed.Customers.AddRange(
                new Customer { TenantId = tenantA, OwnerId = tenantA, Name = "A", CreatedAt = now, UpdatedAt = now },
                new Customer { TenantId = tenantB, OwnerId = tenantB, Name = "B", CreatedAt = now, UpdatedAt = now });
            await seed.SaveChangesAsync();
            var custA = seed.Customers.Single(c => c.TenantId == tenantA).Id;
            var custB = seed.Customers.Single(c => c.TenantId == tenantB).Id;
            seed.Payments.AddRange(
                new Payment
                {
                    TenantId = tenantA, OwnerId = tenantA, CustomerId = custA, Amount = 10,
                    Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED, CreatedBy = tenantA,
                    PaymentDate = now, CreatedAt = now
                },
                new Payment
                {
                    TenantId = tenantB, OwnerId = tenantB, CustomerId = custB, Amount = 20,
                    Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED, CreatedBy = tenantB,
                    PaymentDate = now, CreatedAt = now
                });
            await seed.SaveChangesAsync();
            paymentAId = seed.Payments.Single(p => p.TenantId == tenantA).Id;
            paymentBId = seed.Payments.Single(p => p.TenantId == tenantB).Id;
        }

        await using (var dbA = await OpenAsync(connectionString, tenantA, false))
        {
            Assert.Single(await dbA.Payments.ToListAsync());
            Assert.Null(await dbA.Payments.SingleOrDefaultAsync(p => p.Id == paymentBId));
        }

        await using (var dbB = await OpenAsync(connectionString, tenantB, false))
        {
            Assert.Single(await dbB.Payments.ToListAsync());
            Assert.Null(await dbB.Payments.SingleOrDefaultAsync(p => p.Id == paymentAId));
        }

        await using (var cleanup = await OpenAsync(connectionString, null, true))
        {
            cleanup.Payments.RemoveRange(cleanup.Payments.Where(p => p.TenantId == tenantA || p.TenantId == tenantB));
            cleanup.Customers.RemoveRange(cleanup.Customers.Where(c => c.TenantId == tenantA || c.TenantId == tenantB));
            cleanup.Users.RemoveRange(cleanup.Users.Where(u => u.TenantId == tenantA || u.TenantId == tenantB));
            cleanup.Tenants.RemoveRange(cleanup.Tenants.Where(t => t.Id == tenantA || t.Id == tenantB));
            await cleanup.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task Sales_GlobalFilter_HidesOtherTenantRows_BothDirections()
    {
        var connectionString = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        if (string.IsNullOrWhiteSpace(connectionString))
            return;

        var tenantA = 930_000 + Random.Shared.Next(1, 40_000);
        var tenantB = tenantA + 1;
        var saleAId = 0;
        var saleBId = 0;

        await using (var seed = await OpenAsync(connectionString, null, true))
        {
            var now = DateTime.UtcNow;
            seed.Tenants.AddRange(
                new Tenant { Id = tenantA, Name = $"PG sale A {tenantA}", Subdomain = $"pg-sale-a-{tenantA}" },
                new Tenant { Id = tenantB, Name = $"PG sale B {tenantB}", Subdomain = $"pg-sale-b-{tenantB}" });
            seed.Users.AddRange(
                new User { Id = tenantA, TenantId = tenantA, OwnerId = tenantA, Name = "A", Email = $"sa-{tenantA}@test.local", PasswordHash = "x", Role = UserRole.Owner, CreatedAt = now },
                new User { Id = tenantB, TenantId = tenantB, OwnerId = tenantB, Name = "B", Email = $"sb-{tenantB}@test.local", PasswordHash = "x", Role = UserRole.Owner, CreatedAt = now });
            await seed.SaveChangesAsync();
            seed.Sales.AddRange(
                new Sale
                {
                    TenantId = tenantA, OwnerId = tenantA, InvoiceNo = $"A-{tenantA}", InvoiceDate = now,
                    Subtotal = 100, VatTotal = 5, GrandTotal = 105, TotalAmount = 105, CreatedBy = tenantA, CreatedAt = now
                },
                new Sale
                {
                    TenantId = tenantB, OwnerId = tenantB, InvoiceNo = $"B-{tenantB}", InvoiceDate = now,
                    Subtotal = 200, VatTotal = 10, GrandTotal = 210, TotalAmount = 210, CreatedBy = tenantB, CreatedAt = now
                });
            await seed.SaveChangesAsync();
            saleAId = seed.Sales.Single(s => s.TenantId == tenantA).Id;
            saleBId = seed.Sales.Single(s => s.TenantId == tenantB).Id;
        }

        await using (var dbA = await OpenAsync(connectionString, tenantA, false))
        {
            Assert.Single(await dbA.Sales.ToListAsync());
            Assert.Null(await dbA.Sales.SingleOrDefaultAsync(s => s.Id == saleBId));
        }

        await using (var dbB = await OpenAsync(connectionString, tenantB, false))
        {
            Assert.Single(await dbB.Sales.ToListAsync());
            Assert.Null(await dbB.Sales.SingleOrDefaultAsync(s => s.Id == saleAId));
        }

        await using (var cleanup = await OpenAsync(connectionString, null, true))
        {
            cleanup.Sales.RemoveRange(cleanup.Sales.Where(s => s.TenantId == tenantA || s.TenantId == tenantB));
            cleanup.Users.RemoveRange(cleanup.Users.Where(u => u.TenantId == tenantA || u.TenantId == tenantB));
            cleanup.Tenants.RemoveRange(cleanup.Tenants.Where(t => t.Id == tenantA || t.Id == tenantB));
            await cleanup.SaveChangesAsync();
        }
    }

    [Fact]
    public async Task Products_GlobalFilter_HidesOtherTenantRows_BothDirections()
    {
        var connectionString = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        if (string.IsNullOrWhiteSpace(connectionString))
            return;

        var tenantA = 940_000 + Random.Shared.Next(1, 40_000);
        var tenantB = tenantA + 1;
        var productAId = 0;
        var productBId = 0;

        await using (var seed = await OpenAsync(connectionString, null, true))
        {
            var now = DateTime.UtcNow;
            seed.Tenants.AddRange(
                new Tenant { Id = tenantA, Name = $"PG prod A {tenantA}", Subdomain = $"pg-prod-a-{tenantA}" },
                new Tenant { Id = tenantB, Name = $"PG prod B {tenantB}", Subdomain = $"pg-prod-b-{tenantB}" });
            seed.Products.AddRange(
                new Product { TenantId = tenantA, OwnerId = tenantA, NameEn = "A", Sku = $"SKU-A-{tenantA}", CreatedAt = now, UpdatedAt = now },
                new Product { TenantId = tenantB, OwnerId = tenantB, NameEn = "B", Sku = $"SKU-B-{tenantB}", CreatedAt = now, UpdatedAt = now });
            await seed.SaveChangesAsync();
            productAId = seed.Products.Single(p => p.TenantId == tenantA).Id;
            productBId = seed.Products.Single(p => p.TenantId == tenantB).Id;
        }

        await using (var dbA = await OpenAsync(connectionString, tenantA, false))
        {
            Assert.Single(await dbA.Products.ToListAsync());
            Assert.Null(await dbA.Products.SingleOrDefaultAsync(p => p.Id == productBId));
        }

        await using (var dbB = await OpenAsync(connectionString, tenantB, false))
        {
            Assert.Single(await dbB.Products.ToListAsync());
            Assert.Null(await dbB.Products.SingleOrDefaultAsync(p => p.Id == productAId));
        }

        await using (var cleanup = await OpenAsync(connectionString, null, true))
        {
            cleanup.Products.RemoveRange(cleanup.Products.Where(p => p.TenantId == tenantA || p.TenantId == tenantB));
            cleanup.Tenants.RemoveRange(cleanup.Tenants.Where(t => t.Id == tenantA || t.Id == tenantB));
            await cleanup.SaveChangesAsync();
        }
    }

    private static async Task<AppDbContext> OpenAsync(string connectionString, int? tenantId, bool bypassFilter)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connectionString).Options);
        db.SetRequestTenantScope(tenantId, bypassFilter);
        await PostgresTestSchema.EnsureCreatedAsync(db);
        return db;
    }
}
