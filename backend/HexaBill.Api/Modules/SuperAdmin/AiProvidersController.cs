using HexaBill.Api.Models;
using HexaBill.Api.Modules.Assistant.Ai;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HexaBill.Api.Modules.SuperAdmin;

/// <summary>
/// Platform view of the AI providers: which are configured, and a connectivity test with a fixed synthetic prompt.
/// Platform administrators only. Keys are never returned, prompts and answers are never stored, and a test uses no company data.
/// </summary>
[ApiController]
[Route("api/superadmin/ai")]
[Authorize(Roles = "SystemAdmin")]
public class AiProvidersController : ControllerBase
{
    private readonly AiGateway _gateway;

    public AiProvidersController(AiGateway gateway) => _gateway = gateway;

    [HttpGet("providers")]
    public IActionResult Providers()
    {
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(new ApiResponse<object>
        {
            Success = true,
            Data = new
            {
                enabled = _gateway.IsEnabled,
                customerDataAllowed = _gateway.AllowsCustomerData,
                providers = _gateway.Status(),
            },
        });
    }

    [HttpPost("providers/{key}/test")]
    public async Task<IActionResult> Test(string key, CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        var result = await _gateway.TestProviderAsync(key, ct);
        return Ok(new ApiResponse<AiProviderTest> { Success = result.Ok, Message = result.Ok ? "The provider answered." : result.Failure, Data = result });
    }
}
