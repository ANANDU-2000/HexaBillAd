/*
Purpose: Background service for daily automatic backups
Author: AI Assistant
Date: 2025
*/
using Microsoft.Extensions.Hosting;
using HexaBill.Api.Modules.SuperAdmin;

namespace HexaBill.Api.BackgroundJobs
{
    public class DailyBackupScheduler : BackgroundService
    {
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
                    var now = DateTime.Now;
                    // Schedule for 9:00 PM (21:00) local time
                    var scheduledTime = new DateTime(now.Year, now.Month, now.Day, 21, 0, 0);

                    if (now > scheduledTime)
                    {
                        scheduledTime = scheduledTime.AddDays(1);
                    }

                    var delay = scheduledTime - now;

                    _logger.LogInformation($"⏰ Next daily backup scheduled for: {scheduledTime:yyyy-MM-dd HH:mm:ss}");

                    await Task.Delay(delay, stoppingToken);

                    // Run backup
                    using (var scope = _serviceProvider.CreateScope())
                    {
                        var backupService = scope.ServiceProvider.GetRequiredService<IBackupService>();
                        var backupPath = await backupService.CreateBackupZipAsync();
                        _logger.LogInformation("✅ Daily backup completed: {Path}", backupPath);
                        
                        // Cleanup old backups (keep last 30 days)
                        await CleanupOldBackupsAsync(scope.ServiceProvider);
                    }

                    // Wait a bit before calculating next schedule
                    await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "❌ Error in daily backup scheduler");
                    // Wait 1 hour before retrying
                    await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
                }
            }
        }

        private async Task CleanupOldBackupsAsync(IServiceProvider serviceProvider)
        {
            try
            {
                var backupService = serviceProvider.GetRequiredService<IBackupService>();
                var backups = await backupService.GetBackupFilesAsync();
                var cutoffDate = DateTime.Now.AddDays(-30);

                foreach (var backup in backups)
                {
                    // Extract date from filename: backup_20250112_153045.zip
                    if (backup.StartsWith("backup_") && backup.EndsWith(".zip"))
                    {
                        var datePart = backup.Substring(7, 8); // "20250112"
                        if (DateTime.TryParseExact(datePart, "yyyyMMdd", null, System.Globalization.DateTimeStyles.None, out var backupDate))
                        {
                            if (backupDate < cutoffDate)
                            {
                                await backupService.DeleteBackupAsync(backup);
                                _logger.LogInformation("🗑️ Deleted old backup: {Backup}", backup);
                            }
                        }
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

