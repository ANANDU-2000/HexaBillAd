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
            if (await RouteAccessAsync(id) == RouteAccessLevel.None) return RouteNotFound<List<RouteMapStopDto>>();
            try
            {
                var stops = await _map.GetMapStopsAsync(id, tenantId, date?.Date ?? DateTime.UtcNow.Date, CanSeeCreditLimit);
                if (stops == null) return RouteNotFound<List<RouteMapStopDto>>();
                return Ok(new ApiResponse<List<RouteMapStopDto>> { Success = true, Data = stops });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetMapStops error route={RouteId}", id);
                return StatusCode(500, new ApiResponse<List<RouteMapStopDto>> { Success = false, Message = "Failed to load the route map." });
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
                var overview = await _map.GetOverviewAsync(tenantId, accessible, date?.Date ?? DateTime.UtcNow.Date);
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
