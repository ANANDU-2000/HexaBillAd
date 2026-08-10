/*
 * Customer Visit Status API - Track visit status for route collection sheets.
 * Writes go through IRouteService (single path with stop-location pin rules).
 */
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions;
using System.Security.Claims;

namespace HexaBill.Api.Modules.Branches
{
    [ApiController]
    [Route("api/routes/{routeId:int}/visits")]
    [Authorize]
    public class CustomerVisitsController : TenantScopedController
    {
        private readonly IRouteService _routeService;
        private readonly ILogger<CustomerVisitsController> _logger;

        public CustomerVisitsController(IRouteService routeService, ILogger<CustomerVisitsController> logger)
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

                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var staffId = int.TryParse(userIdClaim, out var uid) ? uid : 0;

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

                var visit = await _routeService.UpdateCustomerVisitAsync(routeId, request.CustomerId, update, staffId, tenantId);
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
