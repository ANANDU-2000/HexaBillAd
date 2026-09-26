using System.Reflection;
using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Automation;
using HexaBill.Api.Modules.Customers;
using HexaBill.Api.Modules.Notifications;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.Subscription;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

public class BackgroundJobScopingTests
{
    [Fact]
    public async Task Jobs_ScopeEachTenantSeparately()
    {
        var log = new ScopeLog();
        var services = new ServiceCollection();
        var database = "jobs-" + Guid.NewGuid();
        services.AddDbContext<AppDbContext>(o => o.UseInMemoryDatabase(database));
        services.AddSingleton(log);
        services.AddScoped<IBalanceService>(sp => ScopeSpy.Create<IBalanceService>(sp, log));
        services.AddScoped<IAlertService>(sp => ScopeSpy.Create<IAlertService>(sp, log));
        services.AddScoped<ISubscriptionService>(sp => ScopeSpy.Create<ISubscriptionService>(sp, log));
        services.AddScoped<IAutomationProvider>(sp => ScopeSpy.Create<IAutomationProvider>(sp, log));
        services.AddScoped<IRecurringInvoiceService>(sp => ScopeSpy.Create<IRecurringInvoiceService>(sp, log));
        var provider = services.BuildServiceProvider();

        using (var seed = provider.CreateScope())
        {
            var db = seed.ServiceProvider.GetRequiredService<AppDbContext>();
            db.SetRequestTenantScope(null, true);
            db.Tenants.AddRange(
                new Tenant { Id = 1, Name = "A", Subdomain = "tenanta", Country = "AE", Currency = "AED", Status = TenantStatus.Active, CreatedAt = DateTime.UtcNow },
                new Tenant { Id = 2, Name = "B", Subdomain = "tenantb", Country = "AE", Currency = "AED", Status = TenantStatus.Active, CreatedAt = DateTime.UtcNow });
            db.Customers.AddRange(
                new Customer { Id = 11, TenantId = 1, OwnerId = 1, Name = "A" },
                new Customer { Id = 22, TenantId = 2, OwnerId = 2, Name = "B" });
            await db.SaveChangesAsync();
        }

        await new BalanceReconciliationJob(provider, NullLogger<BalanceReconciliationJob>.Instance).ReconcileAllTenantsAsync(CancellationToken.None);
        await new AlertCheckBackgroundService(provider, NullLogger<AlertCheckBackgroundService>.Instance).CheckAllTenantsAsync(CancellationToken.None);
        await new TrialExpiryCheckJob(provider, NullLogger<TrialExpiryCheckJob>.Instance).CheckAllTenantsAsync(CancellationToken.None);
        await new DailyRecurringInvoiceJob(provider, NullLogger<DailyRecurringInvoiceJob>.Instance).ProcessAllTenantsAsync(CancellationToken.None);

        AssertPairs("RecalculateCustomerBalanceAsync");
        AssertScopes("CheckAndCreateAlertsAsync");
        AssertScopes("CheckSubscriptionStatusAsync");
        AssertScopes("ProcessDueRecurringInvoicesAsync");

        void AssertScopes(string method)
        {
            var seen = log.Calls.Where(c => c.Method == method).Select(c => c.TenantId).ToList();
            Assert.Equal(new int?[] { 1, 2 }, seen.OrderBy(id => id).ToArray());
            Assert.DoesNotContain(seen, id => id is null or 0);
        }

        void AssertPairs(string method)
        {
            var seen = log.Calls.Where(c => c.Method == method).Select(c => (c.TenantId, c.CustomerId)).ToList();
            Assert.Equal(2, seen.Count);
            Assert.Contains(seen, pair => pair.TenantId == 1 && pair.CustomerId == 11);
            Assert.Contains(seen, pair => pair.TenantId == 2 && pair.CustomerId == 22);
            Assert.DoesNotContain(seen, pair => pair.TenantId == 1 && pair.CustomerId == 22);
            Assert.DoesNotContain(seen, pair => pair.TenantId == 2 && pair.CustomerId == 11);
        }
    }

    [Fact]
    public async Task BalanceJob_MissingSetting_StaysDisabled()
    {
        var services = new ServiceCollection();
        services.AddDbContext<AppDbContext>(o => o.UseInMemoryDatabase("bal-" + Guid.NewGuid()));
        var provider = services.BuildServiceProvider();
        var (enabled, _) = await new BalanceReconciliationJob(provider, NullLogger<BalanceReconciliationJob>.Instance)
            .GetScheduleFromSettingsAsync(CancellationToken.None);
        Assert.False(enabled);
    }

    [Fact]
    public async Task Startup_LogsEachDisabledSchedule()
    {
        var services = new ServiceCollection();
        services.AddDbContext<AppDbContext>(o => o.UseInMemoryDatabase("gate-" + Guid.NewGuid()));
        var logger = new WarningLog();
        var check = new DisabledScheduledJobStartupCheck(services.BuildServiceProvider(), logger);
        await check.StartAsync(CancellationToken.None);
        Assert.Contains(logger.Messages, m => m.Contains("BalanceReconciliationJob") && m.Contains("BALANCE_RECONCILIATION_ENABLED") && m.Contains("missing"));
        Assert.Contains(logger.Messages, m => m.Contains("DailyBackupScheduler") && m.Contains("BACKUP_SCHEDULE_ENABLED") && m.Contains("missing"));
    }

    private sealed class ScopeLog
    {
        public List<(string Method, int? TenantId, int? CustomerId)> Calls { get; } = new();
    }

    private class ScopeSpy : DispatchProxy
    {
        public AppDbContext? Db { get; set; }
        public ScopeLog? Log { get; set; }

        public static T Create<T>(IServiceProvider sp, ScopeLog log) where T : class
        {
            var proxy = DispatchProxy.Create<T, ScopeSpy>();
            var spy = (ScopeSpy)(object)proxy;
            spy.Db = sp.GetRequiredService<AppDbContext>();
            spy.Log = log;
            return proxy;
        }

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            var name = targetMethod?.Name ?? "";
            if (name is "RecalculateCustomerBalanceAsync" or "CheckAndCreateAlertsAsync" or "CheckSubscriptionStatusAsync" or "ProcessDueRecurringInvoicesAsync")
            {
                int? customerId = args?.FirstOrDefault() is int id ? id : null;
                Log!.Calls.Add((name, Db!.RequestTenantId, customerId));
            }

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

    private sealed class WarningLog : ILogger<DisabledScheduledJobStartupCheck>
    {
        public List<string> Messages { get; } = new();
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (logLevel == LogLevel.Warning)
                Messages.Add(formatter(state, exception));
        }
    }
}
