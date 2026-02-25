/*
Purpose: Alert service for admin notifications
Author: AI Assistant
Date: 2025
*/
using Microsoft.EntityFrameworkCore;
using Npgsql;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using HexaBill.Api.Modules.SuperAdmin;

namespace HexaBill.Api.Modules.Notifications
{
    public interface IAlertService
    {
        /// <summary>Create alert. Use tenantId for tenant-specific alerts (invoice, stock, etc.); null/0 for system-wide (backup).</summary>
        Task CreateAlertAsync(AlertType type, string title, string? message = null, AlertSeverity severity = AlertSeverity.Info, Dictionary<string, object>? metadata = null, int? tenantId = null);
        Task<List<Alert>> GetAlertsAsync(bool unreadOnly = false, int limit = 50, int? tenantId = null);
        Task<Alert?> GetAlertByIdAsync(int id, int? tenantId = null); // tenantId required for tenant isolation
        Task MarkAsReadAsync(int id, int? tenantId = null);
        Task MarkAsResolvedAsync(int id, int userId, int? tenantId = null);
        Task<int> GetUnreadCountAsync(int? tenantId = null);
        Task<int> MarkAllAsReadAsync(int? tenantId = null); // tenant-scoped: only current tenant's alerts
        Task<int> MarkAllAsResolvedAsync(int userId, int? tenantId = null);
        Task<int> ClearResolvedAlertsAsync(int? tenantId = null); // tenant-scoped: only current tenant's resolved alerts
        Task CheckAndCreateAlertsAsync(); // Background job to check for conditions
        Task DismissSimilarAlertsAsync(AlertType type, DateTime cutoffTime); // Dismiss duplicate alerts
    }

    public class AlertService : IAlertService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<AlertService> _logger;
        private readonly IServiceProvider _serviceProvider;
        private readonly ISettingsService _settingsService;

        public AlertService(AppDbContext context, ILogger<AlertService> logger, IServiceProvider serviceProvider, ISettingsService settingsService)
        {
            _context = context;
            _logger = logger;
            _serviceProvider = serviceProvider;
            _settingsService = settingsService;
        }

        public async Task CreateAlertAsync(AlertType type, string title, string? message = null, AlertSeverity severity = AlertSeverity.Info, Dictionary<string, object>? metadata = null, int? tenantId = null)
        {
            try
            {
                // CRITICAL: Prevent duplicate alerts - check for similar alerts in last 5 minutes (same tenant)
                var targetTenantId = tenantId ?? 0;
                var cutoffTime = DateTime.UtcNow.AddMinutes(-5);
                var similarAlert = await _context.Alerts
                    .Where(a => a.Type == type.ToString() && 
                               a.Title == title && 
                               (a.TenantId ?? 0) == targetTenantId &&
                               a.CreatedAt >= cutoffTime)
                    .OrderByDescending(a => a.CreatedAt)
                    .FirstOrDefaultAsync();

                if (similarAlert != null)
                {
                    _logger.LogDebug("Similar alert exists (Type: {Type}, Title: {Title}), skipping duplicate", type, title);
                    return;
                }

                var alert = new Alert
                {
                    // CRITICAL: tenantId=0 only for system-wide (backup). Tenant-specific alerts MUST have TenantId set.
                    TenantId = targetTenantId,
                    Type = type.ToString(),
                    Title = title,
                    Message = message,
                    Severity = severity.ToString(),
                    CreatedAt = DateTime.UtcNow,
                    Metadata = metadata != null ? JsonSerializer.Serialize(metadata) : null
                };

                _context.Alerts.Add(alert);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Alert created: {Type} - {Title}", type, title);
            }
            catch (PostgresException pgEx) when (pgEx.Message.Contains("does not exist"))
            {
                _logger.LogWarning("Alerts table does not exist yet. Cannot create alert: {Type} - {Title}", type, title);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create alert: {Type} - {Title}", type, title);
            }
        }

        public async Task<List<Alert>> GetAlertsAsync(bool unreadOnly = false, int limit = 50, int? tenantId = null)
        {
            try
            {
                var query = _context.Alerts
                    .Include(a => a.ResolvedByUser)
                    .AsQueryable();

                if (tenantId.HasValue)
                    query = query.Where(a => a.TenantId == tenantId.Value || a.TenantId == null || a.TenantId == 0);

                query = query.OrderByDescending(a => a.CreatedAt);

                if (unreadOnly)
                    query = query.Where(a => !a.IsRead).OrderByDescending(a => a.CreatedAt);

                return await query.Take(limit).ToListAsync();
            }
            catch (PostgresException pgEx) when (pgEx.Message.Contains("does not exist"))
            {
                _logger.LogWarning("Alerts table does not exist yet. Returning empty list.");
                return new List<Alert>();
            }
        }

        public async Task<Alert?> GetAlertByIdAsync(int id, int? tenantId = null)
        {
            var query = _context.Alerts.Include(a => a.ResolvedByUser).Where(a => a.Id == id);
            // Tenant isolation: only return if alert belongs to tenant (or system-wide TenantId 0)
            if (tenantId.HasValue && tenantId.Value > 0)
                query = query.Where(a => a.TenantId == tenantId.Value || a.TenantId == null || a.TenantId == 0);
            return await query.FirstOrDefaultAsync();
        }

        public async Task MarkAsReadAsync(int id, int? tenantId = null)
        {
            var alert = await _context.Alerts.FindAsync(id);
            if (alert == null || alert.IsRead) return;
            if (tenantId.HasValue && tenantId.Value > 0 && (alert.TenantId ?? 0) > 0 && alert.TenantId != tenantId.Value)
                return; // Tenant isolation: cannot mark another tenant's alert
            alert.IsRead = true;
            alert.ReadAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        public async Task MarkAsResolvedAsync(int id, int userId, int? tenantId = null)
        {
            var alert = await _context.Alerts.FindAsync(id);
            if (alert == null || alert.IsResolved) return;
            if (tenantId.HasValue && tenantId.Value > 0 && (alert.TenantId ?? 0) > 0 && alert.TenantId != tenantId.Value)
                return; // Tenant isolation: cannot resolve another tenant's alert
            alert.IsResolved = true;
            alert.ResolvedAt = DateTime.UtcNow;
            alert.ResolvedBy = userId;
            await _context.SaveChangesAsync();
        }

        public async Task<int> GetUnreadCountAsync(int? tenantId = null)
        {
            try
            {
                var query = _context.Alerts.Where(a => !a.IsRead);
                if (tenantId.HasValue)
                    query = query.Where(a => a.TenantId == tenantId.Value || a.TenantId == null || a.TenantId == 0);
                return await query.CountAsync();
            }
            catch (PostgresException pgEx) when (pgEx.Message.Contains("does not exist"))
            {
                _logger.LogWarning("Alerts table does not exist yet. Returning 0.");
                return 0;
            }
        }

        public async Task<int> MarkAllAsReadAsync(int? tenantId = null)
        {
            try
            {
                var query = _context.Alerts.Where(a => !a.IsRead);
                if (tenantId.HasValue && tenantId.Value > 0)
                    query = query.Where(a => a.TenantId == tenantId.Value || a.TenantId == null || a.TenantId == 0);
                var unreadAlerts = await query.ToListAsync();
                var count = unreadAlerts.Count;
                foreach (var alert in unreadAlerts)
                {
                    alert.IsRead = true;
                    alert.ReadAt = DateTime.UtcNow;
                }
                if (count > 0)
                    await _context.SaveChangesAsync();
                return count;
            }
            catch (PostgresException pgEx) when (pgEx.Message.Contains("does not exist"))
            {
                _logger.LogWarning("Alerts table does not exist yet.");
                return 0;
            }
        }

        public async Task<int> MarkAllAsResolvedAsync(int userId, int? tenantId = null)
        {
            try
            {
                var query = _context.Alerts.Where(a => !a.IsResolved);
                if (tenantId.HasValue)
                    query = query.Where(a => a.TenantId == tenantId.Value || a.TenantId == null || a.TenantId == 0);
                var unresolvedAlerts = await query.ToListAsync();
                foreach (var alert in unresolvedAlerts)
                {
                    alert.IsResolved = true;
                    alert.ResolvedAt = DateTime.UtcNow;
                    alert.ResolvedBy = userId;
                }
                if (unresolvedAlerts.Count > 0)
                    await _context.SaveChangesAsync();
                return unresolvedAlerts.Count;
            }
            catch (PostgresException pgEx) when (pgEx.Message.Contains("does not exist"))
            {
                _logger.LogWarning("Alerts table does not exist yet.");
                return 0;
            }
        }

        public async Task<int> ClearResolvedAlertsAsync(int? tenantId = null)
        {
            try
            {
                var query = _context.Alerts.Where(a => a.IsResolved);
                if (tenantId.HasValue && tenantId.Value > 0)
                    query = query.Where(a => a.TenantId == tenantId.Value || a.TenantId == null || a.TenantId == 0);
                var resolvedAlerts = await query.ToListAsync();
                var count = resolvedAlerts.Count;
                _context.Alerts.RemoveRange(resolvedAlerts);
                if (count > 0)
                    await _context.SaveChangesAsync();
                return count;
            }
            catch (PostgresException pgEx) when (pgEx.Message.Contains("does not exist"))
            {
                _logger.LogWarning("Alerts table does not exist yet.");
                return 0;
            }
        }

        public async Task CheckAndCreateAlertsAsync()
        {
            try
            {
                // Check for backup failures (check last 24 hours)
                await CheckBackupAlertsAsync();

                // Check for DB mismatches
                await CheckDBMismatchAlertsAsync();

                // Check for low stock
                await CheckLowStockAlertsAsync();

                // Check for product expiry (expired or expiring within 30 days)
                await CheckProductExpiryAlertsAsync();

                // Check for overdue invoices
                await CheckOverdueInvoiceAlertsAsync();

                // Check for duplicate invoices (recent)
                await CheckDuplicateInvoiceAlertsAsync();

                _logger.LogInformation("Alert checks completed");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during alert checks");
            }
        }

        private async Task CheckBackupAlertsAsync()
        {
            try
            {
                // Check if backup was successful in last 24 hours
                var lastBackupAlert = await _context.Alerts
                    .Where(a => a.Type == AlertType.BackupSuccess.ToString() || a.Type == AlertType.BackupFailed.ToString())
                    .OrderByDescending(a => a.CreatedAt)
                    .FirstOrDefaultAsync();

                if (lastBackupAlert == null || lastBackupAlert.CreatedAt < DateTime.UtcNow.AddHours(-24))
                {
                    // No backup alert in last 24 hours - check if backup exists
                    var backupDir = Path.Combine(Directory.GetCurrentDirectory(), "backups");
                    if (Directory.Exists(backupDir))
                    {
                        var recentBackups = Directory.GetFiles(backupDir, "*.zip")
                            .Where(f => File.GetCreationTime(f) > DateTime.UtcNow.AddHours(-24))
                            .ToList();

                        if (recentBackups.Any())
                        {
                            await CreateAlertAsync(AlertType.BackupSuccess, "Backup completed successfully", 
                                $"Last backup: {recentBackups.OrderByDescending(f => File.GetCreationTime(f)).First()}", 
                                AlertSeverity.Info);
                        }
                        else
                        {
                            await CreateAlertAsync(AlertType.BackupFailed, "No backup found in last 24 hours", 
                                "Please check backup schedule", AlertSeverity.Warning);
                        }
                    }
                }
            }
            catch (PostgresException pgEx) when (pgEx.SqlState == "42P01" || pgEx.SqlState == "42703" || pgEx.Message.Contains("does not exist"))
            {
                _logger.LogDebug("Alerts table or column missing ({SqlState}). Skipping backup alert check.", pgEx.SqlState);
            }
            catch (Exception ex)
            {
                var pg = ex.InnerException as PostgresException ?? ex as PostgresException;
                if (pg?.SqlState == "42P01" || pg?.SqlState == "42703")
                {
                    _logger.LogDebug("Alerts schema issue. Skipping backup alert check.");
                    return;
                }
                _logger.LogWarning(ex, "Error checking backup alerts");
            }
        }

        private async Task CheckDBMismatchAlertsAsync()
        {
            // Check product stock mismatches - PER-TENANT: group by TenantId for isolation
            var products = await _context.Products.ToListAsync();
            var mismatchesByTenant = new Dictionary<int, List<int>>();

            foreach (var product in products)
            {
                var computedStock = await _context.InventoryTransactions
                    .Where(t => t.ProductId == product.Id)
                    .SumAsync(t => (decimal?)(t.ChangeQty * (t.TransactionType == TransactionType.Purchase || t.TransactionType == TransactionType.PurchaseReturn ? 1 : -1))) ?? 0;

                if (Math.Abs(product.StockQty - computedStock) > 0.01m)
                {
                    var tid = product.TenantId ?? 0;
                    if (!mismatchesByTenant.ContainsKey(tid)) mismatchesByTenant[tid] = new List<int>();
                    mismatchesByTenant[tid].Add(product.Id);
                }
            }

            foreach (var kv in mismatchesByTenant)
            {
                var tid = kv.Key;
                var mismatches = kv.Value;
                var lastMismatchAlert = await _context.Alerts
                    .Where(a => a.Type == AlertType.DBMismatch.ToString() && !a.IsResolved && (a.TenantId ?? 0) == tid)
                    .OrderByDescending(a => a.CreatedAt)
                    .FirstOrDefaultAsync();

                if (lastMismatchAlert == null || lastMismatchAlert.CreatedAt < DateTime.UtcNow.AddHours(-6))
                {
                    await CreateAlertAsync(AlertType.DBMismatch,
                        $"Stock mismatch detected for {mismatches.Count} products",
                        $"Product IDs: {string.Join(", ", mismatches.Take(10))}",
                        AlertSeverity.Warning,
                        new Dictionary<string, object> { { "ProductIds", mismatches } },
                        tid > 0 ? tid : null);
                }
            }
        }

        private async Task CheckLowStockAlertsAsync()
        {
            // #55: Per-product ReorderLevel or global fallback per tenant
            var tenantIds = await _context.Products.Where(p => p.IsActive && p.TenantId.HasValue).Select(p => p.TenantId!.Value).Distinct().ToListAsync();
            foreach (var tenantId in tenantIds)
            {
                var settings = await _settingsService.GetOwnerSettingsAsync(tenantId);
                int? globalThreshold = null;
                if (settings.TryGetValue("LOW_STOCK_GLOBAL_THRESHOLD", out var v) && !string.IsNullOrWhiteSpace(v) && int.TryParse(v.Trim(), out int gt) && gt > 0)
                    globalThreshold = gt;

                var query = _context.Products.Where(p => p.TenantId == tenantId && p.IsActive);
                if (globalThreshold.HasValue && globalThreshold.Value > 0)
                    query = query.Where(p => (p.ReorderLevel > 0 && p.StockQty <= p.ReorderLevel) || (p.ReorderLevel == 0 && p.StockQty <= globalThreshold.Value));
                else
                    query = query.Where(p => p.ReorderLevel > 0 && p.StockQty <= p.ReorderLevel);
                var lowStockProducts = await query.ToListAsync();

                if (lowStockProducts.Any())
                {
                    var lastLowStockAlert = await _context.Alerts
                        .Where(a => a.Type == AlertType.LowStock.ToString() && 
                                   !a.IsResolved && 
                                   a.TenantId == tenantId)
                        .OrderByDescending(a => a.CreatedAt)
                        .FirstOrDefaultAsync();

                    // Create alert if none exists or last alert is older than 12 hours
                    if (lastLowStockAlert == null || lastLowStockAlert.CreatedAt < DateTime.UtcNow.AddHours(-12))
                    {
                        var productList = string.Join(", ", lowStockProducts.Take(5).Select(p => $"{p.NameEn} ({p.StockQty})"));
                        var alertMetadata = new Dictionary<string, object> { 
                            { "ProductIds", lowStockProducts.Select(p => p.Id).ToList() },
                            { "Count", lowStockProducts.Count },
                            { "TenantId", tenantId }
                        };

                        await CreateAlertAsync(AlertType.LowStock,
                            $"{lowStockProducts.Count} products below reorder level",
                            productList,
                            AlertSeverity.Warning,
                            alertMetadata,
                            tenantId);

                        // Trigger automation notification (email/WhatsApp)
                        try
                        {
                            var automationProvider = _serviceProvider.GetService<HexaBill.Api.Modules.Automation.IAutomationProvider>();
                            if (automationProvider != null)
                            {
                                var automationPayload = new
                                {
                                    TenantId = tenantId,
                                    ProductCount = lowStockProducts.Count,
                                    Products = lowStockProducts.Select(p => new
                                    {
                                        Id = p.Id,
                                        Name = p.NameEn,
                                        SKU = p.Sku,
                                        StockQty = p.StockQty,
                                        ReorderLevel = p.ReorderLevel
                                    }).ToList(),
                                    Message = $"You have {lowStockProducts.Count} products below reorder level. Please restock soon."
                                };

                                await automationProvider.NotifyAsync(
                                    HexaBill.Api.Modules.Automation.AutomationEvents.LowStock,
                                    tenantId,
                                    automationPayload
                                );
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Failed to send low stock automation notification for tenant {TenantId}", tenantId);
                        }
                    }
                }
            }
        }

        private async Task CheckProductExpiryAlertsAsync()
        {
            try
            {
                var today = DateTime.UtcNow.Date;
                var in30Days = today.AddDays(30);
                var expiringOrExpired = await _context.Products
                    .Where(p => p.ExpiryDate.HasValue && p.ExpiryDate.Value.Date <= in30Days)
                    .Select(p => new { p.Id, p.TenantId, p.NameEn, p.Sku, p.ExpiryDate })
                    .ToListAsync();

                if (expiringOrExpired.Count == 0) return;

                var byTenant = expiringOrExpired.GroupBy(p => p.TenantId);
                foreach (var grp in byTenant)
                {
                    var tenantId = grp.Key;
                    var list = grp.ToList();
                    var expired = list.Count(p => p.ExpiryDate!.Value.Date < today);
                    var expiringSoon = list.Count(p => p.ExpiryDate!.Value.Date >= today);
                    var lastAlert = await _context.Alerts
                        .Where(a => a.Type == AlertType.ProductExpiring.ToString() && a.TenantId == tenantId && !a.IsResolved)
                        .OrderByDescending(a => a.CreatedAt)
                        .FirstOrDefaultAsync();

                    if (lastAlert == null || lastAlert.CreatedAt < DateTime.UtcNow.AddHours(-12))
                    {
                        var title = expired > 0 && expiringSoon > 0
                            ? $"{expired} products expired, {expiringSoon} expiring within 30 days"
                            : expired > 0
                                ? $"{expired} products expired"
                                : $"{expiringSoon} products expiring within 30 days";
                        var productNames = string.Join(", ", list.Take(5).Select(p => $"{p.NameEn ?? p.Sku} ({p.ExpiryDate:yyyy-MM-dd})"));
                        await CreateAlertForTenantAsync(tenantId ?? 0, AlertType.ProductExpiring, title, productNames, AlertSeverity.Warning,
                            new Dictionary<string, object> { { "ProductIds", list.Select(p => p.Id).ToList() }, { "Count", list.Count } });
                    }
                }
            }
            catch (PostgresException pgEx) when (pgEx.Message.Contains("does not exist"))
            {
                _logger.LogDebug("Products or Alerts table missing. Skipping product expiry check.");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error checking product expiry alerts");
            }
        }

        private async Task CreateAlertForTenantAsync(int tenantId, AlertType type, string title, string? message = null, AlertSeverity severity = AlertSeverity.Info, Dictionary<string, object>? metadata = null)
        {
            try
            {
                var cutoffTime = DateTime.UtcNow.AddMinutes(-5);
                var similarAlert = await _context.Alerts
                    .Where(a => a.TenantId == tenantId && a.Type == type.ToString() && a.Title == title && a.CreatedAt >= cutoffTime)
                    .OrderByDescending(a => a.CreatedAt)
                    .FirstOrDefaultAsync();

                if (similarAlert != null) return;

                var alert = new Alert
                {
                    TenantId = tenantId,
                    Type = type.ToString(),
                    Title = title,
                    Message = message,
                    Severity = severity.ToString(),
                    CreatedAt = DateTime.UtcNow,
                    Metadata = metadata != null ? JsonSerializer.Serialize(metadata) : null
                };
                _context.Alerts.Add(alert);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to create tenant alert: {Type}", type);
            }
        }

        private async Task CheckOverdueInvoiceAlertsAsync()
        {
            try
            {
                var overdueDays = 30; // Configurable
                var overdueDate = DateTime.UtcNow.AddDays(-overdueDays);

                var overdueInvoices = await _context.Sales
                    .Where(s => s.PaymentStatus != SalePaymentStatus.Paid &&
                               s.CreatedAt < overdueDate &&
                               (s.GrandTotal - s.PaidAmount) > 0)
                    .ToListAsync();

                foreach (var g in overdueInvoices.GroupBy(s => s.TenantId ?? 0))
                {
                    var tenantId = g.Key;
                    var list = g.ToList();
                    var totalOverdue = list.Sum(s => s.GrandTotal - s.PaidAmount);
                    var lastOverdueAlert = await _context.Alerts
                        .Where(a => a.Type == AlertType.OverdueInvoice.ToString() && !a.IsResolved && (a.TenantId ?? 0) == tenantId)
                        .OrderByDescending(a => a.CreatedAt)
                        .FirstOrDefaultAsync();

                    if (lastOverdueAlert == null || lastOverdueAlert.CreatedAt < DateTime.UtcNow.AddDays(-1))
                    {
                        await CreateAlertAsync(AlertType.OverdueInvoice,
                            $"{list.Count} invoices overdue (> {overdueDays} days)",
                            $"Total overdue amount: {totalOverdue:C}",
                            AlertSeverity.Warning,
                            new Dictionary<string, object> {
                                { "InvoiceIds", list.Select(s => s.Id).ToList() },
                                { "TotalAmount", totalOverdue },
                                { "Count", list.Count }
                            },
                            tenantId > 0 ? tenantId : null);
                    }
                }
            }
            catch (PostgresException pgEx) when (pgEx.Message.Contains("does not exist"))
            {
                _logger.LogWarning("Sales table missing required columns. Skipping overdue invoice check.");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error checking overdue invoices");
            }
        }

        private async Task CheckDuplicateInvoiceAlertsAsync()
        {
            // Check for duplicate invoice numbers per TENANT (last 7 days)
            var grouped = await _context.Sales
                .Where(s => s.CreatedAt > DateTime.UtcNow.AddDays(-7))
                .GroupBy(s => new { s.TenantId, s.InvoiceNo })
                .Where(g => g.Count() > 1)
                .Select(g => new { g.Key.TenantId, InvoiceNo = g.Key.InvoiceNo })
                .ToListAsync();

            foreach (var byTenant in grouped.GroupBy(x => x.TenantId ?? 0))
            {
                var tenantId = byTenant.Key;
                var dupNos = byTenant.Select(x => x.InvoiceNo).Distinct().ToList();
                await CreateAlertAsync(AlertType.DuplicateInvoice,
                    $"Duplicate invoice numbers detected: {string.Join(", ", dupNos)}",
                    "Please review invoice creation logic",
                    AlertSeverity.Error,
                    null,
                    tenantId > 0 ? tenantId : null);
            }
        }

        /// <summary>
        /// Dismiss similar alerts created before cutoff time
        /// </summary>
        public async Task DismissSimilarAlertsAsync(AlertType type, DateTime cutoffTime)
        {
            try
            {
                var alertsToResolve = await _context.Alerts
                    .Where(a => a.Type == type.ToString() && 
                               a.CreatedAt < cutoffTime && 
                               !a.IsResolved)
                    .ToListAsync();

                foreach (var alert in alertsToResolve)
                {
                    alert.IsResolved = true;
                    alert.ResolvedAt = DateTime.UtcNow;
                    alert.ResolvedBy = null; // Auto-resolved
                }

                await _context.SaveChangesAsync();
                _logger.LogInformation("Auto-resolved {Count} similar {Type} alerts", alertsToResolve.Count, type);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to dismiss similar alerts");
            }
        }
    }
}

