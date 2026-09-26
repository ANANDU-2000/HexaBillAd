/*
Purpose: Background service to check and create alerts periodically
Author: AI Assistant
Date: 2025
*/
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Notifications;

namespace HexaBill.Api.Modules.Notifications
{
    public class AlertCheckBackgroundService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<AlertCheckBackgroundService> _logger;
        private readonly TimeSpan _checkInterval = TimeSpan.FromHours(6); // Check every 6 hours

        public AlertCheckBackgroundService(IServiceProvider serviceProvider, ILogger<AlertCheckBackgroundService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        internal async Task CheckAllTenantsAsync(CancellationToken stoppingToken)
        {
            List<int> tenantIds;
            using (var listScope = _serviceProvider.CreateScope())
            {
                var listContext = listScope.ServiceProvider.GetRequiredService<AppDbContext>();
                tenantIds = await listContext.Tenants
                    .Where(t => t.Status == TenantStatus.Active || t.Status == TenantStatus.Trial)
                    .Select(t => t.Id)
                    .ToListAsync(stoppingToken);
            }

            foreach (var tenantId in tenantIds)
            {
                using var tenantScope = _serviceProvider.CreateScope();
                var context = tenantScope.ServiceProvider.GetRequiredService<AppDbContext>();
                context.SetRequestTenantScope(tenantId, false);
                var alertService = tenantScope.ServiceProvider.GetRequiredService<IAlertService>();
                await alertService.CheckAndCreateAlertsAsync();
            }
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Alert check background service started");
            
            try
            {
                // Wait for database initialization to complete (allow column fixer to run first)
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);

                while (!stoppingToken.IsCancellationRequested)
                {
                    try
                    {
                        await CheckAllTenantsAsync(stoppingToken);

                        _logger.LogInformation("Alert check completed, next check in {Interval}", _checkInterval);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error during alert check");
                    }

                    await Task.Delay(_checkInterval, stoppingToken);
                }
            }
            catch (TaskCanceledException)
            {
                // This is expected when the application is shutting down
                _logger.LogInformation("Alert check background service is stopping...");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Fatal error in alert check background service");
            }

            _logger.LogInformation("Alert check background service stopped");
        }
    }
}

