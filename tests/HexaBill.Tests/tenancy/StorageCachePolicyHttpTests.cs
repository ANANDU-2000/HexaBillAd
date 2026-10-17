using System.Net;
using HexaBill.Api.Core.Storage;
using Microsoft.Extensions.DependencyInjection;

namespace HexaBill.Tests;

/// <summary>SEC-02: private tenant files must never be publicly cacheable; brand logos may be.</summary>
[Collection("HttpIntegration")]
public class StorageCachePolicyHttpTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public StorageCachePolicyHttpTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    private async Task<string> SeedAsync(int tenantId, string folder)
    {
        using var scope = _factory.Services.CreateScope();
        var storage = scope.ServiceProvider.GetRequiredService<IStorageService>();
        var key = $"tenants/{tenantId}/{folder}/{Guid.NewGuid():N}.png";
        await storage.UploadAsync(key, new byte[] { 0x89, 0x50, 0x4E, 0x47 }, "image/png");
        return key;
    }

    private static string CacheControl(HttpResponseMessage r) =>
        string.Join(",", r.Headers.TryGetValues("Cache-Control", out var v) ? v : Array.Empty<string>());

    [Fact]
    public async Task PrivateDocument_IsNotPubliclyCacheable()
    {
        var key = await SeedAsync(1, "documents");
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync($"/api/storage/{key}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var cc = CacheControl(response);
        Assert.DoesNotContain("public", cc, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("no-store", cc, StringComparison.OrdinalIgnoreCase);
        Assert.Equal("nosniff", string.Join(",", response.Headers.GetValues("X-Content-Type-Options")));
    }

    [Fact]
    public async Task PrivateDocument_OtherTenantIsForbidden()
    {
        var key = await SeedAsync(1, "documents");
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var response = await client.GetAsync($"/api/storage/{key}");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task TenantLogo_MayBeCachedByTheBrowser()
    {
        var key = await SeedAsync(1, "logos");
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync($"/api/storage/{key}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("max-age", CacheControl(response), StringComparison.OrdinalIgnoreCase);
    }
}
