using System.Net;
using System.Net.Http.Json;

namespace HexaBill.Tests;

[Collection("HttpIntegration")]
public class QuotationsHttpIsolationTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public QuotationsHttpIsolationTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task GetQuotation_OwnTenant_ReturnsSuccess()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/quotations/1");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<QuotationStub>>();
        Assert.True(json?.Success);
        Assert.Equal("Q-A-HTTP-1", json?.Data?.QuoteNo);
    }

    [Fact]
    public async Task GetQuotation_OtherTenantsQuotation_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/quotations/2");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetQuotation_TenantBCannotReadTenantA_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var response = await client.GetAsync("/api/quotations/1");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ListQuotations_ReturnsOnlyOwnTenantRows()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/quotations");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<List<QuotationStub>>>();
        Assert.True(json?.Success);
        Assert.Single(json!.Data!);
        Assert.Equal("Q-A-HTTP-1", json.Data![0].QuoteNo);
    }

    private sealed class ApiEnvelope<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
    }

    private sealed class QuotationStub
    {
        public string? QuoteNo { get; set; }
    }
}
