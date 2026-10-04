using System.Net;
using System.Net.Http.Json;

namespace HexaBill.Tests;

[Collection("HttpIntegration")]
public class RoutesHttpIsolationTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public RoutesHttpIsolationTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task GetRoutes_ReturnsOnlyOwnTenant()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/routes");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<List<RouteDtoStub>>>();
        Assert.True(json?.Success);
        Assert.Single(json!.Data!);
        Assert.Equal(1, json.Data![0].Id);
        Assert.Equal("Route A", json.Data[0].Name);
    }

    [Fact]
    public async Task GetRoute_OwnTenant_ReturnsSuccess()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/routes/1");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<RouteDtoStub>>();
        Assert.True(json?.Success);
        Assert.Equal(1, json?.Data?.Id);
    }

    [Fact]
    public async Task GetRoute_OtherTenantsRoute_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/routes/2");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetRouteSummary_OtherTenantsRoute_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/routes/2/summary");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetRoute_TenantBCannotReadTenantARoute_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var response = await client.GetAsync("/api/routes/1");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private sealed class ApiEnvelope<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
    }

    private sealed class RouteDtoStub
    {
        public int Id { get; set; }
        public string? Name { get; set; }
    }
}
