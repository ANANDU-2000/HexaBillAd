using System.Text.RegularExpressions;

namespace HexaBill.Api.Shared.Security;

/// <summary>
/// Tenant ownership rules for backup ZIP filenames.
/// Production backups are named HexaBill_Backup_Tenant{id}_{timestamp}.zip.
/// </summary>
public static class BackupTenantAccess
{
    private static readonly Regex TenantIdRegex = new(@"Tenant(\d+)", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static string SanitizeFileName(string? fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
            return string.Empty;

        var name = Path.GetFileName(fileName.Replace('\\', '/'));
        if (string.IsNullOrEmpty(name) || name.Contains("..", StringComparison.Ordinal))
            return string.Empty;

        return name;
    }

    public static bool TryGetTenantId(string fileName, out int tenantId)
    {
        tenantId = 0;
        var match = TenantIdRegex.Match(fileName);
        return match.Success && int.TryParse(match.Groups[1].Value, out tenantId) && tenantId > 0;
    }

    /// <summary>
    /// SystemAdmin / platform jobs pass null or 0 and may access any backup.
    /// Tenant users may only access files that encode their TenantId.
    /// Unknown filename formats are denied to tenant users.
    /// </summary>
    public static bool CanAccess(string fileName, int? requestTenantId)
    {
        if (string.IsNullOrWhiteSpace(fileName))
            return false;
        if (requestTenantId is null or <= 0)
            return true;
        if (!TryGetTenantId(fileName, out var fileTenantId))
            return false;
        return fileTenantId == requestTenantId.Value;
    }
}
