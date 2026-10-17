using System.Net;
using System.Net.Http.Json;

namespace HexaBill.Tests;

/// <summary>REL-02: the staff activity endpoint lives under /api/admin/users/{id}/activity and is tenant-scoped.</summary>
[Collection("HttpIntegration")]
public class UserActivityHttpIsolationTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public UserActivityHttpIsolationTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task OwnTenantUser_ReturnsSuccessEnvelope()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/admin/users/1/activity?limit=10");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<Envelope>();
        Assert.True(json?.Success);
        Assert.NotNull(json!.Data);
    }

    [Fact]
    public async Task OtherTenantUser_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/admin/users/2/activity");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task LegacyUsersRoute_IsNotServed()
    {
        // The frontend used to call this path; it must stay a 404 so a regression is visible, not silently empty.
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/users/1/activity");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private sealed class Envelope
    {
        public bool Success { get; set; }
        public List<object>? Data { get; set; }
    }
}
