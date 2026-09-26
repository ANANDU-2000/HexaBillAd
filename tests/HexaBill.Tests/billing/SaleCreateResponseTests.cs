using System.Reflection;
using System.Security.Claims;
using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Sales;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

public class SaleCreateResponseTests
{
    [Fact]
    public async Task OwnerToken_CreateSale_ReturnsCreatedSaleId()
    {
        var controller = Controller();
        var result = await controller.CreateSale(new CreateSaleRequest());
        var body = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(201, body.StatusCode);
        var response = Assert.IsType<ApiResponse<SaleDto>>(body.Value);
        Assert.True(response.Success);
        Assert.Equal(42, response.Data!.Id);
    }

    [Fact]
    public async Task OwnerToken_CreateSaleWithOverride_ReturnsCreatedSaleId()
    {
        var controller = Controller();
        var result = await controller.CreateSaleWithOverride(new CreateSaleOverrideRequest
        {
            Reason = "test",
            SaleRequest = new CreateSaleRequest()
        });
        var body = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(201, body.StatusCode);
        var response = Assert.IsType<ApiResponse<SaleDto>>(body.Value);
        Assert.True(response.Success);
        Assert.Equal(42, response.Data!.Id);
    }

    private static SalesController Controller()
    {
        var sales = new SaleBodyService();
        var controller = new SalesController(sales.Object, null!, null!, null!, NullLogger<SalesController>.Instance);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = Owner() }
        };
        return controller;
    }

    private static ClaimsPrincipal Owner() =>
        new(new ClaimsIdentity(new[]
        {
            new Claim("plat", "false"),
            new Claim("tid", "1"),
            new Claim(ClaimTypes.Role, "Owner"),
            new Claim(ClaimTypes.NameIdentifier, "10"),
        }, "Test"));

    private sealed class SaleBodyService : InterfaceStub<ISaleService>
    {
        public SaleBodyService()
        {
            When("CreateSaleAsync", _ => Task.FromResult(new SaleDto { Id = 42, InvoiceNo = "0001" }));
            When("CreateSaleWithOverrideAsync", _ => Task.FromResult(new SaleDto { Id = 42, InvoiceNo = "0001" }));
        }
    }
}
