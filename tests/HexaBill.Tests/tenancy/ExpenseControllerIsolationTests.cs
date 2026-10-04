using System.Security.Claims;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Expenses;
using HexaBill.Api.Modules.Reports;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

public class ExpenseControllerIsolationTests
{
    [Fact]
    public async Task GetExpense_OtherTenantsExpense_ReturnsNotFound()
    {
        await using var db = await SeedAsync();
        db.SetRequestTenantScope(1, false);
        var service = new ExpenseService(db, new VatValidationStub().Object, NullLogger<ExpenseService>.Instance);
        var controller = Controller(db, TenantUser(1), service);
        var action = await controller.GetExpense(2);
        Assert.IsType<NotFoundObjectResult>(action.Result);
    }

    [Fact]
    public async Task GetExpense_OwnExpense_ReturnsOk()
    {
        await using var db = await SeedAsync();
        db.SetRequestTenantScope(1, false);
        var service = new ExpenseService(db, new VatValidationStub().Object, NullLogger<ExpenseService>.Instance);
        var controller = Controller(db, TenantUser(1), service);
        var action = await controller.GetExpense(1);
        Assert.IsType<OkObjectResult>(action.Result);
    }

    private static ExpensesController Controller(AppDbContext db, ClaimsPrincipal user, IExpenseService expenses) =>
        Attach(new ExpensesController(expenses, db, null!, null!, NullLogger<ExpensesController>.Instance), user);

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
        var now = DateTime.UtcNow;
        db.Tenants.AddRange(
            new Tenant { Id = 1, Name = "A", Subdomain = "a", FeaturesJson = "[]" },
            new Tenant { Id = 2, Name = "B", Subdomain = "b", FeaturesJson = "[]" });
        db.Users.AddRange(
            new User { Id = 1, TenantId = 1, OwnerId = 1, Email = "a@test.local", Name = "A", PasswordHash = "x", Role = UserRole.Owner, CreatedAt = now },
            new User { Id = 2, TenantId = 2, OwnerId = 2, Email = "b@test.local", Name = "B", PasswordHash = "x", Role = UserRole.Owner, CreatedAt = now });
        db.ExpenseCategories.AddRange(
            new ExpenseCategory { Id = 1, TenantId = 1, Name = "Cat A", CreatedAt = now },
            new ExpenseCategory { Id = 2, TenantId = 2, Name = "Cat B", CreatedAt = now });
        db.Expenses.AddRange(
            new Expense { Id = 1, TenantId = 1, OwnerId = 1, CategoryId = 1, Amount = 10, Date = now, CreatedBy = 1, CreatedAt = now, Status = ExpenseStatus.Approved },
            new Expense { Id = 2, TenantId = 2, OwnerId = 2, CategoryId = 2, Amount = 20, Date = now, CreatedBy = 2, CreatedAt = now, Status = ExpenseStatus.Approved });
        await db.SaveChangesAsync();
        return db;
    }

    private sealed class VatValidationStub : InterfaceStub<IVatReturnValidationService>
    {
        public VatValidationStub() => When(nameof(IVatReturnValidationService.IsTransactionDateInLockedPeriodAsync), _ => Task.FromResult(false));
    }
}
