using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using System.Security.Claims;

namespace HexaBill.Tests;

public class OwnerResetSafetyTests
{
    [Fact]
    public async Task OwnerReset_IsRejectedInProductionBeforeCallingService()
    {
        var resetService = new TrackingResetService();
        var controller = new ResetController(resetService, new TestHostEnvironment(Environments.Production))
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                        new[] { new Claim(ClaimTypes.Role, "Owner") }, "test"))
                }
            }
        };

        var result = await controller.ResetOwnerData(new OwnerResetRequest { ConfirmationText = "FRESH START" });

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Equal(0, resetService.OwnerResetCalls);
    }

    [Fact]
    public async Task OwnerReset_IsUnavailableToTenantAdmins()
    {
        var resetService = new TrackingResetService();
        var controller = new ResetController(resetService, new TestHostEnvironment(Environments.Development))
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                        new[] { new Claim(ClaimTypes.Role, "Admin") }, "test"))
                }
            }
        };

        var result = await controller.ResetOwnerData(new OwnerResetRequest { ConfirmationText = "FRESH START" });

        Assert.IsType<ForbidResult>(result.Result);
        Assert.Equal(0, resetService.OwnerResetCalls);
    }

    [Fact]
    public async Task OwnerReset_DeletesOnlyTenantAlertsAndPreservesGlobalAndOtherTenantAlerts()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options;
        await using var db = new AppDbContext(options);
        db.SetRequestTenantScope(42, isPlatformScope: false);
        await db.Database.EnsureCreatedAsync();
        db.SetRequestTenantScope(null, isPlatformScope: true);
        db.Tenants.AddRange(
            new Tenant { Id = 42, Name = "Synthetic tenant 42", Subdomain = "synthetic-42" },
            new Tenant { Id = 43, Name = "Synthetic tenant 43", Subdomain = "synthetic-43" });
        await db.SaveChangesAsync();
        db.Alerts.Add(new Alert { TenantId = 0, OwnerId = 0, Type = "Platform", Title = "Global alert" });
        await db.SaveChangesAsync();
        db.SetRequestTenantScope(42, isPlatformScope: false);
        db.Users.Add(new User { Id = 420, TenantId = 42, OwnerId = 42, Name = "Synthetic owner", Email = "reset-owner-42@example.invalid", PasswordHash = "test", Role = UserRole.Owner, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
        db.Alerts.Add(new Alert { TenantId = 42, OwnerId = 42, Type = "Tenant", Title = "Tenant alert" });
        await db.SaveChangesAsync();
        db.SetRequestTenantScope(43, isPlatformScope: false);
        db.Alerts.Add(new Alert { TenantId = 43, OwnerId = 43, Type = "Tenant", Title = "Other tenant alert" });
        await db.SaveChangesAsync();
        db.SetRequestTenantScope(42, isPlatformScope: false);

        var service = new ResetService(db, new NoopBackupService(), NullLogger<ResetService>.Instance);
        var reset = await service.ResetOwnerDataAsync(42, 420);

        Assert.True(reset.Success, reset.Message);
        Assert.NotNull(await db.Alerts.IgnoreQueryFilters().SingleOrDefaultAsync(a => a.TenantId == 0));
        Assert.NotNull(await db.Alerts.IgnoreQueryFilters().SingleOrDefaultAsync(a => a.TenantId == 43));
        Assert.Null(await db.Alerts.IgnoreQueryFilters().SingleOrDefaultAsync(a => a.TenantId == 42));
    }

    private sealed class TestHostEnvironment(string environmentName) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = environmentName;
        public string ApplicationName { get; set; } = "HexaBill.Tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    private sealed class TrackingResetService : IResetService
    {
        public int OwnerResetCalls { get; private set; }
        public Task<ResetResult> ResetSystemAsync(bool createBackup, bool clearAuditLogs, int userId) => Task.FromResult(new ResetResult());
        public Task<ResetResult> ResetOwnerDataAsync(int tenantId, int userId)
        {
            OwnerResetCalls++;
            return Task.FromResult(new ResetResult());
        }
        public Task<SystemSummary> GetSystemSummaryAsync() => Task.FromResult(new SystemSummary());
        public Task<SystemSummary> GetOwnerSummaryAsync(int tenantId) => Task.FromResult(new SystemSummary());
    }

    private sealed class NoopBackupService : IComprehensiveBackupService
    {
        public Task<string> CreateFullBackupAsync(int tenantId, bool exportToDesktop = false, bool uploadToGoogleDrive = false, bool sendEmail = false, bool includeInvoicePdfs = false) => Task.FromResult(string.Empty);
        public Task<bool> RestoreFromBackupAsync(int tenantId, string backupFilePath, string? uploadedFilePath = null) => Task.FromResult(false);
        public Task<List<BackupInfo>> GetBackupListAsync(int? tenantId = null, bool isPlatformAdmin = false) => Task.FromResult(new List<BackupInfo>());
        public Task<(Stream stream, string fileName)?> GetBackupForDownloadAsync(string fileName, int? tenantId = null, bool isPlatformAdmin = false) => Task.FromResult<(Stream stream, string fileName)?>(null);
        public Task<bool> DeleteBackupAsync(string fileName, int? tenantId = null, bool isPlatformAdmin = false) => Task.FromResult(false);
        public Task ScheduleDailyBackupAsync() => Task.CompletedTask;
        public Task<ImportPreview> PreviewImportAsync(string backupFilePath, string? uploadedFilePath = null, int? tenantId = null, bool isPlatformAdmin = false) => Task.FromResult(new ImportPreview());
        public Task<ImportResult> ImportWithResolutionAsync(string backupFilePath, string? uploadedFilePath, Dictionary<int, string> conflictResolutions, int userId, int tenantId, bool isPlatformAdmin = false) => Task.FromResult(new ImportResult());
    }
}
