using System.Net;
using System.Net.Http.Json;

namespace HexaBill.Tests;

[Collection("HttpIntegration")]
public class UsersHttpIsolationTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public UsersHttpIsolationTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task GetUser_OwnTenant_ReturnsSuccess()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/users/1");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<UserStub>>();
        Assert.True(json?.Success);
        Assert.Equal(1, json?.Data?.Id);
    }

    [Fact]
    public async Task GetUser_OtherTenantsUser_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/users/2");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetUser_TenantBCannotReadTenantAUser_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var response = await client.GetAsync("/api/users/1");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetUsers_ListExcludesOtherTenantsUsers()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/users?pageSize=100");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<PagedStub<UserStub>>>();
        Assert.True(json?.Success);
        var ids = json!.Data!.Items!.Select(u => u.Id).ToList();
        Assert.Contains(1, ids);
        Assert.DoesNotContain(2, ids);
    }

    private sealed class ApiEnvelope<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
    }

    private sealed class PagedStub<T>
    {
        public List<T>? Items { get; set; }
    }

    private sealed class UserStub
    {
        public int Id { get; set; }
    }
}
