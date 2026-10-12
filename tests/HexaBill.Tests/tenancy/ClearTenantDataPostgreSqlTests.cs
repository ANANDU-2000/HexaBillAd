using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Tenants;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace HexaBill.Tests;

/// <summary>Owner "clear all data" must succeed when the tenant has returns with damage stock. Needs HEXABILL_TEST_POSTGRES.</summary>
public class ClearTenantDataPostgreSqlTests
{
    [Fact]
    public async Task ClearTenantData_WithDamagedReturn_SucceedsAndLeavesNoOrphans()
    {
        var cs = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        if (string.IsNullOrWhiteSpace(cs)) return;

        var tenantId = 920_000 + Random.Shared.Next(1, 40_000);
        var now = DateTime.UtcNow;
        var ownerId = 0;
        await using (var seed = await OpenAsync(cs, null, true))
        {
            seed.Tenants.Add(new Tenant { Id = tenantId, Name = $"Clear {tenantId}", Subdomain = $"clear-{tenantId}" });
            await seed.SaveChangesAsync();
            var user = new User { TenantId = tenantId, OwnerId = tenantId, Name = "Owner", Email = $"o{tenantId}@clear.test", PasswordHash = "x", Role = UserRole.Owner, CreatedAt = now };
            var customer = new Customer { TenantId = tenantId, OwnerId = tenantId, Name = "C", CreatedAt = now, UpdatedAt = now };
            var product = new Product { TenantId = tenantId, OwnerId = tenantId, Sku = $"S{tenantId}", NameEn = "P", StockQty = 5, CreatedAt = now, UpdatedAt = now };
            seed.AddRange(user, customer, product);
            await seed.SaveChangesAsync();
            ownerId = user.Id;
            var sale = new Sale { TenantId = tenantId, OwnerId = tenantId, CustomerId = customer.Id, InvoiceNo = $"CL-{tenantId}", InvoiceDate = now, GrandTotal = 10m, TotalAmount = 10m, CreatedBy = user.Id, CreatedAt = now };
            seed.Sales.Add(sale);
            await seed.SaveChangesAsync();
            var ret = new SaleReturn { TenantId = tenantId, OwnerId = tenantId, SaleId = sale.Id, CustomerId = customer.Id, ReturnNo = $"R-{tenantId}", ReturnDate = now, GrandTotal = 10m, IsBadItem = true, CreatedBy = user.Id, CreatedAt = now };
            seed.SaleReturns.Add(ret);
            await seed.SaveChangesAsync();
            seed.DamageInventories.Add(new DamageInventory { TenantId = tenantId, ProductId = product.Id, Quantity = 1, SourceReturnId = ret.Id, CreatedAt = now, UpdatedAt = now });
            await seed.SaveChangesAsync();
        }

        try
        {
            await using var db = await OpenAsync(cs, tenantId, false);
            var service = new SuperAdminTenantService(db, null!, Options.Create(new HostingOptions()), null!);
            Assert.True(await service.ClearTenantDataAsync(tenantId, ownerId));
            Assert.Empty(await db.Sales.ToListAsync());
            Assert.Empty(await db.SaleReturns.ToListAsync());
            Assert.Empty(await db.DamageInventories.ToListAsync());
            Assert.Equal(0m, (await db.Products.SingleAsync()).StockQty);
            Assert.Single(await db.Customers.ToListAsync());
        }
        finally
        {
            await using var cleanup = await OpenAsync(cs, null, true);
            await cleanup.DamageInventories.Where(d => d.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.SaleReturns.Where(r => r.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.Sales.Where(s => s.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.AuditLogs.Where(a => a.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.Products.Where(p => p.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.Customers.Where(c => c.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.Users.Where(u => u.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.Tenants.Where(t => t.Id == tenantId).ExecuteDeleteAsync();
        }
    }

    private static async Task<AppDbContext> OpenAsync(string cs, int? tenantId, bool bypass)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(cs).Options);
        db.SetRequestTenantScope(tenantId, bypass);
        await PostgresTestSchema.EnsureCreatedAsync(db);
        return db;
    }
}
