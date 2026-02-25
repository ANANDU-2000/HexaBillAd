/*
 * Staff scope: returns route IDs the current user is allowed to see.
 * Owner/Admin: null (no restriction). Staff: list of route IDs from RouteStaff.
 */
namespace HexaBill.Api.Shared.Services
{
    public interface IRouteScopeService
    {
        /// <summary>
        /// Returns route IDs the user is restricted to, or null if user can see all tenant data (Owner/Admin).
        /// When non-null, only data for those route IDs should be returned.
        /// </summary>
        Task<int[]?> GetRestrictedRouteIdsAsync(int userId, int tenantId, string role);
    }
}
