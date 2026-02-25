/*
Purpose: Nightly background job to reconcile all customer balances.
Reduces drift from missed updates; runs during off-peak hours.
Schedule: Configurable via Settings (BALANCE_RECONCILIATION_ENABLED, BALANCE_RECONCILIATION_TIME).
*/
using Microsoft.Extensions.Hosting;
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Modules.Customers;

namespace HexaBill.Api.BackgroundJobs
{
    public class BalanceReconciliationJob : BackgroundService
    {
        private const int SystemOwnerId = 0;
        private const int BatchSize = 100;
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<BalanceReconciliationJob> _logger;

        public BalanceReconciliationJob(IServiceProvider serviceProvider, ILogger<BalanceReconciliationJob> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var (enabled, scheduledTime) = await GetScheduleFromSettingsAsync(stoppingToken);
                    if (!enabled)
                    {
                        await Task.Delay(TimeSpan.FromHours(6), stoppingToken);
                        continue;
                    }

                    var now = DateTime.Now;
                    var delay = scheduledTime - now;
                    if (delay.TotalSeconds < 0)
                        delay = TimeSpan.FromSeconds(30);

                    _logger.LogInformation(
                        "Balance reconciliation next run: {Scheduled:yyyy-MM-dd HH:mm:ss}",
                        scheduledTime);
                    await Task.Delay(delay, stoppingToken);

                    await ReconcileAllBalancesAsync(stoppingToken);

                    await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in balance reconciliation job");
                    await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
                }
            }
        }

        private async Task<(bool enabled, DateTime scheduledTime)> GetScheduleFromSettingsAsync(CancellationToken ct)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var settings = await context.Settings
                    .Where(s => s.OwnerId == SystemOwnerId && (
                        s.Key == "BALANCE_RECONCILIATION_ENABLED" ||
                        s.Key == "BALANCE_RECONCILIATION_TIME"))
                    .ToDictionaryAsync(s => s.Key, s => s.Value ?? "", ct);

                var enabled = settings.GetValueOrDefault("BALANCE_RECONCILIATION_ENABLED", "false")
                    .Equals("true", StringComparison.OrdinalIgnoreCase);
                var timeStr = settings.GetValueOrDefault("BALANCE_RECONCILIATION_TIME", "02:00");

                var now = DateTime.Now;
                if (!TimeSpan.TryParse(timeStr, out var timeOfDay))
                    timeOfDay = new TimeSpan(2, 0, 0);

                var scheduledTime = new DateTime(now.Year, now.Month, now.Day, timeOfDay.Hours, timeOfDay.Minutes, 0);
                if (scheduledTime <= now)
                    scheduledTime = scheduledTime.AddDays(1);

                return (enabled, scheduledTime);
            }
            catch
            {
                var now = DateTime.Now;
                var fallback = new DateTime(now.Year, now.Month, now.Day, 2, 0, 0);
                if (fallback <= now) fallback = fallback.AddDays(1);
                return (false, fallback);
            }
        }

        private async Task ReconcileAllBalancesAsync(CancellationToken stoppingToken)
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var balanceService = scope.ServiceProvider.GetRequiredService<IBalanceService>();

            var customerIds = await context.Customers
                .Where(c => c.TenantId != null)
                .Select(c => c.Id)
                .ToListAsync(stoppingToken);

            var total = customerIds.Count;
            var processed = 0;
            var errors = 0;

            foreach (var batch in customerIds.Chunk(BatchSize))
            {
                foreach (var customerId in batch)
                {
                    if (stoppingToken.IsCancellationRequested) return;

                    try
                    {
                        await balanceService.RecalculateCustomerBalanceAsync(customerId);
                        processed++;
                    }
                    catch (Exception ex)
                    {
                        errors++;
                        _logger.LogWarning(ex, "Failed to reconcile balance for customer {CustomerId}", customerId);
                    }
                }

                _logger.LogInformation(
                    "Balance reconciliation progress: {Processed}/{Total} customers, {Errors} errors",
                    processed, total, errors);
            }

            _logger.LogInformation(
                "Balance reconciliation complete: {Processed} processed, {Errors} errors",
                processed, errors);
        }
    }
}
