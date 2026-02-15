/*
Purpose: Background service to check and create alerts periodically
Author: AI Assistant
Date: 2025
*/
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
                        using (var scope = _serviceProvider.CreateScope())
                        {
                            var alertService = scope.ServiceProvider.GetRequiredService<IAlertService>();
                            await alertService.CheckAndCreateAlertsAsync();
                        }

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

