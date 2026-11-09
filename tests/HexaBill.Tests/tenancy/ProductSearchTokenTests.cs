using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Products;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

public class ProductSearchTokenTests
{
    [Theory]
    [InlineData("1000 seara")]
    [InlineData("seara 1000")]
    [InlineData("SEARA   1000gm")]
    public async Task Search_MultiWord_MatchesNonContiguousName(string query)
    {
        await using var db = await SeedAsync();
        var result = await new ProductService(db, NullLogger<ProductService>.Instance).SearchProductsAsync(query, 1, 60);
        var single = Assert.Single(result);
        Assert.Equal("FROZEN CHICKEN 1000GM SEARA", single.NameEn);
    }

    [Fact]
    public async Task Search_SingleToken_ReturnsAllBrands_BeyondFive_AndIsTenantScoped()
    {
        await using var db = await SeedAsync();
        var result = await new ProductService(db, NullLogger<ProductService>.Instance).SearchProductsAsync("1000", 1, 60);
        Assert.Equal(8, result.Count); // 8 tenant-1 brands; the tenant-2 row is excluded
        Assert.All(result, p => Assert.Contains("1000", p.NameEn));
    }

    [Fact]
    public async Task Search_UnmatchedToken_ReturnsNothing()
    {
        await using var db = await SeedAsync();
        var result = await new ProductService(db, NullLogger<ProductService>.Instance).SearchProductsAsync("1000 zzz", 1, 60);
        Assert.Empty(result);
    }

    private static async Task<AppDbContext> SeedAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        db.SetRequestTenantScope(null, true);
        db.Tenants.AddRange(
            new Tenant { Id = 1, Name = "A", Subdomain = "a", FeaturesJson = "[]" },
            new Tenant { Id = 2, Name = "B", Subdomain = "b", FeaturesJson = "[]" });
        var brands = new[] { "AL SAFFA", "BUPLIC", "CEDROB", "CONFIDENCE", "FRANGOSUL", "SEARA", "NAT", "QUALIKO" };
        var id = 1;
        foreach (var b in brands)
            db.Products.Add(new Product { Id = id++, TenantId = 1, OwnerId = 1, Sku = $"FRZN-1000GM-{id}", NameEn = $"FROZEN CHICKEN 1000GM {b}", UnitType = "CRTN", ConversionToBase = 1 });
        db.Products.Add(new Product { Id = 100, TenantId = 2, OwnerId = 2, Sku = "OTHER", NameEn = "FROZEN CHICKEN 1000GM SEARA", UnitType = "CRTN", ConversionToBase = 1 });
        await db.SaveChangesAsync();
        db.SetRequestTenantScope(1, false);
        return db;
    }
}
