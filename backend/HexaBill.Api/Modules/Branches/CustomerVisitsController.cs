/*
 * Customer Visit Status API - Track visit status for route collection sheets.
 */
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
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
        private readonly AppDbContext _context;

        public CustomerVisitsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<CustomerVisitDto>>> UpdateVisitStatus(int routeId, [FromBody] UpdateVisitStatusRequest request)
        {
            try
            {
                var tenantId = CurrentTenantId;
                if (tenantId <= 0 && !IsSystemAdmin) return Forbid();

                // Validate route exists and belongs to tenant
                var route = await _context.Routes
                    .FirstOrDefaultAsync(r => r.Id == routeId && (tenantId <= 0 || r.TenantId == tenantId));
                if (route == null) return NotFound(new ApiResponse<CustomerVisitDto> { Success = false, Message = "Route not found." });

                // Validate customer exists and belongs to tenant
                var customer = await _context.Customers
                    .FirstOrDefaultAsync(c => c.Id == request.CustomerId && (tenantId <= 0 || c.TenantId == tenantId));
                if (customer == null) return NotFound(new ApiResponse<CustomerVisitDto> { Success = false, Message = "Customer not found." });

                // Parse status
                if (!Enum.TryParse<VisitStatus>(request.Status, true, out var visitStatus))
                {
                    return BadRequest(new ApiResponse<CustomerVisitDto> { Success = false, Message = $"Invalid status: {request.Status}" });
                }

                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var staffId = int.TryParse(userIdClaim, out var uid) ? uid : (int?)null;

                var visitDate = request.VisitDate.Date;

                // Find existing visit or create new
                var existingVisit = await _context.CustomerVisits
                    .FirstOrDefaultAsync(v => v.RouteId == routeId && 
                                             v.CustomerId == request.CustomerId && 
                                             v.VisitDate.Date == visitDate &&
                                             (tenantId <= 0 || v.TenantId == tenantId));

                CustomerVisit visit;
                if (existingVisit != null)
                {
                    visit = existingVisit;
                    visit.Status = visitStatus;
                    visit.Notes = request.Notes;
                    visit.AmountCollected = request.AmountCollected;
                    visit.UpdatedAt = DateTime.UtcNow;
                    if (staffId.HasValue) visit.StaffId = staffId;
                }
                else
                {
                    visit = new CustomerVisit
                    {
                        RouteId = routeId,
                        CustomerId = request.CustomerId,
                        TenantId = tenantId > 0 ? tenantId : customer.TenantId ?? 0,
                        StaffId = staffId,
                        VisitDate = visitDate,
                        Status = visitStatus,
                        Notes = request.Notes,
                        AmountCollected = request.AmountCollected,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.CustomerVisits.Add(visit);
                }

                await _context.SaveChangesAsync();

                // Load customer name and staff name for response
                var visitDto = new CustomerVisitDto
                {
                    Id = visit.Id,
                    RouteId = visit.RouteId,
                    CustomerId = visit.CustomerId,
                    CustomerName = customer.Name ?? "",
                    VisitDate = visit.VisitDate,
                    Status = visit.Status.ToString(),
                    Notes = visit.Notes,
                    AmountCollected = visit.AmountCollected,
                    StaffId = visit.StaffId,
                    StaffName = visit.StaffId.HasValue ? (await _context.Users.FindAsync(visit.StaffId))?.Name : null,
                    CreatedAt = visit.CreatedAt
                };

                return Ok(new ApiResponse<CustomerVisitDto> { Success = true, Data = visitDto, Message = "Visit status updated." });
            }
            catch (Exception ex)
            {
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

                var visitDate = date?.Date ?? DateTime.UtcNow.Date;
                var dateStart = visitDate;
                var dateEnd = dateStart.AddDays(1).AddTicks(-1);

                var visits = await _context.CustomerVisits
                    .Where(v => v.RouteId == routeId && 
                               v.VisitDate >= dateStart && v.VisitDate < dateEnd &&
                               (tenantId <= 0 || v.TenantId == tenantId))
                    .Include(v => v.Customer)
                    .Include(v => v.Staff)
                    .Select(v => new CustomerVisitDto
                    {
                        Id = v.Id,
                        RouteId = v.RouteId,
                        CustomerId = v.CustomerId,
                        CustomerName = v.Customer.Name ?? "",
                        VisitDate = v.VisitDate,
                        Status = v.Status.ToString(),
                        Notes = v.Notes,
                        AmountCollected = v.AmountCollected,
                        StaffId = v.StaffId,
                        StaffName = v.Staff != null ? v.Staff.Name : null,
                        CreatedAt = v.CreatedAt
                    })
                    .ToListAsync();

                return Ok(new ApiResponse<List<CustomerVisitDto>> { Success = true, Data = visits });
            }
            catch (Exception ex)
            {
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
