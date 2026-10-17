using System.Net;
using System.Net.Http.Json;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HexaBill.Tests;

/// <summary>SAFE-01: the server, not the page, enforces reason, typed confirmation, backup acknowledgement and re-authentication.</summary>
[Collection("HttpIntegration")]
public class ClearTenantDataGuardHttpTests
{
    private const string Password = "Correct-Horse-9!";
    private readonly HexaBillWebApplicationFactory _factory;

    public ClearTenantDataGuardHttpTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    // Own throwaway tenant so a successful clear never touches shared seed data.
    private async Task<(int tenantId, int userId, string slug)> CreateTenantAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var id = 9000 + Random.Shared.Next(1, 900);
        var slug = $"cleartest{id}";
        db.Tenants.Add(new Tenant { Id = id, Name = $"Clear Test {id}", Subdomain = slug, Status = TenantStatus.Active });
        db.Users.Add(new User
        {
            Id = id, TenantId = id, OwnerId = id, Name = "Owner", Email = $"o{id}@http.test",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(Password), Role = UserRole.Owner, SessionVersion = 1, IsActive = true, CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();
        return (id, id, slug);
    }

    private static object Body(string? reason = "Starting the real books fresh", string? confirmation = "CLEAR", string? password = Password, bool backup = true)
        => new { reason, confirmation, password, backupConfirmed = backup };

    private async Task<int> ClearAuditCountAsync(int tenantId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.AuditLogs.IgnoreQueryFilters().CountAsync(a => a.TenantId == tenantId && a.Action == "ClearTenantData");
    }

    [Fact]
    public async Task NoBody_IsRejected()
    {
        var (tenantId, userId, slug) = await CreateTenantAsync();
        using var client = HttpIntegrationClient.Create(_factory, userId, tenantId, slug);
        var response = await client.PostAsync("/api/settings/clear-data", null);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, await ClearAuditCountAsync(tenantId));
    }

    [Theory]
    [InlineData("short", "CLEAR", true)]
    [InlineData("Starting the real books fresh", "clear it", true)]
    [InlineData("Starting the real books fresh", "CLEAR", false)]
    public async Task MissingReasonConfirmationOrBackupAck_IsRejected(string reason, string confirmation, bool backup)
    {
        var (tenantId, userId, slug) = await CreateTenantAsync();
        using var client = HttpIntegrationClient.Create(_factory, userId, tenantId, slug);
        var response = await client.PostAsJsonAsync("/api/settings/clear-data", Body(reason, confirmation, Password, backup));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, await ClearAuditCountAsync(tenantId));
    }

    [Fact]
    public async Task WrongPassword_IsForbidden()
    {
        var (tenantId, userId, slug) = await CreateTenantAsync();
        using var client = HttpIntegrationClient.Create(_factory, userId, tenantId, slug);
        var response = await client.PostAsJsonAsync("/api/settings/clear-data", Body(password: "not-the-password"));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(0, await ClearAuditCountAsync(tenantId));
    }

    [Fact]
    public async Task ValidRequest_Succeeds_AndWritesAnAuditRowWithTheReason()
    {
        var (tenantId, userId, slug) = await CreateTenantAsync();
        using var client = HttpIntegrationClient.Create(_factory, userId, tenantId, slug);
        var response = await client.PostAsJsonAsync("/api/settings/clear-data", Body());
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var audit = await db.AuditLogs.IgnoreQueryFilters().SingleAsync(a => a.TenantId == tenantId && a.Action == "ClearTenantData");
        Assert.Contains("Starting the real books fresh", audit.Details);
        Assert.Equal(userId, audit.UserId);
    }
}
