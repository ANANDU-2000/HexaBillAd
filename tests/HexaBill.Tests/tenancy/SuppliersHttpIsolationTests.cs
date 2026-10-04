using System.Net;
using System.Net.Http.Json;

namespace HexaBill.Tests;

[Collection("HttpIntegration")]
public class SuppliersHttpIsolationTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public SuppliersHttpIsolationTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task GetSupplierBalance_OwnSupplier_ReturnsTenantPurchases()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/suppliers/balance/Sup%20A");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<SupplierBalanceStub>>();
        Assert.True(json?.Success);
        Assert.True(json?.Data?.TotalPurchases >= 50m);
        Assert.True(json!.Data!.NetPayable >= 0m);
        Assert.True(json.Data.NetPayable <= json.Data.TotalPurchases);
    }

    [Fact]
    public async Task GetSupplierBalance_OtherTenantsSupplierName_DoesNotExposeTheirPurchases()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/suppliers/balance/Sup%20B");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<SupplierBalanceStub>>();
        Assert.True(json?.Success);
        Assert.Equal(0m, json?.Data?.NetPayable);
        Assert.Equal(0m, json?.Data?.TotalPurchases);
    }

    [Fact]
    public async Task GetAllSuppliersSummary_ListsOnlyOwnTenantDirectory()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/suppliers/summary");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<List<SupplierSummaryStub>>>();
        Assert.True(json?.Success);
        Assert.Single(json!.Data!);
        Assert.Equal("Sup A", json.Data![0].SupplierName);
        Assert.True(json.Data[0].NetPayable >= 0m);
    }

    [Fact]
    public async Task GetSupplierByName_OtherTenantsSupplier_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/suppliers/by-name/Sup%20B");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetSupplierStatement_OtherTenantsSupplier_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/suppliers/Sup%20B/statement");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task SearchSuppliers_DoesNotReturnOtherTenantNames()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/suppliers/search?q=Sup");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<List<string>>>();
        Assert.True(json?.Success);
        Assert.Contains("Sup A", json!.Data!);
        Assert.DoesNotContain("Sup B", json.Data!);
    }

    private sealed class ApiEnvelope<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
    }

    private sealed class SupplierBalanceStub
    {
        public decimal NetPayable { get; set; }
        public decimal TotalPurchases { get; set; }
    }

    private sealed class SupplierSummaryStub
    {
        public string? SupplierName { get; set; }
        public decimal NetPayable { get; set; }
    }
}
