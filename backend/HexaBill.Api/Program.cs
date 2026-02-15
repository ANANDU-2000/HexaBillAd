/*
Purpose: Program.cs - Main entry point for ASP.NET Core application
Author: AI Assistant
Date: 2024
*/
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Modules.Auth;
using HexaBill.Api.Modules.Billing;
using HexaBill.Api.Modules.Customers;
using HexaBill.Api.Modules.Inventory;
using HexaBill.Api.Modules.Purchases;
using HexaBill.Api.Modules.Payments;
using HexaBill.Api.Modules.Expenses;
using HexaBill.Api.Modules.Reports;
using HexaBill.Api.Modules.Notifications;
using HexaBill.Api.Modules.SuperAdmin;
using HexaBill.Api.Shared.Extensions;
using HexaBill.Api.Shared.Middleware;
using HexaBill.Api.Modules.Subscription;
using HexaBill.Api.Shared.Security;
using HexaBill.Api.Shared.Services;
using HexaBill.Api.Shared.Validation;
using HexaBill.Api.BackgroundJobs;
using HexaBill.Api.Models;
using HexaBill.Api.ModelBinders; // CRITICAL: UTC DateTime model binder
using BCrypt.Net;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection.Extensions;
using System;
using System.IO;
using System.Linq;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

// Configure logging early for better visibility
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();
builder.Logging.SetMinimumLevel(LogLevel.Information);
// Suppress noisy EF Core command logging (only show warnings and errors)
builder.Logging.AddFilter("Microsoft.EntityFrameworkCore.Database.Command", LogLevel.Warning);

// Create logger for startup logging
var logger = LoggerFactory.Create(config => config.AddConsole().AddDebug()).CreateLogger("Startup");

// Add services to the container.
builder.Services.AddControllers(options =>
    {
        // CRITICAL FIX: Register global UTC DateTime model binder
        // Automatically converts ALL query string DateTime parameters to UTC
        // Solves DateTimeKind.Unspecified issue for PostgreSQL
        options.ModelBinderProviders.Insert(0, new UtcDateTimeModelBinderProvider());
    })
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.WriteIndented = true;
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Forwarded headers when behind Render/reverse proxy (fixes "Failed to determine the https port for redirect")
builder.Services.Configure<Microsoft.AspNetCore.Builder.ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor
        | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// Database Configuration
// Support both SQLite (local dev) and PostgreSQL (production)
// Priority: Environment variables > appsettings.json
string? connectionString = null;
bool usePostgreSQL = false;

// Check environment variables FIRST (for Render deployment)
var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
var envConnectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");

logger.LogInformation("Checking connection string sources...");
logger.LogInformation("DATABASE_URL env var: {HasDatabaseUrl}", !string.IsNullOrWhiteSpace(databaseUrl));
logger.LogInformation("ConnectionStrings__DefaultConnection env var: {HasEnvConnection}", !string.IsNullOrWhiteSpace(envConnectionString));

// Priority 1: ConnectionStrings__DefaultConnection environment variable
if (!string.IsNullOrWhiteSpace(envConnectionString))
{
    connectionString = envConnectionString;
    // Detect database type: SQLite uses "Data Source=" or ".db", PostgreSQL uses "Host="
    usePostgreSQL = connectionString.Contains("Host=") || connectionString.Contains("Server=");
    logger.LogInformation($"✅ Using ConnectionStrings__DefaultConnection from environment ({(usePostgreSQL ? "PostgreSQL" : "SQLite")})");
}
// Priority 2: DATABASE_URL from Render (always PostgreSQL)
else if (!string.IsNullOrWhiteSpace(databaseUrl))
{
    try
    {
        logger.LogInformation("Parsing DATABASE_URL: {UrlPrefix}", databaseUrl.Substring(0, Math.Min(20, databaseUrl.Length)) + "...");
        
        // Remove trailing ? if present
        var cleanUrl = databaseUrl.TrimEnd('?');
        var uri = new Uri(cleanUrl);
        
        // Use default PostgreSQL port (5432) if not specified
        var dbPort = uri.Port > 0 ? uri.Port : 5432;
        
        connectionString = $"Host={uri.Host};Port={dbPort};Database={uri.AbsolutePath.TrimStart('/')};Username={uri.UserInfo.Split(':')[0]};Password={uri.UserInfo.Split(':')[1]};SSL Mode=Require;Trust Server Certificate=true";
        usePostgreSQL = true;
        logger.LogInformation("✅ Successfully parsed DATABASE_URL from Render (PostgreSQL)");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "❌ Failed to parse DATABASE_URL: {Message}", ex.Message);
        throw new InvalidOperationException("Invalid DATABASE_URL format", ex);
    }
}
// Priority 3: appsettings.json (for local development)
else
{
    var appSettingsConnection = builder.Configuration.GetConnectionString("DefaultConnection") 
        ?? builder.Configuration.GetConnectionString("PostgreSQL");
    
    // Skip placeholder/empty connection strings
    if (!string.IsNullOrWhiteSpace(appSettingsConnection) && 
        !appSettingsConnection.Contains("Will be overridden", StringComparison.OrdinalIgnoreCase) &&
        !appSettingsConnection.Contains("OVERRIDE", StringComparison.OrdinalIgnoreCase))
    {
        connectionString = appSettingsConnection.Trim();
        // Detect database type: SQLite uses "Data Source=" or ".db", PostgreSQL uses "Host="
        usePostgreSQL = connectionString.Contains("Host=") || connectionString.Contains("Server=");
        
        // For SQLite, ensure absolute path if relative path is provided
        if (!usePostgreSQL && connectionString.StartsWith("Data Source=", StringComparison.OrdinalIgnoreCase))
        {
            var dbPath = connectionString.Substring("Data Source=".Length).Trim();
            // If it's a relative path, make it absolute relative to the application directory
            if (!Path.IsPathRooted(dbPath))
            {
                var appDirectory = Directory.GetCurrentDirectory();
                var absoluteDbPath = Path.GetFullPath(Path.Combine(appDirectory, dbPath));
                connectionString = $"Data Source={absoluteDbPath}";
                logger.LogInformation($"✅ Converted SQLite path to absolute: {absoluteDbPath}");
            }
            else
            {
                connectionString = $"Data Source={Path.GetFullPath(dbPath)}";
            }
        }
        
        logger.LogInformation($"✅ Using connection string from appsettings.json ({(usePostgreSQL ? "PostgreSQL" : "SQLite")})");
        logger.LogInformation($"Connection string length: {connectionString.Length}, starts with: {connectionString.Substring(0, Math.Min(50, connectionString.Length))}");
    }
}

if (string.IsNullOrWhiteSpace(connectionString))
{
    logger.LogError("❌ CRITICAL: No database connection string available!");
    logger.LogError("Please set one of:");
    logger.LogError("  - ConnectionStrings__DefaultConnection environment variable");
    logger.LogError("  - DATABASE_URL environment variable (PostgreSQL)");
    logger.LogError("  - DefaultConnection in appsettings.json");
    throw new InvalidOperationException("Database connection string is required.");
}

// Configure database provider based on connection string type
builder.Services.AddDbContext<AppDbContext>(options =>
{
    if (usePostgreSQL)
    {
        options.UseNpgsql(connectionString);
        logger.LogInformation("✅ PostgreSQL database configured");
    }
    else
    {
        options.UseSqlite(connectionString);
        logger.LogInformation("✅ SQLite database configured");
    }
    options.ConfigureWarnings(w =>
        w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
});

// Security Services
builder.Services.AddSecurityServices(builder.Configuration);

// MULTI-TENANT: Register CompanySettings from configuration
builder.Services.Configure<CompanySettings>(builder.Configuration.GetSection("CompanySettings"));

// Tenant Context Service (CRITICAL: Must be scoped)
builder.Services.AddHttpContextAccessor(); // Required for TenantContextService
builder.Services.AddScoped<ITenantContextService, TenantContextService>();

// Audit Service (CRITICAL: Must be scoped, depends on HttpContextAccessor and TenantContextService)
builder.Services.AddScoped<HexaBill.Api.Shared.Services.IAuditService, HexaBill.Api.Shared.Services.AuditService>();

// Services
builder.Services.AddSingleton<IFontService, FontService>(); // Singleton for font registration
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IProductService, ProductService>();
builder.Services.AddScoped<IExcelImportService, ExcelImportService>();
builder.Services.AddScoped<HexaBill.Api.Modules.Import.ISalesLedgerImportService, HexaBill.Api.Modules.Import.SalesLedgerImportService>();
builder.Services.AddScoped<IInvoiceTemplateService, InvoiceTemplateService>();
builder.Services.AddScoped<ISaleService, SaleService>();
builder.Services.AddScoped<IPurchaseService, PurchaseService>();
builder.Services.AddScoped<ICustomerService, CustomerService>();
builder.Services.AddScoped<IPaymentService, PaymentService>();
builder.Services.AddScoped<IExpenseService, ExpenseService>();
builder.Services.AddScoped<HexaBill.Api.Modules.Branches.IBranchService, HexaBill.Api.Modules.Branches.BranchService>();
builder.Services.AddScoped<HexaBill.Api.Modules.Branches.IRouteService, HexaBill.Api.Modules.Branches.RouteService>();
builder.Services.AddScoped<HexaBill.Api.Shared.Services.IRouteScopeService, HexaBill.Api.Shared.Services.RouteScopeService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<IPdfService, PdfService>();
builder.Services.AddScoped<IBackupService, BackupService>();
builder.Services.AddScoped<IComprehensiveBackupService, ComprehensiveBackupService>();
builder.Services.AddScoped<ICurrencyService, CurrencyService>();
builder.Services.AddScoped<IFileUploadService, FileUploadService>();
builder.Services.AddScoped<IReturnService, ReturnService>();
builder.Services.AddScoped<IProfitService, ProfitService>();
builder.Services.AddScoped<IStockAdjustmentService, StockAdjustmentService>();
builder.Services.AddScoped<ISupplierService, SupplierService>();
builder.Services.AddScoped<IAlertService, AlertService>();
builder.Services.AddScoped<IProductSeedService, ProductSeedService>();
builder.Services.AddScoped<IResetService, ResetService>();
builder.Services.AddScoped<IInvoiceNumberService, InvoiceNumberService>();
builder.Services.AddScoped<IValidationService, ValidationService>();
builder.Services.AddScoped<IBalanceService, BalanceService>();
builder.Services.AddScoped<ISettingsService, SettingsService>(); // Owner-specific company settings
builder.Services.AddSingleton<ITimeZoneService, TimeZoneService>(); // Gulf Standard Time (GST, UTC+4)
builder.Services.AddScoped<IStartupDiagnosticsService, StartupDiagnosticsService>(); // CRITICAL: Startup diagnostics
builder.Services.AddScoped<ISuperAdminTenantService, SuperAdminTenantService>(); // Super Admin tenant management
builder.Services.AddScoped<ISubscriptionService, SubscriptionService>(); // Subscription management
builder.Services.AddScoped<ISignupService, SignupService>(); // Public signup service
builder.Services.AddScoped<HexaBill.Api.Modules.SuperAdmin.IDemoRequestService, HexaBill.Api.Modules.SuperAdmin.DemoRequestService>(); // Demo request approval flow
builder.Services.AddScoped<IErrorLogService, ErrorLogService>(); // Enterprise: persist 500 errors for SuperAdmin
builder.Services.AddScoped<HexaBill.Api.Modules.Automation.IAutomationProvider, HexaBill.Api.Modules.Automation.LogOnlyAutomationProvider>(); // Goal Step 4: log-only, plug WhatsApp/Email later
builder.Services.AddSingleton<HexaBill.Api.Modules.Auth.ILoginLockoutService, HexaBill.Api.Modules.Auth.LoginLockoutService>(); // Login lockout 5 attempts, 15 min

// Background services
builder.Services.AddHostedService<DailyBackupScheduler>();
builder.Services.AddHostedService<AlertCheckBackgroundService>();
builder.Services.AddHostedService<HexaBill.Api.BackgroundJobs.TrialExpiryCheckJob>();
// Data integrity validation service - temporarily disabled
// builder.Services.AddHostedService<HexaBill.Api.Shared.Middleware.DataIntegrityValidationService>();

var app = builder.Build();

// CRITICAL: Global Exception Handler - MUST be FIRST in pipeline to catch all unhandled exceptions
app.UseMiddleware<HexaBill.Api.Shared.Middleware.GlobalExceptionHandlerMiddleware>();

// Get logger from app services
var appLogger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Application");

// Initialize fonts early at startup
appLogger.LogInformation("Initializing font registration...");
var fontService = app.Services.GetRequiredService<IFontService>();
fontService.RegisterFonts();
appLogger.LogInformation("Font registration completed. Arabic font: {Font}", fontService.GetArabicFontFamily());

// Configure URLs - Support Render deployment (PORT env var) and local development
app.Urls.Clear();
var serverPort = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(serverPort) && int.TryParse(serverPort, out int portNumber))
{
    // Render deployment - bind to 0.0.0.0:PORT
    app.Urls.Add($"http://0.0.0.0:{portNumber}");
    appLogger.LogInformation("Server configured to listen on port {Port} (0.0.0.0:{Port})", portNumber, portNumber);
}
else
{
    // Local development - use default port
    app.Urls.Add("http://localhost:5000");
    appLogger.LogInformation("Server configured to listen on http://localhost:5000");
}

// Configure the HTTP request pipeline.
// Forwarded headers first when behind Render/reverse proxy (so HTTPS redirect works)
if (!app.Environment.IsDevelopment())
    app.UseForwardedHeaders();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Serve static files from wwwroot/uploads (for logo and other uploads)
var uploadsPath = Path.Combine(builder.Environment.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads");
if (!Directory.Exists(uploadsPath))
{
    Directory.CreateDirectory(uploadsPath);
}

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsPath),
    RequestPath = "/uploads"
});

// Only enforce HTTPS in non-development (forwarded headers already applied above)
if (!app.Environment.IsDevelopment())
    app.UseHttpsRedirection();

// CORS MUST be before authentication/authorization
app.UseCors(app.Environment.IsDevelopment() ? "Development" : "Production");

// CRITICAL: PostgreSQL Error Monitoring Middleware
app.UseMiddleware<HexaBill.Api.Shared.Middleware.PostgreSqlErrorMonitoringMiddleware>();

// Security middleware (includes rate limiting and security headers)
app.UseSecurityMiddleware(app.Environment);

app.UseAuthentication();

// CRITICAL: Tenant Context Middleware - MUST be after authentication, before authorization
app.UseTenantContext();

// Subscription Middleware - Enforce subscription limits and status
app.UseSubscriptionMiddleware();

app.UseAuthorization();

// Data validation middleware (multi-tenant isolation check)
// Temporarily disabled - will be re-enabled after model updates
// app.UseDataValidation();
app.MapControllers();

// CORS diagnostic endpoint (anonymous for debugging)
app.MapGet("/api/cors-check", (HttpContext context) =>
{
    var allowedOriginsEnv = Environment.GetEnvironmentVariable("ALLOWED_ORIGINS");
    var allowedOriginsConfig = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>();
    
    return new
    {
        corsEnabled = true,
        environment = builder.Environment.EnvironmentName,
        corsPolicy = builder.Environment.IsDevelopment() ? "Development" : "Production",
        envVariable = allowedOriginsEnv ?? "Not Set",
        configOrigins = allowedOriginsConfig ?? Array.Empty<string>(),
        requestOrigin = context.Request.Headers["Origin"].ToString(),
        timestamp = DateTime.UtcNow
    };
}).AllowAnonymous();

// Health check endpoints - /health is lightweight; /health/ready includes DB check
app.MapGet("/health", () => Results.Ok(new { status = "Healthy", timestamp = DateTime.UtcNow })).AllowAnonymous();
app.MapGet("/health/ready", async (HttpContext ctx) =>
{
    try
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        _ = await db.Database.CanConnectAsync();
        return Results.Ok(new { status = "Ready", database = "Connected", timestamp = DateTime.UtcNow });
    }
    catch (Exception ex)
    {
        return Results.Json(new { status = "Unhealthy", database = "Disconnected", error = ex.Message }, statusCode: 503);
    }
}).AllowAnonymous();
app.MapGet("/", () => Results.Ok(new { service = "HexaBill.Api", status = "Running", version = "2.0" })).AllowAnonymous();

// Error monitoring endpoint - shows error statistics
app.MapGet("/api/diagnostics/errors", () =>
{
    var errorStats = HexaBill.Api.Shared.Middleware.PostgreSqlErrorMonitoringMiddleware.GetErrorStatistics();
    return Results.Ok(new
    {
        success = true,
        timestamp = DateTime.UtcNow,
        totalErrors = errorStats.Values.Sum(),
        errorBreakdown = errorStats.OrderByDescending(x => x.Value).ToDictionary(x => x.Key, x => x.Value),
        message = errorStats.Any() ? "Errors detected - see breakdown below" : "No errors recorded"
    });
}).AllowAnonymous();

// Database initialization - run in background, don't block server startup
_ = Task.Run(async () =>
{
    await Task.Delay(3000); // Wait 3 seconds for server to start responding to health checks
    using (var scope = app.Services.CreateScope())
    {
        var initLogger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("DatabaseInit");
        try
        {
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            
            // PostgreSQL - no special initialization needed
            
            // Create performance indexes for large datasets (100K+ records)
            try
            {
                initLogger.LogInformation("Creating performance indexes...");
                
                // Try multiple paths to find the SQL file (works in both local and Docker environments)
                var baseDirectory = AppDomain.CurrentDomain.BaseDirectory;
                var possiblePaths = new[]
                {
                    Path.Combine(baseDirectory, "Migrations", "AddPerformanceIndexes.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "Migrations", "AddPerformanceIndexes.sql"),
                    Path.Combine(baseDirectory, "..", "Migrations", "AddPerformanceIndexes.sql"),
                    Path.Combine(baseDirectory, "..", "..", "Migrations", "AddPerformanceIndexes.sql")
                };
                
                string? indexSql = null;
                string? foundPath = null;
                
                foreach (var path in possiblePaths)
                {
                    if (File.Exists(path))
                    {
                        foundPath = path;
                        indexSql = await File.ReadAllTextAsync(path);
                        break;
                    }
                }
                
                if (!string.IsNullOrEmpty(indexSql))
                {
                    initLogger.LogInformation("Found index SQL file at: {Path}", foundPath);
                    // Execute each CREATE INDEX statement separately (SQLite doesn't support multi-statement in one call)
                    var statements = indexSql.Split(';', StringSplitOptions.RemoveEmptyEntries)
                        .Select(s => s.Trim())
                        .Where(s => !string.IsNullOrEmpty(s) && s.StartsWith("CREATE INDEX", StringComparison.OrdinalIgnoreCase));
                    
                    foreach (var statement in statements)
                    {
                        try
                        {
                            await context.Database.ExecuteSqlRawAsync(statement);
                        }
                        catch (Exception idxEx)
                        {
                            // Index might already exist, ignore
                            if (!idxEx.Message.Contains("already exists", StringComparison.OrdinalIgnoreCase))
                            {
                                initLogger.LogWarning(idxEx, "Index creation warning");
                            }
                        }
                    }
                    initLogger.LogInformation("Performance indexes created/verified");
                }
                else
                {
                    initLogger.LogWarning("Index SQL file not found. Searched paths: {Paths}", string.Join(", ", possiblePaths));
                }
            }
            catch (Exception idxEx)
            {
                initLogger.LogWarning(idxEx, "Index creation skipped (file not found or error)");
            }
            
            // Apply pending migrations FIRST (before any operations)
            try
            {
                initLogger.LogInformation("Checking for pending migrations...");
                
                // Check if database exists and has tables
                bool databaseNeedsCreation = false;
                try
                {
                    // Check if Users table exists (indicates if migrations have been applied)
                    if (context.Database.CanConnect())
                    {
                        var connection = context.Database.GetDbConnection();
                        await connection.OpenAsync();
                        using var command = connection.CreateCommand();
                        
                        // Provider-specific table check
                        if (context.Database.IsNpgsql())
                        {
                            command.CommandText = "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'Users' AND table_schema = 'public'";
                        }
                        else
                        {
                            command.CommandText = "SELECT name FROM sqlite_master WHERE type='table' AND name='Users'";
                        }
                        
                        var result = await command.ExecuteScalarAsync();
                        if (context.Database.IsNpgsql())
                        {
                            databaseNeedsCreation = Convert.ToInt32(result) == 0;
                        }
                        else
                        {
                            databaseNeedsCreation = (result == null || result == DBNull.Value);
                        }
                        await connection.CloseAsync();
                    }
                    else
                    {
                        databaseNeedsCreation = true; // Database doesn't exist
                    }
                }
                catch
                {
                    databaseNeedsCreation = true; // Assume creation needed if check fails
                }
                
                var pending = context.Database.GetPendingMigrations().ToList();
                // PostgreSQL: AddBranchAndRoute is a duplicate full schema (SQLite-oriented). InitialPostgreSQL already created everything. Skip AddBranchAndRoute to avoid 42P07 (already exists) and 42704 (blob).
                const string AddBranchAndRouteMigrationId = "20260214173227_AddBranchAndRoute";
                const string InitialPostgreSQLMigrationId = "20260214070330_InitialPostgreSQL";
                if (context.Database.IsNpgsql() && pending.Contains(AddBranchAndRouteMigrationId))
                {
                    initLogger.LogInformation("PostgreSQL: applying InitialPostgreSQL only, then marking AddBranchAndRoute as applied (schema already exists).");
                    await context.Database.MigrateAsync(InitialPostgreSQLMigrationId);
                    await context.Database.ExecuteSqlRawAsync(
                        "INSERT INTO \"__EFMigrationsHistory\" (\"MigrationId\", \"ProductVersion\") SELECT {0}, '9.0.0' WHERE NOT EXISTS (SELECT 1 FROM \"__EFMigrationsHistory\" WHERE \"MigrationId\" = {0})",
                        AddBranchAndRouteMigrationId, AddBranchAndRouteMigrationId);
                    await HexaBill.Api.Shared.Extensions.PostgresBranchesRoutesSchema.EnsureBranchesAndRoutesSchemaAsync(context, initLogger);
                    initLogger.LogInformation("Database migrations applied successfully (AddBranchAndRoute skipped for PostgreSQL).");
                }
                else if (pending.Any())
                {
                    initLogger.LogInformation("Found {Count} pending migration(s): {Migrations}", pending.Count, string.Join(", ", pending));
                    initLogger.LogInformation("Applying migrations...");
                    await context.Database.MigrateAsync();
                    initLogger.LogInformation("Database migrations applied successfully");
                }
                else if (databaseNeedsCreation)
                {
                    // No migrations but database is empty - use EnsureCreated as fallback
                    initLogger.LogWarning("No migrations found but database is empty - using EnsureCreated()");

                    // CRITICAL FIX: For SQLite, if the file exists but is empty/corrupt, EnsureCreated might verify the file exists and skip schema creation.
                    // We must force delete the database to ensure a clean schema creation.
                    if (!context.Database.IsNpgsql())
                    {
                        initLogger.LogWarning("Performing hard reset of SQLite database to ensure clean schema...");
                        await context.Database.EnsureDeletedAsync();
                    }

                    initLogger.LogInformation("Creating database schema...");
                    await context.Database.EnsureCreatedAsync();
                    initLogger.LogInformation("Database schema created successfully");
                }
                else
                {
                    initLogger.LogInformation("All migrations are up to date");
                }

                // PostgreSQL: ensure Branches/Routes and Sales.BranchId/RouteId exist (when AddBranchAndRoute was skipped)
                if (context.Database.IsNpgsql())
                {
                    try
                    {
                        await HexaBill.Api.Shared.Extensions.PostgresBranchesRoutesSchema.EnsureBranchesAndRoutesSchemaAsync(context, initLogger);
                    }
                    catch (Exception ex)
                    {
                        initLogger.LogWarning(ex, "PostgreSQL ensure Branches/Routes schema: {Message}", ex.Message);
                    }
                }
            }
            catch (Exception ex)
            {
                initLogger.LogError(ex, "❌ CRITICAL: Migration error: {Message}", ex.Message);
                if (ex.InnerException != null)
                {
                    initLogger.LogError("Inner exception: {Message}", ex.InnerException.Message);
                }
                
                // For PostgreSQL, migrations are critical. STOP execution if they fail.
                if (context.Database.IsNpgsql())
                {
                    initLogger.LogError("Terminating startup due to migration failure on production database.");
                    throw; // Re-throw to crash the task/process
                }

                // DatabaseFixer is SQLite-specific - fallback for local dev only
                if (!context.Database.IsNpgsql())
                {
                    initLogger.LogInformation("Attempting to fix missing columns...");
                    try
                    {
                        await HexaBill.Api.Shared.Extensions.DatabaseFixer.FixMissingColumnsAsync(context);
                    }
                    catch (Exception fixEx)
                    {
                        initLogger.LogWarning(fixEx, "Column fix failed");
                    }
                }
            }
            
            // CRITICAL: PostgreSQL Production Schema Validation
            if (context.Database.IsNpgsql())
            {
                try
                {
                    initLogger.LogInformation("Validating PostgreSQL schema...");
                    
                    // Check if critical columns exist in Customers table
                    var checkCustomerColumns = @"
                        SELECT 
                            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Customers' AND column_name = 'TotalSales') AS has_total_sales,
                            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Customers' AND column_name = 'TotalPayments') AS has_total_payments,
                            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Customers' AND column_name = 'PendingBalance') AS has_pending_balance,
                            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Customers' AND column_name = 'Balance') AS has_balance,
                            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Customers' AND column_name = 'CreditLimit') AS has_credit_limit";
                    
                    using (var command = context.Database.GetDbConnection().CreateCommand())
                    {
                        command.CommandText = checkCustomerColumns;
                        await context.Database.OpenConnectionAsync();
                        using (var reader = await command.ExecuteReaderAsync())
                        {
                            if (await reader.ReadAsync())
                            {
                                bool hasTotalSales = reader.GetBoolean(0);
                                bool hasTotalPayments = reader.GetBoolean(1);
                                bool hasPendingBalance = reader.GetBoolean(2);
                                bool hasBalance = reader.GetBoolean(3);
                                bool hasCreditLimit = reader.GetBoolean(4);
                                
                                if (!hasTotalSales || !hasTotalPayments || !hasPendingBalance || !hasBalance || !hasCreditLimit)
                                {
                                    initLogger.LogError("❌ CRITICAL: Missing columns in Customers table!");
                                    initLogger.LogError("   TotalSales: {HasTotalSales}", hasTotalSales);
                                    initLogger.LogError("   TotalPayments: {HasTotalPayments}", hasTotalPayments);
                                    initLogger.LogError("   PendingBalance: {HasPendingBalance}", hasPendingBalance);
                                    initLogger.LogError("   Balance: {HasBalance}", hasBalance);
                                    initLogger.LogError("   CreditLimit: {HasCreditLimit}", hasCreditLimit);
                                    initLogger.LogError("");
                                    initLogger.LogError("⚠️  DATABASE SCHEMA IS INCOMPLETE!");
                                    initLogger.LogError("⚠️  Please run: backend/HexaBill.Api/Scripts/ApplyRenderDatabaseFix.ps1");
                                    initLogger.LogError("⚠️  Or manually execute: backend/HexaBill.Api/Scripts/FixProductionDatabase.sql");
                                    initLogger.LogError("");
                                }
                                else
                                {
                                    initLogger.LogInformation("✅ PostgreSQL schema validation passed");
                                }
                            }
                        }
                        await context.Database.CloseConnectionAsync();
                    }
                }
                catch (Exception schemaEx)
                {
                    initLogger.LogWarning(schemaEx, "PostgreSQL schema validation failed");
                }
            }
            
            // PostgreSQL Alerts table is created via migrations
            
            // DatabaseFixer is SQLite-specific - SKIP for PostgreSQL
            // PostgreSQL schema is managed entirely through EF Core migrations
            if (!context.Database.IsNpgsql())
            {
                // ALWAYS run column fixer as safety net (handles existing columns gracefully)
                // This ensures all required columns exist even if migrations fail
                // Note: This may log "fail" messages for columns that already exist - this is normal and expected
                try
                {
                    initLogger.LogInformation("Running database column fixer (this may show 'fail' logs for existing columns - this is normal)...");
                    await HexaBill.Api.Shared.Extensions.DatabaseFixer.FixMissingColumnsAsync(context);
                    initLogger.LogInformation("Database column fixer completed");
                }
                catch (Exception ex)
                {
                    initLogger.LogError(ex, "Column fixer error: {Message}", ex.Message);
                    if (ex.InnerException != null)
                    {
                        initLogger.LogError("Inner exception: {Message}", ex.InnerException.Message);
                    }
                }
            }
            else
            {
                initLogger.LogInformation("Skipping DatabaseFixer for PostgreSQL (migrations handle schema)");
            }
            
            // Check if database can connect (after migrations)
            if (!context.Database.CanConnect())
            {
                initLogger.LogWarning("Cannot connect to database after migrations. This may indicate a problem.");
            }
            else
            {
                initLogger.LogInformation("Database connection verified");
            }

            // ALWAYS seed/update default users - critical for deployment
            // This ensures admin user exists with correct password even if migrations seeded it differently
            try
            {
                initLogger.LogInformation("Ensuring default users exist with correct passwords...");
                var allUsers = await context.Users.ToListAsync();
                var adminEmail = "admin@hexabill.com".ToLowerInvariant();
                
                // Super Admin user - create or update
                var adminUser = allUsers.FirstOrDefault(u => (u.Email ?? string.Empty).Trim().ToLowerInvariant() == adminEmail);
                var correctAdminPasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!");
                
                if (adminUser == null)
                {
                    // Create new super admin user
                    adminUser = new User
                    {
                        Name = "Super Admin",
                        Email = "admin@hexabill.com",
                        PasswordHash = correctAdminPasswordHash,
                        Role = UserRole.Owner,
                        OwnerId = null, // Super admin has no owner restriction
                        TenantId = null, // CRITICAL: Super admin has no tenant restriction (null = SystemAdmin)
                        Phone = "+971 56 955 22 52",
                        CreatedAt = DateTime.UtcNow
                    };
                    context.Users.Add(adminUser);
                    initLogger.LogInformation("Created default super admin user");
                }
                else
                {
                    // Update existing admin user to ensure it's configured as super admin
                    var testPassword = BCrypt.Net.BCrypt.Verify("Admin123!", adminUser.PasswordHash);
                    if (!testPassword)
                    {
                        adminUser.PasswordHash = correctAdminPasswordHash;
                        initLogger.LogInformation("Updated admin user password to ensure correct hash");
                    }
                    
                    // CRITICAL: Ensure TenantId is null for super admin
                    if (adminUser.TenantId.HasValue)
                    {
                        adminUser.TenantId = null;
                        initLogger.LogInformation("Updated admin user TenantId to null (Super Admin)");
                    }
                    
                    // CRITICAL: Ensure OwnerId is null for super admin
                    if (adminUser.OwnerId.HasValue)
                    {
                        adminUser.OwnerId = null;
                        initLogger.LogInformation("Updated admin user OwnerId to null (Super Admin)");
                    }
                    
                    if (testPassword && !adminUser.TenantId.HasValue && !adminUser.OwnerId.HasValue)
                    {
                        initLogger.LogInformation("Admin user exists with correct password and super admin configuration");
                    }
                }

                // Save all changes
                await context.SaveChangesAsync();
                
                // Verify admin user can login - reload users after save to get updated data
                var updatedUsers = await context.Users.ToListAsync();
                var verifyAdmin = updatedUsers.FirstOrDefault(u => 
                    (u.Email ?? string.Empty).Trim().ToLowerInvariant() == adminEmail);
                if (verifyAdmin != null)
                {
                    var canLogin = BCrypt.Net.BCrypt.Verify("Admin123!", verifyAdmin.PasswordHash);
                    if (canLogin)
                    {
                        initLogger.LogInformation("✅ Admin user verified - login should work with: admin@hexabill.com / Admin123!");
                    }
                    else
                    {
                        initLogger.LogError("❌ Admin user password verification failed - this is a critical error!");
                    }
                }
                else
                {
                    initLogger.LogError("❌ Admin user not found after seeding - this is a critical error!");
                }
                
                // SEED DEMO TENANTS (so tenant users get valid tenant_id in JWT)
                var tenant1 = await context.Tenants.FirstOrDefaultAsync(t => t.Name == "Demo Company 1");
                if (tenant1 == null)
                {
                    tenant1 = new Tenant { Name = "Demo Company 1", Country = "AE", Currency = "AED", Status = TenantStatus.Active, CreatedAt = DateTime.UtcNow };
                    context.Tenants.Add(tenant1);
                    await context.SaveChangesAsync();
                    initLogger.LogInformation("Created demo tenant 1 (Demo Company 1)");
                }
                var tenant2 = await context.Tenants.FirstOrDefaultAsync(t => t.Name == "Demo Company 2");
                if (tenant2 == null)
                {
                    tenant2 = new Tenant { Name = "Demo Company 2", Country = "AE", Currency = "AED", Status = TenantStatus.Active, CreatedAt = DateTime.UtcNow };
                    context.Tenants.Add(tenant2);
                    await context.SaveChangesAsync();
                    initLogger.LogInformation("Created demo tenant 2 (Demo Company 2)");
                }

                // SEED OWNER USERS (with TenantId so JWT has tenant_id claim for product/sales scoping)
                var owner1Email = "owner1@hexabill.com".ToLowerInvariant();
                var owner2Email = "owner2@hexabill.com".ToLowerInvariant();
                var owner1 = await context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == owner1Email);
                var owner2 = await context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == owner2Email);
                var tenant1Id = tenant1.Id;
                var tenant2Id = tenant2.Id;

                if (owner1 == null)
                {
                    owner1 = new User
                    {
                        Name = "Tenant Owner 1",
                        Email = "owner1@hexabill.com",
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword("Owner1@123"),
                        Role = UserRole.Owner,
                        OwnerId = tenant1Id,
                        TenantId = tenant1Id,
                        Phone = "+971 56 955 22 52",
                        CreatedAt = DateTime.UtcNow
                    };
                    context.Users.Add(owner1);
                    initLogger.LogInformation("Created owner1 user (TenantId={TenantId})", tenant1Id);
                }
                else if (!owner1.TenantId.HasValue || owner1.TenantId.Value != tenant1Id)
                {
                    owner1.TenantId = tenant1Id;
                    owner1.OwnerId = tenant1Id;
                    initLogger.LogInformation("Updated owner1 TenantId to {TenantId}", tenant1Id);
                }

                if (owner2 == null)
                {
                    owner2 = new User
                    {
                        Name = "Tenant Owner 2",
                        Email = "owner2@hexabill.com",
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword("Owner2@123"),
                        Role = UserRole.Owner,
                        OwnerId = tenant2Id,
                        TenantId = tenant2Id,
                        Phone = "+971 56 955 22 52",
                        CreatedAt = DateTime.UtcNow
                    };
                    context.Users.Add(owner2);
                    initLogger.LogInformation("Created owner2 user (TenantId={TenantId})", tenant2Id);
                }
                else if (!owner2.TenantId.HasValue || owner2.TenantId.Value != tenant2Id)
                {
                    owner2.TenantId = tenant2Id;
                    owner2.OwnerId = tenant2Id;
                    initLogger.LogInformation("Updated owner2 TenantId to {TenantId}", tenant2Id);
                }

                await context.SaveChangesAsync();
                
                // SEED SETTINGS FOR BOTH OWNERS
                var existingSettings = await context.Settings.ToListAsync();
                if (!existingSettings.Any())
                {
                    initLogger.LogInformation("Seeding company settings...");
                    var settings = new List<Setting>
                    {
                        // Owner 1 Settings
                        new Setting { Key = "VAT_PERCENT", OwnerId = 1, Value = "5" },
                        new Setting { Key = "COMPANY_NAME_EN", OwnerId = 1, Value = "" }, // Tenant-specific, set via tenant settings
                        new Setting { Key = "COMPANY_NAME_AR", OwnerId = 1, Value = "هيكسابيل" },
                        new Setting { Key = "COMPANY_ADDRESS", OwnerId = 1, Value = "Abu Dhabi, United Arab Emirates" },
                        new Setting { Key = "COMPANY_TRN", OwnerId = 1, Value = "105274438800003" },
                        new Setting { Key = "COMPANY_PHONE", OwnerId = 1, Value = "+971 56 955 22 52" },
                        new Setting { Key = "CURRENCY", OwnerId = 1, Value = "AED" },
                        new Setting { Key = "INVOICE_PREFIX", OwnerId = 1, Value = "HB" },
                        new Setting { Key = "VAT_EFFECTIVE_DATE", OwnerId = 1, Value = "01-01-2026" },
                        new Setting { Key = "VAT_LEGAL_TEXT", OwnerId = 1, Value = "VAT registered under Federal Decree-Law No. 8 of 2017, UAE" },
                        
                        // Owner 2 Settings
                        new Setting { Key = "VAT_PERCENT", OwnerId = 2, Value = "5" },
                        new Setting { Key = "COMPANY_NAME_EN", OwnerId = 2, Value = "" }, // Tenant-specific, set via tenant settings
                        new Setting { Key = "COMPANY_NAME_AR", OwnerId = 2, Value = "" }, // Tenant-specific
                        new Setting { Key = "COMPANY_ADDRESS", OwnerId = 2, Value = "Abu Dhabi, United Arab Emirates" },
                        new Setting { Key = "COMPANY_TRN", OwnerId = 2, Value = "105274438800003" },
                        new Setting { Key = "COMPANY_PHONE", OwnerId = 2, Value = "+971 56 955 22 52" },
                        new Setting { Key = "CURRENCY", OwnerId = 2, Value = "AED" },
                        new Setting { Key = "INVOICE_PREFIX", OwnerId = 2, Value = "HB" },
                        new Setting { Key = "VAT_EFFECTIVE_DATE", OwnerId = 2, Value = "01-01-2026" },
                        new Setting { Key = "VAT_LEGAL_TEXT", OwnerId = 2, Value = "VAT registered under Federal Decree-Law No. 8 of 2017, UAE" }
                    };
                    context.Settings.AddRange(settings);
                    await context.SaveChangesAsync();
                    initLogger.LogInformation("✅ Settings seeded for both owners");
                }
                
                // SEED EXPENSE CATEGORIES
                var existingCategories = await context.ExpenseCategories.ToListAsync();
                if (!existingCategories.Any())
                {
                    initLogger.LogInformation("Seeding expense categories...");
                    var categories = new List<ExpenseCategory>
                    {
                        new ExpenseCategory { Name = "Rent", ColorCode = "#EF4444", CreatedAt = DateTime.UtcNow },
                        new ExpenseCategory { Name = "Utilities", ColorCode = "#F59E0B", CreatedAt = DateTime.UtcNow },
                        new ExpenseCategory { Name = "Staff Salary", ColorCode = "#3B82F6", CreatedAt = DateTime.UtcNow },
                        new ExpenseCategory { Name = "Marketing", ColorCode = "#8B5CF6", CreatedAt = DateTime.UtcNow },
                        new ExpenseCategory { Name = "Fuel", ColorCode = "#14B8A6", CreatedAt = DateTime.UtcNow },
                        new ExpenseCategory { Name = "Delivery", ColorCode = "#F97316", CreatedAt = DateTime.UtcNow },
                        new ExpenseCategory { Name = "Food", ColorCode = "#EC4899", CreatedAt = DateTime.UtcNow },
                        new ExpenseCategory { Name = "Maintenance", ColorCode = "#6366F1", CreatedAt = DateTime.UtcNow },
                        new ExpenseCategory { Name = "Insurance", ColorCode = "#10B981", CreatedAt = DateTime.UtcNow },
                        new ExpenseCategory { Name = "Other", ColorCode = "#6B7280", CreatedAt = DateTime.UtcNow }
                    };
                    context.ExpenseCategories.AddRange(categories);
                    await context.SaveChangesAsync();
                    initLogger.LogInformation("✅ Expense categories seeded");
                }
            }
            catch (Exception ex)
            {
                initLogger.LogError(ex, "❌ CRITICAL: User seeding failed - admin login will not work!");
            }

            // CRITICAL: Sync invoice sequence with existing data (PostgreSQL only)
            if (context.Database.IsNpgsql())
            {
                try
                {
                    initLogger.LogInformation("Syncing invoice number sequence with existing data...");
                    
                    // Get the highest invoice number from Sales table
                    var maxInvoiceQuery = @"
                        SELECT COALESCE(MAX(CAST(""InvoiceNo"" AS INTEGER)), 2000) 
                        FROM ""Sales"" 
                        WHERE ""IsDeleted"" = false 
                        AND ""InvoiceNo"" ~ '^[0-9]+$'";
                    
                    using (var command = context.Database.GetDbConnection().CreateCommand())
                    {
                        command.CommandText = maxInvoiceQuery;
                        if (context.Database.GetDbConnection().State != System.Data.ConnectionState.Open)
                        {
                            await context.Database.OpenConnectionAsync();
                        }
                        
                        var result = await command.ExecuteScalarAsync();
                        if (result != null && int.TryParse(result.ToString(), out int maxNum))
                        {
                            // Set sequence to max + 1
                            var nextValue = maxNum + 1;
                            var syncSequenceQuery = $"SELECT setval('invoice_number_seq', {nextValue});";
                            
                            using (var syncCommand = context.Database.GetDbConnection().CreateCommand())
                            {
                                syncCommand.CommandText = syncSequenceQuery;
                                await syncCommand.ExecuteScalarAsync();
                                initLogger.LogInformation("✅ Invoice sequence synced: Current max = {MaxInvoice}, Next will be = {NextValue}", maxNum, nextValue);
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    initLogger.LogWarning(ex, "Invoice sequence sync failed (non-critical)");
                }
            }

            // Seed products from Excel files (if database is empty or has few products)
            try
            {
                initLogger.LogInformation("Checking if product seeding is needed...");
                var productSeedService = scope.ServiceProvider.GetRequiredService<IProductSeedService>();
                await productSeedService.SeedProductsFromExcelAsync();
                initLogger.LogInformation("Product seeding check completed");
            }
            catch (Exception ex)
            {
                initLogger.LogWarning(ex, "Product seeding failed (non-critical - products can be imported manually)");
            }
            
            // CRITICAL: Run comprehensive diagnostics
            try
            {
                initLogger.LogInformation("\n" + new string('=', 80));
                initLogger.LogInformation("🔍 RUNNING STARTUP DIAGNOSTICS");
                initLogger.LogInformation(new string('=', 80));
                
                var diagnosticsService = scope.ServiceProvider.GetRequiredService<IStartupDiagnosticsService>();
                var diagnosticsPassed = await diagnosticsService.RunDiagnosticsAsync();
                
                if (diagnosticsPassed)
                {
                    initLogger.LogInformation("✅ All startup diagnostics PASSED - System is healthy");
                }
                else
                {
                    initLogger.LogWarning("⚠️ Some startup diagnostics FAILED - Check logs above for details");
                }
            }
            catch (Exception diagEx)
            {
                initLogger.LogError(diagEx, "❌ CRITICAL: Startup diagnostics failed with exception");
            }
        }
        catch (Exception ex)
        {
            initLogger.LogError(ex, "Database initialization error");
        }
    }
});

// Start the server - this blocks forever until shutdown signal received
appLogger.LogInformation("Starting server...");
appLogger.LogInformation("Swagger UI available at: {SwaggerUrl}", app.Urls.FirstOrDefault() + "/swagger");
app.Run(); // Blocks here - server runs until SIGTERM/SIGINT received


