using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Net.Http.Headers;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HexaBill.Tests;

[Collection("HttpIntegration")]
public class AssistantConsentHttpTests
{
    private readonly HexaBillWebApplicationFactory _factory;
    private readonly TestAiControl _ai;
    public AssistantConsentHttpTests(HexaBillWebApplicationFactory factory)
    {
        _factory = factory;
        _ai = factory.Services.GetRequiredService<TestAiControl>();
        _ai.ResetAll();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.SetRequestTenantScope(null, true);
        if (!db.Tenants.Any(t => t.Id == 83101))
        {
            db.Tenants.Add(new Tenant { Id = 83101, Name = "Synthetic consent", Subdomain = "consent-test", Status = TenantStatus.Active });
            db.Users.Add(new User { Id = 83101, TenantId = 83101, OwnerId = 83101, Name = "Synthetic owner", Email = "consent@example.test", PasswordHash = "unused", Role = UserRole.Owner, IsActive = true, SessionVersion = 1 });
        }
        db.TenantAiConsents.Where(c => c.TenantId == 83101).ExecuteDelete();
        db.SaveChanges();
    }

    private HttpClient Owner() => HttpIntegrationClient.Create(_factory, 83101, "consent-test");
    private static async Task<JsonElement> Data(HttpResponseMessage r) => (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
    private static async Task<string> Fingerprint(HttpClient client) => (await Data(await client.GetAsync("/api/assistant/consent"))).GetProperty("policyFingerprint").GetString()!;
    private static async Task<HttpResponseMessage> Enable(HttpClient client, string? fingerprint = null) =>
        await client.PutAsJsonAsync("/api/assistant/consent", new { enabled = true, policyFingerprint = fingerprint ?? await Fingerprint(client) });

    [Fact]
    public async Task MissingOwnerConsent_RejectsChatBeforeAnyProviderCall()
    {
        using var owner = Owner();
        // Withdrawal is always available, even before a provider policy is configured.
        var withdrawal = await owner.PutAsJsonAsync("/api/assistant/consent", new { enabled = false });
        Assert.Equal(HttpStatusCode.OK, withdrawal.StatusCode);
        var response = await owner.PostAsJsonAsync("/api/assistant/chat", new { message = "Find Cust A" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var data = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
        Assert.Equal("refused", data.GetProperty("mode").GetString());
        Assert.Equal(0, _ai.Good.Calls);
    }

    [Fact]
    public async Task OwnerMustReadCurrentPolicy_CanOptInAndRevoke_WithoutAffectingAnotherTenant()
    {
        using var owner = Owner();
        using var other = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        Assert.False((await Data(await owner.GetAsync("/api/assistant/status"))).GetProperty("chat").GetBoolean());
        Assert.Equal(HttpStatusCode.Conflict, (await Enable(owner, "stale-policy")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Enable(owner)).StatusCode);
        Assert.True((await Data(await owner.GetAsync("/api/assistant/status"))).GetProperty("chat").GetBoolean());
        _ai.Good.Reply = "{\"tool\":\"none\"}";
        await owner.PostAsJsonAsync("/api/assistant/chat", new { message = "hello" });
        Assert.Equal(1, _ai.Good.Calls);
        Assert.Equal(HttpStatusCode.OK, (await owner.PutAsJsonAsync("/api/assistant/consent?tenantId=1", new { enabled = false, tenantId = 1 })).StatusCode);
        await owner.PostAsJsonAsync("/api/assistant/chat", new { message = "hello" });
        Assert.Equal(1, _ai.Good.Calls);
        Assert.True((await Data(await other.GetAsync("/api/assistant/consent"))).GetProperty("enabled").GetBoolean());
    }

    [Theory]
    [InlineData("Staff")]
    [InlineData("Admin")]
    public async Task StaffAndAdmins_CannotConsentForTheOwner(string role)
    {
        using var client = Owner();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", TestJwtFactory.CreateAuthenticatedApiToken(83101, 83101, "consent-test", role: role));
        Assert.False((await Data(await client.GetAsync("/api/assistant/consent"))).GetProperty("canManage").GetBoolean());
        Assert.Equal(HttpStatusCode.Forbidden, (await Enable(client)).StatusCode);
    }

    [Fact]
    public async Task PolicyChangesInvalidateConsent_ButKeyRotationDoesNot()
    {
        using var owner = Owner();
        Assert.Equal(HttpStatusCode.OK, (await Enable(owner)).StatusCode);
        var before = await Fingerprint(owner);
        var originalKey = _ai.Options.Providers["scripted"].ApiKey;
        try
        {
            _ai.Options.Providers["scripted"].ApiKey = "ROTATED-SYNTHETIC-KEY";
            Assert.Equal(before, await Fingerprint(owner));
            _ai.Options.DataPolicyVersion = "changed-retention-v2";
            Assert.NotEqual(before, await Fingerprint(owner));
            var reply = await Data(await owner.PostAsJsonAsync("/api/assistant/chat", new { message = "hello" }));
            Assert.Equal("refused", reply.GetProperty("mode").GetString());
            Assert.Equal(0, _ai.Good.Calls);
            Assert.Equal(HttpStatusCode.Conflict, (await Enable(owner, before)).StatusCode);
        }
        finally { _ai.Options.Providers["scripted"].ApiKey = originalKey; _ai.ResetAll(); }
    }

    [Fact]
    public async Task MissingOperatorPolicy_CannotBeApproved_AndExposesNoKeys()
    {
        using var owner = Owner();
        _ai.Options.DataPolicyVersion = "";
        var response = await owner.GetAsync("/api/assistant/consent");
        Assert.Equal(JsonValueKind.Null, (await Data(response)).GetProperty("policyFingerprint").ValueKind);
        Assert.DoesNotContain("SECRET-KEY-VALUE", await response.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.Conflict, (await Enable(owner, "forged")).StatusCode);
    }
}
