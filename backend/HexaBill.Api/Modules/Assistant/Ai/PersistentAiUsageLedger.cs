using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Modules.Assistant.Ai;

/// <summary>
/// The AI budget kept in the database, so it survives a restart and is shared by every API instance. One row per company
/// and UTC day. The limit check and the increment are ONE statement (an upsert whose update only applies while under the
/// limits), so two instances cannot both take the last call. Only counts are stored.
/// </summary>
public sealed class PersistentAiUsageLedger : IAiUsageLedger
{
    private readonly IServiceScopeFactory _scopes;

    public PersistentAiUsageLedger(IServiceScopeFactory scopes) => _scopes = scopes;

    public bool TryReserve(int tenantId, int estimatedTokens, int callLimit, int tokenLimit, DateTime utcNow)
    {
        // The first call of a day inserts without the limit test below, so refuse an impossible first call here.
        if (callLimit < 1 || estimatedTokens > tokenLimit) return false;
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var day = DateOnly.FromDateTime(utcNow);
        var changed = db.Database.ExecuteSql($@"
INSERT INTO ""AiUsageDaily"" (""TenantId"", ""Day"", ""Calls"", ""Tokens"", ""UpdatedAt"")
VALUES ({tenantId}, {day}, 1, {estimatedTokens}, {utcNow})
ON CONFLICT (""TenantId"", ""Day"") DO UPDATE
SET ""Calls"" = ""AiUsageDaily"".""Calls"" + 1, ""Tokens"" = ""AiUsageDaily"".""Tokens"" + {estimatedTokens}, ""UpdatedAt"" = {utcNow}
WHERE ""AiUsageDaily"".""Calls"" + 1 <= {callLimit} AND ""AiUsageDaily"".""Tokens"" + {estimatedTokens} <= {tokenLimit}");
        return changed > 0;
    }

    public void Settle(int tenantId, int estimatedTokens, int actualTokens, DateTime utcNow)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var day = DateOnly.FromDateTime(utcNow);
        db.Database.ExecuteSql($@"
UPDATE ""AiUsageDaily""
SET ""Tokens"" = CASE WHEN ""Tokens"" - {estimatedTokens} + {actualTokens} < 0 THEN 0 ELSE ""Tokens"" - {estimatedTokens} + {actualTokens} END, ""UpdatedAt"" = {utcNow}
WHERE ""TenantId"" = {tenantId} AND ""Day"" = {day}");
    }

    /// <summary>Today's counts for a company (for the platform status view). Counts only.</summary>
    public (int Calls, int Tokens) Snapshot(int tenantId, DateTime utcNow)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var day = DateOnly.FromDateTime(utcNow);
        var row = db.Set<HexaBill.Api.Models.AiUsageDaily>().IgnoreQueryFilters().AsNoTracking().FirstOrDefault(r => r.TenantId == tenantId && r.Day == day);
        return row == null ? (0, 0) : (row.Calls, row.Tokens);
    }
}
