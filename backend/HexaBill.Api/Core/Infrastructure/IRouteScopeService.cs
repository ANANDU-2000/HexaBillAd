/*
 * Staff scope: returns route IDs the current user is allowed to see.
 * Owner/Admin: null (no restriction). Staff: list of route IDs from RouteStaff.
 */
namespace HexaBill.Api.Core.Infrastructure
{
    /// <summary>What a caller may do on one route. None looks like a missing route to the caller.</summary>
    public enum RouteAccessLevel
    {
        None = 0,
        /// <summary>Assigned staff or driver: sees the route and records visits.</summary>
        Assigned = 1,
        /// <summary>Owner, admin, or a manager explicitly granted the route: also changes the route and the saved shop pin.</summary>
        Manage = 2,
    }

    public interface IRouteScopeService
    {
        /// <summary>
        /// Returns route IDs the user is restricted to, or null if user can see all tenant data (Owner/Admin).
        /// When non-null, only data for those route IDs should be returned.
        /// </summary>
        Task<int[]?> GetRestrictedRouteIdsAsync(int userId, int tenantId, string role);

        /// <summary>
        /// Access to ONE route for the route and visit endpoints. Owner/Admin: every route of the company.
        /// Manager: only a route they are explicitly granted (RouteStaff row, primary assigned staff, or manager of the route's branch).
        /// Anyone else: only a route they are assigned to. A route of another company is always None.
        /// Unlike <see cref="GetRestrictedRouteIdsAsync"/>, which other modules use and which is unchanged, a manager is not unrestricted here.
        /// </summary>
        Task<RouteAccessLevel> GetRouteAccessAsync(int userId, int tenantId, string role, int routeId);

        /// <summary>Route ids the caller can open, or null when every route of the company is allowed (Owner/Admin).</summary>
        Task<int[]?> GetAccessibleRouteIdsAsync(int userId, int tenantId, string role);
    }
}
