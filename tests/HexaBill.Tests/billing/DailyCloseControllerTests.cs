using System.Security.Claims;
using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.DailyClose;
using HexaBill.Api.Modules.Notifications;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

/// <summary>
/// Direct controller invocation with JWT tenant claims (does not prove HTTP middleware).
/// </summary>
public class DailyCloseControllerTests
{
    [Fact]
    public async Task Preview_ReturnsExpectedCash_ForJwtTenant()
    {
        await using var db = await DatabaseAsync();
        var controller = Controller(db, tenantId: 10, role: "Owner", userId: 1);
        var businessDate = new DateTime(2026, 10, 3, 0, 0, 0, DateTimeKind.Utc);
        var action = await controller.Preview(businessDate, openingCash: 100m);
        var result = Assert.IsType<OkObjectResult>(action.Result);
        var payload = Assert.IsType<ApiResponse<DailyClosePreviewDto>>(result.Value);
        Assert.True(payload.Success);
        Assert.NotNull(payload.Data);
        Assert.Equal(1380m, payload.Data!.ExpectedCash);
        Assert.Equal(1330m, payload.Data.CollectionsCashReceived);
        Assert.Equal(50m, payload.Data.CollectionsCashPaidOut);
        Assert.Equal(1330m, payload.Data.CashReceived);
        Assert.Equal(50m, payload.Data.CashPaidOut);
    }

    [Fact]
    public async Task Preview_BranchIncludesCashRefundLinkedThroughSaleReturn()
    {
        await using var db = await DatabaseAsync();
        var noon = new DateTime(2026, 10, 3, 12, 0, 0, DateTimeKind.Utc);
        db.SaleReturns.Add(new SaleReturn
        {
            Id = 1, OwnerId = 10, TenantId = 10, SaleId = 1, BranchId = 1, ReturnNo = "RET-CASH-1",
            ReturnDate = noon, GrandTotal = 100m, Status = ReturnStatus.Approved, CreatedBy = 1, CreatedAt = noon
        });
        db.Payments.Add(new Payment
        {
            TenantId = 10, OwnerId = 10, SaleReturnId = 1, CustomerId = null,
            Amount = 100m, Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED,
            PaymentDate = noon, CreatedBy = 1, CreatedAt = noon
        });
        await db.SaveChangesAsync();

        var controller = Controller(db, tenantId: 10, role: "Owner", userId: 1);
        var businessDate = new DateTime(2026, 10, 3, 0, 0, 0, DateTimeKind.Utc);
        var action = await controller.Preview(businessDate, openingCash: 100m, branchId: 1);
        var result = Assert.IsType<OkObjectResult>(action.Result);
        var payload = Assert.IsType<ApiResponse<DailyClosePreviewDto>>(result.Value);
        Assert.True(payload.Success);
        Assert.NotNull(payload.Data);
        Assert.Equal(150m, payload.Data!.CollectionsCashPaidOut);
        Assert.Equal(1280m, payload.Data.ExpectedCash);
    }

    [Fact]
    public async Task Preview_RejectsBranchFromAnotherTenant()
    {
        await using var db = await DatabaseAsync();
        db.SetRequestTenantScope(null, isPlatformScope: true);
        db.Tenants.Add(new Tenant { Id = 20, Name = "Other", Subdomain = "other-close", FeaturesJson = "[]" });
        db.Branches.Add(new Branch { Id = 99, TenantId = 20, Name = "Foreign branch", CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
        db.SetRequestTenantScope(10, false);

        var controller = Controller(db, tenantId: 10, role: "Owner", userId: 1);
        var businessDate = new DateTime(2026, 10, 3, 0, 0, 0, DateTimeKind.Utc);
        var action = await controller.Preview(businessDate, openingCash: 0m, branchId: 99);
        var result = Assert.IsType<BadRequestObjectResult>(action.Result);
        var payload = Assert.IsType<ApiResponse<DailyClosePreviewDto>>(result.Value);
        Assert.False(payload.Success);
    }

    [Fact]
    public async Task DeleteMovement_CannotRemoveAnotherTenantsMovement()
    {
        await using var db = await DatabaseAsync();
        db.SetRequestTenantScope(null, isPlatformScope: true);
        db.Tenants.Add(new Tenant
        {
            Id = 20,
            Name = "Tenant B",
            Subdomain = "tenant-b-close",
            FeaturesJson = """["daily_close"]"""
        });
        db.CashDrawerMovements.Add(new CashDrawerMovement
        {
            Id = 50,
            TenantId = 20,
            OwnerId = 20,
            Amount = 25m,
            Kind = CashDrawerMovementKind.OwnerCapitalIn,
            MovementDate = new DateTime(2026, 10, 3, 12, 0, 0, DateTimeKind.Utc),
            CreatedByUserId = 2,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        db.SetRequestTenantScope(10, false);

        var controller = Controller(db, tenantId: 10, role: "Owner", userId: 1);
        var action = await controller.DeleteMovement(50);
        var result = Assert.IsType<BadRequestObjectResult>(action.Result);
        var payload = Assert.IsType<ApiResponse<object>>(result.Value);
        Assert.False(payload.Success);
        Assert.Contains("not found", payload.Message ?? "", StringComparison.OrdinalIgnoreCase);
        db.SetRequestTenantScope(20, false);
        Assert.NotNull(await db.CashDrawerMovements.FindAsync(50));
    }

    [Fact]
    public async Task CreateMovement_StaffRole_ReturnsForbid()
    {
        await using var db = await DatabaseAsync();
        var controller = Controller(db, tenantId: 10, role: "Staff", userId: 2);
        var request = new CreateCashDrawerMovementRequest
        {
            BusinessDate = new DateTime(2026, 10, 3, 0, 0, 0, DateTimeKind.Utc),
            Kind = "OwnerCapitalIn",
            Amount = 10m
        };
        var action = await controller.CreateMovement(request);
        Assert.IsType<ForbidResult>(action.Result);
    }

    private static DailyCloseController Controller(AppDbContext db, int tenantId, string role, int userId)
    {
        var service = new DailyCloseService(
            db,
            new TimeZoneService(),
            new AuditNoop(),
            new AlertNoop(),
            new SalesSchemaBranchesEnabled());
        var controller = new DailyCloseController(service, NullLogger<DailyCloseController>.Instance);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                [
                    new Claim("tid", tenantId.ToString()),
                    new Claim("UserId", userId.ToString()),
                    new Claim(ClaimTypes.Role, role)
                ], "fixture"))
            }
        };
        return controller;
    }

    private sealed class AuditNoop : IAuditService
    {
        public Task LogAsync(string action, string? entityType = null, int? entityId = null, object? oldValues = null, object? newValues = null, string? details = null, int? actingUserId = null)
            => Task.CompletedTask;
    }

    private sealed class AlertNoop : IAlertService
    {
        public Task CreateAlertAsync(AlertType type, string title, string? message = null, AlertSeverity severity = AlertSeverity.Info, Dictionary<string, object>? metadata = null, int? tenantId = null) => Task.CompletedTask;
        public Task<List<Alert>> GetAlertsAsync(bool unreadOnly = false, int limit = 50, int? tenantId = null) => Task.FromResult(new List<Alert>());
        public Task<Alert?> GetAlertByIdAsync(int id, int? tenantId = null) => Task.FromResult<Alert?>(null);
        public Task MarkAsReadAsync(int id, int? tenantId = null) => Task.CompletedTask;
        public Task MarkAsResolvedAsync(int id, int userId, int? tenantId = null) => Task.CompletedTask;
        public Task<int> GetUnreadCountAsync(int? tenantId = null) => Task.FromResult(0);
        public Task<int> MarkAllAsReadAsync(int? tenantId = null) => Task.FromResult(0);
        public Task<int> MarkAllAsResolvedAsync(int userId, int? tenantId = null) => Task.FromResult(0);
        public Task<int> ClearResolvedAlertsAsync(int? tenantId = null) => Task.FromResult(0);
        public Task CheckAndCreateAlertsAsync() => Task.CompletedTask;
        public Task DismissSimilarAlertsAsync(AlertType type, DateTime cutoffTime) => Task.CompletedTask;
    }

    private sealed class SalesSchemaBranchesEnabled : ISalesSchemaService
    {
        public Task<bool> SalesHasBranchIdAndRouteIdAsync() => Task.FromResult(true);
        public void ClearColumnCheckCache() { }
    }

    private static async Task<AppDbContext> DatabaseAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        db.SetRequestTenantScope(10, false);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        db.Tenants.Add(new Tenant
        {
            Id = 10,
            Name = "Close fixture",
            Subdomain = "close-fixture",
            FeaturesJson = """["daily_close"]"""
        });
        db.Users.Add(new User { Id = 1, TenantId = 10, OwnerId = 10, Name = "Owner", Email = "o@test", PasswordHash = "x", Role = UserRole.Owner, CreatedAt = DateTime.UtcNow });
        db.Users.Add(new User { Id = 2, TenantId = 10, OwnerId = 10, Name = "Staff", Email = "s@test", PasswordHash = "x", Role = UserRole.Staff, CreatedAt = DateTime.UtcNow });
        db.Customers.Add(new Customer { Id = 1, TenantId = 10, OwnerId = 10, Name = "Buyer", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
        db.Branches.Add(new Branch { Id = 1, TenantId = 10, Name = "Branch A", CreatedAt = DateTime.UtcNow });
        db.Sales.Add(new Sale { Id = 1, TenantId = 10, OwnerId = 10, CustomerId = 1, BranchId = 1, InvoiceNo = "INV-1", GrandTotal = 1331m, InvoiceDate = DateTime.UtcNow, CreatedBy = 1 });
        var noon = new DateTime(2026, 10, 3, 12, 0, 0, DateTimeKind.Utc);
        db.Payments.Add(new Payment
        {
            TenantId = 10, OwnerId = 10, CustomerId = 1, SaleId = 1,
            Amount = 1330m, Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED,
            PaymentDate = noon, CreatedBy = 1, CreatedAt = DateTime.UtcNow
        });
        db.ExpenseCategories.Add(new ExpenseCategory { Id = 1, TenantId = 10, Name = "Petrol", CreatedAt = DateTime.UtcNow });
        db.Expenses.Add(new Expense
        {
            TenantId = 10, OwnerId = 10, CategoryId = 1, BranchId = 1, Amount = 50m, TotalAmount = 50m,
            PaidFrom = ExpensePaidFrom.Cash,
            Date = noon, Status = ExpenseStatus.Approved, CreatedBy = 1, CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        return db;
    }
}
