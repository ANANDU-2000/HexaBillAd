using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Auth;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Tests;

/// <summary>PS-010: failed logins in one workspace must not lock the same email in another workspace.</summary>
public sealed class LoginLockoutTenantScopeTests
{
    [Fact]
    public async Task SameEmail_DifferentWorkspaces_LockoutIsIndependent()
    {
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("Lockout_" + Guid.NewGuid()).Options);
        db.SetRequestTenantScope(null, isPlatformScope: true);
        var lockout = new LoginLockoutService(db);
        const string email = "owner@shared.test";
        var gulf = LoginLockoutKey.For(new TenantHostResolution(TenantHostKind.Tenant, "gulfharvest", 11), email);
        var frozen = LoginLockoutKey.For(new TenantHostResolution(TenantHostKind.Tenant, "frozenhub1", 12), email);

        for (var i = 0; i < 6; i++) await lockout.RecordFailedAttemptAsync(gulf);

        Assert.True(await lockout.IsLockedOutAsync(gulf));
        Assert.False(await lockout.IsLockedOutAsync(frozen));
        await lockout.ClearAttemptsAsync(frozen);           // success elsewhere must not clear gulf
        Assert.True(await lockout.IsLockedOutAsync(gulf));
    }

    [Fact]
    public void Key_IsBoundedTo100Chars_AndUnknownHostKeepsLegacyKey()
    {
        var longEmail = new string('a', 95) + "@x.test";
        Assert.True(LoginLockoutKey.For(new TenantHostResolution(TenantHostKind.Tenant, "t", 5), longEmail).Length <= 100);
        Assert.Equal("a@b.test", LoginLockoutKey.For(TenantHostResolution.Unknown(), "A@B.test"));
        Assert.NotEqual(LoginLockoutKey.For(TenantHostResolution.Platform(), "a@b.test"), LoginLockoutKey.For(TenantHostResolution.Unknown(), "a@b.test"));
    }
}

public sealed class LoginLockoutAdminScopeTests
{
    [Fact]
    public async Task AdminLock_AppliesEverywhere_AndAdminUnlock_ClearsEveryWorkspace()
    {
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("LockoutAdmin_" + Guid.NewGuid()).Options);
        db.SetRequestTenantScope(null, isPlatformScope: true);
        var lockout = new LoginLockoutService(db);
        const string email = "owner@shared.test";
        var gulf = LoginLockoutKey.For(new TenantHostResolution(TenantHostKind.Tenant, "gulfharvest", 11), email);

        await lockout.LockUserAsync(email, 15);
        Assert.True(await lockout.IsLockedOutAsync(gulf));

        for (var i = 0; i < 6; i++) await lockout.RecordFailedAttemptAsync(gulf);
        await lockout.ClearAllScopesAsync(email);
        Assert.False(await lockout.IsLockedOutAsync(gulf));
        Assert.Equal(0, await db.FailedLoginAttempts.CountAsync());
    }
}
