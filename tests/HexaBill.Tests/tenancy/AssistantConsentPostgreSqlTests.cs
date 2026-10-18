using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Assistant;
using HexaBill.Api.Modules.Assistant.Ai;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace HexaBill.Tests;

public class AssistantConsentPostgreSqlTests
{
    [SkippableFact]
    public async Task ConsentPersistsAcrossContexts_IsTenantScoped_AndAuditsOwnerWithdrawal()
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(connection), PostgresIntegrationSkip.Reason);
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection!, p => p.EnableRetryOnFailure()).Options;
        var gateway = new AiGateway(Options.Create(new AiOptions
        {
            Provider = "mock", DataPolicyVersion = "synthetic-v1", DataPolicyNotice = "Synthetic local mock only. No external processing."
        }), new[] { new MockAiProvider() }, new InMemoryAiUsageLedger(), NullLogger<AiGateway>.Instance);
        var tenant = Random.Shared.Next(100_000_000, 200_000_000);
        var caller = new AssistantCaller(tenant, tenant, true, Role: "Owner");
        await using (var db = new AppDbContext(options))
        {
            db.SetRequestTenantScope(null, true);
            await PostgresTestSchema.EnsureCreatedAsync(db);
            db.Tenants.Add(new Tenant { Id = tenant, Name = "Synthetic PG consent", Subdomain = $"consent-pg-{tenant}", Status = TenantStatus.Active });
            db.Users.Add(new User { Id = tenant, TenantId = tenant, OwnerId = tenant, Name = "Synthetic owner", Email = $"consent-{tenant}@example.test", PasswordHash = "unused", Role = UserRole.Owner, IsActive = true });
            await db.SaveChangesAsync();
            db.SetRequestTenantScope(tenant, false);
            var service = new AssistantConsentService(db, gateway, NullLogger<AssistantConsentService>.Instance);
            Assert.False(await service.IsApprovedAsync(tenant, default));
            Assert.True((await service.SetAsync(caller, true, gateway.ConsentPolicy().Fingerprint, default)).Enabled);
        }
        await using (var db = new AppDbContext(options))
        {
            db.SetRequestTenantScope(tenant, false);
            var service = new AssistantConsentService(db, gateway, NullLogger<AssistantConsentService>.Instance);
            Assert.True(await service.IsApprovedAsync(tenant, default));
            Assert.False(await service.IsApprovedAsync(tenant + 1, default));
            Assert.False((await service.SetAsync(caller, false, null, default)).Enabled);
            var audit = await db.AuditLogs.Where(a => a.TenantId == tenant && a.Action == "AssistantConsent").ToListAsync();
            Assert.Equal(2, audit.Count);
            Assert.All(audit, a => Assert.Equal(tenant, a.UserId));
            Assert.Contains(audit, a => a.Details == "enabled=False; policy=");
        }
    }
}
