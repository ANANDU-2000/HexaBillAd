/*
 * Staff scope: Staff role sees only their assigned routes. Owner/Admin see all.
 * Route-id endpoints use GetRouteAccessAsync / GetAccessibleRouteIdsAsync, where a Manager also needs an explicit grant.
 */
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;

namespace HexaBill.Api.Core.Infrastructure
{
    public class RouteScopeService : IRouteScopeService
    {
        private readonly AppDbContext _context;

        public RouteScopeService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<int[]?> GetRestrictedRouteIdsAsync(int userId, int tenantId, string role)
        {
            if (tenantId <= 0) return null; // SuperAdmin
            var r = role?.Trim().ToLowerInvariant() ?? "";
            if (r == "owner" || r == "admin" || r == "manager") return null; // No restriction
            // Staff: only routes they are assigned to (RouteStaff or Route.AssignedStaffId)
            return await AssignedRouteIdsAsync(userId, tenantId);
        }

        public async Task<RouteAccessLevel> GetRouteAccessAsync(int userId, int tenantId, string role, int routeId)
        {
            if (tenantId <= 0) return RouteAccessLevel.Manage; // SuperAdmin; a missing route is reported by the service
            var exists = await _context.Routes.IgnoreQueryFilters().AnyAsync(r => r.Id == routeId && r.TenantId == tenantId);
            if (!exists) return RouteAccessLevel.None;

            var r = NormalizeRole(role);
            if (r is "owner" or "admin" or "systemadmin") return RouteAccessLevel.Manage;

            var assigned = (await AssignedRouteIdsAsync(userId, tenantId)).Contains(routeId);
            if (r == "manager")
            {
                if (assigned) return RouteAccessLevel.Manage;
                var managesBranch = await _context.Routes.IgnoreQueryFilters()
                    .AnyAsync(rt => rt.Id == routeId && rt.TenantId == tenantId && rt.Branch.ManagerUserId == userId);
                return managesBranch ? RouteAccessLevel.Manage : RouteAccessLevel.None;
            }

            return assigned ? RouteAccessLevel.Assigned : RouteAccessLevel.None;
        }

        public async Task<int[]?> GetAccessibleRouteIdsAsync(int userId, int tenantId, string role)
        {
            if (tenantId <= 0) return null;
            var r = NormalizeRole(role);
            if (r is "owner" or "admin" or "systemadmin") return null;

            var ids = (await AssignedRouteIdsAsync(userId, tenantId)).ToList();
            if (r == "manager")
            {
                var branchRoutes = await _context.Routes.IgnoreQueryFilters()
                    .Where(rt => rt.TenantId == tenantId && rt.Branch.ManagerUserId == userId)
                    .Select(rt => rt.Id)
                    .ToListAsync();
                ids.AddRange(branchRoutes);
            }
            return ids.Distinct().ToArray();
        }

        private static string NormalizeRole(string? role) => role?.Trim().ToLowerInvariant() ?? "";

        private async Task<int[]> AssignedRouteIdsAsync(int userId, int tenantId)
        {
            var fromRouteStaff = await _context.RouteStaff
                .Where(rs => rs.UserId == userId && rs.Route.TenantId == tenantId)
                .Select(rs => rs.RouteId)
                .ToListAsync();
            var fromAssignedStaff = await _context.Routes
                .Where(rt => rt.TenantId == tenantId && rt.AssignedStaffId == userId)
                .Select(rt => rt.Id)
                .ToListAsync();
            return fromRouteStaff.Union(fromAssignedStaff).Distinct().ToArray(); // empty array: no routes
        }
    }
}
