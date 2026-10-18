/*
 * Route Map API: stops with balance/overdue for one route, and a summary of every route the caller may see.
 * Same access rule as the routes themselves: a route outside the caller's scope looks like a route that does not exist.
 */
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Models;

namespace HexaBill.Api.Modules.Branches
{
    [ApiController]
    [Authorize]
    public class RouteMapController : RouteScopedController
    {
        private readonly IRouteMapService _map;
        private readonly IRouteScopeService _routeScope;
        private readonly ILogger<RouteMapController> _logger;

        public RouteMapController(IRouteMapService map, IRouteScopeService routeScope, ILogger<RouteMapController> logger) : base(routeScope)
        {
            _map = map;
            _routeScope = routeScope;
            _logger = logger;
        }

        private bool CanSeeCreditLimit =>
            IsSystemAdmin || string.Equals(CurrentRole, "Owner", StringComparison.OrdinalIgnoreCase) || string.Equals(CurrentRole, "Admin", StringComparison.OrdinalIgnoreCase);

        [HttpGet("api/routes/{id}/map-stops")]
        public async Task<ActionResult<ApiResponse<List<RouteMapStopDto>>>> GetMapStops(int id, [FromQuery] DateTime? date)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            var access = await RouteAccessAsync(id);
            if (access == RouteAccessLevel.None) return RouteNotFound<List<RouteMapStopDto>>();
            try
            {
                var stops = await _map.GetMapStopsAsync(id, tenantId, date?.Date ?? DateTime.UtcNow.Date, CanSeeCreditLimit, includePendingFix: access == RouteAccessLevel.Manage);
                if (stops == null) return RouteNotFound<List<RouteMapStopDto>>();
                return Ok(new ApiResponse<List<RouteMapStopDto>> { Success = true, Data = stops });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetMapStops error route={RouteId}", id);
                return StatusCode(500, new ApiResponse<List<RouteMapStopDto>> { Success = false, Message = "Failed to load the route map." });
            }
        }

        /// <summary>Saves a driver's GPS fix (from a visit) as the customer's shop pin. Owners, admins and the route's manager only.</summary>
        [HttpPost("api/routes/{id}/customers/{customerId}/pin-from-visit")]
        public async Task<ActionResult<ApiResponse<object>>> ConfirmPinFromVisit(int id, int customerId, [FromBody] ConfirmPinFromVisitRequest request)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0) return Forbid();
            var access = await RouteAccessAsync(id);
            if (access == RouteAccessLevel.None) return RouteNotFound<object>();
            if (access != RouteAccessLevel.Manage) return NotAllowed<object>("Only an owner, admin or the manager of this route can confirm a shop location.");
            try
            {
                var result = await _map.ConfirmPinFromVisitAsync(id, customerId, request?.VisitId ?? 0, request?.Overwrite ?? false, CurrentUserId, tenantId);
                var body = new ApiResponse<object> { Success = result.Status == PinConfirmStatus.Saved, Message = result.Message };
                return result.Status switch
                {
                    PinConfirmStatus.Saved => Ok(body),
                    PinConfirmStatus.NotOnRoute => NotFound(body),
                    PinConfirmStatus.NeedsOverwrite => Conflict(body),
                    _ => BadRequest(body),
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ConfirmPinFromVisit error route={RouteId} customer={CustomerId}", id, customerId);
                return StatusCode(500, new ApiResponse<object> { Success = false, Message = "The shop location could not be saved." });
            }
        }

        [HttpGet("api/route-map/overview")]
        public async Task<ActionResult<ApiResponse<RouteMapOverviewDto>>> GetOverview([FromQuery] DateTime? date)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0) return Forbid();
            try
            {
                var accessible = await _routeScope.GetAccessibleRouteIdsAsync(CurrentUserId, tenantId, CurrentRole);
                // Owners and admins manage every route; a manager only sees routes they were granted, so they manage all of those. Staff only work their routes.
                var role = (CurrentRole ?? string.Empty).Trim().ToLowerInvariant();
                var canManage = role is "owner" or "admin" or "manager" or "systemadmin";
                var overview = await _map.GetOverviewAsync(tenantId, accessible, date?.Date ?? DateTime.UtcNow.Date, canManage);
                return Ok(new ApiResponse<RouteMapOverviewDto> { Success = true, Data = overview });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetOverview error");
                return StatusCode(500, new ApiResponse<RouteMapOverviewDto> { Success = false, Message = "Failed to load the route map overview." });
            }
        }
    }
}
