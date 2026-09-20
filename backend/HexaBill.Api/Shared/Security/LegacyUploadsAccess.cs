using HexaBill.Api.Shared.Extensions;

namespace HexaBill.Api.Shared.Security;

/// <summary>
/// Tenant ownership checks for legacy /uploads static files.
/// Paths are stored as /uploads/{tenantId}/... under wwwroot/uploads.
/// </summary>
public static class LegacyUploadsAccess
{
    /// <summary>
    /// Parses the tenant id encoded as the first path segment after /uploads/.
    /// Returns false for legacy root files (e.g. /uploads/logo.png).
    /// </summary>
    public static bool TryGetPathTenantId(string? requestPath, out int tenantId)
    {
        tenantId = 0;
        if (string.IsNullOrWhiteSpace(requestPath))
            return false;

        var relative = requestPath.Trim();
        if (relative.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase))
            relative = relative["/uploads/".Length..];
        else if (relative.StartsWith("uploads/", StringComparison.OrdinalIgnoreCase))
            relative = relative["uploads/".Length..];
        else
            return false;

        relative = relative.Replace('\\', '/').TrimStart('/');
        if (string.IsNullOrEmpty(relative) || relative.Contains("..", StringComparison.Ordinal))
            return false;

        var firstSegment = relative.Split('/')[0];
        return int.TryParse(firstSegment, out tenantId) && tenantId > 0;
    }

    public static bool CanAccess(HttpContext context, IConfiguration configuration)
    {
        if (!RequestJwtValidator.TryValidate(context, configuration, out var principal) || principal is null)
            return false;

        if (TenantIdExtensions.IsSystemAdmin(principal))
            return true;

        var requestPath = context.Request.Path.Value ?? string.Empty;
        if (!TryGetPathTenantId(requestPath, out var pathTenantId))
            return false;

        try
        {
            return principal.GetTenantIdFromToken() == pathTenantId;
        }
        catch (UnauthorizedAccessException)
        {
            return false;
        }
    }
}
