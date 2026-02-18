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
    usePostgreSQL = connectionString.Contains("Host=") || connectionString.Contains("Server=");
    var includeErrorDetail = string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Development", StringComparison.OrdinalIgnoreCase)
        || string.Equals(Environment.GetEnvironmentVariable("INCLUDE_PG_ERROR_DETAIL"), "true", StringComparison.OrdinalIgnoreCase);
    if (usePostgreSQL && includeErrorDetail && !connectionString.Contains("Include Error Detail", StringComparison.OrdinalIgnoreCase))
        connectionString += ";Include Error Detail=true";
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
        // Password may contain ':' or '@' - split only on first colon (Render/standard format: user:password)
        var userInfo = uri.UserInfo ?? "";
        var firstColon = userInfo.IndexOf(':');
        var username = firstColon >= 0 ? userInfo.Substring(0, firstColon) : userInfo;
        var password = firstColon >= 0 ? userInfo.Substring(firstColon + 1) : "";
        
        connectionString = $"Host={uri.Host};Port={dbPort};Database={uri.AbsolutePath.TrimStart('/')};Username={username};Password={password};SSL Mode=Require;Trust Server Certificate=true";
        // Include Error Detail in Development or when explicitly requested (needed to diagnose DbUpdateException)
        var includeErrorDetail = string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Development", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Environment.GetEnvironmentVariable("INCLUDE_PG_ERROR_DETAIL"), "true", StringComparison.OrdinalIgnoreCase);
        if (includeErrorDetail && !connectionString.Contains("Include Error Detail", StringComparison.OrdinalIgnoreCase))
            connectionString += ";Include Error Detail=true";
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
        // For 2000+ tenants or multiple instances, use PgBouncer (point connection string to pooler) or set Maximum Pool Size in connection string. See docs/CONNECTION_POOLING_AND_PGBOUNCER.md.
        options.UseNpgsql(connectionString, npgsqlOptions =>
        {
            // PROD-14: Add query timeout guard (30 seconds) - prevents long-running queries from hanging
            npgsqlOptions.CommandTimeout(30);
            // Enable retry on transient failures
            npgsqlOptions.EnableRetryOnFailure(
                maxRetryCount: 3,
                maxRetryDelay: TimeSpan.FromSeconds(5),
                errorCodesToAdd: null);
        });
        logger.LogInformation("✅ PostgreSQL database configured with 30s timeout and retry policy");
    }
    else
    {
        options.UseSqlite(connectionString, sqliteOptions =>
        {
            // PROD-14: Add query timeout guard (30 seconds) for SQLite as well
            sqliteOptions.CommandTimeout(30);
        });
        logger.LogInformation("✅ SQLite database configured with 30s timeout");
    }
    options.ConfigureWarnings(w =>
        w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
    
    // PROD-16: Enable slow query logging (>500ms) via EF Core logging
    // Log slow queries to console with details
    options.LogTo(
        message => 
        {
            // Parse EF Core log messages for slow queries
            if (message.Contains("CommandExecuted") && message.Contains("ms"))
            {
                // Extract duration from log message (format: "Executed DbCommand (XXXms)")
                var msMatch = System.Text.RegularExpressions.Regex.Match(message, @"\((\d+)ms\)");
                if (msMatch.Success && int.TryParse(msMatch.Groups[1].Value, out var duration) && duration > 500)
                {
                    Console.WriteLine($"[SLOW QUERY] {message}");
                }
            }
        },
        Microsoft.Extensions.Logging.LogLevel.Information,
        Microsoft.EntityFrameworkCore.Diagnostics.DbContextLoggerOptions.None);
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
// BUG #2.2 FIX: Use R2 storage if configured, otherwise fallback to local disk storage
var r2Endpoint = Environment.GetEnvironmentVariable("R2_ENDPOINT") ?? builder.Configuration["R2Settings:Endpoint"] ?? builder.Configuration["CloudflareR2:Endpoint"];
var r2AccessKey = Environment.GetEnvironmentVariable("R2_ACCESS_KEY") ?? builder.Configuration["R2Settings:AccessKey"] ?? builder.Configuration["CloudflareR2:AccessKey"];
var r2SecretKey = Environment.GetEnvironmentVariable("R2_SECRET_KEY") ?? builder.Configuration["R2Settings:SecretKey"] ?? builder.Configuration["CloudflareR2:SecretKey"];

if (!string.IsNullOrWhiteSpace(r2Endpoint) && !string.IsNullOrWhiteSpace(r2AccessKey) && !string.IsNullOrWhiteSpace(r2SecretKey))
{
    builder.Services.AddScoped<IFileUploadService, R2FileUploadService>();
    logger.LogInformation("✅ Cloudflare R2 storage enabled for file uploads");
}
else
{
    builder.Services.AddScoped<IFileUploadService, FileUploadService>();
    logger.LogWarning("⚠️ R2 storage not configured - using local disk storage (files will be lost on server restart/deploy). Set R2_ENDPOINT, R2_ACCESS_KEY, and R2_SECRET_KEY to enable R2 storage.");
}
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
// BUG #2.4 FIX: Automation provider - use EmailAutomationProvider if SMTP is configured, otherwise LogOnlyAutomationProvider
// Check for SMTP configuration (environment variables or appsettings)
var smtpHost = Environment.GetEnvironmentVariable("SMTP_HOST") ?? builder.Configuration["EmailSettings:SmtpHost"] ?? builder.Configuration["BackupSettings:Email:SmtpServer"];
var smtpUser = Environment.GetEnvironmentVariable("SMTP_USER") ?? builder.Configuration["EmailSettings:SmtpUser"] ?? builder.Configuration["BackupSettings:Email:Username"];
var smtpPass = Environment.GetEnvironmentVariable("SMTP_PASS") ?? builder.Configuration["EmailSettings:SmtpPassword"] ?? builder.Configuration["BackupSettings:Email:Password"];
var emailEnabled = Environment.GetEnvironmentVariable("EMAIL_ENABLED") ?? builder.Configuration["EmailSettings:Enabled"] ?? builder.Configuration["BackupSettings:Email:Enabled"];

bool useEmailProvider = !string.IsNullOrWhiteSpace(smtpHost) && 
                        !string.IsNullOrWhiteSpace(smtpUser) && 
                        !string.IsNullOrWhiteSpace(smtpPass) &&
                        (emailEnabled == "true" || emailEnabled == "True" || emailEnabled == "1");

if (useEmailProvider)
{
    builder.Services.AddScoped<HexaBill.Api.Modules.Automation.IAutomationProvider, HexaBill.Api.Modules.Automation.EmailAutomationProvider>();
    logger.LogInformation("✅ Email automation enabled - using EmailAutomationProvider (SMTP configured)");
}
else
{
    builder.Services.AddScoped<HexaBill.Api.Modules.Automation.IAutomationProvider, HexaBill.Api.Modules.Automation.LogOnlyAutomationProvider>();
    logger.LogWarning("⚠️ Email automation disabled - using LogOnlyAutomationProvider. Set SMTP_HOST, SMTP_USER, SMTP_PASS environment variables to enable email sending.");
}
// BUG #2.7 FIX: Login lockout service - changed to Scoped (requires DbContext) and async methods
builder.Services.AddScoped<HexaBill.Api.Modules.Auth.ILoginLockoutService, HexaBill.Api.Modules.Auth.LoginLockoutService>(); // Login lockout 5 attempts, 15 min (persistent in PostgreSQL)
builder.Services.AddSingleton<HexaBill.Api.Shared.Services.ITenantActivityService, HexaBill.Api.Shared.Services.TenantActivityService>(); // SuperAdmin Live Activity

// Background services
builder.Services.AddHostedService<DailyBackupScheduler>();
builder.Services.AddHostedService<AlertCheckBackgroundService>();
builder.Services.AddHostedService<HexaBill.Api.BackgroundJobs.TrialExpiryCheckJob>();
// Data integrity validation service - temporarily disabled
// builder.Services.AddHostedService<HexaBill.Api.Shared.Middleware.DataIntegrityValidationService>();

var app = builder.Build();

// CRITICAL: Add SessionVersion + fix IsActive BEFORE any requests (fixes 42703, 42804)
using (var scope = app.Services.CreateScope())
{
    var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (ctx.Database.IsNpgsql())
    {
        try
        {
            // Users table columns - use PostgreSQL native IF NOT EXISTS (PostgreSQL 9.6+)
            ctx.Database.ExecuteSqlRaw(@"ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""SessionVersion"" integer NOT NULL DEFAULT 0;");
            ctx.Database.ExecuteSqlRaw(@"ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""ProfilePhotoUrl"" character varying(500) NULL;");
            ctx.Database.ExecuteSqlRaw(@"ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""LanguagePreference"" character varying(10) NULL;");
            ctx.Database.ExecuteSqlRaw(@"ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""LastLoginAt"" timestamp with time zone NULL;");
            ctx.Database.ExecuteSqlRaw(@"ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""LastActiveAt"" timestamp with time zone NULL;");
            // Customers table columns
            ctx.Database.ExecuteSqlRaw(@"ALTER TABLE ""Customers"" ADD COLUMN IF NOT EXISTS ""PaymentTerms"" character varying(100) NULL;");
            ctx.Database.ExecuteSqlRaw(@"ALTER TABLE ""Customers"" ADD COLUMN IF NOT EXISTS ""BranchId"" integer NULL;");
            ctx.Database.ExecuteSqlRaw(@"ALTER TABLE ""Customers"" ADD COLUMN IF NOT EXISTS ""RouteId"" integer NULL;");
            ctx.Database.ExecuteSqlRaw(@"
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND LOWER(table_name)=LOWER('Routes') AND LOWER(column_name)=LOWER('IsActive') AND data_type IN ('integer','smallint')) THEN
                        ALTER TABLE ""Routes"" ALTER COLUMN ""IsActive"" DROP DEFAULT, ALTER COLUMN ""IsActive"" TYPE boolean USING (CASE WHEN ""IsActive""::int=0 THEN false ELSE true END), ALTER COLUMN ""IsActive"" SET DEFAULT false;
                    END IF;
                END $$");
            ctx.Database.ExecuteSqlRaw(@"
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND LOWER(table_name)=LOWER('Branches') AND LOWER(column_name)=LOWER('IsActive') AND data_type IN ('integer','smallint')) THEN
                        ALTER TABLE ""Branches"" ALTER COLUMN ""IsActive"" DROP DEFAULT, ALTER COLUMN ""IsActive"" TYPE boolean USING (CASE WHEN ""IsActive""::int=0 THEN false ELSE true END), ALTER COLUMN ""IsActive"" SET DEFAULT false;
                    END IF;
                END $$");
            // Routes and Branches IsActive - use native IF NOT EXISTS
            ctx.Database.ExecuteSqlRaw(@"ALTER TABLE ""Routes"" ADD COLUMN IF NOT EXISTS ""IsActive"" boolean NOT NULL DEFAULT true;");
            ctx.Database.ExecuteSqlRaw(@"ALTER TABLE ""Branches"" ADD COLUMN IF NOT EXISTS ""IsActive"" boolean NOT NULL DEFAULT true;");
            // Products table columns - Barcode, ImageUrl, CategoryId, IsActive
            ctx.Database.ExecuteSqlRaw(@"ALTER TABLE ""Products"" ADD COLUMN IF NOT EXISTS ""Barcode"" character varying(100) NULL;");
            ctx.Database.ExecuteSqlRaw(@"ALTER TABLE ""Products"" ADD COLUMN IF NOT EXISTS ""ImageUrl"" character varying(500) NULL;");
            ctx.Database.ExecuteSqlRaw(@"ALTER TABLE ""Products"" ADD COLUMN IF NOT EXISTS ""CategoryId"" integer NULL;");
            ctx.Database.ExecuteSqlRaw(@"ALTER TABLE ""Products"" ADD COLUMN IF NOT EXISTS ""IsActive"" boolean NOT NULL DEFAULT true;");
            // Expenses table columns - use native IF NOT EXISTS
            ctx.Database.ExecuteSqlRaw(@"ALTER TABLE ""Expenses"" ADD COLUMN IF NOT EXISTS ""AttachmentUrl"" character varying(500) NULL;");
            ctx.Database.ExecuteSqlRaw(@"ALTER TABLE ""Expenses"" ADD COLUMN IF NOT EXISTS ""Status"" integer NOT NULL DEFAULT 1;");
            ctx.Database.ExecuteSqlRaw(@"ALTER TABLE ""Expenses"" ADD COLUMN IF NOT EXISTS ""RecurringExpenseId"" integer NULL;");
            ctx.Database.ExecuteSqlRaw(@"ALTER TABLE ""Expenses"" ADD COLUMN IF NOT EXISTS ""ApprovedBy"" integer NULL;");
            ctx.Database.ExecuteSqlRaw(@"ALTER TABLE ""Expenses"" ADD COLUMN IF NOT EXISTS ""ApprovedAt"" timestamp with time zone NULL;");
            ctx.Database.ExecuteSqlRaw(@"ALTER TABLE ""Expenses"" ADD COLUMN IF NOT EXISTS ""RejectionReason"" text NULL;");
            ctx.Database.ExecuteSqlRaw(@"ALTER TABLE ""Expenses"" ADD COLUMN IF NOT EXISTS ""RouteId"" integer NULL;");
            // UserSessions table for "who is logged in" / recent logins
            ctx.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS ""UserSessions"" (
                    ""Id"" serial PRIMARY KEY,
                    ""UserId"" integer NOT NULL,
                    ""TenantId"" integer NOT NULL,
                    ""LoginAt"" timestamp with time zone NOT NULL,
                    ""UserAgent"" character varying(500) NULL,
                    ""IpAddress"" character varying(45) NULL,
                    CONSTRAINT ""FK_UserSessions_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users""(""Id"") ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS ""IX_UserSessions_TenantId"" ON ""UserSessions"" (""TenantId"");
                CREATE INDEX IF NOT EXISTS ""IX_UserSessions_LoginAt"" ON ""UserSessions"" (""LoginAt"");
                ");
        }
        catch (Exception ex)
        {
            // Log but don't crash - migration errors are non-fatal (columns may already exist)
            var startupLogger = app.Services.GetService<ILoggerFactory>()?.CreateLogger("DatabaseInit");
            var errorMsg = ex.Message ?? "";
            // Only log if it's NOT a "column already exists" or "duplicate" error
            if (!errorMsg.Contains("already exists", StringComparison.OrdinalIgnoreCase) &&
                !errorMsg.Contains("duplicate", StringComparison.OrdinalIgnoreCase) &&
                !errorMsg.Contains("42701", StringComparison.OrdinalIgnoreCase))
            {
                startupLogger?.LogWarning(ex, "PostgreSQL migration warning (non-fatal): {Message}", errorMsg);
            }
        }
    }
    else if (ctx.Database.IsSqlite())
    {
        // CRITICAL: Add User columns and UserSessions BEFORE any requests (fixes "no such column: u.LanguagePreference" on login)
        try { ctx.Database.ExecuteSqlRaw("ALTER TABLE Users ADD COLUMN SessionVersion INTEGER NOT NULL DEFAULT 0"); } catch { }
        try { ctx.Database.ExecuteSqlRaw("ALTER TABLE Users ADD COLUMN ProfilePhotoUrl TEXT NULL"); } catch { }
        try { ctx.Database.ExecuteSqlRaw("ALTER TABLE Users ADD COLUMN LanguagePreference TEXT NULL"); } catch { }
        try { ctx.Database.ExecuteSqlRaw("ALTER TABLE Users ADD COLUMN LastLoginAt TEXT NULL"); } catch { }
        try { ctx.Database.ExecuteSqlRaw("ALTER TABLE Users ADD COLUMN LastActiveAt TEXT NULL"); } catch { }
        try
        {
            ctx.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS UserSessions (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    UserId INTEGER NOT NULL,
                    TenantId INTEGER NOT NULL,
                    LoginAt TEXT NOT NULL,
                    UserAgent TEXT NULL,
                    IpAddress TEXT NULL,
                    FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
                )");
            ctx.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_UserSessions_TenantId ON UserSessions (TenantId)");
            ctx.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_UserSessions_LoginAt ON UserSessions (LoginAt)");
        }
        catch { /* table may already exist */ }
        // BUG #2.7 FIX: FailedLoginAttempts table - persistent login lockout tracking
        try
        {
            if (ctx.Database.IsNpgsql())
            {
                ctx.Database.ExecuteSqlRaw(@"
                    CREATE TABLE IF NOT EXISTS ""FailedLoginAttempts"" (
                        ""Id"" SERIAL PRIMARY KEY,
                        ""Email"" VARCHAR(100) NOT NULL UNIQUE,
                        ""FailedCount"" INTEGER NOT NULL DEFAULT 1,
                        ""LockoutUntil"" TIMESTAMP NULL,
                        ""LastAttemptAt"" TIMESTAMP NOT NULL,
                        ""CreatedAt"" TIMESTAMP NOT NULL,
                        ""UpdatedAt"" TIMESTAMP NULL
                    )");
                ctx.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_FailedLoginAttempts_Email ON \"FailedLoginAttempts\" (\"Email\")");
                ctx.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_FailedLoginAttempts_LockoutUntil ON \"FailedLoginAttempts\" (\"LockoutUntil\")");
                ctx.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_FailedLoginAttempts_LastAttemptAt ON \"FailedLoginAttempts\" (\"LastAttemptAt\")");
            }
            else
            {
                ctx.Database.ExecuteSqlRaw(@"
                    CREATE TABLE IF NOT EXISTS FailedLoginAttempts (
                        Id INTEGER PRIMARY KEY AUTOINCREMENT,
                        Email TEXT NOT NULL UNIQUE,
                        FailedCount INTEGER NOT NULL DEFAULT 1,
                        LockoutUntil TEXT NULL,
                        LastAttemptAt TEXT NOT NULL,
                        CreatedAt TEXT NOT NULL,
                        UpdatedAt TEXT NULL
                    )");
                ctx.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_FailedLoginAttempts_Email ON FailedLoginAttempts (Email)");
                ctx.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_FailedLoginAttempts_LockoutUntil ON FailedLoginAttempts (LockoutUntil)");
                ctx.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_FailedLoginAttempts_LastAttemptAt ON FailedLoginAttempts (LastAttemptAt)");
            }
        }
        catch { /* table may already exist */ }
        // Expenses table - fixes 500 on /api/expenses (prevents server from crashing when dashboard loads)
        try { ctx.Database.ExecuteSqlRaw("ALTER TABLE Expenses ADD COLUMN AttachmentUrl TEXT NULL"); } catch { }
        try { ctx.Database.ExecuteSqlRaw("ALTER TABLE Expenses ADD COLUMN Status INTEGER NOT NULL DEFAULT 1"); } catch { }
        try { ctx.Database.ExecuteSqlRaw("ALTER TABLE Expenses ADD COLUMN RecurringExpenseId INTEGER NULL"); } catch { }
        try { ctx.Database.ExecuteSqlRaw("ALTER TABLE Expenses ADD COLUMN ApprovedBy INTEGER NULL"); } catch { }
        try { ctx.Database.ExecuteSqlRaw("ALTER TABLE Expenses ADD COLUMN ApprovedAt TEXT NULL"); } catch { }
        try { ctx.Database.ExecuteSqlRaw("ALTER TABLE Expenses ADD COLUMN RejectionReason TEXT NULL"); } catch { }
        try { ctx.Database.ExecuteSqlRaw("ALTER TABLE Expenses ADD COLUMN RouteId INTEGER NULL"); } catch { }
        // RecurringExpenses table - fixes 500 on /api/expenses/recurring when migrations did not run
        try
        {
            ctx.Database.ExecuteSqlRaw(@"
                CREATE TABLE IF NOT EXISTS RecurringExpenses (
                    Id INTEGER PRIMARY KEY AUTOINCREMENT,
                    OwnerId INTEGER NOT NULL,
                    TenantId INTEGER NULL,
                    BranchId INTEGER NULL,
                    CategoryId INTEGER NOT NULL,
                    Amount TEXT NOT NULL,
                    Note TEXT NULL,
                    Frequency INTEGER NOT NULL,
                    DayOfRecurrence INTEGER NULL,
                    StartDate TEXT NOT NULL,
                    EndDate TEXT NULL,
                    IsActive INTEGER NOT NULL DEFAULT 1,
                    CreatedBy INTEGER NOT NULL,
                    CreatedAt TEXT NOT NULL,
                    UpdatedAt TEXT NOT NULL,
                    FOREIGN KEY (CategoryId) REFERENCES ExpenseCategories(Id) ON DELETE CASCADE,
                    FOREIGN KEY (BranchId) REFERENCES Branches(Id),
                    FOREIGN KEY (CreatedBy) REFERENCES Users(Id) ON DELETE CASCADE
                )");
            ctx.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_RecurringExpenses_TenantId ON RecurringExpenses (TenantId)");
            ctx.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_RecurringExpenses_BranchId ON RecurringExpenses (BranchId)");
            ctx.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_RecurringExpenses_CategoryId ON RecurringExpenses (CategoryId)");
        }
        catch { /* table may already exist */ }
        // ErrorLogs.ResolvedAt - fixes 500 on /api/superadmin/alert-summary and /api/error-logs (SQLite)
        try { ctx.Database.ExecuteSqlRaw("ALTER TABLE ErrorLogs ADD COLUMN ResolvedAt TEXT NULL"); } catch { }
    }
}

// AUDIT-5: Migration check on startup - log warning if pending migrations
using (var scope = app.Services.CreateScope())
{
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var pendingMigrations = await db.Database.GetPendingMigrationsAsync();
        if (pendingMigrations.Any())
        {
            var startupLogger = app.Services.GetService<ILoggerFactory>()?.CreateLogger("MigrationCheck");
            startupLogger?.LogWarning("Pending migrations detected: {Count} - {Migrations}", pendingMigrations.Count(), string.Join(", ", pendingMigrations));
        }
    }
    catch (Exception ex)
    {
        var startupLogger = app.Services.GetService<ILoggerFactory>()?.CreateLogger("MigrationCheck");
        startupLogger?.LogWarning(ex, "Could not check pending migrations");
    }
}

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

// BUG #2.6 FIX: Only enable Swagger in Development mode (explicit check to prevent exposure in production)
// On Render, ASPNETCORE_ENVIRONMENT defaults to 'Production' string, but we check explicitly
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    // Explicitly disable Swagger in production - return 404 for /swagger endpoints
    app.Use(async (context, next) =>
    {
        if (context.Request.Path.StartsWithSegments("/swagger"))
        {
            context.Response.StatusCode = 404;
            await context.Response.WriteAsync("Not Found");
            return;
        }
        await next();
    });
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

// PROD-2: Request logging middleware - Logs TenantId, endpoint, duration, status code, correlation ID
app.UseRequestLogging();

// PROD-16: Slow query logging middleware - Logs queries >500ms with details
app.UseSlowQueryLogging();

// Security middleware (includes rate limiting and security headers)
app.UseSecurityMiddleware(app.Environment);

app.UseAuthentication();

// CRITICAL: Tenant Context Middleware - MUST be after authentication, before authorization
app.UseTenantContext();

// Tenant Activity - Record API calls per tenant for SuperAdmin Live Activity (must be after TenantContext)
app.UseTenantActivity();

// BUG #2.9 FIX: User Activity - Update User.LastActiveAt for online/offline indicator (must be after authentication)
app.UseUserActivity();

// Subscription Middleware - Enforce subscription limits and status
app.UseSubscriptionMiddleware();

// Maintenance Mode - Returns 503 for tenant requests when platform is under maintenance (SA bypasses)
app.UseMiddleware<HexaBill.Api.Shared.Middleware.MaintenanceMiddleware>();

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

// PROD-1: Health check endpoint - handled by DiagnosticsController for comprehensive checks
// Basic health endpoint removed - use /api/health for full diagnostics
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

// Maintenance check - anonymous, bypassed by MaintenanceMiddleware so frontend can show message
app.MapGet("/api/maintenance-check", async (HttpContext ctx) =>
{
    try
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var mode = await db.Settings.AsNoTracking()
            .Where(s => s.OwnerId == 0 && s.Key == "PLATFORM_MAINTENANCE_MODE")
            .Select(s => s.Value)
            .FirstOrDefaultAsync();
        var msg = await db.Settings.AsNoTracking()
            .Where(s => s.OwnerId == 0 && s.Key == "PLATFORM_MAINTENANCE_MESSAGE")
            .Select(s => s.Value)
            .FirstOrDefaultAsync();
        var maintenanceMode = string.Equals(mode, "true", StringComparison.OrdinalIgnoreCase);
        var displayMsg = maintenanceMode ? (msg ?? "System under maintenance. Back shortly.") : "";
        return Results.Json(new { maintenanceMode, message = displayMsg });
    }
    catch
    {
        return Results.Json(new { maintenanceMode = false, message = "" });
    }
}).AllowAnonymous();

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

// AUDIT-5 FIX: Check for pending migrations on startup
_ = Task.Run(async () =>
{
    try
    {
        await Task.Delay(2000); // Wait for app to fully start
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        
        var pendingMigrations = await db.Database.GetPendingMigrationsAsync();
        if (pendingMigrations.Any())
        {
            logger.LogWarning("⚠️ Pending migrations detected: {Count}", pendingMigrations.Count());
            logger.LogWarning("Pending migrations: {Migrations}", string.Join(", ", pendingMigrations));
            
            // In development, optionally auto-apply migrations
            if (app.Environment.IsDevelopment())
            {
                logger.LogInformation("Auto-applying migrations in development...");
                await db.Database.MigrateAsync();
                logger.LogInformation("✅ Migrations applied successfully");
            }
        }
        else
        {
            logger.LogInformation("✅ Database is up to date - no pending migrations");
        }
    }
    catch (Exception ex)
    {
        var logger = app.Services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "❌ Error checking migrations");
        // Don't throw - allow app to start even if migration check fails
    }
});

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
            
            // CRITICAL: Ensure all required columns exist (fixes login when migrations haven't run)
            // Note: Main migration code at startup (lines 272-360) handles this, but this is a safety check
            if (context.Database.IsNpgsql())
            {
                try
                {
                    // Use PostgreSQL native IF NOT EXISTS syntax
                    await context.Database.ExecuteSqlRawAsync(@"ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""SessionVersion"" integer NOT NULL DEFAULT 0;");
                    await context.Database.ExecuteSqlRawAsync(@"ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""LastActiveAt"" timestamp with time zone NULL;");
                    await context.Database.ExecuteSqlRawAsync(@"ALTER TABLE ""ErrorLogs"" ADD COLUMN IF NOT EXISTS ""ResolvedAt"" timestamp with time zone NULL;");
                    initLogger.LogInformation("PostgreSQL: Safety check for critical columns completed");
                }
                catch (Exception ex)
                {
                    // Don't crash app - just log warning
                    initLogger.LogWarning(ex, "PostgreSQL: Safety check failed (non-critical): {Message}", ex.Message);
                }
            }
            else if (context.Database.IsSqlite())
            {
                try
                {
                    await context.Database.ExecuteSqlRawAsync(@"ALTER TABLE Users ADD COLUMN SessionVersion INTEGER NOT NULL DEFAULT 0");
                    initLogger.LogInformation("SQLite: SessionVersion column added (if missing)");
                }
                catch { /* column may already exist */ }
                try
                {
                    await context.Database.ExecuteSqlRawAsync(@"ALTER TABLE Users ADD COLUMN ProfilePhotoUrl TEXT NULL");
                }
                catch { /* column may already exist */ }
                try
                {
                    await context.Database.ExecuteSqlRawAsync(@"ALTER TABLE Users ADD COLUMN LanguagePreference TEXT NULL");
                    initLogger.LogInformation("SQLite: LanguagePreference column added (if missing)");
                }
                catch { /* column may already exist */ }
            }
            
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
                    initLogger.LogInformation("Index SQL file found at: {Path}", foundPath ?? "(unknown)");
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
                    initLogger.LogWarning("Index SQL file not found. Searched paths: {Paths}. See docs/PERFORMANCE_INDEXES.md for manual CREATE INDEX steps.", string.Join("; ", possiblePaths));
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
                    try
                    {
                        await context.Database.MigrateAsync();
                        initLogger.LogInformation("Database migrations applied successfully");
                    }
                    catch (Exception migEx)
                    {
                        var errorMsg = migEx.Message ?? "";
                        var innerMsg = migEx.InnerException?.Message ?? "";
                        var isColumnExistsError = errorMsg.Contains("already exists", StringComparison.OrdinalIgnoreCase) ||
                                                  errorMsg.Contains("42701", StringComparison.OrdinalIgnoreCase) ||
                                                  innerMsg.Contains("already exists", StringComparison.OrdinalIgnoreCase) ||
                                                  innerMsg.Contains("42701", StringComparison.OrdinalIgnoreCase);
                        
                        if (isColumnExistsError && context.Database.IsNpgsql())
                        {
                            // Column already exists - mark migration as applied manually and continue
                            initLogger.LogWarning("Migration failed due to existing columns (non-fatal). Marking migrations as applied and continuing...");
                            try
                            {
                                // Mark all pending migrations as applied in history table
                                foreach (var migrationId in pending)
                                {
                                    await context.Database.ExecuteSqlRawAsync(
                                        @"INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"") 
                                          SELECT {0}, '9.0.0' 
                                          WHERE NOT EXISTS (SELECT 1 FROM ""__EFMigrationsHistory"" WHERE ""MigrationId"" = {0})",
                                        migrationId);
                                }
                                initLogger.LogInformation("Migrations marked as applied (columns already exist from previous runs)");
                            }
                            catch (Exception markEx)
                            {
                                initLogger.LogWarning(markEx, "Failed to mark migrations as applied, but continuing anyway");
                            }
                        }
                        else
                        {
                            // Real error - log but don't crash
                            initLogger.LogWarning(migEx, "Migration warning (non-fatal): {Message}", errorMsg);
                        }
                    }
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
                var errorMsg = ex.Message ?? "";
                var innerMsg = ex.InnerException?.Message ?? "";
                var isNonFatal = errorMsg.Contains("already exists", StringComparison.OrdinalIgnoreCase) ||
                                 errorMsg.Contains("duplicate", StringComparison.OrdinalIgnoreCase) ||
                                 errorMsg.Contains("42701", StringComparison.OrdinalIgnoreCase) ||
                                 innerMsg.Contains("already exists", StringComparison.OrdinalIgnoreCase) ||
                                 innerMsg.Contains("duplicate", StringComparison.OrdinalIgnoreCase) ||
                                 innerMsg.Contains("42701", StringComparison.OrdinalIgnoreCase);
                
                if (isNonFatal)
                {
                    // Column already exists - this is OK, just log info
                    initLogger.LogInformation("Migration: Column already exists (non-fatal): {Message}", errorMsg);
                }
                else
                {
                    // Real error - log but don't crash for PostgreSQL (migrations use DO blocks now)
                    initLogger.LogWarning(ex, "Migration warning (non-fatal): {Message}", errorMsg);
                }
                
                // Don't crash on migration errors - app can still run
                // Migrations are now idempotent using DO blocks, so errors are rare

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

                // FIX 403: In Development, activate any tenant with expired trial or suspended status
                var isDev = builder.Environment.IsDevelopment();
                if (isDev)
                {
                    var problematicTenants = await context.Tenants
                        .Where(t => t.Status == TenantStatus.Suspended || t.Status == TenantStatus.Expired ||
                            (t.Status == TenantStatus.Trial && t.TrialEndDate.HasValue && t.TrialEndDate.Value < DateTime.UtcNow))
                        .ToListAsync();
                    if (problematicTenants.Any())
                    {
                        foreach (var t in problematicTenants)
                        {
                            var oldStatus = t.Status;
                            t.Status = TenantStatus.Active;
                            t.TrialEndDate = null;
                            initLogger.LogInformation("Activated tenant {TenantId} ({Name}) for development (was {Status})", t.Id, t.Name, oldStatus);
                        }
                        await context.SaveChangesAsync();
                        initLogger.LogInformation("Fixed {Count} tenant(s) with expired/suspended status for development", problematicTenants.Count);
                    }
                }

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
                        new ExpenseCategory { Name = "Meals", ColorCode = "#EC4899", CreatedAt = DateTime.UtcNow },
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
// BUG #2.6 FIX: Only log Swagger URL in Development mode
if (app.Environment.IsDevelopment())
{
    appLogger.LogInformation("Swagger UI available at: {SwaggerUrl}", app.Urls.FirstOrDefault() + "/swagger");
}
app.Run(); // Blocks here - server runs until SIGTERM/SIGINT received


