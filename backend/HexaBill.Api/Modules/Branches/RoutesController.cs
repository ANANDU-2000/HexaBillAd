/*
 * Routes API - tenant-scoped route CRUD, assign customers/staff, route summary.
 */
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Models;

namespace HexaBill.Api.Modules.Branches
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class RoutesController : RouteScopedController
    {
        private readonly IRouteService _routeService;
        private readonly IRouteRunService _runService;
        private readonly IDriverLocationService _locationService;
        private readonly HexaBill.Api.Core.Infrastructure.IRouteScopeService _routeScopeService;
        private readonly ILogger<RoutesController> _logger;

        public RoutesController(
            IRouteService routeService,
            IRouteRunService runService,
            IDriverLocationService locationService,
            HexaBill.Api.Core.Infrastructure.IRouteScopeService routeScopeService,
            ILogger<RoutesController> logger) : base(routeScopeService)
        {
            _routeService = routeService;
            _runService = runService;
            _locationService = locationService;
            _routeScopeService = routeScopeService;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<List<RouteDto>>>> GetRoutes([FromQuery] int? branchId)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
                
                // Check database connection
                if (!await _routeService.CheckDatabaseConnectionAsync())
                {
                    return StatusCode(503, new ApiResponse<List<RouteDto>>
                    {
                        Success = false,
                        Message = "Database connection unavailable. Please try again later."
                    });
                }
                
                var list = await _routeService.GetRoutesAsync(tenantId, branchId);

                // Staff: only assigned routes. Manager: only granted routes. Owner/Admin unrestricted.
                if (tenantId > 0)
                {
                    var accessible = await _routeScopeService.GetAccessibleRouteIdsAsync(CurrentUserId, tenantId, CurrentRole);
                    if (accessible != null)
                        list = list.Where(r => accessible.Contains(r.Id)).ToList();
                }

                return Ok(new ApiResponse<List<RouteDto>> { Success = true, Data = list });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetRoutes error");
                return StatusCode(500, new ApiResponse<List<RouteDto>>
                {
                    Success = false,
                    Message = "Failed to load routes. Please try again.",
                    Data = new List<RouteDto>(),
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<RouteDetailDto>>> GetRoute(int id)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
                if (await RouteAccessAsync(id) == RouteAccessLevel.None) return RouteNotFound<RouteDetailDto>();
                var route = await _routeService.GetRouteByIdAsync(id, tenantId);
                if (route == null) return NotFound(new ApiResponse<RouteDetailDto> { Success = false, Message = "Route not found." });
                return Ok(new ApiResponse<RouteDetailDto> { Success = true, Data = route });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetRoute error");
                return StatusCode(500, new ApiResponse<RouteDetailDto> { Success = false, Message = ex.Message ?? "Error loading route.", Errors = new List<string> { ex.Message ?? "Unknown error" } });
            }
        }

        [HttpGet("{id}/summary")]
        public async Task<ActionResult<ApiResponse<RouteSummaryDto>>> GetRouteSummary(int id, [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
                if (await RouteAccessAsync(id) == RouteAccessLevel.None) return RouteNotFound<RouteSummaryDto>();
                var summary = await _routeService.GetRouteSummaryAsync(id, tenantId, fromDate, toDate);
                if (summary == null) return NotFound(new ApiResponse<RouteSummaryDto> { Success = false, Message = "Route not found." });
                return Ok(new ApiResponse<RouteSummaryDto> { Success = true, Data = summary });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetRouteSummary error");
                return StatusCode(500, new ApiResponse<RouteSummaryDto> { Success = false, Message = ex.Message ?? "Error loading route summary.", Errors = new List<string> { ex.Message ?? "Unknown error" } });
            }
        }

        [HttpGet("{id}/collection-sheet")]
        public async Task<ActionResult<ApiResponse<RouteCollectionSheetDto>>> GetRouteCollectionSheet(int id, [FromQuery] DateTime? date)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            if (await RouteAccessAsync(id) == RouteAccessLevel.None) return RouteNotFound<RouteCollectionSheetDto>();
            var sheetDate = date ?? DateTime.UtcNow.Date;
            var sheet = await _routeService.GetRouteCollectionSheetAsync(id, tenantId, sheetDate);
            if (sheet == null) return NotFound(new ApiResponse<RouteCollectionSheetDto> { Success = false, Message = "Route not found." });
            return Ok(new ApiResponse<RouteCollectionSheetDto> { Success = true, Data = sheet });
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<RouteDto>>> CreateRoute([FromBody] CreateRouteRequest request)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
                if (!CanCreateRoutes()) return NotAllowed<RouteDto>("Only an owner, admin or manager can create routes.");

                // SECURITY: Prevent Super Admin from creating global routes (TenantId=0)
                if (tenantId <= 0 && IsSystemAdmin)
                {
                    return BadRequest(new ApiResponse<RouteDto>
                    {
                        Success = false,
                        Message = "Super Admin must select a company (tenant) before creating a route."
                    });
                }

                var route = await _routeService.CreateRouteAsync(request, tenantId);
                return CreatedAtAction(nameof(GetRoute), new { id = route.Id }, new ApiResponse<RouteDto> { Success = true, Data = route });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CreateRoute error");
                return StatusCode(500, new ApiResponse<RouteDto>
                {
                    Success = false,
                    Message = "Failed to create route. Check that the branch and tenant exist.",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<RouteDto>>> UpdateRoute(int id, [FromBody] CreateRouteRequest request)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            var denied = await ManageDeniedAsync<RouteDto>(id);
            if (denied != null) return denied;
            var route = await _routeService.UpdateRouteAsync(id, request, tenantId);
            if (route == null) return NotFound(new ApiResponse<RouteDto> { Success = false, Message = "Route not found." });
            return Ok(new ApiResponse<RouteDto> { Success = true, Data = route });
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<object>>> DeleteRoute(int id)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            var denied = await ManageDeniedAsync<object>(id);
            if (denied != null) return denied;
            var ok = await _routeService.DeleteRouteAsync(id, tenantId);
            if (!ok) return NotFound(new ApiResponse<object> { Success = false, Message = "Route not found." });
            return Ok(new ApiResponse<object> { Success = true, Message = "Route deleted." });
        }

        [HttpPost("{id}/customers/{customerId}")]
        public async Task<ActionResult<ApiResponse<object>>> AssignCustomer(int id, int customerId)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            var denied = await ManageDeniedAsync<object>(id);
            if (denied != null) return denied;
            var ok = await _routeService.AssignCustomerToRouteAsync(id, customerId, tenantId);
            if (!ok) return BadRequest(new ApiResponse<object> { Success = false, Message = "Route or customer not found." });
            return Ok(new ApiResponse<object> { Success = true, Message = "Customer assigned to route." });
        }

        [HttpDelete("{id}/customers/{customerId}")]
        public async Task<ActionResult<ApiResponse<object>>> UnassignCustomer(int id, int customerId)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            var denied = await ManageDeniedAsync<object>(id);
            if (denied != null) return denied;
            var ok = await _routeService.UnassignCustomerFromRouteAsync(id, customerId, tenantId);
            if (!ok) return NotFound(new ApiResponse<object> { Success = false, Message = "Assignment not found." });
            return Ok(new ApiResponse<object> { Success = true, Message = "Customer unassigned." });
        }

        [HttpPost("{id}/staff/{userId}")]
        public async Task<ActionResult<ApiResponse<object>>> AssignStaff(int id, int userId)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            var denied = await ManageDeniedAsync<object>(id);
            if (denied != null) return denied;
            var ok = await _routeService.AssignStaffToRouteAsync(id, userId, tenantId);
            if (!ok) return BadRequest(new ApiResponse<object> { Success = false, Message = "Route or user not found." });
            return Ok(new ApiResponse<object> { Success = true, Message = "Staff assigned to route." });
        }

        [HttpDelete("{id}/staff/{userId}")]
        public async Task<ActionResult<ApiResponse<object>>> UnassignStaff(int id, int userId)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            var denied = await ManageDeniedAsync<object>(id);
            if (denied != null) return denied;
            var ok = await _routeService.UnassignStaffFromRouteAsync(id, userId, tenantId);
            if (!ok) return NotFound(new ApiResponse<object> { Success = false, Message = "Assignment not found." });
            return Ok(new ApiResponse<object> { Success = true, Message = "Staff unassigned." });
        }

        [HttpPut("{id}/visits/{customerId}")]
        public async Task<ActionResult<ApiResponse<CustomerVisitDto>>> UpdateCustomerVisit(int id, int customerId, [FromBody] UpdateCustomerVisitRequest request)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            var access = await RouteAccessAsync(id);
            if (access == RouteAccessLevel.None) return RouteNotFound<CustomerVisitDto>();
            // A visit never moves the saved shop pin on its own; only a manager of the route may ask for that.
            if (request.UpdateSavedLocation && access != RouteAccessLevel.Manage)
                return NotAllowed<CustomerVisitDto>("Only an owner, admin or the manager of this route can change a customer's saved location.");
            var visit = await _routeService.UpdateCustomerVisitAsync(id, customerId, request, CurrentUserId, tenantId, access == RouteAccessLevel.Manage);
            if (visit == null) return NotFound(new ApiResponse<CustomerVisitDto> { Success = false, Message = "Route or customer not found." });
            return Ok(new ApiResponse<CustomerVisitDto> { Success = true, Data = visit });
        }

        [HttpGet("{id}/visits")]
        public async Task<ActionResult<ApiResponse<List<CustomerVisitDto>>>> GetCustomerVisits(int id, [FromQuery] DateTime? date)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            if (await RouteAccessAsync(id) == RouteAccessLevel.None) return RouteNotFound<List<CustomerVisitDto>>();
            var visits = await _routeService.GetCustomerVisitsAsync(id, tenantId, date);
            return Ok(new ApiResponse<List<CustomerVisitDto>> { Success = true, Data = visits });
        }

        [HttpGet("{id}/stops-map")]
        public async Task<ActionResult<ApiResponse<List<RouteStopMapDto>>>> GetRouteStopsMap(int id, [FromQuery] DateTime? date)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
                if (await RouteAccessAsync(id) == RouteAccessLevel.None) return RouteNotFound<List<RouteStopMapDto>>();
                var day = date?.Date ?? DateTime.UtcNow.Date;
                var stops = await _routeService.GetRouteStopsMapAsync(id, tenantId, day);
                if (stops == null)
                    return NotFound(new ApiResponse<List<RouteStopMapDto>> { Success = false, Message = "Route not found." });

                return Ok(new ApiResponse<List<RouteStopMapDto>> { Success = true, Data = stops });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetRouteStopsMap error route={RouteId}", id);
                return StatusCode(500, new ApiResponse<List<RouteStopMapDto>>
                {
                    Success = false,
                    Message = "Failed to load stops map.",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>Null when the caller may change the route; otherwise the response to return (404 if hidden, 403 if only assigned).</summary>
        private async Task<ActionResult?> ManageDeniedAsync<T>(int routeId)
        {
            var access = await RouteAccessAsync(routeId);
            if (access == RouteAccessLevel.Manage) return null;
            if (access == RouteAccessLevel.None) return RouteNotFound<T>();
            return NotAllowed<T>("Only an owner, admin or the manager of this route can change routes.");
        }

        /// <summary>Set the visiting order. Body lists customer ids in the order they should be visited.</summary>
        [HttpPut("{id}/stops/order")]
        public async Task<ActionResult<ApiResponse<object>>> ReorderStops(int id, [FromBody] ReorderStopsRequest request)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            var denied = await ManageDeniedAsync<object>(id);
            if (denied != null) return denied;
            try
            {
                var ok = await _routeService.ReorderRouteStopsAsync(id, tenantId, CurrentUserId, request?.CustomerIds ?? new List<int>());
                if (!ok) return RouteNotFound<object>();
                return Ok(new ApiResponse<object> { Success = true, Message = "Stop order saved." });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
            }
        }

        /// <summary>The open run (with live counts) and the last finished run.</summary>
        [HttpGet("{id}/run")]
        public async Task<ActionResult<ApiResponse<RouteRunStateDto>>> GetRun(int id)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            if (await RouteAccessAsync(id) == RouteAccessLevel.None) return RouteNotFound<RouteRunStateDto>();
            return Ok(new ApiResponse<RouteRunStateDto> { Success = true, Data = await _runService.GetStateAsync(id, tenantId) });
        }

        /// <summary>Start the route (or return the run already open). Assigned staff and managers of the route can do this.</summary>
        [HttpPost("{id}/run/start")]
        public async Task<ActionResult<ApiResponse<RouteRunDto>>> StartRun(int id, [FromBody] StartRouteRunRequest? request)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            if (await RouteAccessAsync(id) == RouteAccessLevel.None) return RouteNotFound<RouteRunDto>();
            try
            {
                var run = await _runService.StartAsync(id, tenantId, CurrentUserId, request?.Date ?? DateTime.UtcNow.Date);
                if (run == null) return RouteNotFound<RouteRunDto>();
                return Ok(new ApiResponse<RouteRunDto> { Success = true, Data = run });
            }
            catch (InvalidOperationException ex) when (ex.Message == RouteRunService.UnavailableMessage)
            {
                return StatusCode(503, new ApiResponse<RouteRunDto> { Success = false, Message = ex.Message });
            }
        }

        /// <summary>End the open run and freeze its stop counts.</summary>
        [HttpPost("{id}/run/end")]
        public async Task<ActionResult<ApiResponse<RouteRunDto>>> EndRun(int id, [FromBody] EndRouteRunRequest? request)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            if (await RouteAccessAsync(id) == RouteAccessLevel.None) return RouteNotFound<RouteRunDto>();
            try
            {
                var run = await _runService.EndAsync(id, tenantId, CurrentUserId, request?.Note);
                if (run == null) return NotFound(new ApiResponse<RouteRunDto> { Success = false, Message = "This route has not been started." });
                return Ok(new ApiResponse<RouteRunDto> { Success = true, Data = run });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new ApiResponse<RouteRunDto> { Success = false, Message = ex.Message });
            }
            catch (InvalidOperationException ex) when (ex.Message == RouteRunService.UnavailableMessage)
            {
                return StatusCode(503, new ApiResponse<RouteRunDto> { Success = false, Message = ex.Message });
            }
        }

        /// <summary>Share the driver position. Needs an open run, an assigned driver and the driver consent.</summary>
        [HttpPost("{id}/location")]
        public async Task<ActionResult<ApiResponse<object>>> ShareLocation(int id, [FromBody] ShareLocationRequest request)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0) return Forbid();
            if (!_locationService.IsEnabled()) return NotFound(new ApiResponse<object> { Success = false, Message = "Live location is not switched on." });
            if (await RouteAccessAsync(id) == RouteAccessLevel.None) return RouteNotFound<object>();
            try
            {
                var result = await _locationService.ShareAsync(id, tenantId, CurrentUserId, request ?? new ShareLocationRequest());
                return result.Status switch
                {
                    ShareStatus.Ok => Ok(new ApiResponse<object> { Success = true }),
                    ShareStatus.NotEnabled => NotFound(new ApiResponse<object> { Success = false, Message = result.Message }),
                    ShareStatus.NotAssigned => NotAllowed<object>(result.Message ?? "Not allowed."),
                    ShareStatus.NoOpenRun => Conflict(new ApiResponse<object> { Success = false, Message = result.Message }),
                    ShareStatus.ConsentRequired => Conflict(new ApiResponse<object> { Success = false, Message = result.Message, Errors = new List<string> { "consent_required" } }),
                    ShareStatus.TooSoon => TooSoon(result),
                    _ => BadRequest(new ApiResponse<object> { Success = false, Message = result.Message }),
                };
            }
            catch (Exception ex) when (RouteService.IsRelationMissing42P01(ex))
            {
                return StatusCode(503, new ApiResponse<object> { Success = false, Message = "Live location is not available until the server update is installed." });
            }
        }

        private ActionResult TooSoon(ShareResult result)
        {
            Response.Headers["Retry-After"] = result.RetryAfterSeconds.ToString();
            return StatusCode(429, new ApiResponse<object> { Success = false, Message = result.Message });
        }

        /// <summary>The driver stops sharing; their position is deleted at once.</summary>
        [HttpDelete("{id}/location")]
        public async Task<ActionResult<ApiResponse<object>>> StopLocation(int id)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0) return Forbid();
            if (!_locationService.IsEnabled()) return NotFound(new ApiResponse<object> { Success = false, Message = "Live location is not switched on." });
            if (await RouteAccessAsync(id) == RouteAccessLevel.None) return RouteNotFound<object>();
            try
            {
                await _locationService.StopAsync(id, tenantId, CurrentUserId);
                return Ok(new ApiResponse<object> { Success = true, Message = "Sharing stopped." });
            }
            catch (Exception ex) when (RouteService.IsRelationMissing42P01(ex))
            {
                return Ok(new ApiResponse<object> { Success = true, Message = "Nothing was being shared." });
            }
        }

        /// <summary>Current driver positions. Owners, admins and managers of the route see every driver; a driver sees only their own.</summary>
        [HttpGet("{id}/location")]
        public async Task<ActionResult<ApiResponse<List<DriverLocationDto>>>> GetLocations(int id)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0) return Forbid();
            if (!_locationService.IsEnabled()) return NotFound(new ApiResponse<List<DriverLocationDto>> { Success = false, Message = "Live location is not switched on." });
            var access = await RouteAccessAsync(id);
            if (access == RouteAccessLevel.None) return RouteNotFound<List<DriverLocationDto>>();
            try
            {
                var list = await _locationService.ListAsync(id, tenantId, CurrentUserId, access == RouteAccessLevel.Manage);
                Response.Headers["Cache-Control"] = "no-store";
                return Ok(new ApiResponse<List<DriverLocationDto>> { Success = true, Data = list });
            }
            catch (Exception ex) when (RouteService.IsRelationMissing42P01(ex))
            {
                return Ok(new ApiResponse<List<DriverLocationDto>> { Success = true, Data = new List<DriverLocationDto>() });
            }
        }

        [HttpGet("feature-flags/live-location")]
        public ActionResult<ApiResponse<object>> GetLiveLocationFeatureFlag() =>
            Ok(new ApiResponse<object> { Success = true, Data = new { enabled = _locationService.IsEnabled() } });

        [HttpGet("feature-flags/stop-location")]
        public ActionResult<ApiResponse<object>> GetStopLocationFeatureFlag()
        {
            return Ok(new ApiResponse<object>
            {
                Success = true,
                Data = new { enabled = _routeService.IsStopLocationEnabled() }
            });
        }
    }

    public class ReorderStopsRequest
    {
        public List<int> CustomerIds { get; set; } = new();
    }

    public class StartRouteRunRequest
    {
        public DateTime? Date { get; set; }
    }

    public class EndRouteRunRequest
    {
        public string? Note { get; set; }
    }
}
