using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HexaBill.Tests;

/// <summary>Draft confirm is exactly-once on PostgreSQL too (claim by conditional update, unique idempotency key, retrying execution strategy).</summary>
[Collection("HttpPostgresIntegration")]
public class AssistantDraftPostgreSqlTests
{
    private readonly HttpPostgresIntegrationFixture _fixture;

    public AssistantDraftPostgreSqlTests(HttpPostgresIntegrationFixture fixture) => _fixture = fixture;

    private static async Task<(Guid id, string hash)> Propose(HttpClient client, string name)
    {
        var response = await client.PostAsJsonAsync("/api/assistant/drafts/customer", new { name, phone = "0501112222" });
        Assert.True(response.StatusCode == HttpStatusCode.Created, $"{(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        var data = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
        Assert.Equal(0, data.GetProperty("errors").GetArrayLength());
        return (data.GetProperty("id").GetGuid(), data.GetProperty("payloadHash").GetString()!);
    }

    private static Task<HttpResponseMessage> Confirm(HttpClient client, Guid id, string hash, string key) =>
        client.PostAsJsonAsync($"/api/assistant/drafts/{id}/confirm", new { payloadHash = hash, idempotencyKey = key });

    [SkippableFact]
    public async Task Confirm_IsExactlyOnce_UnderConcurrency_AndReplaysWithTheSameKey_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);
        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var name = "PG Draft Buyer " + Guid.NewGuid().ToString("N")[..8];
        var (id, hash) = await Propose(client, name);

        var results = await Task.WhenAll(Enumerable.Range(0, 4).Select(i => Confirm(client, id, hash, $"pg-draft-{Guid.NewGuid():N}")));
        Assert.Equal(1, results.Count(r => r.StatusCode == HttpStatusCode.OK));
        Assert.All(results.Where(r => r.StatusCode != HttpStatusCode.OK), r => Assert.Equal(HttpStatusCode.Conflict, r.StatusCode));

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(1, await db.Customers.IgnoreQueryFilters().CountAsync(c => c.TenantId == factory.TenantAId && c.Name == name));

        // The winner's key replays the same answer; a fresh key is refused.
        var winnerKey = (await db.AssistantDrafts.IgnoreQueryFilters().AsNoTracking().FirstAsync(d => d.Id == id)).IdempotencyKey!;
        var replay = await Confirm(client, id, hash, winnerKey);
        Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Confirm(client, id, hash, $"pg-draft-{Guid.NewGuid():N}")).StatusCode);
        Assert.Equal(1, await db.Customers.IgnoreQueryFilters().CountAsync(c => c.TenantId == factory.TenantAId && c.Name == name));
    }

    [SkippableFact]
    public async Task OtherCompany_CannotConfirmTheDraft_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);
        using var a = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        using var b = HttpIntegrationClient.Create(factory, factory.TenantBId, factory.TenantBId, factory.SlugB);
        var name = "PG Draft Isolation " + Guid.NewGuid().ToString("N")[..8];
        var (id, hash) = await Propose(a, name);
        Assert.Equal(HttpStatusCode.NotFound, (await Confirm(b, id, hash, $"pg-draft-{Guid.NewGuid():N}")).StatusCode);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(0, await db.Customers.IgnoreQueryFilters().CountAsync(c => c.Name == name));
    }
}
