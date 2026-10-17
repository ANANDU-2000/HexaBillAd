using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using HexaBill.Api.Data;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HexaBill.Tests;

/// <summary>AI-01 foundation: read-only tools are tenant-scoped, role-redacted, strictly typed and audited.</summary>
[Collection("HttpIntegration")]
public class AssistantToolsHttpTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public AssistantToolsHttpTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    private HttpClient Owner(int tenantId, string slug) => HttpIntegrationClient.Create(_factory, tenantId, slug);

    private HttpClient Staff(int tenantId, string slug)
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            BaseAddress = new Uri($"http://{slug}.hexabill.company"),
        });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer", TestJwtFactory.CreateAuthenticatedApiToken(tenantId, tenantId, slug, role: "Staff"));
        return client;
    }

    private static async Task<JsonElement> Run(HttpClient client, string tool, object args, HttpStatusCode expected = HttpStatusCode.OK)
    {
        var response = await client.PostAsJsonAsync($"/api/assistant/tools/{tool}", args);
        Assert.Equal(expected, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static JsonElement Rows(JsonElement json) => json.GetProperty("data").GetProperty("data");

    [Fact]
    public async Task Owner_SeesOnlyOwnTenantCustomers_WithBalanceAndSources()
    {
        using var client = Owner(1, "tenanta");
        var json = await Run(client, "find_customers", new { query = "Cust" });
        var rows = Rows(json);
        Assert.Equal(1, rows.GetArrayLength());
        Assert.Equal("Cust A", rows[0].GetProperty("name").GetString());
        Assert.NotEqual(JsonValueKind.Null, rows[0].GetProperty("balance").ValueKind);
        var sources = json.GetProperty("data").GetProperty("sources");
        Assert.Equal("customer", sources[0].GetProperty("type").GetString());
        Assert.Equal("1", sources[0].GetProperty("id").GetString());
    }

    [Fact]
    public async Task OtherTenant_CannotFindTenantAData()
    {
        using var client = Owner(2, "tenantb");
        var mine = await Run(client, "find_customers", new { query = "Cust B" });
        Assert.Equal(1, Rows(mine).GetArrayLength());
        var theirs = await Run(client, "find_customers", new { query = "Cust A" });
        Assert.Equal(0, Rows(theirs).GetArrayLength());
        var stock = await Run(client, "product_stock", new { query = "A-SKU" });
        Assert.Equal(0, Rows(stock).GetArrayLength());
    }

    [Fact]
    public async Task Staff_DoesNotSeeBalancesOrCostPrice()
    {
        using var client = Staff(1, "tenanta");
        var customers = await Run(client, "find_customers", new { query = "Cust A" });
        Assert.Equal(JsonValueKind.Null, Rows(customers)[0].GetProperty("balance").ValueKind);
        var stock = await Run(client, "product_stock", new { query = "A-SKU" });
        var row = Rows(stock)[0];
        Assert.Equal(JsonValueKind.Null, row.GetProperty("costPrice").ValueKind);
        Assert.Equal(50m, row.GetProperty("sellPrice").GetDecimal());
        Assert.Equal(100m, row.GetProperty("stockQty").GetDecimal());
    }

    [Fact]
    public async Task Owner_SeesCostPrice()
    {
        using var client = Owner(1, "tenanta");
        var stock = await Run(client, "product_stock", new { query = "A-SKU" });
        Assert.Equal(40m, Rows(stock)[0].GetProperty("costPrice").GetDecimal());
    }

    [Theory]
    [InlineData("find_customers", "{\"query\":\"Cust\",\"tenantId\":2}", HttpStatusCode.BadRequest)]
    [InlineData("find_customers", "{\"query\":\"Cust\",\"sql\":\"select 1\"}", HttpStatusCode.BadRequest)]
    [InlineData("find_customers", "{\"query\":\"x\"}", HttpStatusCode.BadRequest)]
    [InlineData("find_customers", "{\"query\":\"Cust\",\"limit\":0}", HttpStatusCode.BadRequest)]
    [InlineData("find_customers", "[1]", HttpStatusCode.BadRequest)]
    [InlineData("delete_everything", "{}", HttpStatusCode.NotFound)]
    [InlineData("run_sql", "{\"query\":\"select 1\"}", HttpStatusCode.NotFound)]
    public async Task InvalidRequests_AreRejected(string tool, string body, HttpStatusCode expected)
    {
        using var client = Owner(1, "tenanta");
        var response = await client.PostAsync($"/api/assistant/tools/{tool}", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));
        Assert.Equal(expected, response.StatusCode);
    }

    [Fact]
    public async Task Limit_IsCapped()
    {
        using var client = Owner(1, "tenanta");
        var json = await Run(client, "find_customers", new { query = "Cust", limit = 5000 });
        Assert.True(Rows(json).GetArrayLength() <= 10);
    }

    [Fact]
    public async Task ListTools_ShowsOnlyReadOnlyTools()
    {
        using var client = Owner(1, "tenanta");
        var response = await client.GetAsync("/api/assistant/tools");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var names = json.GetProperty("data").EnumerateArray().Select(t => t.GetProperty("name").GetString()).OrderBy(n => n).ToArray();
        Assert.Equal(new[] { "find_customers", "product_stock" }, names);
    }

    [Fact]
    public async Task PlatformAdmin_HasNoCompanyScope()
    {
        using var client = HttpIntegrationClient.CreatePlatformAdmin(_factory);
        var response = await client.GetAsync("/api/assistant/tools");
        Assert.True(response.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.Unauthorized, $"got {response.StatusCode}");
    }

    [Fact]
    public async Task Run_WritesAnAuditRow_WithoutTheSearchText()
    {
        using var client = Owner(1, "tenanta");
        await Run(client, "find_customers", new { query = "Cust A" });
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var rows = await db.AuditLogs.IgnoreQueryFilters().Where(a => a.TenantId == 1 && a.Action == "AssistantToolRun").ToListAsync();
        Assert.NotEmpty(rows);
        Assert.All(rows, r => Assert.DoesNotContain("Cust", r.Details ?? string.Empty));
        Assert.Contains(rows, r => (r.Details ?? string.Empty).StartsWith("tool=find_customers"));
    }
}
