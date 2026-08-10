/*
 * Routes API - tenant-scoped route CRUD, assign customers/staff, route summary.
 */
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions;

namespace HexaBill.Api.Modules.Branches
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class RoutesController : TenantScopedController
    {
        private readonly IRouteService _routeService;
        private readonly HexaBill.Api.Shared.Services.IRouteScopeService _routeScopeService;
        private readonly ILogger<RoutesController> _logger;

        public RoutesController(
            IRouteService routeService,
            HexaBill.Api.Shared.Services.IRouteScopeService routeScopeService,
            ILogger<RoutesController> logger)
        {
            _routeService = routeService;
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

                // Staff: only assigned routes (Owner/Admin unrestricted)
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "";
                if (int.TryParse(userIdClaim, out var userId) && tenantId > 0)
                {
                    var restricted = await _routeScopeService.GetRestrictedRouteIdsAsync(userId, tenantId, role);
                    if (restricted != null)
                        list = list.Where(r => restricted.Contains(r.Id)).ToList();
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
            var route = await _routeService.UpdateRouteAsync(id, request, tenantId);
            if (route == null) return NotFound(new ApiResponse<RouteDto> { Success = false, Message = "Route not found." });
            return Ok(new ApiResponse<RouteDto> { Success = true, Data = route });
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<object>>> DeleteRoute(int id)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            var ok = await _routeService.DeleteRouteAsync(id, tenantId);
            if (!ok) return NotFound(new ApiResponse<object> { Success = false, Message = "Route not found." });
            return Ok(new ApiResponse<object> { Success = true, Message = "Route deleted." });
        }

        [HttpPost("{id}/customers/{customerId}")]
        public async Task<ActionResult<ApiResponse<object>>> AssignCustomer(int id, int customerId)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            var ok = await _routeService.AssignCustomerToRouteAsync(id, customerId, tenantId);
            if (!ok) return BadRequest(new ApiResponse<object> { Success = false, Message = "Route or customer not found." });
            return Ok(new ApiResponse<object> { Success = true, Message = "Customer assigned to route." });
        }

        [HttpDelete("{id}/customers/{customerId}")]
        public async Task<ActionResult<ApiResponse<object>>> UnassignCustomer(int id, int customerId)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            var ok = await _routeService.UnassignCustomerFromRouteAsync(id, customerId, tenantId);
            if (!ok) return NotFound(new ApiResponse<object> { Success = false, Message = "Assignment not found." });
            return Ok(new ApiResponse<object> { Success = true, Message = "Customer unassigned." });
        }

        [HttpPost("{id}/staff/{userId}")]
        public async Task<ActionResult<ApiResponse<object>>> AssignStaff(int id, int userId)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            var ok = await _routeService.AssignStaffToRouteAsync(id, userId, tenantId);
            if (!ok) return BadRequest(new ApiResponse<object> { Success = false, Message = "Route or user not found." });
            return Ok(new ApiResponse<object> { Success = true, Message = "Staff assigned to route." });
        }

        [HttpDelete("{id}/staff/{userId}")]
        public async Task<ActionResult<ApiResponse<object>>> UnassignStaff(int id, int userId)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            var ok = await _routeService.UnassignStaffFromRouteAsync(id, userId, tenantId);
            if (!ok) return NotFound(new ApiResponse<object> { Success = false, Message = "Assignment not found." });
            return Ok(new ApiResponse<object> { Success = true, Message = "Staff unassigned." });
        }

        [HttpPut("{id}/visits/{customerId}")]
        public async Task<ActionResult<ApiResponse<CustomerVisitDto>>> UpdateCustomerVisit(int id, int customerId, [FromBody] UpdateCustomerVisitRequest request)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
            var visit = await _routeService.UpdateCustomerVisitAsync(id, customerId, request, userId, tenantId);
            if (visit == null) return NotFound(new ApiResponse<CustomerVisitDto> { Success = false, Message = "Route or customer not found." });
            return Ok(new ApiResponse<CustomerVisitDto> { Success = true, Data = visit });
        }

        [HttpGet("{id}/visits")]
        public async Task<ActionResult<ApiResponse<List<CustomerVisitDto>>>> GetCustomerVisits(int id, [FromQuery] DateTime? date)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
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
                if (!_routeService.IsStopLocationEnabled())
                {
                    return Ok(new ApiResponse<List<RouteStopMapDto>>
                    {
                        Success = false,
                        Message = "Customer stop location feature is disabled.",
                        Data = new List<RouteStopMapDto>()
                    });
                }

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
}
