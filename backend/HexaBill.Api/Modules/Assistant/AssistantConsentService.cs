using System.Data;
using System.Data.Common;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Assistant.Ai;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Modules.Assistant;

public sealed record AssistantConsentView(bool Enabled, bool CanManage, string? PolicyFingerprint, string PolicyNotice);

public sealed class AssistantConsentService(AppDbContext db, AiGateway gateway, ILogger<AssistantConsentService> logger)
{
    public async Task<bool> IsApprovedAsync(int tenantId, CancellationToken ct)
    {
        var policy = gateway.ConsentPolicy();
        if (tenantId <= 0 || policy.Fingerprint == null) return false;
        try
        {
            return await db.TenantAiConsents.AsNoTracking().AnyAsync(c => c.TenantId == tenantId && c.Enabled && c.PolicyFingerprint == policy.Fingerprint, ct);
        }
        catch (DbException ex)
        {
            logger.LogWarning("AI consent unavailable ({Error}); no provider call. Tenant {TenantId}", ex.GetType().Name, tenantId);
            return false;
        }
    }

    public async Task<AssistantConsentView> ViewAsync(AssistantCaller caller, CancellationToken ct)
    {
        var policy = gateway.ConsentPolicy();
        return new(await IsApprovedAsync(caller.TenantId, ct), caller.Role == "Owner", policy.Fingerprint, policy.Notice);
    }

    public async Task<AssistantConsentView> SetAsync(AssistantCaller caller, bool enabled, string? fingerprint, CancellationToken ct)
    {
        if (caller.TenantId <= 0 || caller.UserId <= 0 || caller.Role != "Owner")
            throw new AssistantToolException(403, "Only this company's owner can change AI consent.");
        var policy = gateway.ConsentPolicy();
        if (enabled && (policy.Fingerprint == null || fingerprint != policy.Fingerprint))
            throw new AssistantToolException(409, "The provider privacy policy changed or is not ready. Read it again before agreeing.");
        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var row = await db.TenantAiConsents.SingleOrDefaultAsync(c => c.TenantId == caller.TenantId, ct);
            if (row == null) { row = new TenantAiConsent { TenantId = caller.TenantId }; db.TenantAiConsents.Add(row); }
            row.Enabled = enabled;
            row.PolicyFingerprint = enabled ? policy.Fingerprint! : string.Empty;
            row.UpdatedByUserId = caller.UserId;
            row.UpdatedAt = DateTime.UtcNow;
            db.AuditLogs.Add(new AuditLog
            {
                TenantId = caller.TenantId, OwnerId = caller.TenantId, UserId = caller.UserId,
                Action = "AssistantConsent", Details = $"enabled={enabled}; policy={row.PolicyFingerprint}", CreatedAt = row.UpdatedAt
            });
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        });
        return await ViewAsync(caller, ct);
    }
}
