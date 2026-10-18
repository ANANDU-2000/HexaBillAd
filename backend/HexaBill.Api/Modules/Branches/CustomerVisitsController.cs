/*
 * Customer Visit Status API - Track visit status for route collection sheets.
 * Writes go through IRouteService (single path with stop-location pin rules).
 */
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Models;

namespace HexaBill.Api.Modules.Branches
{
    [ApiController]
    [Route("api/routes/{routeId:int}/visits")]
    [Authorize]
    public class CustomerVisitsController : RouteScopedController
    {
        private readonly IRouteService _routeService;
        private readonly ILogger<CustomerVisitsController> _logger;

        public CustomerVisitsController(IRouteService routeService, IRouteScopeService routeScopeService, ILogger<CustomerVisitsController> logger) : base(routeScopeService)
        {
            _routeService = routeService;
            _logger = logger;
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<CustomerVisitDto>>> UpdateVisitStatus(int routeId, [FromBody] UpdateVisitStatusRequest request)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0 && !IsSystemAdmin) return Forbid();

                var access = await RouteAccessAsync(routeId);
                if (access == RouteAccessLevel.None) return RouteNotFound<CustomerVisitDto>("Route or customer not found.");
                // A visit never moves the saved shop pin on its own; only a manager of the route may ask for that.
                if (request.UpdateSavedLocation && access != RouteAccessLevel.Manage)
                    return NotAllowed<CustomerVisitDto>("Only an owner, admin or the manager of this route can change a customer's saved location.");
                var staffId = CurrentUserId;

                var update = new UpdateCustomerVisitRequest
                {
                    VisitDate = request.VisitDate,
                    Status = request.Status,
                    Notes = request.Notes,
                    PaymentCollected = request.PaymentCollected ?? request.AmountCollected,
                    Latitude = request.Latitude,
                    Longitude = request.Longitude,
                    ReachedAt = request.ReachedAt,
                    UpdateSavedLocation = request.UpdateSavedLocation,
                    ManualPin = request.ManualPin
                };

                var visit = await _routeService.UpdateCustomerVisitAsync(routeId, request.CustomerId, update, staffId, tenantId, access == RouteAccessLevel.Manage);
                if (visit == null)
                    return NotFound(new ApiResponse<CustomerVisitDto> { Success = false, Message = "Route or customer not found." });

                return Ok(new ApiResponse<CustomerVisitDto> { Success = true, Data = visit, Message = "Visit status updated." });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new ApiResponse<CustomerVisitDto> { Success = false, Message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "UpdateVisitStatus failed route={RouteId}", routeId);
                return StatusCode(500, new ApiResponse<CustomerVisitDto>
                {
                    Success = false,
                    Message = "Failed to update visit status.",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<List<CustomerVisitDto>>>> GetVisits(int routeId, [FromQuery] DateTime? date)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
                if (await RouteAccessAsync(routeId) == RouteAccessLevel.None) return RouteNotFound<List<CustomerVisitDto>>();
                var visits = await _routeService.GetCustomerVisitsAsync(routeId, tenantId, date);
                return Ok(new ApiResponse<List<CustomerVisitDto>> { Success = true, Data = visits });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetVisits failed route={RouteId}", routeId);
                return StatusCode(500, new ApiResponse<List<CustomerVisitDto>>
                {
                    Success = false,
                    Message = "Failed to load visits.",
                    Errors = new List<string> { ex.Message }
                });
            }
        }
    }
}
