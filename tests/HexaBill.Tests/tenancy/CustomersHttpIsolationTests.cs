using System.Net;
using System.Net.Http.Json;

namespace HexaBill.Tests;

[Collection("HttpIntegration")]
public class CustomersHttpIsolationTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public CustomersHttpIsolationTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task GetCustomer_OwnTenant_ReturnsSuccess()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/customers/1");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<CustomerDtoStub>>();
        Assert.True(json?.Success);
        Assert.Equal(1, json?.Data?.Id);
    }

    [Fact]
    public async Task GetCustomer_OtherTenantsCustomer_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/customers/2");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetCustomer_TenantBCannotReadTenantACustomer_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var response = await client.GetAsync("/api/customers/1");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetCustomerLedger_OwnCustomer_ReturnsSuccess()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/customers/1/ledger");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<List<LedgerEntryStub>>>();
        Assert.True(json?.Success);
        Assert.NotNull(json?.Data);
        Assert.NotEmpty(json!.Data!);
    }

    [Fact]
    public async Task GetCustomerLedger_TenantBCannotReadTenantACustomer_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var response = await client.GetAsync("/api/customers/1/ledger");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetCustomerLedger_OtherTenantsCustomer_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/customers/2/ledger");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetOutstandingInvoices_OtherTenantsCustomer_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/customers/2/outstanding-invoices");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetOutstandingInvoices_IncludesCustomerIdentityForLedgerFiltering()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/customers/1/outstanding-invoices");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = System.Text.Json.JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var invoices = json.RootElement.GetProperty("data").EnumerateArray().ToList();
        Assert.NotEmpty(invoices);
        Assert.All(invoices, invoice =>
        {
            Assert.True(invoice.TryGetProperty("customerId", out var customerId), "Ledger drops invoices without customerId and hides Pay All.");
            Assert.Equal(1, customerId.GetInt32());
            Assert.True(invoice.GetProperty("balanceAmount").GetDecimal() > 0);
        });
    }

    [Fact]
    public async Task SearchCustomers_DoesNotReturnOtherTenantCustomers()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/customers/search?q=Cust");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<List<CustomerDtoStub>>>();
        Assert.True(json?.Success);
        Assert.Single(json!.Data!);
        Assert.Equal(1, json.Data![0].Id);
        Assert.DoesNotContain(json.Data!, c => c.Id == 2);
    }

    [Fact]
    public async Task CreateCustomer_DuplicateName_ReturnsConflictNotServerError()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var name = $"Dup Name {Guid.NewGuid():N}";
        var first = await client.PostAsJsonAsync("/api/customers", new { name, phone = $"050{Random.Shared.Next(1000000, 9999999)}" });
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        var second = await client.PostAsJsonAsync("/api/customers", new { name, phone = $"051{Random.Shared.Next(1000000, 9999999)}" });
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        Assert.Contains("already exists", await second.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task CreateAndUpdateCustomer_DuplicatePhone_ReturnsConflictNotServerError()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var phone = $"052{Random.Shared.Next(1000000, 9999999)}";
        var first = await client.PostAsJsonAsync("/api/customers", new { name = $"Phone Owner {Guid.NewGuid():N}", phone });
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        var dup = await client.PostAsJsonAsync("/api/customers", new { name = $"Phone Clone {Guid.NewGuid():N}", phone });
        Assert.Equal(HttpStatusCode.Conflict, dup.StatusCode);

        var other = await client.PostAsJsonAsync("/api/customers", new { name = $"Phone Other {Guid.NewGuid():N}", phone = $"053{Random.Shared.Next(1000000, 9999999)}" });
        Assert.Equal(HttpStatusCode.Created, other.StatusCode);
        var otherId = (await other.Content.ReadFromJsonAsync<ApiEnvelope<CustomerDtoStub>>())!.Data!.Id;
        var update = await client.PutAsJsonAsync($"/api/customers/{otherId}", new { name = $"Phone Other {Guid.NewGuid():N}", phone });
        Assert.Equal(HttpStatusCode.Conflict, update.StatusCode);
    }

    private sealed class ApiEnvelope<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
    }

    private sealed class CustomerDtoStub
    {
        public int Id { get; set; }
    }

    private sealed class LedgerEntryStub
    {
        public string? Particulars { get; set; }
    }
}
