using System.Collections.Concurrent;
using HexaBill.Api.Core.Authorization;
using HexaBill.Api.Core.Tenancy;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HexaBill.Api.Modules.SuperAdmin;

[ApiController]
[Route("api/backup/agent")]
[Authorize(AuthenticationSchemes = BackupAgentAuthenticationHandler.AgentScheme)]
public class BackupAgentController : ControllerBase
{
    private static readonly ConcurrentDictionary<string, (int Count, DateTime Window)> PairAttempts = new();
    private readonly IBackupAgentService _agent;
    private readonly AppDbContext _context;
    private readonly ILogger<BackupAgentController> _logger;

    public BackupAgentController(IBackupAgentService agent, AppDbContext context, ILogger<BackupAgentController> logger)
    {
        _agent = agent;
        _context = context;
        _logger = logger;
    }

    [AllowAnonymous]
    [HttpPost("pair")]
    public async Task<ActionResult<ApiResponse<AgentSession>>> Pair([FromBody] PairAgentRequest request, CancellationToken ct)
    {
        if (!AllowPairAttempt())
            return StatusCode(429, new ApiResponse<AgentSession> { Success = false, Message = "Too many pairing attempts. Wait a few minutes." });
        var hostTenant = HostTenantId();
        try
        {
            var session = await _agent.PairAsync(hostTenant, request?.Code ?? "", request?.DisplayName ?? "", ct);
            if (session == null)
                return BadRequest(new ApiResponse<AgentSession> { Success = false, Message = "That pairing code is not valid." });
            return Ok(new ApiResponse<AgentSession> { Success = true, Message = "This PC is connected.", Data = session });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Backup agent pairing failed");
            return StatusCode(500, new ApiResponse<AgentSession> { Success = false, Message = "This PC could not be connected." });
        }
    }

    [HttpPost("heartbeat")]
    public async Task<ActionResult<ApiResponse<bool>>> Heartbeat([FromBody] AgentHeartbeatRequest request, CancellationToken ct)
    {
        if (!TryBind(out var tenantId, out var deviceId, out var error))
            return error!;
        var ok = await _agent.HeartbeatAsync(tenantId, deviceId, request?.FolderLabel, request?.Version, ct);
        return ok
            ? Ok(new ApiResponse<bool> { Success = true, Data = true })
            : NotFound(new ApiResponse<bool> { Success = false, Message = "This PC is no longer connected." });
    }

    [HttpGet("config")]
    public async Task<ActionResult<ApiResponse<AgentConfigDto>>> Config(CancellationToken ct)
    {
        if (!TryBind(out var tenantId, out var deviceId, out var error))
            return error!;
        var config = await _agent.GetConfigAsync(tenantId, deviceId, ct);
        if (config == null)
            return NotFound(new ApiResponse<AgentConfigDto> { Success = false, Message = "This PC is no longer connected." });
        return Ok(new ApiResponse<AgentConfigDto> { Success = true, Data = config });
    }

    [HttpPost("jobs/claim")]
    public async Task<ActionResult<ApiResponse<AgentJobDto>>> Claim(CancellationToken ct)
    {
        if (!TryBind(out var tenantId, out var deviceId, out var error))
            return error!;
        try
        {
            var job = await _agent.ClaimAsync(tenantId, deviceId, ct);
            if (job == null)
                return StatusCode(403, new ApiResponse<AgentJobDto> { Success = false, Message = "Automatic local backup is not enabled for this company." });
            return Ok(new ApiResponse<AgentJobDto> { Success = true, Data = job, Message = job.Message ?? "" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Backup claim failed for device {DeviceId}", deviceId);
            return StatusCode(500, new ApiResponse<AgentJobDto> { Success = false, Message = BackupRunRules.CouldNotComplete });
        }
    }

    [HttpGet("jobs/{id:int}/file")]
    public async Task<IActionResult> Download(int id, CancellationToken ct)
    {
        if (!TryBind(out var tenantId, out var deviceId, out var error))
            return error!;
        var opened = await _agent.OpenDownloadAsync(tenantId, deviceId, id, ct);
        if (opened == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Backup file was not found." });
        return new FileStreamResult(opened.Value.Stream, "application/zip") { FileDownloadName = opened.Value.DownloadName };
    }

    [HttpPost("jobs/{id:int}/report")]
    public async Task<ActionResult<ApiResponse<bool>>> Report(int id, [FromBody] AgentReportDto report, CancellationToken ct)
    {
        if (!TryBind(out var tenantId, out var deviceId, out var error))
            return error!;
        var ok = await _agent.ReportAsync(tenantId, deviceId, id, report ?? new AgentReportDto(), ct);
        return ok
            ? Ok(new ApiResponse<bool> { Success = true, Data = true })
            : NotFound(new ApiResponse<bool> { Success = false, Message = "Backup was not found." });
    }

    private bool TryBind(out int tenantId, out int deviceId, out ActionResult? error)
    {
        tenantId = 0;
        deviceId = 0;
        error = null;
        var tid = User.FindFirst("tid")?.Value;
        var did = User.FindFirst("did")?.Value;
        var scope = User.FindFirst("scope")?.Value;
        if (scope != BackupAgentSecrets.Scope || !int.TryParse(tid, out tenantId) || !int.TryParse(did, out deviceId) || tenantId <= 0)
        {
            error = Forbid();
            return false;
        }
        var hostTenant = HostTenantId();
        if (hostTenant is > 0 && hostTenant != tenantId)
        {
            error = Forbid();
            return false;
        }
        _context.SetRequestTenantScope(tenantId, false);
        HttpContext.Items["TenantId"] = tenantId;
        return true;
    }

    private int? HostTenantId()
    {
        if (HttpContext.Items.TryGetValue(TenantHostMiddleware.ResolutionItemKey, out var hostObj) &&
            hostObj is TenantHostResolution host &&
            host.Kind == TenantHostKind.Tenant)
            return host.TenantId;
        return null;
    }

    private bool AllowPairAttempt()
    {
        var key = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var now = DateTime.UtcNow;
        var entry = PairAttempts.AddOrUpdate(key,
            _ => (1, now),
            (_, current) => now - current.Window > TimeSpan.FromMinutes(10) ? (1, now) : (current.Count + 1, current.Window));
        return entry.Count <= 8;
    }
}

public class PairAgentRequest
{
    public string Code { get; set; } = "";
    public string DisplayName { get; set; } = "";
}

public class AgentHeartbeatRequest
{
    public string? FolderLabel { get; set; }
    public string? Version { get; set; }
}
