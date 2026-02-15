/*
 * Staff scope: Staff role sees only their assigned routes. Owner/Admin see all.
 */
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;

namespace HexaBill.Api.Shared.Services
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
            // Staff: only routes they are assigned to
            var routeIds = await _context.RouteStaff
                .Where(rs => rs.UserId == userId && rs.Route.TenantId == tenantId)
                .Select(rs => rs.RouteId)
                .Distinct()
                .ToArrayAsync();
            if (routeIds.Length == 0) return Array.Empty<int>(); // Staff with no route sees nothing
            return routeIds;
        }
    }
}
