using HexaBill.Api.Core.Tenancy;
using HexaBill.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HexaBill.Api.Modules.DailyClose;

[Authorize]
[ApiController]
[Route("api/daily-close")]
public class DailyCloseController : TenantScopedController
{
    private readonly IDailyCloseService _dailyCloseService;
    private readonly ILogger<DailyCloseController> _logger;

    public DailyCloseController(IDailyCloseService dailyCloseService, ILogger<DailyCloseController> logger)
    {
        _dailyCloseService = dailyCloseService;
        _logger = logger;
    }

    [HttpGet("preview")]
    public async Task<ActionResult<ApiResponse<DailyClosePreviewDto>>> Preview(
        [FromQuery] DateTime businessDate,
        [FromQuery] decimal openingCash = 0,
        [FromQuery] int? branchId = null)
    {
        try
        {
            if (CurrentTenantId <= 0) return Forbid();
            var data = await _dailyCloseService.GetPreviewAsync(CurrentTenantId, businessDate, openingCash, branchId);
            return Ok(new ApiResponse<DailyClosePreviewDto> { Success = true, Message = "Preview ready", Data = data });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<DailyClosePreviewDto> { Success = false, Message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ApiResponse<DailyClosePreviewDto> { Success = false, Message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Daily close preview failed for tenant {TenantId}", CurrentTenantId);
            return StatusCode(500, new ApiResponse<DailyClosePreviewDto> { Success = false, Message = "An error occurred" });
        }
    }

    [HttpGet("status")]
    public async Task<ActionResult<ApiResponse<DailyCloseStatusDto>>> Status(
        [FromQuery] DateTime businessDate,
        [FromQuery] int? branchId = null)
    {
        try
        {
            if (CurrentTenantId <= 0) return Forbid();
            var data = await _dailyCloseService.GetStatusAsync(CurrentTenantId, businessDate, branchId);
            return Ok(new ApiResponse<DailyCloseStatusDto> { Success = true, Message = "Status retrieved", Data = data });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<DailyCloseStatusDto> { Success = false, Message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ApiResponse<DailyCloseStatusDto> { Success = false, Message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Daily close status failed for tenant {TenantId}", CurrentTenantId);
            return StatusCode(500, new ApiResponse<DailyCloseStatusDto> { Success = false, Message = "An error occurred" });
        }
    }

    [HttpGet("history")]
    public async Task<ActionResult<ApiResponse<List<DailyCashCloseDto>>>> History(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int? branchId = null)
    {
        try
        {
            if (CurrentTenantId <= 0) return Forbid();
            var data = await _dailyCloseService.GetHistoryAsync(CurrentTenantId, from, to, branchId);
            return Ok(new ApiResponse<List<DailyCashCloseDto>> { Success = true, Message = "History retrieved", Data = data });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<List<DailyCashCloseDto>> { Success = false, Message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ApiResponse<List<DailyCashCloseDto>> { Success = false, Message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Daily close history failed for tenant {TenantId}", CurrentTenantId);
            return StatusCode(500, new ApiResponse<List<DailyCashCloseDto>> { Success = false, Message = "An error occurred" });
        }
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<DailyCashCloseDto>>> Save([FromBody] SaveDailyCloseRequest request)
    {
        try
        {
            if (CurrentTenantId <= 0) return Forbid();
            var userId = int.Parse(User.FindFirst("UserId")?.Value ?? "0");
            if (userId <= 0) return Unauthorized();
            var data = await _dailyCloseService.SaveCloseAsync(request, CurrentTenantId, userId, IsAdmin);
            return Ok(new ApiResponse<DailyCashCloseDto> { Success = true, Message = request.SubmitClose ? "Day closed" : "Draft saved", Data = data });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ApiResponse<DailyCashCloseDto> { Success = false, Message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<DailyCashCloseDto> { Success = false, Message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Daily close save failed for tenant {TenantId}", CurrentTenantId);
            return StatusCode(500, new ApiResponse<DailyCashCloseDto> { Success = false, Message = "An error occurred" });
        }
    }

    [HttpGet("movements")]
    public async Task<ActionResult<ApiResponse<List<CashDrawerMovementDto>>>> Movements(
        [FromQuery] DateTime businessDate,
        [FromQuery] int? branchId = null)
    {
        try
        {
            if (CurrentTenantId <= 0) return Forbid();
            var data = await _dailyCloseService.GetMovementsAsync(CurrentTenantId, businessDate, branchId);
            return Ok(new ApiResponse<List<CashDrawerMovementDto>> { Success = true, Message = "Movements retrieved", Data = data });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<List<CashDrawerMovementDto>> { Success = false, Message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ApiResponse<List<CashDrawerMovementDto>> { Success = false, Message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Daily close movements list failed for tenant {TenantId}", CurrentTenantId);
            return StatusCode(500, new ApiResponse<List<CashDrawerMovementDto>> { Success = false, Message = "An error occurred" });
        }
    }

    [HttpPost("movements")]
    public async Task<ActionResult<ApiResponse<CashDrawerMovementDto>>> CreateMovement([FromBody] CreateCashDrawerMovementRequest request)
    {
        try
        {
            if (CurrentTenantId <= 0) return Forbid();
            var userId = int.Parse(User.FindFirst("UserId")?.Value ?? "0");
            if (userId <= 0) return Unauthorized();
            var data = await _dailyCloseService.CreateMovementAsync(request, CurrentTenantId, userId, IsAdmin);
            return Ok(new ApiResponse<CashDrawerMovementDto> { Success = true, Message = "Movement recorded", Data = data });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ApiResponse<CashDrawerMovementDto> { Success = false, Message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<CashDrawerMovementDto> { Success = false, Message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Daily close movement create failed for tenant {TenantId}", CurrentTenantId);
            return StatusCode(500, new ApiResponse<CashDrawerMovementDto> { Success = false, Message = "An error occurred" });
        }
    }

    [HttpDelete("movements/{id:int}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteMovement(int id)
    {
        try
        {
            if (CurrentTenantId <= 0) return Forbid();
            var userId = int.Parse(User.FindFirst("UserId")?.Value ?? "0");
            if (userId <= 0) return Unauthorized();
            await _dailyCloseService.DeleteMovementAsync(id, CurrentTenantId, userId, IsAdmin);
            return Ok(new ApiResponse<object> { Success = true, Message = "Movement deleted" });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Daily close movement delete failed for tenant {TenantId}", CurrentTenantId);
            return StatusCode(500, new ApiResponse<object> { Success = false, Message = "An error occurred" });
        }
    }

    [HttpPost("reopen")]
    public async Task<ActionResult<ApiResponse<DailyCashCloseDto>>> Reopen([FromBody] ReopenDailyCloseRequest request)
    {
        try
        {
            if (CurrentTenantId <= 0) return Forbid();
            var userId = int.Parse(User.FindFirst("UserId")?.Value ?? "0");
            if (userId <= 0) return Unauthorized();
            var data = await _dailyCloseService.ReopenAsync(request, CurrentTenantId, userId, IsAdmin);
            return Ok(new ApiResponse<DailyCashCloseDto> { Success = true, Message = "Day reopened for correction", Data = data });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ApiResponse<DailyCashCloseDto> { Success = false, Message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<DailyCashCloseDto> { Success = false, Message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Daily close reopen failed for tenant {TenantId}", CurrentTenantId);
            return StatusCode(500, new ApiResponse<DailyCashCloseDto> { Success = false, Message = "An error occurred" });
        }
    }
}
