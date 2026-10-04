using System.Security.Claims;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Payments;
using HexaBill.Api.Modules.Sales;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

public class PaymentControllerIsolationTests
{
    [Fact]
    public async Task CleanupEqualAmountPayments_RefusesMutationAndPreservesLegitimateReceipts()
    {
        await using var db = await SeedAsync();
        db.SetRequestTenantScope(1, false);
        db.Payments.Add(new Payment
        {
            Id = 3, TenantId = 1, OwnerId = 1, CustomerId = 1, SaleId = 1, Amount = 50,
            Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED, CreatedBy = 1,
            PaymentDate = DateTime.UtcNow.AddDays(1), CreatedAt = DateTime.UtcNow.AddDays(1)
        });
        var sale = await db.Sales.SingleAsync(s => s.Id == 1);
        sale.PaidAmount = 100;
        sale.PaymentStatus = SalePaymentStatus.Paid;
        await db.SaveChangesAsync();
        var payments = new PaymentService(db, NullLogger<PaymentService>.Instance, null!, null!, null!);
        var controller = Controller(db, TenantUser(1, "Owner"), payments, ReceiptProbeService.NeverCalled);
        var services = new Microsoft.Extensions.DependencyInjection.ServiceCollection();
        Microsoft.Extensions.DependencyInjection.ServiceCollectionServiceExtensions.AddSingleton(services, db);
        Microsoft.Extensions.DependencyInjection.ServiceCollectionServiceExtensions.AddSingleton<HexaBill.Api.Modules.Customers.ICustomerService>(services, new HexaBill.Api.Modules.Customers.CustomerService(db));
        using var provider = Microsoft.Extensions.DependencyInjection.ServiceCollectionContainerBuilderExtensions.BuildServiceProvider(services);
        controller.HttpContext.RequestServices = provider;

        var action = await controller.CleanupDuplicatePayments(1);

        Assert.IsType<ConflictObjectResult>(action.Result);
        db.ChangeTracker.Clear();
        Assert.Equal(2, await db.Payments.CountAsync(p => p.SaleId == 1));
        Assert.Equal(100, (await db.Sales.SingleAsync(s => s.Id == 1)).PaidAmount);
    }

    [Fact]
    public async Task ForceDeleteCustomer_WithPostedHistory_RefusesAndPreservesRows()
    {
        await using var db = await SeedAsync();
        db.SetRequestTenantScope(1, false);
        var customers = new HexaBill.Api.Modules.Customers.CustomerService(db);

        var result = await customers.ForceDeleteCustomerWithAllDataAsync(1, 1, 1);

        Assert.False(result.Success);
        Assert.Contains("financial history", result.Message, StringComparison.OrdinalIgnoreCase);
        db.ChangeTracker.Clear();
        Assert.True(await db.Customers.AnyAsync(c => c.Id == 1));
        Assert.True(await db.Sales.AnyAsync(s => s.Id == 1));
        Assert.True(await db.Payments.AnyAsync(p => p.Id == 1));
    }

    [Fact]
    public async Task GetPayment_OtherTenantsPayment_ReturnsNotFound()
    {
        await using var db = await SeedAsync();
        db.SetRequestTenantScope(1, false);
        var payments = new PaymentService(db, NullLogger<PaymentService>.Instance, null!, null!, null!);
        var controller = Controller(db, TenantUser(1, "Owner"), payments, ReceiptProbeService.NeverCalled);
        var action = await controller.GetPayment(2);
        Assert.IsType<NotFoundObjectResult>(action.Result);
    }

    [Fact]
    public async Task GetPayment_OwnPayment_ReturnsOk()
    {
        await using var db = await SeedAsync();
        db.SetRequestTenantScope(1, false);
        var payments = new PaymentService(db, NullLogger<PaymentService>.Instance, null!, null!, null!);
        var controller = Controller(db, TenantUser(1, "Owner"), payments, ReceiptProbeService.NeverCalled);
        var action = await controller.GetPayment(1);
        Assert.IsType<OkObjectResult>(action.Result);
    }

    [Fact]
    public async Task GetInvoiceReceiptPayments_OtherTenantsSale_ReturnsBadRequest()
    {
        await using var db = await SeedAsync();
        db.SetRequestTenantScope(1, false);
        var payments = new PaymentService(db, NullLogger<PaymentService>.Instance, null!, null!, null!);
        var receipt = new PaymentReceiptService(db, NullLogger<PaymentReceiptService>.Instance);
        var controller = Controller(db, TenantUser(1, "Owner"), payments, receipt);
        var action = await controller.GetInvoiceReceiptPayments(2);
        var result = Assert.IsType<BadRequestObjectResult>(action.Result);
        var body = Assert.IsType<ApiResponse<List<int>>>(result.Value);
        Assert.False(body.Success);
        Assert.Contains("workspace", body.Message ?? "", StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetCustomerReceipts_OtherTenantsCustomer_ReturnsNotFound()
    {
        await using var db = await SeedAsync();
        db.SetRequestTenantScope(1, false);
        var payments = new PaymentService(db, NullLogger<PaymentService>.Instance, null!, null!, null!);
        var receipt = new PaymentReceiptService(db, NullLogger<PaymentReceiptService>.Instance);
        var controller = Controller(db, TenantUser(1, "Owner"), payments, receipt);
        var action = await controller.GetCustomerReceipts(2);
        Assert.IsType<NotFoundObjectResult>(action.Result);
    }

    [Fact]
    public async Task GeneratePaymentReceipt_OtherTenantsPayment_ReturnsBadRequestWithoutReceiptRow()
    {
        await using var db = await SeedAsync();
        db.SetRequestTenantScope(1, false);
        db.Settings.Add(new Setting { TenantId = 1, OwnerId = 1, Key = "COMPANY_NAME_EN", Value = "A Co" });
        await db.SaveChangesAsync();
        var payments = new PaymentService(db, NullLogger<PaymentService>.Instance, null!, null!, null!);
        var receipt = new PaymentReceiptService(db, NullLogger<PaymentReceiptService>.Instance);
        var controller = Controller(db, TenantUser(1, "Owner"), payments, receipt);
        var action = await controller.GeneratePaymentReceipt(2);
        Assert.IsType<BadRequestObjectResult>(action.Result);
        Assert.Empty(db.PaymentReceipts);
    }

    private static PaymentsController Controller(
        AppDbContext db,
        ClaimsPrincipal user,
        IPaymentService payments,
        IPaymentReceiptService receipt) =>
        Attach(new PaymentsController(payments, receipt, NullLogger<PaymentsController>.Instance, null!, db), user);

    private static T Attach<T>(T controller, ClaimsPrincipal user) where T : ControllerBase
    {
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = user } };
        return controller;
    }

    private static ClaimsPrincipal TenantUser(int tenantId, string role) =>
        new(new ClaimsIdentity(new[]
        {
            new Claim("tid", tenantId.ToString()),
            new Claim(ClaimTypes.Role, role),
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
        db.Customers.AddRange(
            new Customer { Id = 1, TenantId = 1, OwnerId = 1, Name = "A", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
            new Customer { Id = 2, TenantId = 2, OwnerId = 2, Name = "B", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
        db.Sales.AddRange(
            new Sale { Id = 1, TenantId = 1, OwnerId = 1, CustomerId = 1, InvoiceNo = "A-1", GrandTotal = 100, InvoiceDate = DateTime.UtcNow, CreatedBy = 1 },
            new Sale { Id = 2, TenantId = 2, OwnerId = 2, CustomerId = 2, InvoiceNo = "B-1", GrandTotal = 200, InvoiceDate = DateTime.UtcNow, CreatedBy = 2 });
        db.Payments.AddRange(
            new Payment
            {
                Id = 1, TenantId = 1, OwnerId = 1, CustomerId = 1, SaleId = 1, Amount = 50,
                Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED, CreatedBy = 1,
                PaymentDate = DateTime.UtcNow, CreatedAt = DateTime.UtcNow
            },
            new Payment
            {
                Id = 2, TenantId = 2, OwnerId = 2, CustomerId = 2, SaleId = 2, Amount = 80,
                Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED, CreatedBy = 2,
                PaymentDate = DateTime.UtcNow, CreatedAt = DateTime.UtcNow
            });
        await db.SaveChangesAsync();
        return db;
    }

    private sealed class ReceiptProbeService : InterfaceStub<IPaymentReceiptService>
    {
        public static readonly IPaymentReceiptService NeverCalled = new ReceiptProbeService(() => throw new InvalidOperationException("Receipt service should not be called.")).Object;

        public static IPaymentReceiptService OnGenerate(Action onGenerate) => new ReceiptProbeService(onGenerate).Object;

        public ReceiptProbeService(Action onGenerate)
        {
            When(nameof(IPaymentReceiptService.GenerateReceiptAsync), _ =>
            {
                onGenerate();
                return Task.FromResult(new PaymentReceiptDetailDto { ReceiptNumber = "X", AmountReceived = 1 });
            });
        }
    }
}
