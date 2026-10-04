using System.Net;
using System.Net.Http.Json;

namespace HexaBill.Tests;

[Collection("HttpIntegration")]
public class RecurringInvoicesHttpIsolationTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public RecurringInvoicesHttpIsolationTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task GetRecurringInvoices_ReturnsOnlyOwnTenantRows()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/RecurringInvoices");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<List<RecurringStub>>>();
        Assert.True(json?.Success);
        Assert.Single(json!.Data!);
        Assert.Equal(1, json.Data![0].Id);
    }

    [Fact]
    public async Task DeleteRecurringInvoice_OtherTenantsTemplate_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.DeleteAsync("/api/RecurringInvoices/2");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteRecurringInvoice_TenantBCannotDeleteTenantA_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var response = await client.DeleteAsync("/api/RecurringInvoices/1");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private sealed class ApiEnvelope<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
    }

    private sealed class RecurringStub
    {
        public int Id { get; set; }
    }
}
