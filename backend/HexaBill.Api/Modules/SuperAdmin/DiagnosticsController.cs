using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.SuperAdmin;
using HexaBill.Api.Shared.Extensions;
using HexaBill.Api.Shared.Security;
using HexaBill.Api.Shared.Services;
using System.Diagnostics;

namespace HexaBill.Api.Modules.SuperAdmin
{
    [ApiController]
    [Route("api")] 
    public class DiagnosticsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IConfiguration _config;
        private readonly IFontService _fontService;
        private readonly IErrorLogService _errorLogService;

        public DiagnosticsController(AppDbContext db, IConfiguration config, IFontService fontService, IErrorLogService errorLogService)
        {
            _db = db;
            _config = config;
            _fontService = fontService;
            _errorLogService = errorLogService;
        }

        /// <summary>
        /// PROD-1: Comprehensive health check endpoint
        /// Checks: DB connection, memory usage, server uptime, tenant count
        /// </summary>
        [HttpGet("health")]
        [AllowAnonymous]
        public async Task<IActionResult> Health()
        {
            var health = new
            {
                status = "healthy",
                timestamp = DateTime.UtcNow,
                checks = new Dictionary<string, object>()
            };

            try
            {
                // Check database connection
                var canConnect = await _db.Database.CanConnectAsync();
                health.checks["database"] = new { connected = canConnect };

                if (canConnect)
                {
                    // Check tenant count (basic data access test)
                    var tenantCount = await _db.Tenants.CountAsync();
                    health.checks["tenants"] = new { count = tenantCount };

                    // Check memory usage
                    var memoryUsed = GC.GetTotalMemory(false);
                    var memoryMB = memoryUsed / (1024.0 * 1024.0);
                    var memoryLimitMB = Environment.WorkingSet / (1024.0 * 1024.0);
                    var memoryUsagePercent = (memoryMB / memoryLimitMB) * 100;
                    health.checks["memory"] = new { 
                        usedMB = Math.Round(memoryMB, 2),
                        maxMB = memoryLimitMB,
                        usagePercent = Math.Round(memoryUsagePercent, 2),
                        status = memoryUsagePercent > 90 ? "critical" : memoryUsagePercent > 75 ? "warning" : "healthy"
                    };

                    // AUDIT-11 FIX: Add connection pool monitoring (PostgreSQL only)
                    if (_db.Database.IsNpgsql())
                    {
                        try
                        {
                            var connectionCount = await _db.Database.SqlQueryRaw<int>(
                                "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()"
                            ).FirstOrDefaultAsync();
                            
                            // Default PostgreSQL max connections (can be configured)
                            var maxConnections = 100; // Default for Render PostgreSQL
                            var connectionPoolUsage = (double)connectionCount / maxConnections * 100;
                            
                            health.checks["database"] = new { 
                                connected = canConnect,
                                activeConnections = connectionCount,
                                maxConnections = maxConnections,
                                connectionPoolUsage = Math.Round(connectionPoolUsage, 2),
                                status = connectionPoolUsage > 90 ? "critical" : connectionPoolUsage > 75 ? "warning" : "healthy"
                            };
                        }
                        catch (Exception ex)
                        {
                            // If query fails, just log and continue with basic connection check
                            health.checks["database"] = new { 
                                connected = canConnect,
                                connectionPoolError = "Unable to query connection pool stats"
                            };
                        }
                    }
                    else
                    {
                        health.checks["database"] = new { connected = canConnect };
                    }
                }
                else
                {
                    health.checks["database"] = new { connected = false };
                }

                // Server uptime (approximate)
                var uptime = DateTime.UtcNow - Process.GetCurrentProcess().StartTime.ToUniversalTime();
                health.checks["uptime"] = new { 
                    seconds = (int)uptime.TotalSeconds,
                    formatted = $"{uptime.Days}d {uptime.Hours}h {uptime.Minutes}m"
                };

                return Ok(health);
            }
            catch (Exception ex)
            {
                return StatusCode(503, new
                {
                    status = "unhealthy",
                    timestamp = DateTime.UtcNow,
                    error = ex.Message,
                    checks = health.checks
                });
            }
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

            object resourceUsage = null;
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

                    // Resource usage so Super Admin can see "hitting limits" (memory + DB connections)
                    var memoryUsed = GC.GetTotalMemory(false);
                    var memoryMB = memoryUsed / (1024.0 * 1024.0);
                    var workingSetMB = Environment.WorkingSet / (1024.0 * 1024.0);
                    var memoryUsagePercent = workingSetMB > 0 ? (memoryMB / workingSetMB) * 100 : 0;
                    int activeConnections = 0;
                    int maxConnections = 100;
                    double connectionPoolUsage = 0;
                    if (_db.Database.IsNpgsql())
                    {
                        try
                        {
                            activeConnections = await _db.Database.SqlQueryRaw<int>(
                                "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()"
                            ).FirstOrDefaultAsync();
                            connectionPoolUsage = maxConnections > 0 ? (double)activeConnections / maxConnections * 100 : 0;
                        }
                        catch { /* ignore */ }
                    }
                    resourceUsage = new
                    {
                        memoryUsedMb = Math.Round(memoryMB, 2),
                        workingSetMb = Math.Round(workingSetMB, 2),
                        memoryUsagePercent = Math.Round(memoryUsagePercent, 2),
                        activeConnections,
                        maxConnections,
                        connectionPoolUsagePercent = Math.Round(connectionPoolUsage, 2),
                        limitsHint = memoryUsagePercent > 90 || connectionPoolUsage > 90 ? "critical" : memoryUsagePercent > 75 || connectionPoolUsage > 75 ? "warning" : "ok"
                    };
                }
            }
            catch (Exception ex)
            {
                error = ex.Message;
            }

            var backendUrl = $"{Request.Scheme}://{Request.Host}";
            return Ok(new
            {
                success = error == null,
                timestamp = ts,
                backendUrl,
                database = new { connected = dbOk, error },
                migrations = new { lastApplied = lastMigration, pending },
                companyCount,
                resourceUsage
            });
        }

        /// <summary>Lightweight summary for Super Admin alert bell: unresolved count, last 24h/1h, recent items. (PRODUCTION_MASTER_TODO #49)</summary>
        [HttpGet("superadmin/alert-summary")]
        [Authorize(Roles = "SystemAdmin")]
        public async Task<IActionResult> GetAlertSummary()
        {
            try
            {
                var now = DateTime.UtcNow;
                var last24h = now.AddHours(-24);
                var last1h = now.AddHours(-1);
                var unresolvedCount = await _db.ErrorLogs.CountAsync(e => e.ResolvedAt == null);
                var last24hCount = await _db.ErrorLogs.CountAsync(e => e.CreatedAt >= last24h);
                var last1hCount = await _db.ErrorLogs.CountAsync(e => e.CreatedAt >= last1h);
                var recent = await (from e in _db.ErrorLogs
                    join t in _db.Tenants on e.TenantId equals t.Id into tj
                    from t in tj.DefaultIfEmpty()
                    where e.ResolvedAt == null
                    orderby e.CreatedAt descending
                    select new { e.Id, e.Message, e.TenantId, e.CreatedAt, TenantName = t != null ? t.Name : (string?)null })
                    .Take(5)
                    .ToListAsync();
                return Ok(new
                {
                    success = true,
                    unresolvedCount,
                    last24hCount,
                    last1hCount,
                    recent = recent.Select(r => new { r.Id, r.Message, r.TenantId, r.TenantName, r.CreatedAt })
                });
            }
            catch (PostgresException ex) when (ex.SqlState == "42P01" || ex.SqlState == "42703")
            {
                return Ok(new { success = true, unresolvedCount = 0, last24hCount = 0, last1hCount = 0, recent = Array.Empty<object>() });
            }
            catch (Exception ex) when (ex.InnerException is PostgresException pg && (pg.SqlState == "42P01" || pg.SqlState == "42703"))
            {
                return Ok(new { success = true, unresolvedCount = 0, last24hCount = 0, last1hCount = 0, recent = Array.Empty<object>() });
            }
            catch (Exception ex) when (GetDeepPostgresState(ex) is string state && (state == "42P01" || state == "42703"))
            {
                return Ok(new { success = true, unresolvedCount = 0, last24hCount = 0, last1hCount = 0, recent = Array.Empty<object>() });
            }
        }

        /// <summary>Enterprise: last 100 server errors. SuperAdmin/Admin only. includeResolved=true to show resolved/suppressed entries.</summary>
        [HttpGet("error-logs")]
        [Authorize(Roles = "Admin,Owner,SystemAdmin")]
        public async Task<IActionResult> GetErrorLogs([FromQuery] int limit = 100, [FromQuery] bool includeResolved = false)
        {
            try
            {
                limit = Math.Clamp(limit, 1, 500);
                var query = _db.ErrorLogs.AsQueryable();
                if (!includeResolved)
                    query = query.Where(e => e.ResolvedAt == null);
                var list = await (from e in query
                    join t in _db.Tenants on e.TenantId equals t.Id into tj
                    from t in tj.DefaultIfEmpty()
                    orderby e.CreatedAt descending
                    select new
                    {
                        e.Id,
                        e.TraceId,
                        e.ErrorCode,
                        e.Message,
                        e.Path,
                        e.Method,
                        e.TenantId,
                        e.UserId,
                        e.CreatedAt,
                        e.ResolvedAt,
                        TenantName = t != null ? t.Name : (string?)null
                    })
                    .Take(limit)
                    .ToListAsync();
                return Ok(new { success = true, count = list.Count, items = list });
            }
            catch (PostgresException ex) when (ex.SqlState == "42P01" || ex.SqlState == "42703")
            {
                return Ok(new { success = true, count = 0, items = Array.Empty<object>() });
            }
            catch (Exception ex) when (ex.InnerException is PostgresException pg && (pg.SqlState == "42P01" || pg.SqlState == "42703"))
            {
                return Ok(new { success = true, count = 0, items = Array.Empty<object>() });
            }
            catch (Exception ex) when (GetDeepPostgresState(ex) is string state && (state == "42P01" || state == "42703"))
            {
                return Ok(new { success = true, count = 0, items = Array.Empty<object>() });
            }
        }

        /// <summary>Mark an error log as resolved/suppressed so it can be hidden from the default list.</summary>
        [HttpPatch("error-logs/{id}/resolve")]
        [Authorize(Roles = "Admin,Owner,SystemAdmin")]
        public async Task<IActionResult> ResolveErrorLog(int id)
        {
            var entry = await _db.ErrorLogs.FindAsync(id);
            if (entry == null)
                return NotFound(new { success = false, message = "Error log not found." });
            entry.ResolvedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(new { success = true, message = "Marked as resolved.", resolvedAt = entry.ResolvedAt });
        }

        /// <summary>Client-reported errors (e.g. "Service temporarily unavailable", connection refused). Stored in ErrorLogs so Super Admin can see them.</summary>
        [HttpPost("error-logs/client")]
        [Authorize(Roles = "Admin,Owner,SystemAdmin,Staff")]
        public async Task<IActionResult> PostClientError([FromBody] ClientErrorRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest(new { success = false, message = "Message is required." });
            }
            var message = request.Message.Length > 1900 ? request.Message[..1900] : request.Message;
            var path = (request.Path ?? "").Length > 450 ? request.Path[..450] : request.Path;
            var traceId = "client-" + Guid.NewGuid().ToString("N")[..12];
            int? tenantId = User?.GetTenantIdOrNullForSystemAdmin();
            int? userId = int.TryParse(User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var uid) ? uid : (int?)null;
            var fullMessage = request.Count > 1
                ? $"[Client] {message} (occurred {request.Count} times)"
                : $"[Client] {message}";
            await _errorLogService.LogAsync(traceId, "CLIENT", fullMessage, null, path, request.Method ?? "GET", tenantId, userId);
            return Ok(new { success = true, traceId });
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
                    a.OldValues,
                    a.NewValues,
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
                        var connection = _db.Database.GetDbConnection();
                        await connection.OpenAsync();
                        var command = connection.CreateCommand();
                        command.CommandText = _db.Database.IsNpgsql()
                            ? "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;"
                            : "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;";
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

        /// <summary>Compare EF model vs production DB: report missing tables and optional critical columns. SystemAdmin only. Use in production to find migration/schema drift (42P01, 42703).</summary>
        [HttpGet("schema-check")]
        [Authorize(Roles = "SystemAdmin")]
        public async Task<IActionResult> SchemaCheck()
        {
            if (!_db.Database.IsNpgsql())
            {
                return Ok(new { success = true, message = "Schema check is only supported for PostgreSQL.", missingTables = Array.Empty<string>(), missingColumns = Array.Empty<object>() });
            }
            try
            {
                // Tables the app expects (from EF model / migrations). Add new ones here when you add entities.
                var expectedTables = new[]
                {
                    "Alerts", "AuditLogs", "BranchStaff", "Branches", "CreditNotes", "CustomerVisits", "Customers", "DamageCategories", "DamageInventories",
                    "DemoRequests", "ErrorLogs", "ExpenseCategories", "Expenses", "FailedLoginAttempts", "HeldInvoices", "InventoryTransactions", "InvoiceTemplates",
                    "InvoiceVersions", "PaymentIdempotencies", "Payments", "PriceChangeLogs", "ProductCategories", "Products", "PurchaseReturnItems", "PurchaseReturns",
                    "PurchaseItems", "Purchases", "RecurringExpenses", "RouteCustomers", "RouteExpenses", "RouteStaff", "Routes", "SaleReturnItems", "SaleReturns",
                    "SaleItems", "Sales", "Settings", "SubscriptionPlans", "Subscriptions", "Tenants", "UserSessions", "Users"
                };

                var existingTables = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                var connection = _db.Database.GetDbConnection();
                var wasOpen = connection.State == System.Data.ConnectionState.Open;
                if (!wasOpen) await connection.OpenAsync();
                try
                {
                    using var cmd = connection.CreateCommand();
                    cmd.CommandText = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'";
                    using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                        existingTables.Add(reader.GetString(0));
                }
                finally
                {
                    if (!wasOpen) connection.Close();
                }

                var missingTables = expectedTables.Where(t => !existingTables.Contains(t)).OrderBy(t => t).ToList();

                // Critical columns we've hit in production (table, column) - report if missing
                var criticalColumns = new[] { ("ErrorLogs", "ResolvedAt"), ("SaleReturns", "ReturnCategory"), ("SaleReturnItems", "DamageCategoryId"), ("SaleReturnItems", "Condition"), ("Sales", "BranchId"), ("Sales", "RouteId"), ("Branches", "IsActive"), ("Routes", "IsActive") };
                var missingColumns = new List<object>();
                if (!wasOpen) await connection.OpenAsync();
                foreach (var (tableName, columnName) in criticalColumns)
                {
                    if (!existingTables.Contains(tableName)) continue; // table missing is already in missingTables
                    using var cmd2 = connection.CreateCommand();
                    cmd2.CommandText = "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND LOWER(table_name) = @t AND LOWER(column_name) = @c LIMIT 1";
                    var pt = cmd2.CreateParameter();
                    pt.ParameterName = "t";
                    pt.Value = tableName.ToLowerInvariant();
                    cmd2.Parameters.Add(pt);
                    var pc = cmd2.CreateParameter();
                    pc.ParameterName = "c";
                    pc.Value = columnName.ToLowerInvariant();
                    cmd2.Parameters.Add(pc);
                    var exists = await cmd2.ExecuteScalarAsync();
                    if (exists == null || exists is DBNull)
                        missingColumns.Add(new { table = tableName, column = columnName });
                }

                return Ok(new
                {
                    success = true,
                    expectedTableCount = expectedTables.Length,
                    existingTableCount = existingTables.Count,
                    missingTables,
                    missingColumns,
                    message = missingTables.Count > 0 || missingColumns.Count > 0
                        ? "Fix by running migrations (POST /api/migrate) or adding CREATE TABLE/ALTER in Program.cs startup."
                        : "Schema matches EF model (no missing tables or critical columns)."
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, error = ex.Message, stackTrace = ex.StackTrace });
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
                // PostgreSQL: migrations handle schema. This fix is SQLite-only (legacy).
                if (_db.Database.IsNpgsql())
                {
                    return Ok(new { message = "fix-columns is SQLite-only; PostgreSQL uses migrations", results = Array.Empty<object>(), success = true });
                }

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

        /// <summary>Unwrap nested exceptions to find PostgresException.SqlState (42P01, 42703) for missing table/column.</summary>
        private static string? GetDeepPostgresState(Exception? ex)
        {
            for (var e = ex; e != null; e = e.InnerException)
            {
                if (e is PostgresException pg)
                    return pg.SqlState;
            }
            return null;
        }
    }

    public class ClientErrorRequest
    {
        public string Message { get; set; } = string.Empty;
        public string? Path { get; set; }
        public string? Method { get; set; }
        public int Count { get; set; } = 1;
    }
}


