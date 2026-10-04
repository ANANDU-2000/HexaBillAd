using System.Net;
using System.Net.Http.Json;

namespace HexaBill.Tests;

[Collection("HttpIntegration")]
public class ExpensesHttpIsolationTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public ExpensesHttpIsolationTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task GetExpense_OwnTenant_ReturnsSuccess()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/expenses/1");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<ExpenseDtoStub>>();
        Assert.True(json?.Success);
        Assert.Equal(1, json?.Data?.Id);
    }

    [Fact]
    public async Task GetExpense_OtherTenantsExpense_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/expenses/2");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetExpense_TenantBCannotReadTenantAExpense_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var response = await client.GetAsync("/api/expenses/1");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PostCreateExpense_CrossTenantCategory_ReturnsBadRequest()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var response = await client.PostAsJsonAsync("/api/expenses", new
        {
            categoryId = 1,
            amount = 15m,
            date = DateTime.UtcNow,
            note = "cross-tenant category",
            withVat = false,
            paidFrom = "Cash"
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task DeleteExpense_OtherTenantsExpense_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.DeleteAsync("/api/expenses/2");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PostCreateExpense_OwnCategory_ReturnsCreated()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.PostAsJsonAsync("/api/expenses", new
        {
            categoryId = 1,
            amount = 12m,
            date = DateTime.UtcNow,
            note = "HTTP isolation create",
            withVat = false,
            paidFrom = "Cash"
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<ExpenseDtoStub>>();
        Assert.True(json?.Success);
        Assert.True(json?.Data?.Id > 0);
    }

    private sealed class ApiEnvelope<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
    }

    private sealed class ExpenseDtoStub
    {
        public int Id { get; set; }
    }
}
