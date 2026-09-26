using System.Reflection;
using System.Security.Claims;
using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Customers;
using HexaBill.Api.Modules.Products;
using HexaBill.Api.Modules.Reports;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

public class PlatformScopeReadTests
{
    [Fact]
    public async Task PlatformToken_CustomerList_IsForbidden()
    {
        await using var db = await SeedAsync();
        var result = await Customers(db, PlatformUser(), new TenantCustomerService().Object).GetCustomers();
        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task PlatformToken_CustomerById_IsForbidden()
    {
        await using var db = await SeedAsync();
        var result = await Customers(db, PlatformUser(), new TenantCustomerService().Object).GetCustomer(1);
        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task PlatformToken_ProductList_IsForbidden()
    {
        await using var db = await SeedAsync();
        var result = await Products(db, PlatformUser(), new TenantProductService().Object).GetProducts();
        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task PlatformToken_Dashboard_IsForbidden()
    {
        await using var db = await SeedAsync();
        var result = await Dashboard(db, PlatformUser()).GetDashboardData();
        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task PlatformToken_ReportSummary_IsForbidden()
    {
        await using var db = await SeedAsync();
        var result = await Reports(db, PlatformUser(), new TenantReportService().Object).GetSummaryReport();
        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task PlatformToken_SaleById_IsForbidden()
    {
        await using var db = await SeedAsync();
        var result = await Sales(db, PlatformUser(), new TenantSaleService().Object).GetSale(1);
        Assert.IsType<ForbidResult>(result.Result);
    }

    [Fact]
    public async Task PlatformToken_ValidationCustomerActions_DoNotReturnData()
    {
        await using var db = await SeedAsync();
        var controller = Validation(db, PlatformUser(), new TenantBalanceService().Object);
        Assert.IsType<NotFoundObjectResult>((await controller.ValidateCustomerBalance(1)).Result);
        Assert.IsType<NotFoundObjectResult>((await controller.FixCustomerBalance(1)).Result);
        Assert.IsType<NotFoundObjectResult>((await controller.RecalculateCustomerBalance(1)).Result);
    }

    [Fact]
    public async Task SupportToken_ReadsOwnTenant_AndHidesTheOtherTenant()
    {
        await using var db = await SeedAsync();
        db.SupportSessions.Add(new SupportSession
        {
            Id = 7,
            TenantId = 1,
            PlatformUserId = 1,
            Reason = "check",
            StartedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(1)
        });
        await db.SaveChangesAsync();
        db.SetRequestTenantScope(1, false);

        var user = SupportUser(1);
        var customers = Customers(db, user, new TenantCustomerService().Object);
        var ownList = await customers.GetCustomers();
        var ownPage = Assert.IsType<OkObjectResult>(ownList.Result).Value as ApiResponse<PagedResponse<CustomerDto>>;
        Assert.Equal(new[] { 1 }, ownPage!.Data!.Items.Select(c => c.Id));
        Assert.IsType<NotFoundObjectResult>((await customers.GetCustomer(2)).Result);

        var products = Products(db, user, new TenantProductService().Object);
        var productPage = Assert.IsType<OkObjectResult>((await products.GetProducts()).Result).Value as ApiResponse<PagedResponse<ProductDto>>;
        Assert.Equal(new[] { 1 }, productPage!.Data!.Items.Select(p => p.Id));

        var dashboard = Assert.IsType<OkObjectResult>(await Dashboard(db, user).GetDashboardData()).Value as DashboardResponse;
        Assert.Equal(1, dashboard!.PendingBillsCount);
        Assert.DoesNotContain(dashboard.LowStockAlerts, p => p.Id == 2);

        var summary = Assert.IsType<OkObjectResult>((await Reports(db, user, new TenantReportService().Object).GetSummaryReport()).Result).Value as ApiResponse<SummaryReportDto>;
        Assert.Equal(1, summary!.Data!.SalesToday);

        var sales = Sales(db, user, new TenantSaleService().Object);
        var ownSale = Assert.IsType<OkObjectResult>((await sales.GetSale(1)).Result).Value as ApiResponse<SaleDto>;
        Assert.Equal(1, ownSale!.Data!.Id);
        Assert.IsType<NotFoundObjectResult>((await sales.GetSale(2)).Result);

        var validation = Validation(db, user, new TenantBalanceService().Object);
        Assert.IsType<OkObjectResult>((await validation.ValidateCustomerBalance(1)).Result);
        Assert.IsType<NotFoundObjectResult>((await validation.ValidateCustomerBalance(2)).Result);
        Assert.IsType<OkObjectResult>((await validation.FixCustomerBalance(1)).Result);
        Assert.IsType<NotFoundObjectResult>((await validation.FixCustomerBalance(2)).Result);
        Assert.IsType<OkObjectResult>((await validation.RecalculateCustomerBalance(1)).Result);
        Assert.IsType<NotFoundObjectResult>((await validation.RecalculateCustomerBalance(2)).Result);
    }

    private static CustomersController Customers(AppDbContext db, ClaimsPrincipal user, ICustomerService customers) =>
        Attach(new CustomersController(customers, new FixedClock(), null!, db, NullLogger<CustomersController>.Instance), user);

    private static ProductsController Products(AppDbContext db, ClaimsPrincipal user, IProductService products) =>
        Attach(new ProductsController(products, null!, new ServiceCollection().BuildServiceProvider(), new EmptySettings(), null!, null!, NullLogger<ProductsController>.Instance), user);

    private static DashboardController Dashboard(AppDbContext db, ClaimsPrincipal user) =>
        Attach(new DashboardController(db, new FixedClock(), null!, null!, null!, NullLogger<DashboardController>.Instance), user);

    private static ReportsController Reports(AppDbContext db, ClaimsPrincipal user, IReportService reports) =>
        Attach(new ReportsController(reports, null!, null!, db, new FixedClock(), null!, null!, NullLogger<ReportsController>.Instance), user);

    private static SalesController Sales(AppDbContext db, ClaimsPrincipal user, ISaleService sales) =>
        Attach(new SalesController(sales, null!, db, null!, NullLogger<SalesController>.Instance), user);

    private static ValidationController Validation(AppDbContext db, ClaimsPrincipal user, IBalanceService balances) =>
        Attach(new ValidationController(balances, db, NullLogger<ValidationController>.Instance), user);

    private static T Attach<T>(T controller, ClaimsPrincipal user) where T : ControllerBase
    {
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = user } };
        return controller;
    }

    private static ClaimsPrincipal PlatformUser() =>
        new(new ClaimsIdentity(new[]
        {
            new Claim("plat", "true"),
            new Claim(ClaimTypes.Role, "SystemAdmin"),
            new Claim(ClaimTypes.NameIdentifier, "1"),
        }, "Test"));

    private static ClaimsPrincipal SupportUser(int tenantId) =>
        new(new ClaimsIdentity(new[]
        {
            new Claim("plat", "false"),
            new Claim("tid", tenantId.ToString()),
            new Claim("tenant_id", tenantId.ToString()),
            new Claim("support_session", "7"),
            new Claim(ClaimTypes.Role, "Owner"),
            new Claim(ClaimTypes.NameIdentifier, "1"),
        }, "Test"));

    private static async Task<AppDbContext> SeedAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase("plat-" + Guid.NewGuid()).Options);
        db.SetRequestTenantScope(null, true);
        db.Tenants.AddRange(
            new Tenant { Id = 1, Name = "A", Subdomain = "tenanta", Country = "AE", Currency = "AED", Status = TenantStatus.Active, CreatedAt = DateTime.UtcNow },
            new Tenant { Id = 2, Name = "B", Subdomain = "tenantb", Country = "AE", Currency = "AED", Status = TenantStatus.Active, CreatedAt = DateTime.UtcNow });
        db.Customers.AddRange(
            new Customer { Id = 1, TenantId = 1, OwnerId = 1, Name = "A" },
            new Customer { Id = 2, TenantId = 2, OwnerId = 2, Name = "B" });
        db.Products.AddRange(
            new Product { Id = 1, TenantId = 1, OwnerId = 1, NameEn = "A", Sku = "A", UnitType = "PCS", StockQty = 1, CostPrice = 1, SellPrice = 2 },
            new Product { Id = 2, TenantId = 2, OwnerId = 2, NameEn = "B", Sku = "B", UnitType = "PCS", StockQty = 1, CostPrice = 1, SellPrice = 2 });
        db.Sales.AddRange(
            new Sale { Id = 1, TenantId = 1, OwnerId = 1, InvoiceNo = "A1", InvoiceDate = DateTime.UtcNow, GrandTotal = 10, TotalAmount = 10, PaymentStatus = SalePaymentStatus.Pending, CreatedBy = 1, CreatedAt = DateTime.UtcNow },
            new Sale { Id = 2, TenantId = 2, OwnerId = 2, InvoiceNo = "B1", InvoiceDate = DateTime.UtcNow, GrandTotal = 99, TotalAmount = 99, PaymentStatus = SalePaymentStatus.Pending, CreatedBy = 2, CreatedAt = DateTime.UtcNow });
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
    }

    private sealed class TenantCustomerService : InterfaceStub<ICustomerService>
    {
        public TenantCustomerService()
        {
            When("GetCustomersAsync", args =>
            {
                var tenantId = (int)args[0]!;
                var items = tenantId == 1 ? new List<CustomerDto> { new() { Id = 1, Name = "A" } } : new List<CustomerDto>();
                return Task.FromResult(new PagedResponse<CustomerDto> { Items = items, TotalCount = items.Count });
            });
            When("GetCustomerByIdAsync", args =>
            {
                var id = (int)args[0]!;
                var tenantId = (int)args[1]!;
                CustomerDto? dto = id == 1 && tenantId == 1 ? new CustomerDto { Id = 1, Name = "A" } : null;
                return Task.FromResult(dto);
            });
        }
    }

    private sealed class TenantProductService : InterfaceStub<IProductService>
    {
        public TenantProductService()
        {
            When("GetProductsAsync", args =>
            {
                var tenantId = (int)args[0]!;
                var items = tenantId == 1 ? new List<ProductDto> { new() { Id = 1, NameEn = "A", Sku = "A" } } : new List<ProductDto>();
                return Task.FromResult(new PagedResponse<ProductDto> { Items = items, TotalCount = items.Count });
            });
        }
    }

    private sealed class TenantSaleService : InterfaceStub<ISaleService>
    {
        public TenantSaleService()
        {
            When("GetSaleByIdAsync", args =>
            {
                var id = (int)args[0]!;
                var tenantId = (int)args[1]!;
                SaleDto? dto = id == tenantId ? new SaleDto { Id = id, InvoiceNo = "A1" } : null;
                return Task.FromResult(dto);
            });
            When("CreateSaleAsync", _ => Task.FromResult(new SaleDto { Id = 42, InvoiceNo = "0001" }));
            When("CreateSaleWithOverrideAsync", _ => Task.FromResult(new SaleDto { Id = 42, InvoiceNo = "0001" }));
        }
    }

    private sealed class TenantReportService : InterfaceStub<IReportService>
    {
        public TenantReportService()
        {
            When("GetSummaryReportAsync", args => Task.FromResult(new SummaryReportDto { SalesToday = (int)args[0]! }));
        }
    }

    private sealed class TenantBalanceService : InterfaceStub<IBalanceService>
    {
        public TenantBalanceService()
        {
            When("ValidateCustomerBalanceAsync", _ => Task.FromResult(new BalanceValidationResult()));
            When("FixBalanceMismatchAsync", _ => Task.FromResult(true));
            When("RecalculateCustomerBalanceAsync", _ => Task.CompletedTask);
        }
    }
}

public class InterfaceStub<T> where T : class
{
    private readonly Dictionary<string, Func<object?[], object?>> _handlers = new();
    public T Object { get; }

    protected InterfaceStub()
    {
        Object = DispatchProxy.Create<T, StubProxy>();
        ((StubProxy)(object)Object).Handlers = _handlers;
    }

    protected void When(string method, Func<object?[], object?> handler) => _handlers[method] = handler;

    public static implicit operator T(InterfaceStub<T> stub) => stub.Object;

    public class StubProxy : DispatchProxy
    {
        public Dictionary<string, Func<object?[], object?>> Handlers { get; set; } = new();

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            if (targetMethod != null && Handlers.TryGetValue(targetMethod.Name, out var handler))
                return handler(args ?? Array.Empty<object?>());

            var type = targetMethod?.ReturnType ?? typeof(void);
            if (type == typeof(Task)) return Task.CompletedTask;
            if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Task<>))
            {
                var inner = type.GetGenericArguments()[0];
                var value = inner.IsValueType ? Activator.CreateInstance(inner) : null;
                return typeof(Task).GetMethod(nameof(Task.FromResult))!.MakeGenericMethod(inner).Invoke(null, new[] { value });
            }
            return null;
        }
    }
}
