using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HexaBill.Tests;

/// <summary>AI-02 core without a model: drafts change nothing until a person confirms the exact content, once.</summary>
[Collection("HttpIntegration")]
public class AssistantDraftHttpTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public AssistantDraftHttpTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    private HttpClient Owner(int tenantId, string slug) => HttpIntegrationClient.Create(_factory, tenantId, slug);
    private static string Key() => "key-" + Guid.NewGuid().ToString("N");
    private static string UniqueName() => "Draft Buyer " + Guid.NewGuid().ToString("N")[..8];

    private async Task<int> CustomerCount(int tenantId, string name)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.Customers.IgnoreQueryFilters().CountAsync(c => c.TenantId == tenantId && c.Name == name);
    }

    private static async Task<JsonElement> Body(HttpResponseMessage r) => await r.Content.ReadFromJsonAsync<JsonElement>();

    private static async Task<(Guid id, string hash, JsonElement data)> Propose(HttpClient client, object payload)
    {
        var response = await client.PostAsJsonAsync("/api/assistant/drafts/customer", payload);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var data = (await Body(response)).GetProperty("data");
        return (data.GetProperty("id").GetGuid(), data.GetProperty("payloadHash").GetString()!, data);
    }

    private async Task<int> StoredDrafts(int tenantId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.AssistantDrafts.IgnoreQueryFilters().CountAsync(d => d.TenantId == tenantId);
    }

    private static async Task<JsonElement> ProposeInvalid(HttpClient client, object payload)
    {
        var response = await client.PostAsJsonAsync("/api/assistant/drafts/customer", payload);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode); // shown with its errors, not created
        var data = (await Body(response)).GetProperty("data");
        Assert.Equal("Invalid", data.GetProperty("status").GetString());
        return data;
    }

    private static Task<HttpResponseMessage> Confirm(HttpClient client, Guid id, string hash, string? key) =>
        client.PostAsJsonAsync($"/api/assistant/drafts/{id}/confirm", new { payloadHash = hash, idempotencyKey = key });

    [Fact]
    public async Task Draft_ChangesNothing_AndShowsCleanedFields()
    {
        var name = UniqueName();
        using var client = Owner(1, "tenanta");
        var (_, hash, data) = await Propose(client, new { name = "  " + name + "  ", phone = " 0501234567 ", email = "", creditLimit = 150.456 });
        Assert.Equal(name, data.GetProperty("fields").GetProperty("name").GetString());
        Assert.Equal("0501234567", data.GetProperty("fields").GetProperty("phone").GetString());
        Assert.Equal(JsonValueKind.Null, data.GetProperty("fields").GetProperty("email").ValueKind);
        Assert.Equal(150.46m, data.GetProperty("fields").GetProperty("creditLimit").GetDecimal());
        Assert.Equal(0, data.GetProperty("errors").GetArrayLength());
        Assert.Equal(64, hash.Length);
        Assert.Equal("Draft", data.GetProperty("status").GetString());
        Assert.Equal(0, await CustomerCount(1, name));
    }

    [Fact]
    public async Task InvalidFields_AreReportedPerField_NothingIsStored_AndThereIsNothingToConfirm()
    {
        using var client = Owner(1, "tenanta");
        var before = await StoredDrafts(1);
        var data = await ProposeInvalid(client, new { name = "", email = "not-an-email", creditLimit = -5, phone = new string('9', 30) });
        var fields = data.GetProperty("errors").EnumerateArray().Select(e => e.GetProperty("field").GetString()).ToHashSet();
        Assert.Superset(new HashSet<string?> { "name", "email", "creditLimit", "phone" }, fields);
        Assert.Equal(string.Empty, data.GetProperty("payloadHash").GetString());
        Assert.Equal(before, await StoredDrafts(1)); // abandoned or invalid attempts must not use up the open-draft limit
        var confirm = await Confirm(client, Guid.Empty, "anything", Key());
        Assert.Equal(HttpStatusCode.NotFound, confirm.StatusCode);
    }

    [Fact]
    public async Task DuplicateName_IsFlaggedAtDraftTime()
    {
        using var client = Owner(1, "tenanta");
        var data = await ProposeInvalid(client, new { name = "Cust A" });
        Assert.Contains(data.GetProperty("errors").EnumerateArray(), e => e.GetProperty("field").GetString() == "name");
    }

    [Fact]
    public async Task Confirm_CreatesExactlyOneCustomer_InTheCallersCompany()
    {
        var name = UniqueName();
        using var client = Owner(1, "tenanta");
        var (id, hash, _) = await Propose(client, new { name, phone = "0509999999", creditLimit = 100 });
        var response = await Confirm(client, id, hash, Key());
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var data = (await Body(response)).GetProperty("data");
        Assert.Equal("Confirmed", data.GetProperty("status").GetString());
        Assert.True(data.GetProperty("result").GetProperty("customerId").GetInt32() > 0);
        Assert.Equal(1, await CustomerCount(1, name));
        Assert.Equal(0, await CustomerCount(2, name));
    }

    [Fact]
    public async Task SameKey_ReplaysTheFirstResult_AnotherKeyIsRefused_NeverTwoCustomers()
    {
        var name = UniqueName();
        using var client = Owner(1, "tenanta");
        var (id, hash, _) = await Propose(client, new { name });
        var key = Key();
        var first = await Body(await Confirm(client, id, hash, key));
        var replay = await Confirm(client, id, hash, key);
        Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
        Assert.Equal(first.GetProperty("data").GetProperty("result").GetProperty("customerId").GetInt32(),
            (await Body(replay)).GetProperty("data").GetProperty("result").GetProperty("customerId").GetInt32());
        var other = await Confirm(client, id, hash, Key());
        Assert.Equal(HttpStatusCode.Conflict, other.StatusCode);
        Assert.Equal(1, await CustomerCount(1, name));
    }

    [Fact]
    public async Task ConcurrentConfirms_CreateOnlyOne()
    {
        var name = UniqueName();
        using var client = Owner(1, "tenanta");
        var (id, hash, _) = await Propose(client, new { name });
        var results = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => Confirm(client, id, hash, Key())));
        Assert.Equal(1, results.Count(r => r.StatusCode == HttpStatusCode.OK));
        Assert.All(results.Where(r => r.StatusCode != HttpStatusCode.OK), r => Assert.Equal(HttpStatusCode.Conflict, r.StatusCode));
        Assert.Equal(1, await CustomerCount(1, name));
    }

    [Fact]
    public async Task WrongHash_IsRefused_NothingCreated()
    {
        var name = UniqueName();
        using var client = Owner(1, "tenanta");
        var (id, _, _) = await Propose(client, new { name });
        var response = await Confirm(client, id, new string('a', 64), Key());
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal(0, await CustomerCount(1, name));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("short")]
    public async Task MissingOrWeakIdempotencyKey_IsRefused(string? key)
    {
        var name = UniqueName();
        using var client = Owner(1, "tenanta");
        var (id, hash, _) = await Propose(client, new { name });
        var response = await Confirm(client, id, hash, key);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, await CustomerCount(1, name));
    }

    [Fact]
    public async Task OtherCompany_CannotSeeConfirmOrCancel_ATenantADraft()
    {
        var name = UniqueName();
        using var a = Owner(1, "tenanta");
        using var b = Owner(2, "tenantb");
        var (id, hash, _) = await Propose(a, new { name });
        Assert.Equal(HttpStatusCode.NotFound, (await b.GetAsync($"/api/assistant/drafts/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Confirm(b, id, hash, Key())).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await b.PostAsync($"/api/assistant/drafts/{id}/cancel", null)).StatusCode);
        Assert.Equal(0, await CustomerCount(1, name));
        Assert.Equal(0, await CustomerCount(2, name));
    }

    [Fact]
    public async Task ExpiredDraft_CannotBeConfirmed()
    {
        var name = UniqueName();
        using var client = Owner(1, "tenanta");
        var (id, hash, _) = await Propose(client, new { name });
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var draft = await db.AssistantDrafts.IgnoreQueryFilters().FirstAsync(d => d.Id == id);
            draft.ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
            await db.SaveChangesAsync();
        }
        var response = await Confirm(client, id, hash, Key());
        Assert.Equal(HttpStatusCode.Gone, response.StatusCode);
        Assert.Equal(0, await CustomerCount(1, name));
    }

    [Fact]
    public async Task CancelledDraft_CannotBeConfirmed()
    {
        var name = UniqueName();
        using var client = Owner(1, "tenanta");
        var (id, hash, _) = await Propose(client, new { name });
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync($"/api/assistant/drafts/{id}/cancel", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Confirm(client, id, hash, Key())).StatusCode);
        Assert.Equal(0, await CustomerCount(1, name));
    }

    [Fact]
    public async Task Confirm_WritesAnAuditRow_WithoutCustomerDetails()
    {
        var name = UniqueName();
        using var client = Owner(1, "tenanta");
        var (id, hash, _) = await Propose(client, new { name, phone = "0507654321" });
        await Confirm(client, id, hash, Key());
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var row = await db.AuditLogs.IgnoreQueryFilters().FirstOrDefaultAsync(a => a.TenantId == 1 && a.Action == "AssistantDraftConfirmed" && a.Details!.Contains(id.ToString()));
        Assert.NotNull(row);
        Assert.DoesNotContain(name, row!.Details);
        Assert.DoesNotContain("0507654321", row.Details);
    }
}
