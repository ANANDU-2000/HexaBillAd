using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace HexaBill.Tests;

[Collection("HttpIntegration")]
public class TenantHostHttpIsolationTests
{
    private readonly HexaBillEnforcedHostWebApplicationFactory _factory;

    public TenantHostHttpIsolationTests(HexaBillEnforcedHostWebApplicationFactory factory) => _factory = factory;

    [Fact(DisplayName = "TEN01_ValidHostAndToken_ReturnsSuccess")]
    public async Task ValidHostAndMatchingToken_ReturnsSuccess()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/customers/1");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact(DisplayName = "TEN01_TokenOnWrongTenantHost_ReturnsForbidden")]
    public async Task TenantAToken_OnTenantBHost_ReturnsForbidden()
    {
        var client = _factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            BaseAddress = new Uri("http://tenantb.hexabill.company"),
        });
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestJwtFactory.CreateAuthenticatedApiToken(1, 1, "tenanta"));

        var response = await client.GetAsync("/api/customers/1");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact(DisplayName = "TEN01_UnknownHost_ReturnsForbidden")]
    public async Task UnknownHost_ReturnsForbidden()
    {
        var client = _factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            BaseAddress = new Uri("http://evil.example.com"),
        });
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestJwtFactory.CreateAuthenticatedApiToken(1, 1, "tenanta"));

        var response = await client.GetAsync("/api/customers/1");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact(DisplayName = "TEN01_ClientSuppliedXTenantIdHeader_ReturnsForbidden")]
    public async Task ClientSuppliedXTenantIdHeader_ReturnsForbidden()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/customers/1");
        request.Headers.TryAddWithoutValidation("X-Tenant-Id", "2");
        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
