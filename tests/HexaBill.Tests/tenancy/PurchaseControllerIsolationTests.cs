using System.Security.Claims;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Purchases;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

public class PurchaseControllerIsolationTests
{
    [Fact]
    public async Task GetPurchase_OtherTenantsPurchase_ReturnsNotFound()
    {
        await using var db = await SeedAsync();
        db.SetRequestTenantScope(1, false);
        var service = new PurchaseService(db, null!);
        var controller = Controller(db, TenantUser(1), service);
        var action = await controller.GetPurchase(2);
        Assert.IsType<NotFoundObjectResult>(action.Result);
    }

    [Fact]
    public async Task GetPurchase_OwnPurchase_ReturnsOk()
    {
        await using var db = await SeedAsync();
        db.SetRequestTenantScope(1, false);
        var service = new PurchaseService(db, null!);
        var controller = Controller(db, TenantUser(1), service);
        var action = await controller.GetPurchase(1);
        Assert.IsType<OkObjectResult>(action.Result);
    }

    private static PurchasesController Controller(AppDbContext db, ClaimsPrincipal user, IPurchaseService purchases) =>
        Attach(new PurchasesController(purchases, db, NullLogger<PurchasesController>.Instance), user);

    private static T Attach<T>(T controller, ClaimsPrincipal user) where T : ControllerBase
    {
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = user } };
        return controller;
    }

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
        db.Users.AddRange(
            new User { Id = 1, TenantId = 1, OwnerId = 1, Email = "a@test.local", Name = "A", PasswordHash = "x", Role = UserRole.Owner },
            new User { Id = 2, TenantId = 2, OwnerId = 2, Email = "b@test.local", Name = "B", PasswordHash = "x", Role = UserRole.Owner });
        var now = DateTime.UtcNow;
        db.Purchases.AddRange(
            new Purchase
            {
                Id = 1, TenantId = 1, OwnerId = 1, SupplierName = "Sup A", InvoiceNo = "PA-1",
                TotalAmount = 50, PurchaseDate = now, CreatedBy = 1, CreatedAt = now
            },
            new Purchase
            {
                Id = 2, TenantId = 2, OwnerId = 2, SupplierName = "Sup B", InvoiceNo = "PB-1",
                TotalAmount = 80, PurchaseDate = now, CreatedBy = 2, CreatedAt = now
            });
        await db.SaveChangesAsync();
        return db;
    }
}
