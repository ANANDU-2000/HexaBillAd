using HexaBill.Api.Models;
using HexaBill.Api.Modules.SuperAdmin;

namespace HexaBill.Tests;

public class BackupAgentRulesTests
{
    [Fact]
    public void LocalBackupFeature_IsOffUnlessExplicitlyEnabled()
    {
        Assert.False(TenantFeatureFlags.IsEnabled(null, TenantFeatureFlags.LocalBackupAgent));
        Assert.False(TenantFeatureFlags.IsEnabled("[]", TenantFeatureFlags.LocalBackupAgent));
        Assert.False(TenantFeatureFlags.IsEnabled("[\"backup\"]", TenantFeatureFlags.LocalBackupAgent));
        Assert.True(TenantFeatureFlags.IsEnabled("[\"localBackupAgent\"]", TenantFeatureFlags.LocalBackupAgent));
    }

    [Fact]
    public void DueSlot_LongOfflineProducesOnlyTheLatestOccurrence()
    {
        var updated = new DateTime(2026, 9, 1, 8, 0, 0, DateTimeKind.Utc);
        var now = new DateTime(2026, 9, 11, 23, 40, 0, DateTimeKind.Utc);
        Assert.True(BackupScheduleClock.TryGetDueSlot(now, updated, "23:00", "UTC", "daily", 0, out var slot));
        Assert.Equal("2026-09-11", slot.Key);
        Assert.True(slot.Missed);
    }

    [Fact]
    public void DueSlot_DoesNotRunAnOccurrenceFromBeforeTheScheduleWasSaved()
    {
        var updated = new DateTime(2026, 9, 27, 9, 0, 0, DateTimeKind.Utc);
        var now = new DateTime(2026, 9, 27, 10, 0, 0, DateTimeKind.Utc);
        Assert.False(BackupScheduleClock.TryGetDueSlot(now, updated, "23:00", "UTC", "daily", 0, out _));
    }

    [Fact]
    public void Verification_RequiresMatchingChecksum()
    {
        Assert.False(BackupRunRules.HashesMatch("abc", "abd"));
        Assert.True(BackupRunRules.HashesMatch("ABC", "abc"));
        Assert.False(BackupRunRules.CanReuseArchive(BackupRunStatus.Failed));
        Assert.True(BackupRunRules.CanReuseArchive(BackupRunStatus.Ready));
        Assert.Equal(BackupRunRules.CouldNotComplete, BackupRunRules.SanitizeFailure("System.IO.IOException: disk"));
        Assert.Equal(BackupRunRules.FolderUnavailable, BackupRunRules.SanitizeFailure(BackupRunRules.FolderUnavailable));
    }

    [Fact]
    public void Status_IsNotActiveWhenTheDeviceIsOffline()
    {
        Assert.Equal("Configured, device offline", BackupRunRules.StatusLabel(true, true, true, false, BackupRunStatus.Verified));
        Assert.Equal("Automatic backup active", BackupRunRules.StatusLabel(true, true, true, true, BackupRunStatus.Verified));
        Assert.Equal("Not configured", BackupRunRules.StatusLabel(false, false, false, false, null));
    }

    [Fact]
    public void ManifestTenantMismatch_IsRejectedByFilenameAndPreviewRule()
    {
        Assert.False(BackupTenantAccess.CanAccess("HexaBill_Backup_Tenant2_20260927.zip", 1));
        Assert.True(BackupTenantAccess.CanAccess("HexaBill_Backup_Tenant2_20260927.zip", 2));
    }
}
