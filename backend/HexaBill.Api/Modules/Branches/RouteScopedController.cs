/*
 * Shared base for controllers whose endpoints take a route id. Tenant isolation is not enough there:
 * the caller must also be allowed on that route (see IRouteScopeService.GetRouteAccessAsync).
 */
using System.Security.Claims;
using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace HexaBill.Api.Modules.Branches
{
    public abstract class RouteScopedController : TenantScopedController
    {
        private readonly IRouteScopeService _routeScope;

        protected RouteScopedController(IRouteScopeService routeScope)
        {
            _routeScope = routeScope;
        }

        protected int CurrentUserId =>
            int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;

        protected string CurrentRole => User.FindFirst(ClaimTypes.Role)?.Value ?? "";

        /// <summary>Platform SuperAdmin keeps access to every route; everyone else is checked against their assignment.</summary>
        protected async Task<RouteAccessLevel> RouteAccessAsync(int routeId)
        {
            if (IsSystemAdmin) return RouteAccessLevel.Manage;
            return await _routeScope.GetRouteAccessAsync(CurrentUserId, CurrentTenantId, CurrentRole, routeId);
        }

        /// <summary>Same body as a route that does not exist, so a same-company user cannot probe route ids.</summary>
        protected ActionResult RouteNotFound<T>(string message = "Route not found.") =>
            NotFound(new ApiResponse<T> { Success = false, Message = message });

        protected ActionResult NotAllowed<T>(string message) =>
            StatusCode(StatusCodes.Status403Forbidden, new ApiResponse<T> { Success = false, Message = message });

        /// <summary>Owner, admin or manager may create routes; staff may not. SuperAdmin passes.</summary>
        protected bool CanCreateRoutes()
        {
            if (IsSystemAdmin) return true;
            var role = CurrentRole.Trim().ToLowerInvariant();
            return role is "owner" or "admin" or "manager";
        }
    }
}
