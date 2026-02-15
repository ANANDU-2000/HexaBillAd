using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Npgsql;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Subscription;
using HexaBill.Api.Modules.Automation;

namespace HexaBill.Api.BackgroundJobs
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
                        _ = await db.Subscriptions.FirstOrDefaultAsync(stoppingToken);
                    }
                    catch (PostgresException pe) when (pe.SqlState == "42P01")
                    {
                        _logger.LogDebug("Subscriptions table not found; skipping trial check until migrations are applied.");
                        await Task.Delay(TimeSpan.FromMinutes(10), stoppingToken);
                        continue;
                    }

                    var subscriptionService = scope.ServiceProvider.GetRequiredService<ISubscriptionService>();
                    var automation = scope.ServiceProvider.GetRequiredService<IAutomationProvider>();

                    var now = DateTime.UtcNow;
                    var in3Days = now.AddDays(3);

                    var expiringTrials = await db.Subscriptions
                        .Where(s => s.Status == SubscriptionStatus.Trial && s.TrialEndDate.HasValue &&
                                   s.TrialEndDate.Value >= now && s.TrialEndDate.Value <= in3Days)
                        .Select(s => new { s.TenantId, s.TrialEndDate })
                        .ToListAsync(stoppingToken);
                    foreach (var t in expiringTrials)
                        await automation.NotifyAsync(AutomationEvents.TrialEnding, t.TenantId, new { trialEndDate = t.TrialEndDate }, stoppingToken);

                    var tenantIds = await db.Subscriptions.Select(s => s.TenantId).Distinct().ToListAsync(stoppingToken);
                    foreach (var tid in tenantIds)
                        await subscriptionService.CheckSubscriptionStatusAsync(tid);

                    var overdue = await db.Sales
                        .Where(s => s.TenantId != null && !s.IsDeleted && s.DueDate.HasValue && s.DueDate < now &&
                                   (s.PaymentStatus == SalePaymentStatus.Pending || s.PaymentStatus == SalePaymentStatus.Partial))
                        .GroupBy(s => s.TenantId!.Value)
                        .Select(g => new { TenantId = g.Key, Count = g.Count() })
                        .ToListAsync(stoppingToken);
                    foreach (var o in overdue)
                        await automation.NotifyAsync(AutomationEvents.PaymentOverdue, o.TenantId, new { overdueCount = o.Count }, stoppingToken);
                }
                catch (OperationCanceledException) { break; }
                catch (Exception ex) { _logger.LogError(ex, "TrialExpiryCheckJob error"); }

                await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
            }
        }
    }
}
