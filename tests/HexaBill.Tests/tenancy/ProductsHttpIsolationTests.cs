using System.Net;
using System.Net.Http.Json;

namespace HexaBill.Tests;

[Collection("HttpIntegration")]
public class ProductsHttpIsolationTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public ProductsHttpIsolationTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task GetProducts_List_ReturnsSuccess()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/products?page=1&pageSize=10");
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.OK, body);
    }

    [Fact]
    public async Task GetProduct_OwnTenant_ReturnsSuccess()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/products/1");
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.OK, body);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<ProductDtoStub>>();
        Assert.True(json?.Success);
        Assert.Equal(1, json?.Data?.Id);
    }

    [Fact]
    public async Task GetProduct_OtherTenantsProduct_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/products/2");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetProduct_TenantBCannotReadTenantAProduct_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var response = await client.GetAsync("/api/products/1");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task SearchProducts_DoesNotReturnOtherTenantProducts()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/products/search?q=Prod");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<List<ProductDtoStub>>>();
        Assert.True(json?.Success);
        Assert.Single(json!.Data!);
        Assert.Equal(1, json.Data![0].Id);
    }

    private sealed class ApiEnvelope<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
    }

    private sealed class ProductDtoStub
    {
        public int Id { get; set; }
    }
}
