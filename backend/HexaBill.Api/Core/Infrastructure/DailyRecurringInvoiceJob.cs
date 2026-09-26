/*
Purpose: Daily job to process recurring invoices due for today
Author: HexaBill
Date: 2025
*/
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using HexaBill.Api.Data;
using HexaBill.Api.Models;

namespace HexaBill.Api.Core.Infrastructure
{
    public class DailyRecurringInvoiceJob : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<DailyRecurringInvoiceJob> _logger;

        public DailyRecurringInvoiceJob(IServiceProvider serviceProvider, ILogger<DailyRecurringInvoiceJob> logger)
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
                    var nextRun = new DateTime(now.Year, now.Month, now.Day, 0, 5, 0);
                    if (nextRun <= now) nextRun = nextRun.AddDays(1);
                    var delay = nextRun - now;
                    _logger.LogInformation("Recurring invoice job next run: {NextRun}", nextRun);
                    await Task.Delay(delay, stoppingToken);

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
                        var service = tenantScope.ServiceProvider.GetRequiredService<IRecurringInvoiceService>();
                        await service.ProcessDueRecurringInvoicesAsync(stoppingToken);
                    }
                }
                catch (OperationCanceledException) { break; }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in recurring invoice job");
                    await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
                }
            }
        }
    }
}
