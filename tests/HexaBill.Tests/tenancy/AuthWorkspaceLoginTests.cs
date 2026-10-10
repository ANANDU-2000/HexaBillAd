using System.IdentityModel.Tokens.Jwt;
using HexaBill.Api.Core.Tenancy;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Auth;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace HexaBill.Tests;

public sealed class AuthWorkspaceLoginTests
{
    [Theory]
    [InlineData(10)]
    [InlineData(20)]
    public async Task SharedEmail_AuthenticatesOnlyTheResolvedWorkspace(int tenantId)
    {
        await using var db = await CreateFixtureAsync();
        db.SetRequestTenantScope(tenantId, false);
        var service = CreateService(db, new(TenantHostKind.Tenant, $"workspace-{tenantId}", tenantId, TenantStatus.Active));
        var response = await service.LoginAsync(new() { Email = "  OWNER@EXAMPLE.TEST  ", Password = $"secret-{tenantId}" });

        Assert.NotNull(response);
        Assert.Equal(tenantId, response.TenantId);
        Assert.Equal(tenantId, response.UserId);
        Assert.Equal($"Company {tenantId}", response.CompanyName);
        Assert.Equal(new[] { tenantId }, response.AssignedBranchIds);
        Assert.Equal(new[] { tenantId }, response.AssignedRouteIds);
        var claims = new JwtSecurityTokenHandler().ReadJwtToken(response.Token).Claims;
        Assert.Contains(claims, c => c.Type == "tid" && c.Value == tenantId.ToString());
        Assert.Contains(claims, c => c.Type == "tslug" && c.Value == $"workspace-{tenantId}");
        db.SetRequestTenantScope(null, true);
        db.ChangeTracker.Clear();
        Assert.NotNull((await db.Users.SingleAsync(u => u.Id == tenantId)).LastLoginAt);
        Assert.Null((await db.Users.SingleAsync(u => u.Id == (tenantId == 10 ? 20 : 10))).LastLoginAt);
        var session = Assert.Single(await db.UserSessions.ToListAsync());
        Assert.Equal(tenantId, session.TenantId);
        Assert.Equal(tenantId, session.UserId);
    }

    [SkippableFact]
    public async Task SharedEmail_PostgreSql_AuthenticatesEachWorkspaceWithoutTouchingTheOther()
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(connection), "Requires the disposable PostgreSQL test database.");
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection).Options);
        db.SetRequestTenantScope(null, true);
        await PostgresTestSchema.EnsureCreatedAsync(db);
        await using var transaction = await db.Database.BeginTransactionAsync();
        var firstId = Random.Shared.Next(3_000_000, 4_000_000);
        var email = $"shared-{Guid.NewGuid():N}@example.test";
        foreach (var id in new[] { firstId, firstId + 1 })
        {
            db.Tenants.Add(new() { Id = id, Name = "Synthetic workspace", Subdomain = $"auth-{id}", Status = TenantStatus.Active });
            db.Users.Add(new() { Id = id, TenantId = id, OwnerId = id, Name = "Synthetic owner", Email = email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword($"test-{id}"), Role = UserRole.Owner });
        }
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        foreach (var id in new[] { firstId, firstId + 1 })
        {
            db.SetRequestTenantScope(id, false);
            var response = await CreateService(db, new(TenantHostKind.Tenant, $"auth-{id}", id, TenantStatus.Active))
                .LoginAsync(new() { Email = email, Password = $"test-{id}" });
            Assert.NotNull(response);
            Assert.Equal(id, response.UserId);
            Assert.Equal(id, response.TenantId);
            db.ChangeTracker.Clear();
        }
        db.SetRequestTenantScope(null, true);
        var sessions = await db.UserSessions.Where(s => s.UserId == firstId || s.UserId == firstId + 1).ToListAsync();
        Assert.Equal(2, sessions.Count);
        Assert.All(sessions, s => Assert.Equal(s.UserId, s.TenantId));
        // Roll back all synthetic accounts/sessions even when an assertion fails.
        await transaction.RollbackAsync();
    }

    [Fact]
    public async Task SharedEmail_PlatformHostSelectsOnlyPlatformIdentity()
    {
        await using var db = await CreateFixtureAsync();
        db.SetRequestTenantScope(null, true);
        var response = await CreateService(db, TenantHostResolution.Platform())
            .LoginAsync(new() { Email = "owner@example.test", Password = "platform-secret" });
        Assert.NotNull(response);
        Assert.Equal(30, response.UserId);
        Assert.Null(response.TenantId);
        var claims = new JwtSecurityTokenHandler().ReadJwtToken(response.Token).Claims;
        Assert.Contains(claims, c => c.Type == "plat" && c.Value == "true");
        Assert.DoesNotContain(claims, c => c.Type == "tid");
    }

    [Theory]
    [InlineData("secret-10", true, TenantStatus.Active)]
    [InlineData("platform-secret", true, TenantStatus.Active)]
    [InlineData("wrong-password", true, TenantStatus.Active)]
    [InlineData("secret-20", false, TenantStatus.Active)]
    [InlineData("secret-20", true, TenantStatus.Suspended)]
    [InlineData("secret-20", true, TenantStatus.Expired)]
    public async Task RejectedLogin_RecordsNoSessionOrTimestamp(string password, bool active, TenantStatus status)
    {
        await using var db = await CreateFixtureAsync();
        db.Users.Single(u => u.Id == 20).IsActive = active;
        db.Tenants.Single(t => t.Id == 20).Status = status;
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        db.SetRequestTenantScope(20, false);
        // Host cache can still say Active; the service must check current tenant state.
        var response = await CreateService(db, new(TenantHostKind.Tenant, "workspace-20", 20, TenantStatus.Active))
            .LoginAsync(new() { Email = "owner@example.test", Password = password });
        Assert.Null(response);
        db.SetRequestTenantScope(null, true);
        Assert.Empty(await db.UserSessions.ToListAsync());
        Assert.All(await db.Users.ToListAsync(), u => Assert.Null(u.LastLoginAt));
    }

    [Theory]
    [InlineData(TenantHostKind.Unknown)]
    [InlineData(TenantHostKind.Marketing)]
    public async Task NonWorkspaceHost_RejectsValidCredentials(TenantHostKind kind)
    {
        await using var db = await CreateFixtureAsync();
        var response = await CreateService(db, new(kind, null, null, null))
            .LoginAsync(new() { Email = "owner@example.test", Password = "secret-10" });
        Assert.Null(response);
        Assert.Empty(await db.UserSessions.ToListAsync());
    }

    private static AuthService CreateService(AppDbContext db, TenantHostResolution resolution)
    {
        var http = new DefaultHttpContext();
        http.Items[TenantHostMiddleware.ResolutionItemKey] = resolution;
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["JwtSettings:SecretKey"] = "synthetic-workspace-test-signing-key-long-enough-for-hmac-sha256"
        }).Build();
        return new(db, config, new Resolver(resolution), new HttpContextAccessor { HttpContext = http });
    }

    private static async Task<AppDbContext> CreateFixtureAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        db.SetRequestTenantScope(null, true);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        foreach (var id in new[] { 10, 20 })
        {
            db.Tenants.Add(new() { Id = id, Name = $"Company {id}", Subdomain = $"workspace-{id}", Status = TenantStatus.Active });
            db.Users.Add(new() { Id = id, TenantId = id, OwnerId = id, Name = $"Owner {id}", Email = "owner@example.test",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword($"secret-{id}"), Role = UserRole.Owner, IsActive = true });
            db.Settings.Add(new() { TenantId = id, OwnerId = id, Key = "COMPANY_NAME_EN", Value = $"Company {id}" });
            db.Branches.Add(new() { Id = id, TenantId = id, Name = $"Branch {id}" });
            db.Routes.Add(new() { Id = id, TenantId = id, BranchId = id, Name = $"Route {id}" });
            db.BranchStaff.Add(new() { BranchId = id, UserId = id });
            db.RouteStaff.Add(new() { RouteId = id, UserId = id });
        }
        db.Users.Add(new() { Id = 30, Name = "Platform", Email = "owner@example.test", IsPlatformAdmin = true,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("platform-secret"), Role = UserRole.Admin, IsActive = true });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return db;
    }

    private sealed class Resolver(TenantHostResolution resolution) : ITenantHostResolver
    {
        public Task<TenantHostResolution> ResolveAsync(HttpContext context, CancellationToken cancellationToken = default) => Task.FromResult(resolution);
        public void Invalidate(string? slug) { }
    }
}
