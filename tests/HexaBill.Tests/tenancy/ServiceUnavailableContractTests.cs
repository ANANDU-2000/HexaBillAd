using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HexaBill.Tests;

/// <summary>
/// P0-02: clients must be able to tell administrator maintenance apart from a server that is
/// starting, updating or blocked on schema. Both are 503, so the body carries a stable reason.
/// </summary>
[Collection("HttpIntegration")]
public sealed class ServiceUnavailableContractTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public ServiceUnavailableContractTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task InitializationGate_ReturnsServiceUnavailableReason_NotMaintenance()
    {
        using var client = _factory.CreateClient();
        var status = _factory.Services.GetRequiredService<DatabaseInitializationStatus>();
        status.SetStateForTests(DatabaseInitializationState.Failed);
        try
        {
            var login = await client.PostAsJsonAsync("/api/auth/login", new { email = "x@example.test", password = "not-used" });
            Assert.Equal(HttpStatusCode.ServiceUnavailable, login.StatusCode);
            using var body = JsonDocument.Parse(await login.Content.ReadAsStringAsync());
            Assert.Equal("SERVICE_UNAVAILABLE", body.RootElement.GetProperty("reason").GetString());
            Assert.False(string.IsNullOrWhiteSpace(body.RootElement.GetProperty("message").GetString()));
            Assert.False(body.RootElement.TryGetProperty("maintenanceMode", out _));
            Assert.Equal("InitializationFailed", body.RootElement.GetProperty("schema").GetString());
            Assert.NotNull(login.Headers.RetryAfter);
        }
        finally
        {
            status.SetStateForTests(DatabaseInitializationState.Ready);
        }
    }

    [Fact]
    public async Task PlatformMaintenance_ReturnsMaintenanceReason_AndLeavesAuthOpen()
    {
        await SetMaintenanceAsync("true");
        try
        {
            using var owner = HttpIntegrationClient.Create(_factory, 1, 1, "tenanta");
            var business = await owner.GetAsync("/api/customers");
            Assert.Equal(HttpStatusCode.ServiceUnavailable, business.StatusCode);
            using var body = JsonDocument.Parse(await business.Content.ReadAsStringAsync());
            Assert.Equal("MAINTENANCE_ENABLED", body.RootElement.GetProperty("reason").GetString());
            Assert.True(body.RootElement.GetProperty("maintenanceMode").GetBoolean());
            Assert.NotNull(business.Headers.RetryAfter);

            using var anonymous = _factory.CreateClient();
            var login = await anonymous.PostAsJsonAsync("/api/auth/login", new { email = "x@example.test", password = "not-used" });
            Assert.NotEqual(HttpStatusCode.ServiceUnavailable, login.StatusCode);

            using var platformAdmin = HttpIntegrationClient.CreatePlatformAdmin(_factory);
            Assert.NotEqual(HttpStatusCode.ServiceUnavailable, (await platformAdmin.GetAsync("/api/customers")).StatusCode);
        }
        finally
        {
            await SetMaintenanceAsync(null);
        }
    }

    private async Task SetMaintenanceAsync(string? value)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.SetRequestTenantScope(null, isPlatformScope: true);
        var existing = await db.Settings.IgnoreQueryFilters()
            .Where(s => s.OwnerId == 0 && s.Key == "PLATFORM_MAINTENANCE_MODE")
            .ToListAsync();
        db.Settings.RemoveRange(existing);
        if (value != null)
            db.Settings.Add(new Setting { Key = "PLATFORM_MAINTENANCE_MODE", OwnerId = 0, Value = value });
        await db.SaveChangesAsync();
    }
}
