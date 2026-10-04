using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace HexaBill.Tests;

internal static class HttpIntegrationClient
{
    public static HttpClient Create(HexaBillWebApplicationFactory factory, int tenantId, string slug)
        => Create(factory, tenantId, tenantId, slug);

    public static HttpClient Create(WebApplicationFactory<Program> factory, int userId, int tenantId, string slug)
    {
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            BaseAddress = new Uri($"http://{slug}.hexabill.company"),
        });
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestJwtFactory.CreateAuthenticatedApiToken(userId, tenantId, slug));
        return client;
    }

    public static async Task<HttpClient> CreateFromLoginAsync(
        WebApplicationFactory<Program> factory, string slug, string email, string password)
    {
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            BaseAddress = new Uri($"http://{slug}.hexabill.company"),
        });
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        loginResponse.EnsureSuccessStatusCode();
        var envelope = await loginResponse.Content.ReadFromJsonAsync<LoginEnvelope>();
        if (string.IsNullOrWhiteSpace(envelope?.Data?.Token))
            throw new InvalidOperationException("Login response did not include a token.");
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", envelope.Data.Token);
        return client;
    }

    public static HttpClient CreatePlatformAdmin(WebApplicationFactory<Program> factory, int userId = 1)
    {
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            BaseAddress = new Uri("http://admin.hexabill.company"),
        });
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestJwtFactory.CreatePlatformAdminToken(userId));
        return client;
    }

    private sealed class LoginEnvelope
    {
        public bool Success { get; set; }
        public LoginData? Data { get; set; }
    }

    private sealed class LoginData
    {
        public string? Token { get; set; }
    }
}
