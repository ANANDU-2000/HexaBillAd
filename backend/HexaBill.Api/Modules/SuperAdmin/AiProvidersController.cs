using System.Text.Json;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Assistant.Ai;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Modules.SuperAdmin;

/// <summary>
/// Platform view and control of the AI providers: which are configured, a connectivity test with a fixed synthetic prompt,
/// which free/paid models are used and in what order, daily limits, an off switch, and usage per company.
/// Platform administrators only. Keys are never returned or accepted here (they live in the server environment), prompts and
/// answers are never stored, and a test uses no company data.
/// </summary>
[ApiController]
[Route("api/superadmin/ai")]
[Authorize(Roles = "SystemAdmin")]
public class AiProvidersController : ControllerBase
{
    private readonly AiGateway _gateway;
    private readonly AiRuntimeSettingsStore _runtime;
    private readonly AppDbContext _db;
    private readonly IHttpClientFactory _http;
    private readonly ILogger<AiProvidersController> _logger;

    public AiProvidersController(AiGateway gateway, AiRuntimeSettingsStore runtime, AppDbContext db, IHttpClientFactory http, ILogger<AiProvidersController> logger)
    {
        _gateway = gateway; _runtime = runtime; _db = db; _http = http; _logger = logger;
    }

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
                effective = _gateway.Effective(),
                runtime = _runtime.Current,
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

    /// <summary>Save the administrator's choices. Everything is validated and clamped; unknown provider keys are rejected.</summary>
    [HttpPut("runtime")]
    public async Task<IActionResult> SaveRuntime([FromBody] AiRuntime body, CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        if (body == null) return BadRequest(new ApiResponse<object> { Success = false, Message = "Nothing to save." });
        var known = _gateway.Status().Select(s => s.Key).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var named = new[] { body.Provider }.Concat(body.Fallbacks ?? Array.Empty<string>()).Concat(body.Models?.Keys ?? Enumerable.Empty<string>()).Where(k => !string.IsNullOrWhiteSpace(k));
        var unknown = named.FirstOrDefault(k => !known.Contains(k!));
        if (unknown != null) return BadRequest(new ApiResponse<object> { Success = false, Message = $"Unknown provider '{unknown}'. Providers and their keys are set in the server environment." });
        await _runtime.SaveAsync(body, ct);
        _logger.LogInformation("AI runtime settings updated by platform administrator");
        return Ok(new ApiResponse<object> { Success = true, Message = "Saved.", Data = new { runtime = _runtime.Current, effective = _gateway.Effective() } });
    }

    /// <summary>Clears the administrator's choices so the server environment applies again.</summary>
    [HttpDelete("runtime")]
    public async Task<IActionResult> ResetRuntime(CancellationToken ct)
    {
        await _runtime.SaveAsync(new AiRuntime(), ct);
        return Ok(new ApiResponse<object> { Success = true, Message = "Reset to the server environment.", Data = new { effective = _gateway.Effective() } });
    }

    /// <summary>
    /// Models OpenRouter lists as free (prompt and completion price both zero). Fetched live from OpenRouter's public list;
    /// nothing is hard-coded, so names and availability are always current.
    /// </summary>
    [HttpGet("openrouter/models")]
    public async Task<IActionResult> OpenRouterModels([FromQuery] bool freeOnly = true, CancellationToken ct = default)
    {
        Response.Headers["Cache-Control"] = "no-store";
        try
        {
            var client = _http.CreateClient("ai-openrouter-catalog");
            client.Timeout = TimeSpan.FromSeconds(15);
            using var response = await client.GetAsync("https://openrouter.ai/api/v1/models", ct);
            response.EnsureSuccessStatusCode();
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
            var list = new List<object>();
            foreach (var m in doc.RootElement.GetProperty("data").EnumerateArray())
            {
                var id = m.TryGetProperty("id", out var i) ? i.GetString() : null;
                if (string.IsNullOrWhiteSpace(id)) continue;
                decimal prompt = -1, completion = -1;
                if (m.TryGetProperty("pricing", out var pr))
                {
                    decimal.TryParse(pr.TryGetProperty("prompt", out var p) ? p.GetString() : null, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out prompt);
                    decimal.TryParse(pr.TryGetProperty("completion", out var c) ? c.GetString() : null, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out completion);
                }
                var free = prompt == 0 && completion == 0;
                if (freeOnly && !free) continue;
                // Only text-in, text-out chat models are useful for the assistant.
                var modality = m.TryGetProperty("architecture", out var a) && a.TryGetProperty("modality", out var mo) ? mo.GetString() : null;
                if (modality != null && !modality.EndsWith("->text", StringComparison.OrdinalIgnoreCase)) continue;
                list.Add(new
                {
                    id,
                    name = m.TryGetProperty("name", out var n) ? n.GetString() : id,
                    contextLength = m.TryGetProperty("context_length", out var cl) && cl.TryGetInt32(out var ctx) ? ctx : (int?)null,
                    free,
                    promptPerMillion = prompt >= 0 ? prompt * 1_000_000m : (decimal?)null,
                    completionPerMillion = completion >= 0 ? completion * 1_000_000m : (decimal?)null,
                });
            }
            return Ok(new ApiResponse<object> { Success = true, Data = new { count = list.Count, models = list.Take(300) } });
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or KeyNotFoundException)
        {
            _logger.LogWarning("OpenRouter model list could not be fetched ({Error})", ex.GetType().Name);
            return Ok(new ApiResponse<object> { Success = false, Message = "The OpenRouter model list could not be fetched right now." });
        }
    }

    /// <summary>Calls and tokens per company: today and the last 7 days. Counts only, no content.</summary>
    [HttpGet("usage")]
    public async Task<IActionResult> Usage(CancellationToken ct)
    {
        Response.Headers["Cache-Control"] = "no-store";
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var since = today.AddDays(-6);
        var rows = await _db.Set<AiUsageDaily>().IgnoreQueryFilters().AsNoTracking().Where(r => r.Day >= since).ToListAsync(ct);
        var names = await _db.Tenants.IgnoreQueryFilters().AsNoTracking().Where(t => rows.Select(r => r.TenantId).Contains(t.Id)).ToDictionaryAsync(t => t.Id, t => t.Name, ct);
        var perTenant = rows.GroupBy(r => r.TenantId).Select(g => new
        {
            tenantId = g.Key,
            name = names.GetValueOrDefault(g.Key) ?? $"Company {g.Key}",
            todayCalls = g.Where(r => r.Day == today).Sum(r => r.Calls),
            todayTokens = g.Where(r => r.Day == today).Sum(r => r.Tokens),
            weekCalls = g.Sum(r => r.Calls),
            weekTokens = g.Sum(r => (long)r.Tokens),
        }).OrderByDescending(x => x.todayCalls).ThenByDescending(x => x.weekCalls).ToList();
        var perDay = rows.GroupBy(r => r.Day).OrderBy(g => g.Key).Select(g => new { day = g.Key.ToString("yyyy-MM-dd"), calls = g.Sum(r => r.Calls), tokens = g.Sum(r => (long)r.Tokens) }).ToList();
        return Ok(new ApiResponse<object> { Success = true, Data = new { perTenant, perDay, effective = _gateway.Effective() } });
    }
}
