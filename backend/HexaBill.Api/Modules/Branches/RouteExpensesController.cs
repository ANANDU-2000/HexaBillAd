/*
 * Route expenses API - Fuel, Staff, Delivery, Misc per route.
 */
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions;
using System.Security.Claims;

namespace HexaBill.Api.Modules.Branches
{
    [ApiController]
    [Route("api/routes/{routeId:int}/expenses")]
    [Authorize]
    public class RouteExpensesController : TenantScopedController
    {
        private readonly IRouteService _routeService;

        public RouteExpensesController(IRouteService routeService)
        {
            _routeService = routeService;
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<List<RouteExpenseDto>>>> GetRouteExpenses(int routeId, [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            var list = await _routeService.GetRouteExpensesAsync(routeId, tenantId, fromDate, toDate);
            return Ok(new ApiResponse<List<RouteExpenseDto>> { Success = true, Data = list });
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<RouteExpenseDto>>> CreateRouteExpense(int routeId, [FromBody] CreateRouteExpenseRequest request)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            request.RouteId = routeId;
            var expense = await _routeService.CreateRouteExpenseAsync(request, userId, tenantId);
            if (expense == null) return NotFound(new ApiResponse<RouteExpenseDto> { Success = false, Message = "Route not found." });
            return CreatedAtAction(nameof(GetRouteExpenses), new { routeId }, new ApiResponse<RouteExpenseDto> { Success = true, Data = expense });
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<object>>> DeleteRouteExpense(int routeId, int id)
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0 && !IsSystemAdmin) return Forbid();
            var ok = await _routeService.DeleteRouteExpenseAsync(id, tenantId);
            if (!ok) return NotFound(new ApiResponse<object> { Success = false, Message = "Expense not found." });
            return Ok(new ApiResponse<object> { Success = true, Message = "Expense deleted." });
        }
    }
}
