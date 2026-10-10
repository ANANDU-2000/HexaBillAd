using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;

namespace HexaBill.Api.Modules.Reports;

public static class VatReturnWriteGuard
{
    private const int AdvisoryLockNamespace = 0x5641544D; // "VATM"

    /// <summary>
    /// Serializes VAT writes and period freezes for a tenant when called inside a
    /// relational transaction. Non-relational test providers retain the status check.
    /// </summary>
    public static async Task AcquireTenantWriteLockAsync(AppDbContext context, int tenantId)
    {
        if (tenantId <= 0 || !context.Database.IsNpgsql() || context.Database.CurrentTransaction == null)
            return;

        await context.Database.ExecuteSqlRawAsync(
            "SELECT pg_advisory_xact_lock({0}, {1})",
            AdvisoryLockNamespace,
            tenantId);
    }

    public static async Task EnsurePeriodOpenAsync(AppDbContext context, int tenantId, DateTime effectiveDate)
    {
        await AcquireTenantWriteLockAsync(context, tenantId);
        var day = DateTime.SpecifyKind(effectiveDate.Date, DateTimeKind.Utc);
        var endOfDay = day.AddDays(1).AddTicks(-1);
        var isFrozen = await context.VatReturnPeriods.AnyAsync(p => p.TenantId == tenantId
            && (p.Status == "Locked" || p.Status == "Submitted")
            && p.PeriodStart <= endOfDay && p.PeriodEnd >= day);
        if (isFrozen)
            throw new InvalidOperationException("This VAT period is locked or marked as filed. Amend the report before changing a return in this period.");
    }
}
