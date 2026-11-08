using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using HexaBill.Api.Data;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HexaBill.Tests;

/// <summary>Remote MCP server: one company per token, role-aware, strict arguments, drafts only (no confirm), audited.</summary>
[Collection("HttpIntegration")]
public class McpHttpTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public McpHttpTests(HexaBillWebApplicationFactory factory) => _factory = factory;

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

    private static async Task<JsonElement> Rpc(HttpClient client, string method, object? parameters = null, int id = 1)
    {
        var body = JsonSerializer.Serialize(new { jsonrpc = "2.0", id, method, @params = parameters });
        var response = await client.PostAsync("/api/mcp", new StringContent(body, Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static Task<JsonElement> Call(HttpClient client, string tool, object args) =>
        Rpc(client, "tools/call", new { name = tool, arguments = args });

    private static string Text(JsonElement rpc) => rpc.GetProperty("result").GetProperty("content")[0].GetProperty("text").GetString()!;
    private static bool IsError(JsonElement rpc) => rpc.GetProperty("result").GetProperty("isError").GetBoolean();
    private static JsonElement Rows(JsonElement rpc) => JsonDocument.Parse(Text(rpc)).RootElement.GetProperty("data");

    [Fact]
    public async Task Initialize_NegotiatesVersion_AndOffersOnlyTools()
    {
        using var client = Owner(1, "tenanta");
        var init = await Rpc(client, "initialize", new { protocolVersion = "2025-03-26", capabilities = new { }, clientInfo = new { name = "t", version = "1" } });
        Assert.Equal("2025-03-26", init.GetProperty("result").GetProperty("protocolVersion").GetString());
        Assert.Equal("2.0", init.GetProperty("jsonrpc").GetString());
        Assert.True(init.GetProperty("result").GetProperty("capabilities").TryGetProperty("tools", out _));
        Assert.False(init.GetProperty("result").GetProperty("capabilities").TryGetProperty("resources", out _));
        var unknown = await Rpc(client, "initialize", new { protocolVersion = "1999-01-01" });
        Assert.Equal("2025-06-18", unknown.GetProperty("result").GetProperty("protocolVersion").GetString());
    }

    [Fact]
    public async Task ToolsList_HasReadTools_AndDraftsButNoConfirmOrSql()
    {
        using var client = Owner(1, "tenanta");
        var list = await Rpc(client, "tools/list");
        var tools = list.GetProperty("result").GetProperty("tools").EnumerateArray().ToList();
        var names = tools.Select(t => t.GetProperty("name").GetString()!).ToList();
        Assert.Contains("find_customers", names);
        Assert.Contains("dashboard_summary", names);
        Assert.Contains("draft_customer", names);
        Assert.Contains("draft_expense", names);
        Assert.DoesNotContain(names, n => n.Contains("confirm") || n.Contains("sql") || n.Contains("delete"));
        var read = tools.Single(t => t.GetProperty("name").GetString() == "find_customers");
        Assert.True(read.GetProperty("annotations").GetProperty("readOnlyHint").GetBoolean());
        Assert.False(read.GetProperty("inputSchema").GetProperty("additionalProperties").GetBoolean());
        var draft = tools.Single(t => t.GetProperty("name").GetString() == "draft_customer");
        Assert.False(draft.GetProperty("annotations").GetProperty("readOnlyHint").GetBoolean());
        Assert.False(draft.GetProperty("annotations").GetProperty("destructiveHint").GetBoolean());
    }

    [Fact]
    public async Task EachCompany_SeesOnlyItsOwnData()
    {
        using var a = Owner(1, "tenanta");
        using var b = Owner(2, "tenantb");
        var mine = await Call(a, "find_customers", new { query = "Cust A" });
        Assert.False(IsError(mine));
        Assert.Equal(1, Rows(mine).GetArrayLength());
        Assert.Equal("Cust A", Rows(mine)[0].GetProperty("name").GetString());

        var crossB = await Call(b, "find_customers", new { query = "Cust A" });
        Assert.Equal(0, Rows(crossB).GetArrayLength());
        var stockB = await Call(b, "product_stock", new { query = "A-SKU" });
        Assert.Equal(0, Rows(stockB).GetArrayLength());
    }

    [Fact]
    public async Task Staff_DoesNotSeeBalanceOrCost()
    {
        using var client = Staff(1, "tenanta");
        var customers = await Call(client, "find_customers", new { query = "Cust A" });
        Assert.Equal(JsonValueKind.Null, Rows(customers)[0].GetProperty("balance").ValueKind);
        var stock = await Call(client, "product_stock", new { query = "A-SKU" });
        Assert.Equal(JsonValueKind.Null, Rows(stock)[0].GetProperty("costPrice").ValueKind);
    }

    [Theory]
    [InlineData("find_customers", "{\"query\":\"Cust\",\"tenantId\":2}")]
    [InlineData("find_customers", "{\"query\":\"Cust\",\"sql\":\"select 1\"}")]
    [InlineData("draft_customer", "{\"name\":\"Zed Trading\",\"tenantId\":2}")]
    [InlineData("draft_expense", "{\"amount\":5,\"ownerId\":2}")]
    [InlineData("run_sql", "{}")]
    [InlineData("confirm_draft", "{}")]
    public async Task ForgedOrUnknownArguments_AreToolErrors_NotExecuted(string tool, string argsJson)
    {
        using var client = Owner(1, "tenanta");
        using var args = JsonDocument.Parse(argsJson);
        var result = await Call(client, tool, args.RootElement.Clone());
        Assert.True(IsError(result));
    }

    [Fact]
    public async Task DraftCustomer_CreatesProposalOnly_AndNothingInTheBooks()
    {
        using var client = Owner(1, "tenanta");
        async Task<int> Customers()
        {
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            return await db.Customers.IgnoreQueryFilters().CountAsync(c => c.TenantId == 1);
        }
        var before = await Customers();
        var result = await Call(client, "draft_customer", new { name = "Mcp Draft Trading", phone = "0501234567" });
        Assert.False(IsError(result));
        var draft = JsonDocument.Parse(Text(result)).RootElement;
        Assert.False(string.IsNullOrWhiteSpace(draft.GetProperty("payloadHash").GetString()));
        Assert.Equal("customer.create", draft.GetProperty("kind").GetString());
        Assert.NotEqual("Executed", draft.GetProperty("status").GetString());
        Assert.Equal(before, await Customers());
    }

    [Fact]
    public async Task Notification_GetsNoBody_AndUnknownMethodIsRpcError()
    {
        using var client = Owner(1, "tenanta");
        var note = await client.PostAsync("/api/mcp", new StringContent("{\"jsonrpc\":\"2.0\",\"method\":\"notifications/initialized\"}", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.Accepted, note.StatusCode);
        var bad = await Rpc(client, "resources/list");
        Assert.Equal(-32601, bad.GetProperty("error").GetProperty("code").GetInt32());
        var ping = await Rpc(client, "ping", id: 7);
        Assert.Equal(7, ping.GetProperty("id").GetInt32());
    }

    [Fact]
    public async Task NoToken_IsUnauthorized_AndPlatformAdminHasNoCompanyScope()
    {
        using var anon = _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, BaseAddress = new Uri("http://tenanta.hexabill.company") });
        var response = await anon.PostAsync("/api/mcp", new StringContent("{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"ping\"}", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

        using var admin = HttpIntegrationClient.CreatePlatformAdmin(_factory);
        var adminResponse = await admin.PostAsync("/api/mcp", new StringContent("{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"ping\"}", Encoding.UTF8, "application/json"));
        Assert.True(adminResponse.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.Unauthorized, $"got {adminResponse.StatusCode}");
    }

    [Fact]
    public async Task ToolCall_IsAudited_WithoutArguments()
    {
        using var client = Owner(1, "tenanta");
        await Call(client, "find_customers", new { query = "Cust A" });
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var rows = await db.AuditLogs.IgnoreQueryFilters().Where(a => a.TenantId == 1 && a.Action == "McpToolCall").ToListAsync();
        Assert.NotEmpty(rows);
        Assert.All(rows, r => Assert.DoesNotContain("Cust", r.Details ?? string.Empty));
        Assert.Contains(rows, r => (r.Details ?? string.Empty) == "tool=find_customers");
    }
}
