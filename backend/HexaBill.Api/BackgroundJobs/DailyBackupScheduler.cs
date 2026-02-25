/*
Purpose: Background service for scheduled automatic backups (reads time/frequency/retention from Settings).
Runs in-process with the API; for scale, consider a separate worker (e.g. Render worker/cron) - see docs/BACKGROUND_JOBS.md.
PRODUCTION_MASTER_TODO #34: only one backup at a time; default schedule is off-peak (21:00).
*/
using Microsoft.Extensions.Hosting;
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Modules.SuperAdmin;
using HexaBill.Api.Data;
using HexaBill.Api.Models;

namespace HexaBill.Api.BackgroundJobs
{
    public class DailyBackupScheduler : BackgroundService
    {
        private const int BackupScheduleOwnerId = 0;
        /// <summary>Ensures only one backup runs at a time (avoid overlap if previous run is slow).</summary>
        private static readonly SemaphoreSlim s_backupLock = new(1, 1);
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<DailyBackupScheduler> _logger;

        public DailyBackupScheduler(IServiceProvider serviceProvider, ILogger<DailyBackupScheduler> logger)
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
                    (bool enabled, DateTime scheduledTime, int retentionDays) = await GetScheduleFromSettingsAsync(stoppingToken);
                    if (!enabled)
                    {
                        _logger.LogInformation("ℹ️ Automatic backup is disabled. Next check in 1 hour.");
                        await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
                        continue;
                    }

                    var now = DateTime.Now;
                    var delay = scheduledTime - now;
                    if (delay.TotalSeconds < 0)
                        delay = TimeSpan.FromSeconds(10); // run soon if we missed the window

                    _logger.LogInformation("⏰ Next backup scheduled for: {Scheduled:yyyy-MM-dd HH:mm:ss}", scheduledTime);
                    await Task.Delay(delay, stoppingToken);

                    // Only one backup at a time (skip if previous run still in progress)
                    if (!await s_backupLock.WaitAsync(TimeSpan.Zero, stoppingToken))
                    {
                        _logger.LogWarning("Previous backup still in progress; skipping this run. Next check in 1 hour.");
                        await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
                        continue;
                    }
                    try
                    {
                        using (var scope = _serviceProvider.CreateScope())
                        {
                            var backupService = scope.ServiceProvider.GetRequiredService<IComprehensiveBackupService>();
                            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                            
                            // AUDIT-8 FIX: Backup all active tenants (system-wide scheduled backup)
                            var activeTenantIds = await context.Tenants
                                .Where(t => t.Status == TenantStatus.Active || t.Status == TenantStatus.Trial)
                                .Select(t => t.Id)
                                .ToListAsync(stoppingToken);
                            
                            foreach (var tenantId in activeTenantIds)
                            {
                                try
                                {
                                    var fileName = await backupService.CreateFullBackupAsync(tenantId, exportToDesktop: false, uploadToGoogleDrive: false, sendEmail: false);
                                    _logger.LogInformation("✅ Scheduled backup completed for tenant {TenantId}: {FileName}", tenantId, fileName);
                                }
                                catch (Exception ex)
                                {
                                    _logger.LogError(ex, "❌ Failed to backup tenant {TenantId}", tenantId);
                                }
                            }
                            
                            await CleanupOldBackupsAsync(scope.ServiceProvider, retentionDays);
                        }
                    }
                    finally
                    {
                        s_backupLock.Release();
                    }

                    await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "❌ Error in backup scheduler");
                    await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
                }
            }
        }

        private async Task<(bool enabled, DateTime scheduledTime, int retentionDays)> GetScheduleFromSettingsAsync(CancellationToken ct)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var settings = await context.Settings
                    .Where(s => s.OwnerId == BackupScheduleOwnerId && (
                        s.Key == "BACKUP_SCHEDULE_ENABLED" ||
                        s.Key == "BACKUP_SCHEDULE_TIME" ||
                        s.Key == "BACKUP_SCHEDULE_FREQUENCY" ||
                        s.Key == "BACKUP_RETENTION_DAYS"))
                    .ToDictionaryAsync(s => s.Key, s => s.Value ?? "", ct);

                var enabled = settings.GetValueOrDefault("BACKUP_SCHEDULE_ENABLED", "false").Equals("true", StringComparison.OrdinalIgnoreCase);
                var timeStr = settings.GetValueOrDefault("BACKUP_SCHEDULE_TIME", "21:00");
                var frequency = settings.GetValueOrDefault("BACKUP_SCHEDULE_FREQUENCY", "daily");
                var retentionDays = int.TryParse(settings.GetValueOrDefault("BACKUP_RETENTION_DAYS", "30"), out var rd) ? rd : 30;

                var now = DateTime.Now;
                if (!TimeSpan.TryParse(timeStr, out var timeOfDay))
                    timeOfDay = new TimeSpan(21, 0, 0);

                var scheduledTime = new DateTime(now.Year, now.Month, now.Day, timeOfDay.Hours, timeOfDay.Minutes, 0);
                if (scheduledTime <= now)
                    scheduledTime = scheduledTime.AddDays(1);
                if (frequency == "weekly")
                {
                    // Next occurrence on Sunday at scheduled time
                    var daysUntilSunday = ((int)DayOfWeek.Sunday - (int)now.DayOfWeek + 7) % 7;
                    if (daysUntilSunday == 0 && scheduledTime <= now) daysUntilSunday = 7;
                    scheduledTime = scheduledTime.AddDays(daysUntilSunday);
                }

                return (enabled, scheduledTime, retentionDays);
            }
            catch
            {
                var now = DateTime.Now;
                var fallback = new DateTime(now.Year, now.Month, now.Day, 21, 0, 0);
                if (fallback <= now) fallback = fallback.AddDays(1);
                return (false, fallback, 30);
            }
        }

        private async Task CleanupOldBackupsAsync(IServiceProvider serviceProvider, int retentionDays)
        {
            try
            {
                var backupService = serviceProvider.GetRequiredService<IComprehensiveBackupService>();
                var backups = await backupService.GetBackupListAsync();
                var cutoffDate = DateTime.Now.AddDays(-retentionDays);

                foreach (var backup in backups)
                {
                    var created = backup.CreatedDate;
                    if (created < cutoffDate)
                    {
                        await backupService.DeleteBackupAsync(backup.FileName);
                        _logger.LogInformation("🗑️ Deleted old backup: {FileName}", backup.FileName);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error cleaning up old backups");
            }
        }
    }
}

