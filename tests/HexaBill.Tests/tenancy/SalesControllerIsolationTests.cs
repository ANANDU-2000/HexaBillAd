using System.Security.Claims;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Sales;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

public class SalesControllerIsolationTests
{
    [Fact]
    public async Task GetSale_OtherTenantsSale_ReturnsNotFound()
    {
        await using var db = await SeedAsync();
        db.SetRequestTenantScope(1, false);
        var controller = Controller(db, TenantUser(1), new TenantSaleProbe().Object);
        var action = await controller.GetSale(2);
        Assert.IsType<NotFoundObjectResult>(action.Result);
    }

    [Fact]
    public async Task GetSale_OwnSale_ReturnsOk()
    {
        await using var db = await SeedAsync();
        db.SetRequestTenantScope(1, false);
        var controller = Controller(db, TenantUser(1), new TenantSaleProbe().Object);
        var action = await controller.GetSale(1);
        Assert.IsType<OkObjectResult>(action.Result);
    }

    private static SalesController Controller(AppDbContext db, ClaimsPrincipal user, ISaleService sales) =>
        Attach(new SalesController(sales, null!, db, null!, NullLogger<SalesController>.Instance), user);

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
        return db;
    }

    private sealed class TenantSaleProbe : InterfaceStub<ISaleService>
    {
        public TenantSaleProbe()
        {
            When("GetSaleByIdAsync", args =>
            {
                var id = (int)args[0]!;
                var tenantId = (int)args[1]!;
                if (tenantId == 1 && id == 1)
                    return Task.FromResult<SaleDto?>(new SaleDto { Id = 1, InvoiceNo = "A-1" });
                if (tenantId == 2 && id == 2)
                    return Task.FromResult<SaleDto?>(new SaleDto { Id = 2, InvoiceNo = "B-1" });
                return Task.FromResult<SaleDto?>(null);
            });
        }
    }
}
