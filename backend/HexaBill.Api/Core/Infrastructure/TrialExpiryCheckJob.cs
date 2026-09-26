using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Npgsql;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Subscription;
using HexaBill.Api.Modules.Automation;

namespace HexaBill.Api.Core.Infrastructure
{
    public class TrialExpiryCheckJob : BackgroundService
    {
        private readonly IServiceProvider _sp;
        private readonly ILogger<TrialExpiryCheckJob> _logger;

        public TrialExpiryCheckJob(IServiceProvider sp, ILogger<TrialExpiryCheckJob> logger)
        {
            _sp = sp;
            _logger = logger;
        }

        internal async Task CheckAllTenantsAsync(CancellationToken stoppingToken)
        {
            List<int> tenantIds;
            using (var listScope = _sp.CreateScope())
            {
                var listContext = listScope.ServiceProvider.GetRequiredService<AppDbContext>();
                tenantIds = await listContext.Tenants
                    .Where(t => t.Status == TenantStatus.Active || t.Status == TenantStatus.Trial)
                    .Select(t => t.Id)
                    .ToListAsync(stoppingToken);
            }

            var now = DateTime.UtcNow;
            var in3Days = now.AddDays(3);
            foreach (var tid in tenantIds)
            {
                using var tenantScope = _sp.CreateScope();
                var tenantDb = tenantScope.ServiceProvider.GetRequiredService<AppDbContext>();
                tenantDb.SetRequestTenantScope(tid, false);
                var subscriptionService = tenantScope.ServiceProvider.GetRequiredService<ISubscriptionService>();
                var automation = tenantScope.ServiceProvider.GetRequiredService<IAutomationProvider>();

                var expiringTrials = await tenantDb.Subscriptions
                    .Where(s => s.Status == SubscriptionStatus.Trial && s.TrialEndDate.HasValue &&
                               s.TrialEndDate.Value >= now && s.TrialEndDate.Value <= in3Days)
                    .Select(s => s.TrialEndDate)
                    .ToListAsync(stoppingToken);
                foreach (var trialEndDate in expiringTrials)
                    await automation.NotifyAsync(AutomationEvents.TrialEnding, tid, new { trialEndDate }, stoppingToken);

                await subscriptionService.CheckSubscriptionStatusAsync(tid);

                var overdueCount = await tenantDb.Sales
                    .Where(s => !s.IsDeleted && s.DueDate.HasValue && s.DueDate < now &&
                               (s.PaymentStatus == SalePaymentStatus.Pending || s.PaymentStatus == SalePaymentStatus.Partial))
                    .CountAsync(stoppingToken);
                if (overdueCount > 0)
                    await automation.NotifyAsync(AutomationEvents.PaymentOverdue, tid, new { overdueCount }, stoppingToken);
            }
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken);
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _sp.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                    // If Subscriptions table does not exist yet (migrations not fully applied), skip this run
                    if (!await db.Database.CanConnectAsync(stoppingToken))
                        continue;
                    try
                    {
                        _ = await db.Subscriptions.OrderBy(s => s.Id).FirstOrDefaultAsync(stoppingToken);
                    }
                    catch (PostgresException pe) when (pe.SqlState == "42P01")
                    {
                        _logger.LogDebug("Subscriptions table not found; skipping trial check until migrations are applied.");
                        await Task.Delay(TimeSpan.FromMinutes(10), stoppingToken);
                        continue;
                    }

                    await CheckAllTenantsAsync(stoppingToken);
                }
                catch (OperationCanceledException) { break; }
                catch (Exception ex) { _logger.LogError(ex, "TrialExpiryCheckJob error"); }

                await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
            }
        }
    }
}
