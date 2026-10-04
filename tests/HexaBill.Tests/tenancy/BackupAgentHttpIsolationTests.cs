using System.Net;
using System.Net.Http.Headers;
using Microsoft.AspNetCore.Mvc.Testing;

namespace HexaBill.Tests;

[Collection("HttpIntegration")]
public class BackupAgentHttpIsolationTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public BackupAgentHttpIsolationTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task DownloadJobFile_CrossTenantRun_ReturnsNotFound()
    {
        using var client = CreateAgentClient("tenanta", HexaBillWebApplicationFactory.BackupAgentTokenTenantA);
        var response = await client.GetAsync(
            $"/api/backup/agent/jobs/{HexaBillWebApplicationFactory.BackupRunTenantBId}/file");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DownloadJobFile_TenantBAgent_CannotDownloadTenantARun()
    {
        using var client = CreateAgentClient("tenantb", HexaBillWebApplicationFactory.BackupAgentTokenTenantB);
        var response = await client.GetAsync(
            $"/api/backup/agent/jobs/{HexaBillWebApplicationFactory.BackupRunTenantAId}/file");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AgentToken_OnWrongTenantHost_ReturnsUnauthorized()
    {
        using var client = CreateAgentClient("tenantb", HexaBillWebApplicationFactory.BackupAgentTokenTenantA);
        var response = await client.GetAsync("/api/backup/agent/config");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task TenantOwnerJwt_CannotDownloadAgentJobFile_ReturnsUnauthorized()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync(
            $"/api/backup/agent/jobs/{HexaBillWebApplicationFactory.BackupRunTenantAId}/file");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private HttpClient CreateAgentClient(string slug, string token)
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            BaseAddress = new Uri($"http://{slug}.hexabill.company"),
        });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }
}
