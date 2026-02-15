using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.SuperAdmin;
using HexaBill.Api.Shared.Security;

namespace HexaBill.Api.Modules.SuperAdmin
{
    [ApiController]
    [Route("api")] 
    public class DiagnosticsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IConfiguration _config;
        private readonly IFontService _fontService;

        public DiagnosticsController(AppDbContext db, IConfiguration config, IFontService fontService)
        {
            _db = db;
            _config = config;
            _fontService = fontService;
        }

        [HttpGet("health")]
        [AllowAnonymous]
        public IActionResult Health()
        {
            return Ok(new { status = "healthy", timestamp = DateTime.UtcNow });
        }

        /// <summary>Platform health for Super Admin: DB, migrations, company count. Use for monitoring / status page.</summary>
        [HttpGet("superadmin/platform-health")]
        [Authorize(Roles = "SystemAdmin")]
        public async Task<IActionResult> GetPlatformHealth()
        {
            var ts = DateTime.UtcNow;
            bool dbOk = false;
            string lastMigration = "";
            var pending = Array.Empty<string>();
            int companyCount = 0;
            string error = null;

            try
            {
                dbOk = await _db.Database.CanConnectAsync();
                if (dbOk)
                {
                    var applied = await _db.Database.GetAppliedMigrationsAsync();
                    lastMigration = applied.OrderByDescending(x => x).FirstOrDefault() ?? "";
                    var pendingList = await _db.Database.GetPendingMigrationsAsync();
                    pending = pendingList.ToArray();
                    companyCount = await _db.Tenants.CountAsync();
                }
            }
            catch (Exception ex)
            {
                error = ex.Message;
            }

            return Ok(new
            {
                success = error == null,
                timestamp = ts,
                database = new { connected = dbOk, error },
                migrations = new { lastApplied = lastMigration, pending },
                companyCount
            });
        }

        /// <summary>Enterprise: last 100 server errors. SuperAdmin/Admin only.</summary>
        [HttpGet("error-logs")]
        [Authorize(Roles = "Admin,Owner,SystemAdmin")]
        public async Task<IActionResult> GetErrorLogs([FromQuery] int limit = 100)
        {
            limit = Math.Clamp(limit, 1, 500);
            var list = await _db.ErrorLogs
                .OrderByDescending(e => e.CreatedAt)
                .Take(limit)
                .Select(e => new
                {
                    e.Id,
                    e.TraceId,
                    e.ErrorCode,
                    e.Message,
                    e.Path,
                    e.Method,
                    e.TenantId,
                    e.UserId,
                    e.CreatedAt
                })
                .ToListAsync();
            return Ok(new { success = true, count = list.Count, items = list });
        }

        /// <summary>Platform-wide audit logs for Super Admin. Optional filters: tenantId, userId, action, fromDate, toDate. SystemAdmin only.</summary>
        [HttpGet("superadmin/audit-logs")]
        [Authorize(Roles = "SystemAdmin")]
        public async Task<IActionResult> GetPlatformAuditLogs(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] int? tenantId = null,
            [FromQuery] int? userId = null,
            [FromQuery] string? action = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            pageSize = Math.Clamp(pageSize, 1, 100);
            var query = _db.AuditLogs.AsQueryable();

            if (tenantId.HasValue)
                query = query.Where(a => a.TenantId == tenantId.Value);
            if (userId.HasValue)
                query = query.Where(a => a.UserId == userId.Value);
            if (!string.IsNullOrWhiteSpace(action))
                query = query.Where(a => a.Action != null && a.Action.Contains(action));
            if (fromDate.HasValue)
                query = query.Where(a => a.CreatedAt >= fromDate.Value);
            if (toDate.HasValue)
            {
                var end = toDate.Value.Date.AddDays(1);
                query = query.Where(a => a.CreatedAt < end);
            }

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderByDescending(a => a.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(a => new
                {
                    a.Id,
                    a.TenantId,
                    UserName = a.User.Name,
                    a.UserId,
                    a.Action,
                    a.EntityType,
                    a.EntityId,
                    a.Details,
                    a.CreatedAt
                })
                .ToListAsync();
            return Ok(new
            {
                success = true,
                data = new
                {
                    items,
                    totalCount,
                    page,
                    pageSize,
                    totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
                }
            });
        }

        [HttpGet("status")]
        public async Task<IActionResult> Status()
        {
            try
            {
                var dbConnected = await _db.Database.CanConnectAsync();
                var appliedMigrations = await _db.Database.GetAppliedMigrationsAsync();
                var pendingMigrations = await _db.Database.GetPendingMigrationsAsync();

                var tables = new List<string>();
                if (dbConnected)
                {
                    try
                    {
                        // Check which tables exist
                        var connection = _db.Database.GetDbConnection();
                        await connection.OpenAsync();
                        var command = connection.CreateCommand();
                        command.CommandText = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;";
                        using var reader = await command.ExecuteReaderAsync();
                        while (await reader.ReadAsync())
                        {
                            tables.Add(reader.GetString(0));
                        }
                        await connection.CloseAsync();
                    }
                    catch (Exception ex)
                    {
                        tables.Add($"Error checking tables: {ex.Message}");
                    }
                }

                var result = new
                {
                    dbConnected,
                    migrationsApplied = appliedMigrations.Any(),
                    appliedMigrations = appliedMigrations.ToList(),
                    pendingMigrations = pendingMigrations.ToList(),
                    tables = tables,
                    requiredTables = new[] { "Users", "Products", "Sales", "SaleItems", "Customers", "Payments", "InventoryTransactions", "AuditLogs" },
                    tablesMissing = tables.Any() ? new[] { "Users", "Products", "Sales", "SaleItems", "Customers", "Payments", "InventoryTransactions", "AuditLogs" }
                        .Except(tables).ToList() : new[] { "Users", "Products", "Sales", "SaleItems", "Customers", "Payments", "InventoryTransactions", "AuditLogs" }.ToList(),
                    version = typeof(Program).Assembly.GetName().Version?.ToString() ?? "1.0.0"
                };
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message, stackTrace = ex.StackTrace });
            }
        }

        /// <summary>Apply pending EF migrations. SystemAdmin only.</summary>
        [HttpPost("migrate")]
        [Authorize(Roles = "SystemAdmin")]
        public async Task<IActionResult> ApplyMigrations()
        {
            try
            {
                var pending = await _db.Database.GetPendingMigrationsAsync();
                var pendingList = pending.ToList();

                if (!pendingList.Any())
                {
                    return Ok(new { message = "No pending migrations", appliedMigrations = await _db.Database.GetAppliedMigrationsAsync() });
                }

                await _db.Database.MigrateAsync();
                var applied = await _db.Database.GetAppliedMigrationsAsync();

                return Ok(new
                {
                    message = "Migrations applied successfully",
                    pendingMigrations = pendingList,
                    appliedMigrations = applied.ToList(),
                    dbConnected = await _db.Database.CanConnectAsync()
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message, stackTrace = ex.StackTrace, innerException = ex.InnerException?.Message });
            }
        }

        [HttpGet("fonts")]
        [AllowAnonymous]
        public IActionResult CheckFonts()
        {
            try
            {
                var fontsDir = Path.Combine(Directory.GetCurrentDirectory(), "Fonts");
                var fontFiles = new List<object>();
                
                if (Directory.Exists(fontsDir))
                {
                    var files = Directory.GetFiles(fontsDir, "*.ttf");
                    foreach (var file in files)
                    {
                        var fileInfo = new FileInfo(file);
                        fontFiles.Add(new
                        {
                            name = fileInfo.Name,
                            size = fileInfo.Length,
                            path = file,
                            exists = true
                        });
                    }
                }

                var arabicFont = _fontService.GetArabicFontFamily();
                var englishFont = _fontService.GetEnglishFontFamily();

                return Ok(new
                {
                    fontsDirectory = fontsDir,
                    directoryExists = Directory.Exists(fontsDir),
                    fontFiles = fontFiles,
                    fontFilesCount = fontFiles.Count,
                    arabicFontFamily = arabicFont,
                    englishFontFamily = englishFont,
                    workingDirectory = Directory.GetCurrentDirectory(),
                    expectedFonts = new[]
                    {
                        "NotoSansArabic-Regular.ttf",
                        "NotoSansArabic-Bold.ttf"
                    },
                    fontsRegistered = fontFiles.Count >= 2
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message, stackTrace = ex.StackTrace });
            }
        }

        [HttpPost("fix-columns")]
        [Authorize(Roles = "Admin,Owner")]
        public async Task<IActionResult> FixMissingColumns()
        {
            try
            {
                var results = new List<object>();
                
                // Add missing columns using raw SQL (SQLite-safe)
                var commands = new[]
                {
                    ("ALTER TABLE Sales ADD COLUMN LastPaymentDate TEXT NULL", "LastPaymentDate"),
                    ("ALTER TABLE Sales ADD COLUMN PaidAmount decimal(18,2) DEFAULT 0", "PaidAmount"),
                    ("ALTER TABLE Sales ADD COLUMN TotalAmount decimal(18,2) DEFAULT 0", "TotalAmount"),
                    ("ALTER TABLE Customers ADD COLUMN LastActivity TEXT NULL", "LastActivity"),
                    ("ALTER TABLE Payments ADD COLUMN Reference TEXT NULL", "Reference"),
                    ("ALTER TABLE Payments ADD COLUMN CreatedBy INTEGER DEFAULT 1", "CreatedBy"),
                    ("ALTER TABLE Payments ADD COLUMN UpdatedAt TEXT NULL", "UpdatedAt")
                };

                foreach (var (command, columnName) in commands)
                {
                    try
                    {
                        await _db.Database.ExecuteSqlRawAsync(command);
                        results.Add(new { column = columnName, status = "added", success = true });
                    }
                    catch (Exception ex)
                    {
                        // Column may already exist
                        if (ex.Message.Contains("duplicate column", StringComparison.OrdinalIgnoreCase) ||
                            ex.Message.Contains("already exists", StringComparison.OrdinalIgnoreCase))
                        {
                            results.Add(new { column = columnName, status = "already exists", success = true });
                        }
                        else
                        {
                            results.Add(new { column = columnName, status = "error", error = ex.Message, success = false });
                        }
                    }
                }

                // Initialize values
                try
                {
                    await _db.Database.ExecuteSqlRawAsync("UPDATE Sales SET TotalAmount = GrandTotal WHERE TotalAmount = 0 OR TotalAmount IS NULL");
                    await _db.Database.ExecuteSqlRawAsync("UPDATE Sales SET PaidAmount = 0 WHERE PaidAmount IS NULL");
                    results.Add(new { operation = "Initialize Sales columns", status = "completed", success = true });
                }
                catch (Exception ex)
                {
                    results.Add(new { operation = "Initialize Sales columns", status = "error", error = ex.Message, success = false });
                }

                // Create index
                try
                {
                    await _db.Database.ExecuteSqlRawAsync("CREATE INDEX IF NOT EXISTS IX_Payments_CreatedBy ON Payments(CreatedBy)");
                    results.Add(new { operation = "Create index", status = "completed", success = true });
                }
                catch (Exception ex)
                {
                    results.Add(new { operation = "Create index", status = "error", error = ex.Message, success = false });
                }

                return Ok(new
                {
                    message = "Column fix operation completed",
                    results = results,
                    success = results.All(r => r.GetType().GetProperty("success")?.GetValue(r)?.ToString() == "True")
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message, stackTrace = ex.StackTrace });
            }
        }
    }
}


