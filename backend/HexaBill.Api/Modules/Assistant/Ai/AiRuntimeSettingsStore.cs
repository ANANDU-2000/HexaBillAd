using System.Text.Json;
using System.Text.RegularExpressions;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Modules.Assistant.Ai;

/// <summary>
/// The platform administrator's AI choices (order of providers, which models to use, daily limits, an off switch), kept in the
/// existing Settings table under one platform-only key, so no schema change is needed. Read through a short cache so a chat
/// call never waits on the database. It can only narrow or re-order what the server environment already allows.
/// </summary>
public sealed class AiRuntimeSettingsStore : IAiRuntimeSettings
{
    public const string SettingKey = "ai.runtime";
    private static readonly TimeSpan CacheFor = TimeSpan.FromSeconds(20);
    private static readonly Regex ModelId = new(@"^[A-Za-z0-9][A-Za-z0-9._:/\-]{0,119}$", RegexOptions.Compiled);
    private static readonly Regex ProviderKey = new(@"^[A-Za-z0-9_\-]{1,40}$", RegexOptions.Compiled);

    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<AiRuntimeSettingsStore> _logger;
    private readonly object _gate = new();
    private AiRuntime _cached = new();
    private DateTime _loadedAt = DateTime.MinValue;

    public AiRuntimeSettingsStore(IServiceScopeFactory scopes, ILogger<AiRuntimeSettingsStore> logger) { _scopes = scopes; _logger = logger; }

    public AiRuntime Current
    {
        get
        {
            lock (_gate)
            {
                if (DateTime.UtcNow - _loadedAt < CacheFor) return _cached;
                try
                {
                    using var scope = _scopes.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var row = db.Settings.IgnoreQueryFilters().AsNoTracking().FirstOrDefault(s => s.Key == SettingKey && s.OwnerId == 0);
                    _cached = Parse(row?.Value);
                }
                catch (Exception ex)
                {
                    // Keep the last known choice. The environment defaults apply if there never was one.
                    _logger.LogWarning("AI runtime settings could not be read ({Error}); using the previous values.", ex.GetType().Name);
                }
                _loadedAt = DateTime.UtcNow;
                return _cached;
            }
        }
    }

    public static AiRuntime Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new AiRuntime();
        try { return Sanitize(JsonSerializer.Deserialize<AiRuntime>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new AiRuntime()); }
        catch (JsonException) { return new AiRuntime(); }
    }

    /// <summary>Drops anything malformed. Returns a safe value; never throws.</summary>
    public static AiRuntime Sanitize(AiRuntime r)
    {
        Dictionary<string, string[]>? models = null;
        if (r.Models != null)
        {
            models = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
            foreach (var (key, list) in r.Models.Take(10))
            {
                if (!ProviderKey.IsMatch(key ?? string.Empty) || list == null) continue;
                var ids = list.Where(m => m != null && ModelId.IsMatch(m.Trim())).Select(m => m.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).Take(30).ToArray();
                if (ids.Length > 0) models[key] = ids;
            }
        }
        var provider = r.Provider != null && ProviderKey.IsMatch(r.Provider) ? r.Provider : null;
        var fallbacks = r.Fallbacks?.Where(k => k != null && ProviderKey.IsMatch(k)).Distinct(StringComparer.OrdinalIgnoreCase).Take(8).ToArray();
        return new AiRuntime(r.Enabled, provider, fallbacks, r.AllowPaidFallback,
            r.DailyCalls is { } c ? Math.Clamp(c, 1, 100_000) : null,
            r.DailyTokens is { } t ? Math.Clamp(t, 1_000, 50_000_000) : null,
            models);
    }

    public async Task SaveAsync(AiRuntime value, CancellationToken ct)
    {
        var clean = Sanitize(value);
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var json = JsonSerializer.Serialize(clean);
        var row = await db.Settings.IgnoreQueryFilters().FirstOrDefaultAsync(s => s.Key == SettingKey && s.OwnerId == 0, ct);
        if (row == null)
            db.Settings.Add(new Setting { Key = SettingKey, OwnerId = 0, TenantId = null, Value = json, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
        else { row.Value = json; row.UpdatedAt = DateTime.UtcNow; }
        await db.SaveChangesAsync(ct);
        lock (_gate) { _cached = clean; _loadedAt = DateTime.UtcNow; }
    }
}
