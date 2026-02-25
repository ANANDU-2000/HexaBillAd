/*
Purpose: Backup service for data backup and restore with ZIP support
Author: AI Assistant
Date: 2024
*/
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using System.IO.Compression;
using System.Text.Json;

namespace HexaBill.Api.Modules.SuperAdmin
{
    public interface IBackupService
    {
        Task<string> CreateBackupAsync();
        Task<string> CreateBackupZipAsync(); // New: ZIP backup with metadata
        Task<bool> RestoreBackupAsync(string backupPath);
        Task<bool> RestoreBackupZipAsync(string zipPath); // New: Restore from ZIP
        Task<List<string>> GetBackupFilesAsync();
        Task<bool> DeleteBackupAsync(string fileName);
        Task<string> GetDesktopBackupPathAsync(); // New: Get Desktop path
    }

    public class BackupService : IBackupService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly ILogger<BackupService> _logger;
        private readonly string _backupDirectory;
        private readonly string _attachmentsDirectory;

        public BackupService(AppDbContext context, IConfiguration configuration, ILogger<BackupService> logger)
        {
            _context = context;
            _configuration = configuration;
            _logger = logger;
            _backupDirectory = Path.Combine(Directory.GetCurrentDirectory(), "backups");
            _attachmentsDirectory = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
            
            if (!Directory.Exists(_backupDirectory))
            {
                Directory.CreateDirectory(_backupDirectory);
            }
            if (!Directory.Exists(_attachmentsDirectory))
            {
                Directory.CreateDirectory(_attachmentsDirectory);
            }
        }

        public Task<string> GetDesktopBackupPathAsync()
        {
            // BUG #13 FIX: Use /tmp on Linux (Render), Desktop on Windows (dev)
            var desktopPath = Environment.OSVersion.Platform == PlatformID.Unix || Environment.OSVersion.Platform == PlatformID.MacOSX
                ? "/tmp"
                : Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
            var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
            var fileName = $"HexaBillBackup_{timestamp}.zip";
            return Task.FromResult(Path.Combine(desktopPath, fileName));
        }

        public async Task<string> CreateBackupZipAsync()
        {
            try
            {
                var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
                var tempDir = Path.Combine(Path.GetTempPath(), $"backup_{timestamp}");
                Directory.CreateDirectory(tempDir);

                try
                {
                    // 1. Export database to SQL dump
                    var sqlDumpPath = Path.Combine(tempDir, "db_dump.sql");
                    await ExportDatabaseToSqlAsync(sqlDumpPath);

                    // 2. Create metadata.json
                    var metadata = new BackupMetadata
                    {
                        BackupDate = DateTime.UtcNow,
                        Version = "1.0",
                        DatabaseType = "SQLite",
                        TotalRecords = await GetTotalRecordsCountAsync()
                    };
                    var metadataPath = Path.Combine(tempDir, "metadata.json");
                    await File.WriteAllTextAsync(metadataPath, JsonSerializer.Serialize(metadata, new JsonSerializerOptions { WriteIndented = true }));

                    // 3. Copy attachments folder
                    var attachmentsBackupDir = Path.Combine(tempDir, "attachments");
                    if (Directory.Exists(_attachmentsDirectory))
                    {
                        CopyDirectory(_attachmentsDirectory, attachmentsBackupDir);
                    }

                    // 4. Create ZIP file
                    var desktopPath = await GetDesktopBackupPathAsync();
                    if (File.Exists(desktopPath))
                    {
                        File.Delete(desktopPath);
                    }
                    ZipFile.CreateFromDirectory(tempDir, desktopPath, CompressionLevel.Optimal, false);

                    // 5. Also save to backups directory
                    var backupFileName = $"backup_{timestamp}.zip";
                    var backupFilePath = Path.Combine(_backupDirectory, backupFileName);
                    File.Copy(desktopPath, backupFilePath, true);

                    // Create audit log
                    var auditLog = new AuditLog
                    {
                        UserId = 1,
                        Action = "ZIP Backup Created",
                        Details = $"Backup file: {backupFileName}, Location: Desktop",
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.AuditLogs.Add(auditLog);
                    await _context.SaveChangesAsync();

                    _logger.LogInformation("✅ Backup created successfully: {Path}", desktopPath);
                    return desktopPath;
                }
                finally
                {
                    // Cleanup temp directory
                    if (Directory.Exists(tempDir))
                    {
                        Directory.Delete(tempDir, true);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Backup creation failed");
                var auditLog = new AuditLog
                {
                    UserId = 1,
                    Action = "Backup Failed",
                    Details = $"Error: {ex.Message}",
                    CreatedAt = DateTime.UtcNow
                };
                _context.AuditLogs.Add(auditLog);
                await _context.SaveChangesAsync();
                throw;
            }
        }

        public async Task<bool> RestoreBackupZipAsync(string zipPath)
        {
            try
            {
                if (!File.Exists(zipPath))
                {
                    _logger.LogError("Backup file not found: {Path}", zipPath);
                    return false;
                }

                var tempDir = Path.Combine(Path.GetTempPath(), $"restore_{DateTime.Now:yyyyMMddHHmmss}");
                Directory.CreateDirectory(tempDir);

                try
                {
                    // 1. Extract ZIP
                    ZipFile.ExtractToDirectory(zipPath, tempDir);

                    // 2. Read metadata
                    var metadataPath = Path.Combine(tempDir, "metadata.json");
                    if (File.Exists(metadataPath))
                    {
                        var metadataJson = await File.ReadAllTextAsync(metadataPath);
                        var metadata = JsonSerializer.Deserialize<BackupMetadata>(metadataJson);
                        _logger.LogInformation("Restoring backup from {Date}, Version {Version}", metadata?.BackupDate, metadata?.Version);
                    }

                    // 3. Restore database from SQL dump (UPSERT mode - no drop)
                    var sqlDumpPath = Path.Combine(tempDir, "db_dump.sql");
                    if (File.Exists(sqlDumpPath))
                    {
                        await RestoreDatabaseFromSqlAsync(sqlDumpPath);
                    }

                    // 4. Restore attachments
                    var attachmentsBackupDir = Path.Combine(tempDir, "attachments");
                    if (Directory.Exists(attachmentsBackupDir))
                    {
                        CopyDirectory(attachmentsBackupDir, _attachmentsDirectory);
                    }

                    // 5. Create audit log
                    var auditLog = new AuditLog
                    {
                        UserId = 1,
                        Action = "Backup Restored",
                        Details = $"Restored from: {Path.GetFileName(zipPath)}",
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.AuditLogs.Add(auditLog);
                    await _context.SaveChangesAsync();

                    _logger.LogInformation("✅ Backup restored successfully");
                    return true;
                }
                finally
                {
                    if (Directory.Exists(tempDir))
                    {
                        Directory.Delete(tempDir, true);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Backup restore failed");
                var auditLog = new AuditLog
                {
                    UserId = 1,
                    Action = "Backup Restore Failed",
                    Details = $"Error: {ex.Message}",
                    CreatedAt = DateTime.UtcNow
                };
                _context.AuditLogs.Add(auditLog);
                await _context.SaveChangesAsync();
                return false;
            }
        }

        private async Task ExportDatabaseToSqlAsync(string outputPath)
        {
            using var writer = new StreamWriter(outputPath);
            
            // Export all tables
                    await writer.WriteLineAsync("-- HexaBill Backup SQL Dump");
            await writer.WriteLineAsync($"-- Generated: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC");
            await writer.WriteLineAsync();

            // Export Products
            await ExportTableAsync(writer, "Products", async () => await _context.Products.ToListAsync());
            
            // Export Customers
            await ExportTableAsync(writer, "Customers", async () => await _context.Customers.ToListAsync());
            
            // Export Sales
            await ExportTableAsync(writer, "Sales", async () => await _context.Sales.ToListAsync());
            
            // Export SaleItems
            await ExportTableAsync(writer, "SaleItems", async () => await _context.SaleItems.ToListAsync());
            
            // Export Purchases
            await ExportTableAsync(writer, "Purchases", async () => await _context.Purchases.ToListAsync());
            
            // Export PurchaseItems
            await ExportTableAsync(writer, "PurchaseItems", async () => await _context.PurchaseItems.ToListAsync());
            
            // Export Payments
            await ExportTableAsync(writer, "Payments", async () => await _context.Payments.ToListAsync());
            
            // Export Expenses
            await ExportTableAsync(writer, "Expenses", async () => await _context.Expenses.ToListAsync());
            
            // Export Users
            await ExportTableAsync(writer, "Users", async () => await _context.Users.ToListAsync());
            
            // Export Settings
            await ExportTableAsync(writer, "Settings", async () => await _context.Settings.ToListAsync());

            await writer.FlushAsync();
        }

        private async Task ExportTableAsync<T>(StreamWriter writer, string tableName, Func<Task<List<T>>> getData)
        {
            var data = await getData();
            if (data.Any())
            {
                await writer.WriteLineAsync($"\n-- Table: {tableName}");
                await writer.WriteLineAsync($"-- Records: {data.Count}");
                var json = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = false });
                await writer.WriteLineAsync($"-- DATA:{tableName}:{json}");
            }
        }

        private async Task RestoreDatabaseFromSqlAsync(string sqlDumpPath)
        {
            var sql = await File.ReadAllTextAsync(sqlDumpPath);
            var lines = sql.Split('\n');

            foreach (var line in lines)
            {
                if (line.StartsWith("-- DATA:"))
                {
                    var parts = line.Substring(8).Split(':', 2);
                    if (parts.Length == 2)
                    {
                        var tableName = parts[0];
                        var jsonData = parts[1];

                        await UpsertTableDataAsync(tableName, jsonData);
                    }
                }
            }
        }

        private async Task UpsertTableDataAsync(string tableName, string jsonData)
        {
            try
            {
                switch (tableName)
                {
                    case "Products":
                        var products = JsonSerializer.Deserialize<List<Product>>(jsonData);
                        if (products != null)
                        {
                            foreach (var item in products)
                            {
                                var existing = await _context.Products.FindAsync(item.Id);
                                if (existing != null)
                                {
                                    _context.Entry(existing).CurrentValues.SetValues(item);
                                }
                                else
                                {
                                    _context.Products.Add(item);
                                }
                            }
                        }
                        break;
                    
                    case "Customers":
                        var customers = JsonSerializer.Deserialize<List<Customer>>(jsonData);
                        if (customers != null)
                        {
                            foreach (var item in customers)
                            {
                                var existing = await _context.Customers.FindAsync(item.Id);
                                if (existing != null)
                                {
                                    _context.Entry(existing).CurrentValues.SetValues(item);
                                }
                                else
                                {
                                    _context.Customers.Add(item);
                                }
                            }
                        }
                        break;
                    
                    case "Sales":
                        var sales = JsonSerializer.Deserialize<List<Sale>>(jsonData);
                        if (sales != null)
                        {
                            foreach (var item in sales)
                            {
                                var existing = await _context.Sales.FindAsync(item.Id);
                                if (existing != null)
                                {
                                    _context.Entry(existing).CurrentValues.SetValues(item);
                                }
                                else
                                {
                                    _context.Sales.Add(item);
                                }
                            }
                        }
                        break;
                    
                    // Add more cases for other tables...
                }

                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error upserting {Table}", tableName);
            }
        }

        private void CopyDirectory(string sourceDir, string destDir)
        {
            Directory.CreateDirectory(destDir);

            foreach (var file in Directory.GetFiles(sourceDir))
            {
                var destFile = Path.Combine(destDir, Path.GetFileName(file));
                File.Copy(file, destFile, true);
            }

            foreach (var directory in Directory.GetDirectories(sourceDir))
            {
                var destSubDir = Path.Combine(destDir, Path.GetFileName(directory));
                CopyDirectory(directory, destSubDir);
            }
        }

        private async Task<int> GetTotalRecordsCountAsync()
        {
            var count = 0;
            count += await _context.Products.CountAsync();
            count += await _context.Customers.CountAsync();
            count += await _context.Sales.CountAsync();
            count += await _context.Purchases.CountAsync();
            count += await _context.Payments.CountAsync();
            count += await _context.Expenses.CountAsync();
            return count;
        }

        public async Task<string> CreateBackupAsync()
        {
            try
            {
                var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
                var fileName = $"backup_{timestamp}.db";
                var filePath = Path.Combine(_backupDirectory, fileName);

                // Get connection string and resolve SQLite database path
                var connectionString = _configuration.GetConnectionString("DefaultConnection");
                if (string.IsNullOrEmpty(connectionString))
                {
                    throw new InvalidOperationException("Database connection string not found");
                }

                var dbPath = connectionString.Contains("Data Source", StringComparison.OrdinalIgnoreCase)
                    ? connectionString.Split(';').FirstOrDefault(p => p.StartsWith("Data Source", StringComparison.OrdinalIgnoreCase))?.Split('=')[1]
                    : null;

                if (string.IsNullOrWhiteSpace(dbPath))
                {
                    throw new InvalidOperationException("SQLite database path not found in connection string");
                }

                var fullDbPath = Path.IsPathRooted(dbPath)
                    ? dbPath
                    : Path.Combine(Directory.GetCurrentDirectory(), dbPath);

                if (!File.Exists(fullDbPath))
                {
                    throw new InvalidOperationException($"Database file not found: {fullDbPath}");
                }

                // Copy database file
                await Task.Run(() => File.Copy(fullDbPath, filePath, true));

                // Create audit log
                var auditLog = new AuditLog
                {
                    UserId = 1, // System user
                    Action = "Backup Created",
                    Details = $"Backup file: {fileName}",
                    CreatedAt = DateTime.UtcNow
                };

                _context.AuditLogs.Add(auditLog);
                await _context.SaveChangesAsync();

                return fileName;
            }
            catch (Exception ex)
            {
                // Log error
                var auditLog = new AuditLog
                {
                    UserId = 1, // System user
                    Action = "Backup Failed",
                    Details = $"Error: {ex.Message}",
                    CreatedAt = DateTime.UtcNow
                };

                _context.AuditLogs.Add(auditLog);
                await _context.SaveChangesAsync();

                throw;
            }
        }

        public async Task<bool> RestoreBackupAsync(string backupPath)
        {
            try
            {
                var fullPath = Path.Combine(_backupDirectory, backupPath);
                if (!File.Exists(fullPath))
                {
                    return false;
                }

                // Get connection string
                var connectionString = _configuration.GetConnectionString("DefaultConnection");
                if (string.IsNullOrEmpty(connectionString))
                {
                    throw new InvalidOperationException("Database connection string not found");
                }

                var dbPath = connectionString.Contains("Data Source", StringComparison.OrdinalIgnoreCase)
                    ? connectionString.Split(';').FirstOrDefault(p => p.StartsWith("Data Source", StringComparison.OrdinalIgnoreCase))?.Split('=')[1]
                    : null;

                if (string.IsNullOrWhiteSpace(dbPath))
                {
                    throw new InvalidOperationException("SQLite database path not found");
                }

                var fullDbPath = Path.IsPathRooted(dbPath)
                    ? dbPath
                    : Path.Combine(Directory.GetCurrentDirectory(), dbPath);

                // Backup current database first
                if (File.Exists(fullDbPath))
                {
                    var currentBackup = $"{fullDbPath}.pre_restore_{DateTime.Now:yyyyMMddHHmmss}";
                    File.Copy(fullDbPath, currentBackup, true);
                }

                // Restore from backup
                await Task.Run(() => File.Copy(fullPath, fullDbPath, true));

                // Create audit log
                var auditLog = new AuditLog
                {
                    UserId = 1, // System user
                    Action = "Backup Restored",
                    Details = $"Restored from: {backupPath}",
                    CreatedAt = DateTime.UtcNow
                };

                _context.AuditLogs.Add(auditLog);
                await _context.SaveChangesAsync();

                return true;
            }
            catch (Exception ex)
            {
                // Log error
                var auditLog = new AuditLog
                {
                    UserId = 1, // System user
                    Action = "Backup Restore Failed",
                    Details = $"Error: {ex.Message}",
                    CreatedAt = DateTime.UtcNow
                };

                _context.AuditLogs.Add(auditLog);
                await _context.SaveChangesAsync();

                return false;
            }
        }

        public Task<List<string>> GetBackupFilesAsync()
        {
            var dbFiles = Directory.GetFiles(_backupDirectory, "backup_*.db")
                .Select(Path.GetFileName)
                .Where(f => f != null)
                .Cast<string>()
                .OrderByDescending(f => f)
                .ToList();

            return Task.FromResult(dbFiles);
        }

        public async Task<bool> DeleteBackupAsync(string fileName)
        {
            try
            {
                var fullPath = Path.Combine(_backupDirectory, fileName);
                if (!File.Exists(fullPath))
                {
                    return false;
                }

                File.Delete(fullPath);

                // Create audit log
                var auditLog = new AuditLog
                {
                    UserId = 1, // System user
                    Action = "Backup Deleted",
                    Details = $"Deleted file: {fileName}",
                    CreatedAt = DateTime.UtcNow
                };

                _context.AuditLogs.Add(auditLog);
                await _context.SaveChangesAsync();

                return true;
            }
            catch
            {
                return false;
            }
        }
    }

    public class BackupMetadata
    {
        public DateTime BackupDate { get; set; }
        public string Version { get; set; } = "1.0";
        public string DatabaseType { get; set; } = "SQLite";
        public int TotalRecords { get; set; }
    }
}

