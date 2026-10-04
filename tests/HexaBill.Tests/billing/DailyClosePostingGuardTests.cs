using System.Text.Json;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.DailyClose;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Tests;

public class DailyClosePostingGuardTests
{
    [Fact]
    public async Task BranchPosting_IsBlockedByTenantWideClose()
    {
        await using var db = await DatabaseAsync();
        db.DailyCashCloses.Add(ClosedClose(branchId: null));
        await db.SaveChangesAsync();

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            DailyClosePostingGuard.EnsureOpenAsync(db, 10, new DateTime(2026, 10, 4, 10, 0, 0, DateTimeKind.Utc), branchId: 7));

        Assert.Contains("business day is closed", error.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task BranchPosting_IsBlockedByItsBranchClose_ButNotAnotherBranchClose()
    {
        await using var db = await DatabaseAsync();
        db.DailyCashCloses.Add(ClosedClose(branchId: 7));
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            DailyClosePostingGuard.EnsureOpenAsync(db, 10, new DateTime(2026, 10, 4, 10, 0, 0, DateTimeKind.Utc), branchId: 7));
        await DailyClosePostingGuard.EnsureOpenAsync(db, 10, new DateTime(2026, 10, 4, 10, 0, 0, DateTimeKind.Utc), branchId: 8);
    }

    private static DailyCashClose ClosedClose(int? branchId) => new()
    {
        TenantId = 10,
        OwnerId = 10,
        BranchId = branchId,
        BusinessDate = new DateTime(2026, 10, 4, 0, 0, 0, DateTimeKind.Utc),
        Version = 1,
        Status = DailyCashCloseStatus.Closed,
        CreatedByUserId = 1,
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    };

    private static async Task<AppDbContext> DatabaseAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        db.SetRequestTenantScope(10, false);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        db.Tenants.Add(new Tenant
        {
            Id = 10,
            Name = "Daily close scope fixture",
            Subdomain = "daily-close-scope",
            FeaturesJson = JsonSerializer.Serialize(new[] { TenantFeatureFlags.DailyClose })
        });
        await db.SaveChangesAsync();
        return db;
    }
}
