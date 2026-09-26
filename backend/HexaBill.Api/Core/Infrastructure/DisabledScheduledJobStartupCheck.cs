using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;

namespace HexaBill.Api.Core.Infrastructure;

/// <summary>
/// Logs one warning per registered job whose enable setting is missing or not true.
/// Does not change the job schedule and does not stop the host.
/// </summary>
public sealed class DisabledScheduledJobStartupCheck : IHostedService
{
    private static readonly (string Job, string Setting)[] Gates =
    {
        ("BalanceReconciliationJob", "BALANCE_RECONCILIATION_ENABLED"),
        ("DailyBackupScheduler", "BACKUP_SCHEDULE_ENABLED"),
    };

    private readonly IServiceProvider _services;
    private readonly ILogger<DisabledScheduledJobStartupCheck> _logger;

    public DisabledScheduledJobStartupCheck(IServiceProvider services, ILogger<DisabledScheduledJobStartupCheck> logger)
    {
        _services = services;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var keys = Gates.Select(g => g.Setting).ToArray();
            var rows = await db.Settings
                .Where(s => s.OwnerId == 0 && keys.Contains(s.Key))
                .ToListAsync(cancellationToken);

            foreach (var gate in Gates)
            {
                var value = rows.FirstOrDefault(s => s.Key == gate.Setting)?.Value;
                if (string.Equals(value, "true", StringComparison.OrdinalIgnoreCase))
                    continue;

                _logger.LogWarning(
                    "Scheduled job {Job} is disabled: {Setting} is {Value}",
                    gate.Job,
                    gate.Setting,
                    string.IsNullOrWhiteSpace(value) ? "missing" : value);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not read scheduled job enable settings");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
