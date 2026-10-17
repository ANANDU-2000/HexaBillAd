using System.Net;
using System.Net.Http.Json;

namespace HexaBill.Tests;

/// <summary>DATA-01: directory counts come from the server, over every company, regardless of page and filter.</summary>
[Collection("HttpIntegration")]
public class TenantDirectoryCountsHttpTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public TenantDirectoryCountsHttpTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    private async Task<Envelope> GetAsync(string query)
    {
        using var client = HttpIntegrationClient.CreatePlatformAdmin(_factory);
        var response = await client.GetAsync($"/api/superadmin/tenant{query}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<Envelope>();
        Assert.True(json?.Success);
        return json!;
    }

    [Fact]
    public async Task Counts_AreIndependentOfPageSizeAndFilters()
    {
        var all = await GetAsync("?page=1&pageSize=100");
        var onePage = await GetAsync("?page=1&pageSize=1&status=Suspended&search=zzz-no-match");

        Assert.NotNull(all.Data!.StatusCounts);
        Assert.Equal(all.Data.TotalCount, all.Data.DirectoryTotal);
        Assert.Equal(all.Data.DirectoryTotal, all.Data.StatusCounts!.Values.Sum());
        Assert.Equal(all.Data.DirectoryTotal, onePage.Data!.DirectoryTotal);
        Assert.Equal(all.Data.StatusCounts, onePage.Data.StatusCounts);
        Assert.NotNull(onePage.Data.AsOf);
    }

    private sealed class Envelope { public bool Success { get; set; } public Page? Data { get; set; } }
    private sealed class Page
    {
        public int TotalCount { get; set; }
        public int? DirectoryTotal { get; set; }
        public Dictionary<string, int>? StatusCounts { get; set; }
        public DateTime? AsOf { get; set; }
    }
}
