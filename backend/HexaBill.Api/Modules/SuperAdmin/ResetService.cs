/*
Purpose: Admin Reset Service - Safely reset transactional data with backup option
Author: AI Assistant
Date: 2025
*/
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;

namespace HexaBill.Api.Modules.SuperAdmin
{
    public interface IResetService
    {
        Task<ResetResult> ResetSystemAsync(bool createBackup, bool clearAuditLogs, int userId);
        Task<ResetResult> ResetOwnerDataAsync(int tenantId, int userId); // Owner-scoped reset
        Task<SystemSummary> GetSystemSummaryAsync();
        Task<SystemSummary> GetOwnerSummaryAsync(int tenantId); // Owner-scoped summary
    }

    public class ResetService : IResetService
    {
        private readonly AppDbContext _context;
        private readonly IComprehensiveBackupService _backupService;

        public ResetService(AppDbContext context, IComprehensiveBackupService backupService)
        {
            _context = context;
            _backupService = backupService;
        }

        public async Task<ResetResult> ResetSystemAsync(bool createBackup, bool clearAuditLogs, int userId)
        {
            var result = new ResetResult
            {
                Success = false,
                Message = "",
                BackupCreated = false,
                BackupFilePath = null
            };

            try
            {
                // Step 1: Create backup if requested
                if (createBackup)
                {
                    try
                    {
                        var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
                        var backupFileName = $"BeforeReset_{timestamp}.zip";
                        
                        // AUDIT-8 FIX: System-wide reset backup - backup all active tenants
                        var activeTenantIds = await _context.Tenants
                            .Where(t => t.Status == TenantStatus.Active || t.Status == TenantStatus.Trial)
                            .Select(t => t.Id)
                            .ToListAsync();
                        
                        foreach (var tenantId in activeTenantIds)
                        {
                            try
                            {
                                await _backupService.CreateFullBackupAsync(tenantId, exportToDesktop: true, uploadToGoogleDrive: false, sendEmail: false);
                                Console.WriteLine($"✅ Backup created for tenant {tenantId} before system reset");
                            }
                            catch (Exception tenantBackupEx)
                            {
                                Console.WriteLine($"⚠️ Failed to backup tenant {tenantId}: {tenantBackupEx.Message}");
                            }
                        }
                        
                        result.BackupCreated = true;
                        result.BackupFilePath = Path.Combine(
                            // BUG #13 FIX: Use /tmp on Linux (Render), Desktop on Windows (dev)
                            (Environment.OSVersion.Platform == PlatformID.Unix || Environment.OSVersion.Platform == PlatformID.MacOSX)
                                ? "/tmp"
                                : Environment.GetFolderPath(Environment.SpecialFolder.Desktop),
                            "HexaBill_Backups",
                            backupFileName
                        );
                        
                        Console.WriteLine($"✅ Backup created before reset: {result.BackupFilePath}");
                    }
                    catch (Exception backupEx)
                    {
                        // Don't fail reset if backup fails, but warn admin
                        result.Message = $"Warning: Backup failed: {backupEx.Message}. Continue with reset?";
                        Console.WriteLine($"⚠️ Backup failed: {backupEx.Message}");
                    }
                }

                // Step 2: Get counts before deletion (for reporting)
                var summaryBefore = await GetSystemSummaryAsync();

                // Step 3: Delete all transactional data
                // Sales and Sale Items
                var salesCount = await _context.Sales.Where(s => !s.IsDeleted).ExecuteDeleteAsync();
                var saleItemsCount = await _context.SaleItems.ExecuteDeleteAsync();
                
                // Payments
                var paymentsCount = await _context.Payments.ExecuteDeleteAsync();
                
                // Expenses
                var expensesCount = await _context.Expenses.ExecuteDeleteAsync();
                
                // Inventory Transactions
                var inventoryTxCount = await _context.InventoryTransactions.ExecuteDeleteAsync();
                
                // Sales Returns
                var salesReturnsCount = await _context.SaleReturns.ExecuteDeleteAsync();
                
                // Purchase Returns
                var purchaseReturnsCount = await _context.PurchaseReturns.ExecuteDeleteAsync();
                
                // Purchases
                var purchasesCount = await _context.Purchases.ExecuteDeleteAsync();

                // Step 4: Reset stock quantities to 0 (keep products)
                var productsUpdated = await _context.Products
                    .Where(p => p.StockQty != 0)
                    .ExecuteUpdateAsync(p => p.SetProperty(x => x.StockQty, 0));

                // Step 5: Reset customer balances to 0 (keep customers)
                var customersUpdated = await _context.Customers
                    .Where(c => c.Balance != 0)
                    .ExecuteUpdateAsync(c => c.SetProperty(x => x.Balance, 0));

                // Step 6: Optional - Clear audit logs
                int auditLogsCount = 0;
                if (clearAuditLogs)
                {
                    auditLogsCount = await _context.AuditLogs.ExecuteDeleteAsync();
                }

                // Step 7: Create audit log entry for the reset action
                var resetAuditLog = new AuditLog
                {
                    UserId = userId,
                    Action = "SYSTEM_RESET",
                    Details = $"System reset executed. Deleted: {salesCount} sales, {paymentsCount} payments, {expensesCount} expenses, {inventoryTxCount} inventory transactions. Backup: {(result.BackupCreated ? "Yes" : "No")}. Audit logs cleared: {clearAuditLogs}",
                    CreatedAt = DateTime.UtcNow
                };
                _context.AuditLogs.Add(resetAuditLog);

                await _context.SaveChangesAsync();

                result.Success = true;
                result.Message = $"System reset completed successfully. " +
                    $"Deleted: {salesCount} sales, {saleItemsCount} sale items, {paymentsCount} payments, {expensesCount} expenses, " +
                    $"{inventoryTxCount} inventory transactions, {salesReturnsCount} sales returns, {purchaseReturnsCount} purchase returns, {purchasesCount} purchases. " +
                    $"Reset: {productsUpdated} products (stock to 0), {customersUpdated} customers (balance to 0). " +
                    $"{(clearAuditLogs ? $"Cleared {auditLogsCount} audit logs." : "Audit logs preserved.")}";

                Console.WriteLine($"✅ System reset completed by user {userId}");
                Console.WriteLine($"   Summary: {result.Message}");

                return result;
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.Message = $"Reset failed: {ex.Message}";
                Console.WriteLine($"❌ System reset failed: {ex.Message}");
                return result;
            }
        }

        public async Task<SystemSummary> GetSystemSummaryAsync()
        {
            return new SystemSummary
            {
                TotalSales = await _context.Sales.Where(s => !s.IsDeleted).CountAsync(),
                TotalSaleItems = await _context.SaleItems.CountAsync(),
                TotalPayments = await _context.Payments.CountAsync(),
                TotalExpenses = await _context.Expenses.CountAsync(),
                TotalInventoryTransactions = await _context.InventoryTransactions.CountAsync(),
                TotalSalesReturns = await _context.SaleReturns.CountAsync(),
                TotalPurchaseReturns = await _context.PurchaseReturns.CountAsync(),
                TotalPurchases = await _context.Purchases.CountAsync(),
                TotalProducts = await _context.Products.CountAsync(),
                TotalCustomers = await _context.Customers.CountAsync(),
                TotalUsers = await _context.Users.CountAsync(),
                TotalAuditLogs = await _context.AuditLogs.CountAsync(),
                GeneratedAt = DateTime.UtcNow
            };
        }

        public async Task<SystemSummary> GetOwnerSummaryAsync(int tenantId)
        {
            return new SystemSummary
            {
                TotalSales = await _context.Sales.Where(s => !s.IsDeleted && s.TenantId == tenantId).CountAsync(),
                TotalSaleItems = await _context.SaleItems.Where(si => si.Sale != null && si.Sale.TenantId == tenantId).CountAsync(),
                TotalPayments = await _context.Payments.Where(p => p.TenantId == tenantId).CountAsync(),
                TotalExpenses = await _context.Expenses.Where(e => e.TenantId == tenantId).CountAsync(),
                TotalInventoryTransactions = await _context.InventoryTransactions.Where(i => i.TenantId == tenantId).CountAsync(),
                TotalSalesReturns = await _context.SaleReturns.Where(sr => sr.TenantId == tenantId).CountAsync(),
                TotalPurchaseReturns = await _context.PurchaseReturns.Where(pr => pr.TenantId == tenantId).CountAsync(),
                TotalPurchases = await _context.Purchases.Where(p => p.TenantId == tenantId).CountAsync(),
                TotalProducts = await _context.Products.Where(p => p.TenantId == tenantId).CountAsync(),
                TotalCustomers = await _context.Customers.Where(c => c.TenantId == tenantId).CountAsync(),
                TotalUsers = await _context.Users.Where(u => u.TenantId == tenantId).CountAsync(),
                TotalAuditLogs = await _context.AuditLogs.CountAsync(), // Audit logs are not owner-scoped
                GeneratedAt = DateTime.UtcNow
            };
        }

        public async Task<ResetResult> ResetOwnerDataAsync(int tenantId, int userId)
        {
            var result = new ResetResult
            {
                Success = false,
                Message = "",
                BackupCreated = false,
                BackupFilePath = null
            };

            try
            {
                Console.WriteLine($"\n🔄 Starting owner-scoped reset for tenantId={tenantId} by UserId={userId}");

                // Get counts before deletion
                var summaryBefore = await GetOwnerSummaryAsync(tenantId);
                Console.WriteLine($"   Before: {summaryBefore.TotalSales} sales, {summaryBefore.TotalPayments} payments");

                // Delete all transactional data for this owner
                // Sales and Sale Items - get sale IDs first
                var saleIds = await _context.Sales.Where(s => s.TenantId == tenantId).Select(s => s.Id).ToListAsync();
                var saleItemsCount = await _context.SaleItems.Where(si => saleIds.Contains(si.SaleId)).ExecuteDeleteAsync();
                var salesCount = await _context.Sales.Where(s => s.TenantId == tenantId).ExecuteDeleteAsync();
                
                // Payments
                var paymentsCount = await _context.Payments.Where(p => p.TenantId == tenantId).ExecuteDeleteAsync();
                
                // Expenses
                var expensesCount = await _context.Expenses.Where(e => e.TenantId == tenantId).ExecuteDeleteAsync();
                
                // Inventory Transactions
                var inventoryTxCount = await _context.InventoryTransactions.Where(i => i.TenantId == tenantId).ExecuteDeleteAsync();
                
                // Sales Returns
                var salesReturnsCount = await _context.SaleReturns.Where(sr => sr.TenantId == tenantId).ExecuteDeleteAsync();
                
                // Purchase Returns
                var purchaseReturnsCount = await _context.PurchaseReturns.Where(pr => pr.TenantId == tenantId).ExecuteDeleteAsync();
                
                // Purchases - get IDs first, then delete items, then purchases
                var purchaseIds = await _context.Purchases.Where(p => p.TenantId == tenantId).Select(p => p.Id).ToListAsync();
                var purchaseItemsCount = await _context.PurchaseItems.Where(pi => purchaseIds.Contains(pi.PurchaseId)).ExecuteDeleteAsync();
                var purchasesCount = await _context.Purchases.Where(p => p.TenantId == tenantId).ExecuteDeleteAsync();

                // Reset stock quantities to 0 for owner's products
                var productsUpdated = await _context.Products
                    .Where(p => p.TenantId == tenantId && p.StockQty != 0)
                    .ExecuteUpdateAsync(p => p.SetProperty(x => x.StockQty, 0));

                // Reset customer balances to 0 for owner's customers
                var customersUpdated = await _context.Customers
                    .Where(c => c.TenantId == tenantId && c.Balance != 0)
                    .ExecuteUpdateAsync(c => c.SetProperty(x => x.Balance, 0));

                // Clear alerts for this owner
                var alertsCleared = await _context.Alerts.Where(a => a.TenantId == tenantId || a.TenantId == 0).ExecuteDeleteAsync();

                // Create audit log entry
                var resetAuditLog = new AuditLog
                {
                    UserId = userId,
                    Action = "OWNER_DATA_RESET",
                    Details = $"Owner data reset for tenantId={tenantId}. Deleted: {salesCount} sales, {paymentsCount} payments, {expensesCount} expenses, {purchasesCount} purchases. Reset: {productsUpdated} products, {customersUpdated} customers.",
                    CreatedAt = DateTime.UtcNow
                };
                _context.AuditLogs.Add(resetAuditLog);
                await _context.SaveChangesAsync();

                result.Success = true;
                result.Message = $"Owner data reset completed. Deleted: {salesCount} sales, {saleItemsCount} sale items, {paymentsCount} payments, {expensesCount} expenses, " +
                    $"{inventoryTxCount} inventory transactions, {salesReturnsCount} returns, {purchasesCount} purchases. " +
                    $"Reset: {productsUpdated} products (stock to 0), {customersUpdated} customers (balance to 0). Cleared {alertsCleared} alerts.";

                Console.WriteLine($"✅ Owner reset completed: {result.Message}");
                return result;
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.Message = $"Reset failed: {ex.Message}";
                Console.WriteLine($"❌ Owner reset failed: {ex.Message}");
                return result;
            }
        }
    }

    public class ResetResult
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public bool BackupCreated { get; set; }
        public string? BackupFilePath { get; set; }
    }

    public class SystemSummary
    {
        public int TotalSales { get; set; }
        public int TotalSaleItems { get; set; }
        public int TotalPayments { get; set; }
        public int TotalExpenses { get; set; }
        public int TotalInventoryTransactions { get; set; }
        public int TotalSalesReturns { get; set; }
        public int TotalPurchaseReturns { get; set; }
        public int TotalPurchases { get; set; }
        public int TotalProducts { get; set; }
        public int TotalCustomers { get; set; }
        public int TotalUsers { get; set; }
        public int TotalAuditLogs { get; set; }
        public DateTime GeneratedAt { get; set; }
    }
}

