using System.Security.Claims;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Products;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using HexaBill.Api.Modules.SuperAdmin;

namespace HexaBill.Tests;

public class ProductControllerIsolationTests
{
    [Fact]
    public async Task GetProduct_OtherTenantsProduct_ReturnsNotFound()
    {
        await using var db = await SeedAsync();
        db.SetRequestTenantScope(1, false);
        var service = new ProductService(db, NullLogger<ProductService>.Instance);
        var controller = Controller(service);
        Attach(controller, TenantUser(1));
        var action = await controller.GetProduct(2);
        Assert.IsType<NotFoundObjectResult>(action.Result);
    }

    [Fact]
    public async Task GetProduct_OwnProduct_ReturnsOk()
    {
        await using var db = await SeedAsync();
        db.SetRequestTenantScope(1, false);
        var service = new ProductService(db, NullLogger<ProductService>.Instance);
        var controller = Controller(service);
        Attach(controller, TenantUser(1));
        var action = await controller.GetProduct(1);
        Assert.IsType<OkObjectResult>(action.Result);
    }

    private static ProductsController Controller(IProductService products) =>
        new(products, null!, new ServiceCollection().BuildServiceProvider(), new EmptySettings(), null!, null!, NullLogger<ProductsController>.Instance);

    private static void Attach(ProductsController controller, ClaimsPrincipal user) =>
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = user } };

    private static ClaimsPrincipal TenantUser(int tenantId) =>
        new(new ClaimsIdentity(new[]
        {
            new Claim("tid", tenantId.ToString()),
            new Claim(ClaimTypes.Role, "Owner"),
            new Claim(ClaimTypes.NameIdentifier, "1"),
        }, "Test"));

    private static async Task<AppDbContext> SeedAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        db.SetRequestTenantScope(null, true);
        db.Tenants.AddRange(
            new Tenant { Id = 1, Name = "A", Subdomain = "a", FeaturesJson = "[]" },
            new Tenant { Id = 2, Name = "B", Subdomain = "b", FeaturesJson = "[]" });
        db.Products.AddRange(
            new Product { Id = 1, TenantId = 1, OwnerId = 1, Sku = "A1", NameEn = "Prod A", UnitType = "PIECE", ConversionToBase = 1 },
            new Product { Id = 2, TenantId = 2, OwnerId = 2, Sku = "B1", NameEn = "Prod B", UnitType = "PIECE", ConversionToBase = 1 });
        await db.SaveChangesAsync();
        return db;
    }

    private sealed class EmptySettings : ISettingsService
    {
        public Task<Dictionary<string, string>> GetOwnerSettingsAsync(int tenantId) => Task.FromResult(new Dictionary<string, string>());
        public Task<string?> GetSettingValueAsync(int tenantId, string key) => Task.FromResult<string?>(null);
        public Task<bool> UpdateOwnerSettingAsync(int tenantId, string key, string value) => throw new NotSupportedException();
        public Task<bool> UpdateOwnerSettingsBulkAsync(int tenantId, Dictionary<string, string> settings) => throw new NotSupportedException();
        public Task<CompanySettings> GetCompanySettingsAsync(int tenantId) => throw new NotSupportedException();
        public Task<LogoMetadata?> GetLogoMetadataAsync(int tenantId) => throw new NotSupportedException();
        public Task ClearLogoAsync(int tenantId) => throw new NotSupportedException();
        public Task ClearStampAsync(int tenantId) => throw new NotSupportedException();
        public Task ClearSignatureAsync(int tenantId) => throw new NotSupportedException();
        public Task<int> CountOtherTenantsSharingVatTrnAsync(int tenantId, string? vatTrn) => Task.FromResult(0);
    }
}
