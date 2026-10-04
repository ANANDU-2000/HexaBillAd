using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Modules.DailyClose;

/// <summary>Coordinates a money posting with the close operation for the same tenant day and branch.</summary>
public static class DailyClosePostingGuard
{
    private static readonly TimeZoneInfo GstTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Arabian Standard Time");

    public static DateTime ToBusinessDate(DateTime transactionDateUtc)
    {
        var utc = transactionDateUtc.Kind == DateTimeKind.Utc
            ? transactionDateUtc
            : DateTime.SpecifyKind(transactionDateUtc, DateTimeKind.Utc);
        var gst = TimeZoneInfo.ConvertTimeFromUtc(utc, GstTimeZone);
        return new DateTime(gst.Year, gst.Month, gst.Day, 0, 0, 0, DateTimeKind.Utc);
    }

    public static async Task AcquireBusinessDayLockAsync(AppDbContext context, int tenantId, DateTime businessDate, int? branchId)
    {
        if (!context.Database.IsNpgsql()) return;

        var normalized = NormalizeBusinessDate(businessDate);
        // A tenant-wide close aggregates every branch, so every branch writer
        // first serializes on the tenant-wide key and then its branch key.
        var allBranchesScope = $"daily-close:{tenantId}:{normalized:yyyy-MM-dd}:all";
        await context.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock(hashtextextended({allBranchesScope}, 0))");
        if (branchId.HasValue)
        {
            var branchScope = $"daily-close:{tenantId}:{normalized:yyyy-MM-dd}:{branchId.Value}";
            await context.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT pg_advisory_xact_lock(hashtextextended({branchScope}, 0))");
        }
    }

    public static async Task EnsureOpenAsync(AppDbContext context, int tenantId, DateTime transactionDateUtc, int? branchId)
        => await EnsureOpenAsync(context, tenantId, new[] { (transactionDateUtc, branchId) });

    public static async Task EnsureOpenAsync(
        AppDbContext context,
        int tenantId,
        IEnumerable<(DateTime TransactionDateUtc, int? BranchId)> affectedScopes)
    {
        var featuresJson = await context.Tenants.AsNoTracking()
            .Where(t => t.Id == tenantId)
            .Select(t => t.FeaturesJson)
            .FirstOrDefaultAsync();
        if (!TenantFeatureFlags.IsEnabled(featuresJson, TenantFeatureFlags.DailyClose)) return;

        var scopes = affectedScopes
            .Select(scope => (BusinessDate: ToBusinessDate(scope.TransactionDateUtc), scope.BranchId))
            .Distinct()
            .OrderBy(scope => scope.BusinessDate)
            .ThenBy(scope => scope.BranchId)
            .ToList();

        // A posting that moves an expense between days/branches must lock both scopes
        // in stable order to avoid deadlocks with another concurrent edit.
        foreach (var scope in scopes)
        {
            await AcquireBusinessDayLockAsync(context, tenantId, scope.BusinessDate, scope.BranchId);
            var closeScopes = scope.BranchId.HasValue ? new int?[] { null, scope.BranchId } : new int?[] { null };
            foreach (var closeBranchId in closeScopes)
            {
                var latestStatus = await context.DailyCashCloses.AsNoTracking()
                    .Where(c => c.TenantId == tenantId && c.BusinessDate == scope.BusinessDate && c.BranchId == closeBranchId)
                    .OrderByDescending(c => c.Version)
                    .Select(c => (DailyCashCloseStatus?)c.Status)
                    .FirstOrDefaultAsync();

                if (latestStatus == DailyCashCloseStatus.Closed)
                    throw new InvalidOperationException("This business day is closed. Reopen with a reason before making changes.");
            }
        }
    }

    private static DateTime NormalizeBusinessDate(DateTime value) =>
        new(value.Year, value.Month, value.Day, 0, 0, 0, DateTimeKind.Utc);
}
