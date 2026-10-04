using System.Net;

namespace HexaBill.Tests;

[Collection("HttpIntegration")]
public class StorageHttpIsolationTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public StorageHttpIsolationTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task GetTenantLogo_OwnTenant_ReturnsFileBytes()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/storage/tenants/1/logos/fixture.png");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var bytes = await response.Content.ReadAsByteArrayAsync();
        Assert.Equal(new byte[] { 1, 2, 3 }, bytes);
    }

    [Fact]
    public async Task GetTenantLogo_OtherTenantsPath_ReturnsForbidden()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/storage/tenants/2/logos/secret.png");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetByKey_OtherTenantsKey_ReturnsForbidden()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/storage/tenants/2/logos/secret.png");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetTenantLogo_TenantBCannotReadTenantA_ReturnsForbidden()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var response = await client.GetAsync("/api/storage/tenants/1/logos/fixture.png");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetTenantLogo_OwnTenantAsTenantB_ReturnsFileBytes()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var response = await client.GetAsync("/api/storage/tenants/2/logos/secret.png");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var bytes = await response.Content.ReadAsByteArrayAsync();
        Assert.Equal(new byte[] { 4, 5, 6 }, bytes);
    }
}
