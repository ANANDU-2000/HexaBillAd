using System.Security.Claims;
using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Customers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

public class CustomerLedgerControllerIsolationTests
{
    [Fact]
    public async Task GetCustomerLedger_OtherTenantsCustomer_ReturnsNotFound_WithoutCallingService()
    {
        await using var db = await SeedAsync();
        db.SetRequestTenantScope(1, false);
        var ledgerCalled = false;
        var customers = new CustomerProbeService(() => ledgerCalled = true).Object;
        var controller = Controller(db, TenantUser(1), customers);
        var action = await controller.GetCustomerLedger(2);
        Assert.IsType<NotFoundObjectResult>(action.Result);
        Assert.False(ledgerCalled);
    }

    [Fact]
    public async Task GetCustomerLedger_OwnCustomer_CallsService()
    {
        await using var db = await SeedAsync();
        db.SetRequestTenantScope(1, false);
        var ledgerCalled = false;
        var customers = new CustomerProbeService(() => ledgerCalled = true).Object;
        var controller = Controller(db, TenantUser(1), customers);
        var action = await controller.GetCustomerLedger(1);
        Assert.IsType<OkObjectResult>(action.Result);
        Assert.True(ledgerCalled);
    }

    private static CustomersController Controller(AppDbContext db, ClaimsPrincipal user, ICustomerService customers) =>
        Attach(new CustomersController(customers, new FixedClock(), null!, db, NullLogger<CustomersController>.Instance), user);

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
        db.Customers.AddRange(
            new Customer { Id = 1, TenantId = 1, OwnerId = 1, Name = "A", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
            new Customer { Id = 2, TenantId = 2, OwnerId = 2, Name = "B", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
        return db;
    }

    private sealed class FixedClock : ITimeZoneService
    {
        public DateTime GetCurrentTime() => DateTime.UtcNow;
        public DateTime GetCurrentDate() => DateTime.UtcNow.Date;
        public DateTime GetDefaultInvoiceDateUtc() => DateTime.UtcNow;
        public DateTime ConvertToGst(DateTime utcDateTime) => utcDateTime;
        public DateTime ConvertToUtc(DateTime gstDateTime) => gstDateTime;
        public TimeZoneInfo GetGstTimeZone() => TimeZoneInfo.Utc;
    }

    [Fact]
    public async Task GetOutstandingInvoices_OtherTenantsCustomer_ReturnsNotFound_WithoutCallingService()
    {
        await using var db = await SeedAsync();
        db.SetRequestTenantScope(1, false);
        var called = false;
        var customers = new CustomerProbeService(() => called = true).Object;
        var controller = Controller(db, TenantUser(1), customers);
        var action = await controller.GetOutstandingInvoices(2);
        Assert.IsType<NotFoundObjectResult>(action.Result);
        Assert.False(called);
    }

    [Fact]
    public async Task GetCustomer_OtherTenantsCustomer_ReturnsNotFound_WithoutCallingService()
    {
        await using var db = await SeedAsync();
        db.SetRequestTenantScope(1, false);
        var called = false;
        var customers = new CustomerProbeService(() => called = true).Object;
        var controller = Controller(db, TenantUser(1), customers);
        var action = await controller.GetCustomer(2);
        Assert.IsType<NotFoundObjectResult>(action.Result);
        Assert.False(called);
    }

    [Fact]
    public async Task GetCustomer_OwnCustomer_CallsService()
    {
        await using var db = await SeedAsync();
        db.SetRequestTenantScope(1, false);
        var called = false;
        var customers = new CustomerProbeService(() => called = true).Object;
        var controller = Controller(db, TenantUser(1), customers);
        var action = await controller.GetCustomer(1);
        Assert.IsType<OkObjectResult>(action.Result);
        Assert.True(called);
    }

    [Fact]
    public async Task GetCustomerItemPrices_OtherTenantsCustomer_ReturnsNotFound_WithoutCallingService()
    {
        await using var db = await SeedAsync();
        db.SetRequestTenantScope(1, false);
        var called = false;
        var customers = new CustomerProbeService(() => called = true).Object;
        var controller = Controller(db, TenantUser(1), customers);
        var action = await controller.GetCustomerItemPrices(2, null);
        Assert.IsType<NotFoundObjectResult>(action.Result);
        Assert.False(called);
    }

    [Fact]
    public async Task GetCustomerStatement_OtherTenantsCustomer_ReturnsNotFound_WithoutCallingService()
    {
        await using var db = await SeedAsync();
        db.SetRequestTenantScope(1, false);
        var called = false;
        var customers = new CustomerProbeService(() => called = true).Object;
        var controller = Controller(db, TenantUser(1), customers);
        var result = await controller.GetCustomerStatement(2, null, null);
        Assert.IsType<NotFoundObjectResult>(result);
        Assert.False(called);
    }

    private sealed class CustomerProbeService : InterfaceStub<ICustomerService>
    {
        public CustomerProbeService(Action onSensitiveCall)
        {
            When("GetCustomerLedgerAsync", _ =>
            {
                onSensitiveCall();
                return Task.FromResult(new List<CustomerLedgerEntry>());
            });
            When("GetOutstandingInvoicesAsync", _ =>
            {
                onSensitiveCall();
                return Task.FromResult(new List<OutstandingInvoiceDto>());
            });
            When("GenerateCustomerStatementAsync", _ =>
            {
                onSensitiveCall();
                return Task.FromResult(Array.Empty<byte>());
            });
            When("GetCustomerByIdAsync", _ =>
            {
                onSensitiveCall();
                return Task.FromResult<CustomerDto?>(new CustomerDto { Id = 1, Name = "A" });
            });
        }
    }

}
