/*
 * Shared check for Sales.BranchId/RouteId column existence (PostgreSQL production may lack these).
 * Used by BranchService, ReportService, and optionally CustomerService to avoid 42703.
 */
namespace HexaBill.Api.Shared.Services
{
    public interface ISalesSchemaService
    {
        /// <summary>
        /// True if Sales table has BranchId and RouteId columns (cached). When false, branch/route filters and breakdowns should be skipped.
        /// </summary>
        Task<bool> SalesHasBranchIdAndRouteIdAsync();

        /// <summary>
        /// Clear the cached column check so the next call re-checks (e.g. after startup migration adds columns).
        /// </summary>
        void ClearColumnCheckCache();
    }
}
