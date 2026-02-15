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

namespace HexaBill.Api.Modules.Notifications
{
    public interface IAlertService
    {
        Task CreateAlertAsync(AlertType type, string title, string? message = null, AlertSeverity severity = AlertSeverity.Info, Dictionary<string, object>? metadata = null);
        Task<List<Alert>> GetAlertsAsync(bool unreadOnly = false, int limit = 50, int? tenantId = null);
        Task<Alert?> GetAlertByIdAsync(int id);
        Task MarkAsReadAsync(int id);
        Task MarkAsResolvedAsync(int id, int userId);
        Task<int> GetUnreadCountAsync(int? tenantId = null);
        Task<int> MarkAllAsReadAsync(); // Mark all alerts as read
        Task<int> ClearResolvedAlertsAsync(); // Delete resolved alerts
        Task CheckAndCreateAlertsAsync(); // Background job to check for conditions
        Task DismissSimilarAlertsAsync(AlertType type, DateTime cutoffTime); // Dismiss duplicate alerts
    }

    public class AlertService : IAlertService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<AlertService> _logger;

        public AlertService(AppDbContext context, ILogger<AlertService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task CreateAlertAsync(AlertType type, string title, string? message = null, AlertSeverity severity = AlertSeverity.Info, Dictionary<string, object>? metadata = null)
        {
            try
            {
                // CRITICAL: Prevent duplicate alerts - check for similar alerts in last 5 minutes
                var cutoffTime = DateTime.UtcNow.AddMinutes(-5);
                var similarAlert = await _context.Alerts
                    .Where(a => a.Type == type.ToString() && 
                               a.Title == title && 
                               a.CreatedAt >= cutoffTime)
                    .OrderByDescending(a => a.CreatedAt)
                    .FirstOrDefaultAsync();

                if (similarAlert != null)
                {
                    // Similar alert exists recently - don't create duplicate
                    _logger.LogDebug("Similar alert exists (Type: {Type}, Title: {Title}), skipping duplicate", type, title);
                    return;
                }

                var alert = new Alert
                {
                    TenantId = 0, // SYSTEM-LEVEL ALERT: tenantId=0 for system alerts (not owner-specific)
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

        public async Task<Alert?> GetAlertByIdAsync(int id)
        {
            return await _context.Alerts
                .Include(a => a.ResolvedByUser)
                .FirstOrDefaultAsync(a => a.Id == id);
        }

        public async Task MarkAsReadAsync(int id)
        {
            var alert = await _context.Alerts.FindAsync(id);
            if (alert != null && !alert.IsRead)
            {
                alert.IsRead = true;
                alert.ReadAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
        }

        public async Task MarkAsResolvedAsync(int id, int userId)
        {
            var alert = await _context.Alerts.FindAsync(id);
            if (alert != null && !alert.IsResolved)
            {
                alert.IsResolved = true;
                alert.ResolvedAt = DateTime.UtcNow;
                alert.ResolvedBy = userId;
                await _context.SaveChangesAsync();
            }
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

        public async Task<int> MarkAllAsReadAsync()
        {
            try
            {
                var unreadAlerts = await _context.Alerts.Where(a => !a.IsRead).ToListAsync();
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

        public async Task<int> ClearResolvedAlertsAsync()
        {
            try
            {
                var resolvedAlerts = await _context.Alerts.Where(a => a.IsResolved).ToListAsync();
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
            catch (PostgresException pgEx) when (pgEx.Message.Contains("does not exist"))
            {
                _logger.LogWarning("Alerts table does not exist yet. Skipping backup alert check.");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error checking backup alerts");
            }
        }

        private async Task CheckDBMismatchAlertsAsync()
        {
            // Check product stock mismatches
            var products = await _context.Products.ToListAsync();
            var mismatches = new List<int>();

            foreach (var product in products)
            {
                var computedStock = await _context.InventoryTransactions
                    .Where(t => t.ProductId == product.Id)
                    .SumAsync(t => (decimal?)(t.ChangeQty * (t.TransactionType == TransactionType.Purchase || t.TransactionType == TransactionType.PurchaseReturn ? 1 : -1))) ?? 0;

                if (Math.Abs(product.StockQty - computedStock) > 0.01m)
                {
                    mismatches.Add(product.Id);
                }
            }

            if (mismatches.Any())
            {
                var lastMismatchAlert = await _context.Alerts
                    .Where(a => a.Type == AlertType.DBMismatch.ToString() && !a.IsResolved)
                    .OrderByDescending(a => a.CreatedAt)
                    .FirstOrDefaultAsync();

                if (lastMismatchAlert == null || lastMismatchAlert.CreatedAt < DateTime.UtcNow.AddHours(-6))
                {
                    await CreateAlertAsync(AlertType.DBMismatch, 
                        $"Stock mismatch detected for {mismatches.Count} products", 
                        $"Product IDs: {string.Join(", ", mismatches.Take(10))}", 
                        AlertSeverity.Warning,
                        new Dictionary<string, object> { { "ProductIds", mismatches } });
                }
            }
        }

        private async Task CheckLowStockAlertsAsync()
        {
            var lowStockProducts = await _context.Products
                .Where(p => p.StockQty <= p.ReorderLevel && p.ReorderLevel > 0)
                .ToListAsync();

            if (lowStockProducts.Any())
            {
                var lastLowStockAlert = await _context.Alerts
                    .Where(a => a.Type == AlertType.LowStock.ToString() && !a.IsResolved)
                    .OrderByDescending(a => a.CreatedAt)
                    .FirstOrDefaultAsync();

                if (lastLowStockAlert == null || lastLowStockAlert.CreatedAt < DateTime.UtcNow.AddHours(-12))
                {
                    var productList = string.Join(", ", lowStockProducts.Take(5).Select(p => $"{p.NameEn} ({p.StockQty})"));
                    await CreateAlertAsync(AlertType.LowStock, 
                        $"{lowStockProducts.Count} products below reorder level", 
                        productList, 
                        AlertSeverity.Warning,
                        new Dictionary<string, object> { 
                            { "ProductIds", lowStockProducts.Select(p => p.Id).ToList() },
                            { "Count", lowStockProducts.Count }
                        });
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

                if (overdueInvoices.Any())
                {
                    var totalOverdue = overdueInvoices.Sum(s => s.GrandTotal - s.PaidAmount);
                    var lastOverdueAlert = await _context.Alerts
                        .Where(a => a.Type == AlertType.OverdueInvoice.ToString() && !a.IsResolved)
                        .OrderByDescending(a => a.CreatedAt)
                        .FirstOrDefaultAsync();

                    if (lastOverdueAlert == null || lastOverdueAlert.CreatedAt < DateTime.UtcNow.AddDays(-1))
                    {
                        await CreateAlertAsync(AlertType.OverdueInvoice, 
                            $"{overdueInvoices.Count} invoices overdue (> {overdueDays} days)", 
                            $"Total overdue amount: {totalOverdue:C}", 
                            AlertSeverity.Warning,
                            new Dictionary<string, object> { 
                                { "InvoiceIds", overdueInvoices.Select(s => s.Id).ToList() },
                                { "TotalAmount", totalOverdue },
                                { "Count", overdueInvoices.Count }
                            });
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
            // Check for duplicate invoice numbers in last 7 days
            var recentSales = await _context.Sales
                .Where(s => s.CreatedAt > DateTime.UtcNow.AddDays(-7))
                .GroupBy(s => s.InvoiceNo)
                .Where(g => g.Count() > 1)
                .Select(g => g.Key)
                .ToListAsync();

            if (recentSales.Any())
            {
                await CreateAlertAsync(AlertType.DuplicateInvoice, 
                    $"Duplicate invoice numbers detected: {string.Join(", ", recentSales)}", 
                    "Please review invoice creation logic", 
                    AlertSeverity.Error);
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

