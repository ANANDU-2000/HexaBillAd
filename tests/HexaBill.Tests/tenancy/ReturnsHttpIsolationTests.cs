using System.Net;
using System.Net.Http.Json;

namespace HexaBill.Tests;

[Collection("HttpIntegration")]
public class ReturnsHttpIsolationTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public ReturnsHttpIsolationTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task GetSaleReturns_BySaleId_OwnTenant_ReturnsOwnReturnOnly()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/returns/sales?saleId=1");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<List<SaleReturnStub>>>();
        Assert.True(json?.Success);
        Assert.Single(json!.Data!);
        Assert.Equal(1, json.Data![0].Id);
    }

    [Fact]
    public async Task GetSaleReturns_Paged_ExcludesOtherTenantsReturns()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/returns/sales?page=1&pageSize=20");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<PagedSaleReturnsStub>>();
        Assert.True(json?.Success);
        var ids = json!.Data!.Items.Select(i => i.Id).ToList();
        Assert.Contains(1, ids);
        Assert.DoesNotContain(2, ids);
    }

    [Fact]
    public async Task DeleteSaleReturn_OtherTenantsReturn_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.DeleteAsync("/api/returns/sales/2");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetSaleReturns_ByOtherTenantsSaleId_ReturnsEmpty()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/returns/sales?saleId=2");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<List<SaleReturnStub>>>();
        Assert.True(json?.Success);
        Assert.NotNull(json?.Data);
        Assert.Empty(json!.Data!);
    }

    [Fact]
    public async Task DeleteSaleReturn_TenantBCannotDeleteTenantAReturn_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var response = await client.DeleteAsync("/api/returns/sales/1");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private sealed class ApiEnvelope<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
    }

    private sealed class SaleReturnStub
    {
        public int Id { get; set; }
    }

    private sealed class PagedSaleReturnsStub
    {
        public List<SaleReturnStub> Items { get; set; } = new();
    }
}
