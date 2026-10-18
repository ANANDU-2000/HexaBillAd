using System.Collections.Concurrent;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace HexaBill.Api.Modules.Assistant.Ai;

/// <summary>
/// Server-side AI provider layer. OFF unless configured; the assistant chat is the only feature that calls it.
/// Keys are read only from server configuration (environment or secret store), never from a request, never logged,
/// never returned. Exact model names, base URLs and prices come from configuration, not from this code.
/// </summary>
public sealed class AiOptions
{
    public const string Section = "Ai";

    /// <summary>Master switch. Default false: every call returns Disabled and no provider is contacted.</summary>
    public bool Enabled { get; set; }

    /// <summary>Key into <see cref="Providers"/> used first. Empty means none.</summary>
    public string Provider { get; set; } = string.Empty;

    /// <summary>Optional second provider, used only when the first fails. A paid fallback also needs <see cref="AllowPaidFallback"/>.</summary>
    public string FallbackProvider { get; set; } = string.Empty;

    public bool AllowPaidFallback { get; set; }

    /// <summary>Must be set by the owner after a provider's data-use, retention and region terms were approved. Default false.</summary>
    public bool AllowCustomerData { get; set; }
    /// <summary>Operator-reviewed retention/region/data-use policy shown to each owner before consent. Empty keeps consent disabled.</summary>
    public string DataPolicyVersion { get; set; } = string.Empty;
    public string DataPolicyNotice { get; set; } = string.Empty;

    public int DailyCallLimitPerTenant { get; set; } = 200;
    public int DailyTokenLimitPerTenant { get; set; } = 200_000;
    public int TimeoutSeconds { get; set; } = 20;
    public int MaxPromptChars { get; set; } = 8_000;

    public Dictionary<string, AiProviderOptions> Providers { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

public sealed class AiProviderOptions
{
    /// <summary>"openai-compatible" (OpenAI, Groq, OpenRouter and similar) or "gemini".</summary>
    public string Kind { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    /// <summary>Set through server configuration only. Never put a real value in a file under source control.</summary>
    public string ApiKey { get; set; } = string.Empty;
    /// <summary>True when calls cost money. A paid provider is never used as a silent fallback.</summary>
    public bool Paid { get; set; }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(ApiKey) && !string.IsNullOrWhiteSpace(Model) && !string.IsNullOrWhiteSpace(BaseUrl)
        && (Kind.Equals("openai-compatible", StringComparison.OrdinalIgnoreCase) || Kind.Equals("gemini", StringComparison.OrdinalIgnoreCase));
}

public sealed record AiCall(int TenantId, int UserId, string Purpose, string Prompt, bool ContainsCustomerData, string? System = null);

public enum AiOutcome { Ok, Disabled, Refused, Unavailable }

/// <summary>Result of a call. The text is non-authoritative output; callers must never post it to the books without a person confirming.</summary>
public sealed record AiResult(AiOutcome Outcome, string? Text, string? Provider, string? Reason, int InputTokens = 0, int OutputTokens = 0, bool TokensEstimated = false)
{
    public bool Ok => Outcome == AiOutcome.Ok;
}

public sealed record ProviderReply(string Text, int? InputTokens, int? OutputTokens);

/// <summary>What a platform administrator may see about a provider. Never the key, never a prompt.</summary>
public sealed record AiProviderStatus(string Key, string Kind, string Model, bool Configured, bool Paid, bool IsPrimary, bool IsFallback);

/// <summary>Outcome of a connectivity test with a fixed synthetic prompt. Failure is a short category, never a response body.</summary>
public sealed record AiProviderTest(string Provider, bool Configured, bool Ok, long LatencyMs, string? Model, string? Failure);

public interface IAiProvider
{
    string Key { get; }
    bool Paid { get; }
    bool IsConfigured { get; }
    Task<ProviderReply> CompleteAsync(string? system, string prompt, CancellationToken ct);
}

public interface IAiUsageLedger
{
    /// <summary>Atomically checks the daily limits for a tenant and reserves one call plus the estimated tokens.</summary>
    bool TryReserve(int tenantId, int estimatedTokens, int callLimit, int tokenLimit, DateTime utcNow);
    void Settle(int tenantId, int estimatedTokens, int actualTokens, DateTime utcNow);
}

/// <summary>Per-process ledger. Good enough for one instance; a persistent ledger is needed before several instances share a budget.</summary>
public sealed class InMemoryAiUsageLedger : IAiUsageLedger
{
    private readonly ConcurrentDictionary<(int Tenant, DateOnly Day), (int Calls, int Tokens)> _usage = new();
    private readonly object _gate = new();

    public bool TryReserve(int tenantId, int estimatedTokens, int callLimit, int tokenLimit, DateTime utcNow)
    {
        var key = (tenantId, DateOnly.FromDateTime(utcNow));
        lock (_gate)
        {
            var current = _usage.GetValueOrDefault(key);
            if (current.Calls + 1 > callLimit || current.Tokens + estimatedTokens > tokenLimit) return false;
            _usage[key] = (current.Calls + 1, current.Tokens + estimatedTokens);
            return true;
        }
    }

    public void Settle(int tenantId, int estimatedTokens, int actualTokens, DateTime utcNow)
    {
        var key = (tenantId, DateOnly.FromDateTime(utcNow));
        lock (_gate)
        {
            var current = _usage.GetValueOrDefault(key);
            _usage[key] = (current.Calls, Math.Max(0, current.Tokens - estimatedTokens + actualTokens));
        }
    }

    public (int Calls, int Tokens) Snapshot(int tenantId, DateTime utcNow) => _usage.GetValueOrDefault((tenantId, DateOnly.FromDateTime(utcNow)));
}

/// <summary>OpenAI-style chat completions (OpenAI, Groq, OpenRouter and other compatible services).</summary>
public sealed class OpenAiCompatibleProvider : IAiProvider
{
    private readonly HttpClient _http;
    private readonly AiProviderOptions _options;
    public string Key { get; }
    public bool Paid => _options.Paid;
    public bool IsConfigured => _options.IsConfigured;

    public OpenAiCompatibleProvider(string key, AiProviderOptions options, HttpClient http) { Key = key; _options = options; _http = http; }

    public async Task<ProviderReply> CompleteAsync(string? system, string prompt, CancellationToken ct)
    {
        var messages = new List<object>();
        if (!string.IsNullOrWhiteSpace(system)) messages.Add(new { role = "system", content = system });
        messages.Add(new { role = "user", content = prompt });
        using var request = new HttpRequestMessage(HttpMethod.Post, _options.BaseUrl.TrimEnd('/') + "/chat/completions")
        {
            Content = new StringContent(JsonSerializer.Serialize(new { model = _options.Model, messages }), Encoding.UTF8, "application/json"),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);
        using var response = await _http.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        var root = doc.RootElement;
        var text = root.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString() ?? string.Empty;
        int? input = null, output = null;
        if (root.TryGetProperty("usage", out var usage))
        {
            if (usage.TryGetProperty("prompt_tokens", out var p) && p.TryGetInt32(out var pi)) input = pi;
            if (usage.TryGetProperty("completion_tokens", out var c) && c.TryGetInt32(out var ci)) output = ci;
        }
        return new ProviderReply(text, input, output);
    }
}

/// <summary>Google Gemini generateContent. The key goes in a header, never in the URL, so it cannot end up in access logs.</summary>
public sealed class GeminiProvider : IAiProvider
{
    private readonly HttpClient _http;
    private readonly AiProviderOptions _options;
    public string Key { get; }
    public bool Paid => _options.Paid;
    public bool IsConfigured => _options.IsConfigured;

    public GeminiProvider(string key, AiProviderOptions options, HttpClient http) { Key = key; _options = options; _http = http; }

    public async Task<ProviderReply> CompleteAsync(string? system, string prompt, CancellationToken ct)
    {
        object body = string.IsNullOrWhiteSpace(system)
            ? new { contents = new[] { new { role = "user", parts = new[] { new { text = prompt } } } } }
            : new
            {
                systemInstruction = new { parts = new[] { new { text = system } } },
                contents = new[] { new { role = "user", parts = new[] { new { text = prompt } } } },
            };
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{_options.BaseUrl.TrimEnd('/')}/models/{Uri.EscapeDataString(_options.Model)}:generateContent")
        {
            Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"),
        };
        request.Headers.Add("x-goog-api-key", _options.ApiKey);
        using var response = await _http.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        var root = doc.RootElement;
        var text = root.GetProperty("candidates")[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString() ?? string.Empty;
        int? input = null, output = null;
        if (root.TryGetProperty("usageMetadata", out var usage))
        {
            if (usage.TryGetProperty("promptTokenCount", out var p) && p.TryGetInt32(out var pi)) input = pi;
            if (usage.TryGetProperty("candidatesTokenCount", out var c) && c.TryGetInt32(out var ci)) output = ci;
        }
        return new ProviderReply(text, input, output);
    }
}

/// <summary>Deterministic provider for tests and for running the product with AI wired but no external service.</summary>
public sealed class MockAiProvider : IAiProvider
{
    public string Key => "mock";
    public bool Paid => false;
    public bool IsConfigured => true;
    public Task<ProviderReply> CompleteAsync(string? system, string prompt, CancellationToken ct) =>
        Task.FromResult(new ProviderReply("[mock] " + (prompt.Length > 60 ? prompt[..60] : prompt), prompt.Length / 4, 8));
}

/// <summary>
/// The single entry point. Order of checks: switch, scope, prompt size, customer-data approval, daily limits, provider
/// configured, call with a timeout, optional free fallback. A failure never throws to the caller: the answer is Unavailable,
/// so the normal ERP screens keep working. Prompts, answers and keys are never logged.
/// </summary>
public sealed class AiGateway
{
    private readonly AiOptions _options;
    private readonly IReadOnlyDictionary<string, IAiProvider> _providers;
    private readonly IAiUsageLedger _ledger;
    private readonly ILogger<AiGateway> _logger;
    private readonly Func<DateTime> _clock;

    public AiGateway(IOptions<AiOptions> options, IEnumerable<IAiProvider> providers, IAiUsageLedger ledger, ILogger<AiGateway> logger, Func<DateTime>? clock = null)
    {
        _options = options.Value;
        _providers = providers.ToDictionary(p => p.Key, StringComparer.OrdinalIgnoreCase);
        _ledger = ledger;
        _logger = logger;
        _clock = clock ?? (() => DateTime.UtcNow);
    }

    private static int EstimateTokens(AiCall call) => Math.Max(1, ((call.Prompt?.Length ?? 0) + (call.System?.Length ?? 0)) / 4) + 256; // rough input plus allowance for the answer

    public async Task<AiResult> CompleteAsync(AiCall call, CancellationToken ct = default)
    {
        if (!_options.Enabled) return new AiResult(AiOutcome.Disabled, null, null, "AI is not enabled.");
        if (call.TenantId <= 0) return new AiResult(AiOutcome.Refused, null, null, "No company scope.");
        if (call.UserId <= 0) return new AiResult(AiOutcome.Refused, null, null, "No user scope.");
        if (string.IsNullOrWhiteSpace(call.Prompt)) return new AiResult(AiOutcome.Refused, null, null, "Empty request.");
        if (call.Prompt.Length > _options.MaxPromptChars) return new AiResult(AiOutcome.Refused, null, null, "The request is too long.");
        if (call.ContainsCustomerData && !_options.AllowCustomerData)
            return new AiResult(AiOutcome.Refused, null, null, "Customer data may not be sent to an AI provider until the owner approves its terms.");

        var primary = Resolve(_options.Provider);
        if (primary == null) return new AiResult(AiOutcome.Unavailable, null, null, "No AI provider is configured.");

        var now = _clock();
        var estimate = EstimateTokens(call);
        bool reserved;
        try
        {
            reserved = _ledger.TryReserve(call.TenantId, estimate, _options.DailyCallLimitPerTenant, _options.DailyTokenLimitPerTenant, now);
        }
        catch (Exception ex)
        {
            // No budget record means no call: the AI must never run unmetered. The ERP screens are unaffected.
            _logger.LogWarning("AI usage ledger unavailable ({Error}); call not made. Tenant {TenantId}", ex.GetType().Name, call.TenantId);
            return new AiResult(AiOutcome.Unavailable, null, primary.Key, "The AI service is not available. Use the normal screens.");
        }
        if (!reserved)
            return new AiResult(AiOutcome.Refused, null, primary.Key, "The daily AI limit for this company is used up.");

        var attempt = await TryProviderAsync(primary, call, ct);
        if (attempt == null)
        {
            var fallback = Resolve(_options.FallbackProvider);
            if (fallback != null && !ReferenceEquals(fallback, primary) && (!fallback.Paid || _options.AllowPaidFallback))
                attempt = await TryProviderAsync(fallback, call, ct);
        }

        if (attempt == null)
        {
            SafeSettle(call.TenantId, estimate, 0, now);
            return new AiResult(AiOutcome.Unavailable, null, primary.Key, "The AI service is not available. Use the normal screens.");
        }

        var (provider, reply) = attempt.Value;
        var estimated = reply.InputTokens == null || reply.OutputTokens == null;
        var actual = estimated ? estimate : reply.InputTokens!.Value + reply.OutputTokens!.Value;
        SafeSettle(call.TenantId, estimate, actual, now);
        return new AiResult(AiOutcome.Ok, reply.Text, provider.Key, null, reply.InputTokens ?? estimate, reply.OutputTokens ?? 0, estimated);
    }

    private void SafeSettle(int tenantId, int estimated, int actual, DateTime now)
    {
        try { _ledger.Settle(tenantId, estimated, actual, now); }
        catch (Exception ex) { _logger.LogWarning("AI usage ledger could not settle ({Error}). Tenant {TenantId}", ex.GetType().Name, tenantId); }
    }

    /// <summary>Configured providers and their roles, for the platform status view. No keys.</summary>
    public IReadOnlyList<AiProviderStatus> Status() =>
        _providers.Values.OrderBy(p => p.Key, StringComparer.OrdinalIgnoreCase).Select(p =>
        {
            _options.Providers.TryGetValue(p.Key, out var o);
            return new AiProviderStatus(p.Key, o?.Kind ?? "mock", o?.Model ?? "mock", p.IsConfigured, p.Paid,
                p.Key.Equals(_options.Provider, StringComparison.OrdinalIgnoreCase), p.Key.Equals(_options.FallbackProvider, StringComparison.OrdinalIgnoreCase));
        }).ToList();

    public bool IsEnabled => _options.Enabled;
    /// <summary>True when the primary provider is fully configured.</summary>
    public bool HasProvider => Resolve(_options.Provider) != null;
    public bool AllowsCustomerData => _options.AllowCustomerData;

    public (string? Fingerprint, string Notice) ConsentPolicy()
    {
        if (string.IsNullOrWhiteSpace(_options.DataPolicyVersion) || string.IsNullOrWhiteSpace(_options.DataPolicyNotice))
            return (null, "The provider privacy policy is not ready. Use the Look up tab.");
        var providers = new List<object>();
        foreach (var key in new[] { _options.Provider, _options.FallbackProvider }.Where(k => !string.IsNullOrWhiteSpace(k)))
        {
            if (_options.Providers.TryGetValue(key, out var p))
            {
                if (!p.IsConfigured) return (null, "The provider configuration is not ready. Use the Look up tab.");
                providers.Add(new { key, p.Kind, p.BaseUrl, p.Model, p.Paid });
            }
            else if (key == "mock") providers.Add(new { key, Model = "synthetic-only" });
            else return (null, "The provider configuration is not ready. Use the Look up tab.");
        }
        if (providers.Count == 0) return (null, "The provider configuration is not ready. Use the Look up tab.");
        var policy = JsonSerializer.Serialize(new { _options.DataPolicyVersion, _options.DataPolicyNotice, _options.AllowPaidFallback, providers });
        var names = string.Join("; ", new[] { _options.Provider, _options.FallbackProvider }.Where(k => !string.IsNullOrWhiteSpace(k))
            .Select(k => _options.Providers.TryGetValue(k, out var p) ? $"{k}: {p.Model}" : k));
        return (Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(policy))).ToLowerInvariant(),
            $"{_options.DataPolicyNotice}\nProviders in order: {names}. Policy: {_options.DataPolicyVersion}.");
    }

    private readonly ConcurrentDictionary<string, DateTime> _lastTest = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Connectivity check for one provider with a fixed synthetic prompt (no company data). Works while the master switch is off,
    /// because that is how a provider is checked before it is turned on. Uses no company budget. At most one test per provider
    /// every few seconds.
    /// </summary>
    public async Task<AiProviderTest> TestProviderAsync(string key, CancellationToken ct = default)
    {
        var provider = _providers.TryGetValue(key ?? string.Empty, out var p) ? p : null;
        if (provider == null || !provider.IsConfigured)
            return new AiProviderTest(key ?? string.Empty, false, false, 0, null, "Not configured: set kind, base URL, model and key on the server.");
        _options.Providers.TryGetValue(provider.Key, out var o);
        var model = o?.Model ?? "mock";

        var now = _clock();
        if (_lastTest.TryGetValue(provider.Key, out var last) && (now - last).TotalSeconds < 5)
            return new AiProviderTest(provider.Key, true, false, 0, model, "Wait a few seconds before testing again.");
        _lastTest[provider.Key] = now;

        var limit = TimeSpan.FromSeconds(Math.Max(1, _options.TimeoutSeconds));
        var clock = Stopwatch.StartNew();
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(limit);
            var work = provider.CompleteAsync(null, "Reply with the single word OK.", timeout.Token);
            if (await Task.WhenAny(work, Task.Delay(limit, ct)) != work)
            {
                timeout.Cancel();
                _ = work.ContinueWith(t => _ = t.Exception, TaskContinuationOptions.OnlyOnFaulted);
                return new AiProviderTest(provider.Key, true, false, clock.ElapsedMilliseconds, model, "Timed out.");
            }
            var reply = await work;
            _logger.LogInformation("AI provider test ok. Provider {Provider}, {Ms} ms", provider.Key, clock.ElapsedMilliseconds);
            return new AiProviderTest(provider.Key, true, !string.IsNullOrWhiteSpace(reply.Text), clock.ElapsedMilliseconds, model,
                string.IsNullOrWhiteSpace(reply.Text) ? "The provider answered with nothing." : null);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning("AI provider test failed. Provider {Provider}, status {Status}", provider.Key, (int?)ex.StatusCode);
            return new AiProviderTest(provider.Key, true, false, clock.ElapsedMilliseconds, model, ex.StatusCode.HasValue ? $"The provider refused the request (HTTP {(int)ex.StatusCode.Value})." : "The provider could not be reached.");
        }
        catch (Exception ex) when (ex is TaskCanceledException or OperationCanceledException or TimeoutException)
        {
            return new AiProviderTest(provider.Key, true, false, clock.ElapsedMilliseconds, model, "Timed out.");
        }
        catch (Exception ex) when (ex is JsonException or KeyNotFoundException or InvalidOperationException)
        {
            _logger.LogWarning("AI provider test failed. Provider {Provider}, {Error}", provider.Key, ex.GetType().Name);
            return new AiProviderTest(provider.Key, true, false, clock.ElapsedMilliseconds, model, "The provider answered in an unexpected format.");
        }
    }

    private IAiProvider? Resolve(string key) =>
        !string.IsNullOrWhiteSpace(key) && _providers.TryGetValue(key, out var p) && p.IsConfigured ? p : null;

    private async Task<(IAiProvider, ProviderReply)?> TryProviderAsync(IAiProvider provider, AiCall call, CancellationToken ct)
    {
        var limit = TimeSpan.FromSeconds(Math.Max(1, _options.TimeoutSeconds));
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(limit);
        var clock = Stopwatch.StartNew();
        try
        {
            // The gateway enforces its own deadline. A provider or HTTP layer that ignores cancellation must not hang the caller.
            var work = provider.CompleteAsync(call.System, call.Prompt, timeout.Token);
            var finished = await Task.WhenAny(work, Task.Delay(limit, ct));
            if (finished != work)
            {
                timeout.Cancel();
                _ = work.ContinueWith(t => _ = t.Exception, TaskContinuationOptions.OnlyOnFaulted); // observe a late failure
                throw new TimeoutException("AI provider did not answer in time.");
            }
            var reply = await work;
            // Provider, purpose and timing only. Never the prompt, the answer or any key.
            _logger.LogInformation("AI call ok. Provider {Provider}, tenant {TenantId}, purpose {Purpose}, {Ms} ms", provider.Key, call.TenantId, call.Purpose, clock.ElapsedMilliseconds);
            return (provider, reply);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or OperationCanceledException or TimeoutException or JsonException or KeyNotFoundException or InvalidOperationException)
        {
            _logger.LogWarning("AI call failed. Provider {Provider}, tenant {TenantId}, purpose {Purpose}, {Error}, {Ms} ms", provider.Key, call.TenantId, call.Purpose, ex.GetType().Name, clock.ElapsedMilliseconds);
            return null;
        }
    }
}
