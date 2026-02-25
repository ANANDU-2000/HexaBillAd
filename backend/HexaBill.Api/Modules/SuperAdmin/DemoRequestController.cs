using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Shared.Extensions;
using HexaBill.Api.Models;

namespace HexaBill.Api.Modules.SuperAdmin;

[ApiController]
[Route("api/[controller]")]
public class DemoRequestController : TenantScopedController
{
    private readonly IDemoRequestService _service;

    public DemoRequestController(IDemoRequestService service)
    {
        _service = service;
    }

    [HttpPost]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<DemoRequestDto>>> CreateDemoRequest([FromBody] CreateDemoRequestDto request)
    {
        try
        {
            var demo = await _service.CreateDemoRequestAsync(request);
            return Ok(new ApiResponse<DemoRequestDto> { Success = true, Message = "Demo request submitted", Data = demo });
        }
        catch (Exception ex)
        {
            return BadRequest(new ApiResponse<DemoRequestDto> { Success = false, Message = ex.Message });
        }
    }

    [HttpGet]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PagedResponse<DemoRequestDto>>>> GetDemoRequests(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null)
    {
        if (!IsSystemAdmin) return Forbid();
        try
        {
            DemoRequestStatus? statusFilter = null;
            if (!string.IsNullOrEmpty(status) && Enum.TryParse<DemoRequestStatus>(status, true, out var s))
                statusFilter = s;
            var result = await _service.GetDemoRequestsAsync(page, pageSize, statusFilter);
            return Ok(new ApiResponse<PagedResponse<DemoRequestDto>> { Success = true, Data = result });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new ApiResponse<PagedResponse<DemoRequestDto>> { Success = false, Message = ex.Message });
        }
    }

    [HttpGet("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<DemoRequestDto>>> GetDemoRequest(int id)
    {
        if (!IsSystemAdmin) return Forbid();
        var demo = await _service.GetDemoRequestByIdAsync(id);
        if (demo == null) return NotFound(new ApiResponse<DemoRequestDto> { Success = false, Message = "Not found" });
        return Ok(new ApiResponse<DemoRequestDto> { Success = true, Data = demo });
    }

    [HttpPost("{id}/approve")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> ApproveDemoRequest(int id, [FromBody] ApproveDemoRequestDto request)
    {
        if (!IsSystemAdmin) return Forbid();
        var userId = User.FindFirst("user_id")?.Value;
        if (!int.TryParse(userId, out var uid)) return Unauthorized();
        var success = await _service.ApproveDemoRequestAsync(id, request.PlanId, request.TrialDays, uid);
        if (!success) return BadRequest(new ApiResponse<object> { Success = false, Message = "Cannot approve" });
        return Ok(new ApiResponse<object> { Success = true, Message = "Approved" });
    }

    [HttpPost("{id}/reject")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> RejectDemoRequest(int id, [FromBody] RejectDemoRequestDto request)
    {
        if (!IsSystemAdmin) return Forbid();
        var userId = User.FindFirst("user_id")?.Value;
        if (!int.TryParse(userId, out var uid)) return Unauthorized();
        var success = await _service.RejectDemoRequestAsync(id, request.Reason, uid);
        if (!success) return BadRequest(new ApiResponse<object> { Success = false, Message = "Cannot reject" });
        return Ok(new ApiResponse<object> { Success = true, Message = "Rejected" });
    }

    [HttpPost("{id}/convert")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> ConvertToTenant(int id)
    {
        if (!IsSystemAdmin) return Forbid();
        var userId = User.FindFirst("user_id")?.Value;
        if (!int.TryParse(userId, out var uid)) return Unauthorized();
        var success = await _service.ConvertToTenantAsync(id, uid);
        if (!success) return BadRequest(new ApiResponse<object> { Success = false, Message = "Cannot convert" });
        return Ok(new ApiResponse<object> { Success = true, Message = "Tenant created" });
    }
}

public class ApproveDemoRequestDto
{
    public int PlanId { get; set; }
    public int TrialDays { get; set; } = 14;
}

public class RejectDemoRequestDto
{
    public string Reason { get; set; } = string.Empty;
}
