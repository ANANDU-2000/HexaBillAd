using System.Text.Json;
using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.DailyClose;
using HexaBill.Api.Modules.Expenses;
using HexaBill.Api.Modules.Notifications;
using HexaBill.Api.Modules.Reports;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

/// <summary>Petrol cash expense via API → daily close expected cash → submit with matching count.</summary>
public class DailyClosePetrolJourneyTests
{
    [Fact]
    public async Task PetrolCashExpense_ThenClose_MatchesCountedCash()
    {
        await using var db = await DatabaseAsync();
        var businessDate = new DateTime(2026, 10, 4, 0, 0, 0, DateTimeKind.Utc);
        var expenseAt = new DateTime(2026, 10, 4, 10, 30, 0, DateTimeKind.Utc);

        var expenseService = new ExpenseService(db, new VatValidationStub().Object, NullLogger<ExpenseService>.Instance);
        await expenseService.CreateExpenseAsync(new CreateExpenseRequest
        {
            CategoryId = 1,
            Amount = 75m,
            Date = expenseAt,
            Note = "Petrol - van",
            WithVat = false,
            PaidFrom = "Cash",
            TaxType = "Petroleum"
        }, userId: 1, tenantId: 10);

        var close = new DailyCloseService(db, new TimeZoneService(), new AuditNoop(), new AlertNoop(), new SalesSchemaNoBranch());
        var preview = await close.GetPreviewAsync(10, businessDate, openingCash: 200m);
        Assert.Equal(75m, preview.CashPaidOut);
        Assert.Equal(1, preview.ExpenseCount);
        Assert.Equal(125m, preview.ExpectedCash);

        var submitted = await close.SaveCloseAsync(new SaveDailyCloseRequest
        {
            BusinessDate = businessDate,
            OpeningCash = 200m,
            CountedCash = 125m,
            SubmitClose = true,
            VarianceReason = "matched"
        }, 10, 1, canSubmitClose: true);

        Assert.Equal("Closed", submitted.Status, StringComparer.OrdinalIgnoreCase);
        Assert.Equal(0m, submitted.Variance);
        Assert.Equal(125m, submitted.CountedCash);
    }

    [Fact]
    public async Task PetrolBankExpense_DoesNotReduceDrawerExpected_OnClose()
    {
        await using var db = await DatabaseAsync();
        var businessDate = new DateTime(2026, 10, 4, 0, 0, 0, DateTimeKind.Utc);
        var expenseAt = new DateTime(2026, 10, 4, 11, 0, 0, DateTimeKind.Utc);

        var expenseService = new ExpenseService(db, new VatValidationStub().Object, NullLogger<ExpenseService>.Instance);
        await expenseService.CreateExpenseAsync(new CreateExpenseRequest
        {
            CategoryId = 1,
            Amount = 75m,
            Date = expenseAt,
            Note = "Petrol card",
            WithVat = false,
            PaidFrom = "Bank",
            TaxType = "Petroleum"
        }, userId: 1, tenantId: 10);

        var close = new DailyCloseService(db, new TimeZoneService(), new AuditNoop(), new AlertNoop(), new SalesSchemaNoBranch());
        var preview = await close.GetPreviewAsync(10, businessDate, openingCash: 200m);
        Assert.Equal(0m, preview.CashPaidOut);
        Assert.Equal(75m, preview.BankPaidOut);
        Assert.Equal(200m, preview.ExpectedCash);
    }

    [Fact]
    public async Task PetrolCashExpense_OnClosedBusinessDay_IsRejected()
    {
        await using var db = await DatabaseAsync();
        var businessDate = new DateTime(2026, 10, 4, 0, 0, 0, DateTimeKind.Utc);
        var expenseService = new ExpenseService(db, new VatValidationStub().Object, NullLogger<ExpenseService>.Instance);
        var existingExpense = await expenseService.CreateExpenseAsync(new CreateExpenseRequest
        {
            CategoryId = 1,
            Amount = 75m,
            Date = new DateTime(2026, 10, 4, 10, 30, 0, DateTimeKind.Utc),
            Note = "Petrol before close",
            WithVat = false,
            PaidFrom = "Cash",
            TaxType = "Petroleum"
        }, userId: 1, tenantId: 10);
        var close = new DailyCloseService(db, new TimeZoneService(), new AuditNoop(), new AlertNoop(), new SalesSchemaNoBranch());
        await close.SaveCloseAsync(new SaveDailyCloseRequest
        {
            BusinessDate = businessDate,
            OpeningCash = 200m,
            CountedCash = 125m,
            SubmitClose = true
        }, 10, 1, canSubmitClose: true);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => expenseService.CreateExpenseAsync(new CreateExpenseRequest
        {
            CategoryId = 1,
            Amount = 75m,
            // 20:30 UTC is 00:30 GST on the following business date.
            Date = new DateTime(2026, 10, 3, 20, 30, 0, DateTimeKind.Utc),
            Note = "Petrol after close",
            WithVat = false,
            PaidFrom = "Cash",
            TaxType = "Petroleum"
        }, userId: 1, tenantId: 10));

        Assert.Contains("business day is closed", ex.Message, StringComparison.OrdinalIgnoreCase);
        var updateError = await Assert.ThrowsAsync<InvalidOperationException>(() => expenseService.UpdateExpenseAsync(existingExpense.Id, new CreateExpenseRequest
        {
            CategoryId = 1,
            Amount = 100m,
            Date = new DateTime(2026, 10, 4, 10, 30, 0, DateTimeKind.Utc),
            Note = "Edited after close",
            WithVat = false,
            PaidFrom = "Cash",
            TaxType = "Petroleum"
        }, userId: 1, tenantId: 10));
        Assert.Contains("business day is closed", updateError.Message, StringComparison.OrdinalIgnoreCase);

        var deleteError = await Assert.ThrowsAsync<InvalidOperationException>(() => expenseService.DeleteExpenseAsync(existingExpense.Id, userId: 1, tenantId: 10));
        Assert.Contains("business day is closed", deleteError.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Single(await db.Expenses.IgnoreQueryFilters().Where(e => e.TenantId == 10).ToListAsync());

        await close.ReopenAsync(new ReopenDailyCloseRequest
        {
            BusinessDate = businessDate,
            Reason = "Correct late expense"
        }, 10, 1, canReopen: true);
        var created = await expenseService.CreateExpenseAsync(new CreateExpenseRequest
        {
            CategoryId = 1,
            Amount = 75m,
            Date = new DateTime(2026, 10, 3, 20, 30, 0, DateTimeKind.Utc),
            Note = "Petrol after reopen",
            WithVat = false,
            PaidFrom = "Cash",
            TaxType = "Petroleum"
        }, userId: 1, tenantId: 10);
        Assert.Equal("Petrol after reopen", created.Note);
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
            Name = "Journey fixture",
            Subdomain = "journey-fixture",
            FeaturesJson = JsonSerializer.Serialize(new[] { TenantFeatureFlags.DailyClose })
        });
        db.Users.Add(new User { Id = 1, TenantId = 10, OwnerId = 10, Name = "Owner", Email = "o@test", PasswordHash = "x", Role = UserRole.Owner, CreatedAt = DateTime.UtcNow });
        db.ExpenseCategories.Add(new ExpenseCategory { Id = 1, TenantId = 10, Name = "Petrol", CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
        return db;
    }

    private sealed class VatValidationStub : InterfaceStub<IVatReturnValidationService>
    {
        public VatValidationStub() =>
            When(nameof(IVatReturnValidationService.IsTransactionDateInLockedPeriodAsync), _ => Task.FromResult(false));
    }

    private sealed class AuditNoop : IAuditService
    {
        public Task LogAsync(string action, string? entityType = null, int? entityId = null, object? oldValues = null, object? newValues = null, string? details = null, int? actingUserId = null) =>
            Task.CompletedTask;
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

    private sealed class SalesSchemaNoBranch : ISalesSchemaService
    {
        public Task<bool> SalesHasBranchIdAndRouteIdAsync() => Task.FromResult(false);
        public void ClearColumnCheckCache() { }
    }
}
