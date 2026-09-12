using HexaBill.Api.Shared.Security;

namespace HexaBill.Tests;

public class BackupTenantAccessTests
{
    [Fact]
    public void SanitizeFileName_StripsPathTraversal()
    {
        Assert.Equal("HexaBill_Backup_Tenant2_20260101.zip", BackupTenantAccess.SanitizeFileName(@"..\..\HexaBill_Backup_Tenant2_20260101.zip"));
        Assert.Equal(string.Empty, BackupTenantAccess.SanitizeFileName(".."));
    }

    [Fact]
    public void TryGetTenantId_ParsesFilename()
    {
        Assert.True(BackupTenantAccess.TryGetTenantId("HexaBill_Backup_Tenant12_20260810_120000.zip", out var tenantId));
        Assert.Equal(12, tenantId);
    }

    [Fact]
    public void CanAccess_TenantUserCannotReadAnotherTenantBackup()
    {
        const string otherTenant = "HexaBill_Backup_Tenant2_20260810_120000.zip";
        Assert.False(BackupTenantAccess.CanAccess(otherTenant, 1));
        Assert.True(BackupTenantAccess.CanAccess(otherTenant, 2));
        Assert.True(BackupTenantAccess.CanAccess(otherTenant, 0));
        Assert.True(BackupTenantAccess.CanAccess(otherTenant, null));
    }

    [Fact]
    public void CanAccess_UnknownFilenameDeniedToTenantUser()
    {
        Assert.False(BackupTenantAccess.CanAccess("manual-export.zip", 1));
        Assert.True(BackupTenantAccess.CanAccess("manual-export.zip", 0));
    }
}
