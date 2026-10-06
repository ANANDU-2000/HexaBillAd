using System.Data.Common;
using HexaBill.Api.Core.Tenancy;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Auth;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;

namespace HexaBill.Tests;

public sealed class AuthTenantStatusTests
{
    [Fact]
    public async Task Login_DeniesAuthenticationWhenTenantStatusLookupFails()
    {
        var interceptor = new TenantLookupFailureInterceptor();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite("Data Source=:memory:")
            .AddInterceptors(interceptor)
            .Options;
        await using var db = new AppDbContext(options);
        db.SetRequestTenantScope(10, false);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        var user = new User
        {
            Id = 1, TenantId = 10, OwnerId = 10, Name = "Tenant owner", Email = "owner@example.test",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("secret"), Role = UserRole.Owner, IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Tenants.Add(new Tenant { Id = 10, Name = "Tenant", Subdomain = "tenant", Status = TenantStatus.Active });
        db.Users.Add(user);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        interceptor.FailTenantLookup = true;

        var httpContext = new DefaultHttpContext();
        httpContext.Items[TenantHostMiddleware.ResolutionItemKey] = new TenantHostResolution(
            TenantHostKind.Tenant, "tenant", 10, TenantStatus.Active);
        var httpAccessor = new HttpContextAccessor { HttpContext = httpContext };
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["JwtSettings:SecretKey"] = "synthetic-test-signing-key-that-is-long-enough-for-hmac-sha256"
        }).Build();
        var service = new AuthService(db, config, new TenantHostResolverStub(), httpAccessor);

        var response = await service.LoginAsync(new LoginRequest { Email = "owner@example.test", Password = "secret" });

        Assert.Null(response);
        interceptor.FailTenantLookup = false;
        db.ChangeTracker.Clear();
        Assert.Null((await db.Users.SingleAsync(u => u.Id == 1)).LastLoginAt);
    }

    private sealed class TenantLookupFailureInterceptor : DbCommandInterceptor
    {
        public bool FailTenantLookup { get; set; }

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            if (FailTenantLookup && command.CommandText.Contains("\"Tenants\"", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Synthetic tenant-state database failure.");
            return ValueTask.FromResult(result);
        }
    }

    private sealed class TenantHostResolverStub : ITenantHostResolver
    {
        public Task<TenantHostResolution> ResolveAsync(HttpContext context, CancellationToken cancellationToken = default)
            => Task.FromResult(new TenantHostResolution(TenantHostKind.Tenant, "tenant", 10, TenantStatus.Active));

        public void Invalidate(string? slug) { }
    }
}
