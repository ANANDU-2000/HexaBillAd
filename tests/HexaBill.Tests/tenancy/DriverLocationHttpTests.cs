using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Branches;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace HexaBill.Tests;

/// <summary>
/// Live driver position: opt-in, only for an assigned driver on an open run, one overwritten row, visible only to the owner,
/// admin and managers of the route, gone when sharing stops or the run ends. Own company so other route lists stay exact.
/// </summary>
[Collection("HttpIntegration")]
public class DriverLocationHttpTests
{
    private const int Company = 9303;
    private const string Slug = "routeloc";
    private const int Owner = 9330, Driver = 9331, SecondDriver = 9332, Unassigned = 9333;
    private const int Route = 9331, OtherRoute = 9332;

    private static readonly object FixtureLock = new();
    private readonly HexaBillWebApplicationFactory _factory;

    public DriverLocationHttpTests(HexaBillWebApplicationFactory factory)
    {
        _factory = factory;
        EnsureFixture();
    }

    private void EnsureFixture()
    {
        lock (FixtureLock)
        {
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.SetRequestTenantScope(null, true);
            if (db.Tenants.IgnoreQueryFilters().Any(t => t.Id == Company)) return;
            var now = DateTime.UtcNow;
            db.Tenants.Add(new Tenant { Id = Company, Name = "Live location company", Subdomain = Slug, Status = TenantStatus.Active, FeaturesJson = "[]" });
            db.SaveChanges();
            foreach (var (id, role) in new[] { (Owner, UserRole.Owner), (Driver, UserRole.Staff), (SecondDriver, UserRole.Staff), (Unassigned, UserRole.Staff) })
                db.Users.Add(new User { Id = id, TenantId = Company, OwnerId = Company, Name = $"Live fixture {id}", Email = $"live-{id}@http.test", PasswordHash = "x", Role = role, SessionVersion = 1, IsActive = true, CreatedAt = now });
            db.Branches.Add(new Branch { Id = 9330, TenantId = Company, Name = "Live branch", IsActive = true, CreatedAt = now });
            db.Routes.AddRange(
                new HexaBill.Api.Models.Route { Id = Route, BranchId = 9330, TenantId = Company, Name = "Live route", IsActive = true, CreatedAt = now },
                new HexaBill.Api.Models.Route { Id = OtherRoute, BranchId = 9330, TenantId = Company, Name = "Other live route", IsActive = true, CreatedAt = now });
            db.SaveChanges();
            db.RouteStaff.AddRange(
                new RouteStaff { RouteId = Route, UserId = Driver, AssignedAt = now },
                new RouteStaff { RouteId = Route, UserId = SecondDriver, AssignedAt = now },
                new RouteStaff { RouteId = OtherRoute, UserId = SecondDriver, AssignedAt = now });
            db.SaveChanges();
        }
    }

    private HttpClient As(int userId, string role, int tenantId = Company, string slug = Slug)
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, BaseAddress = new Uri($"http://{slug}.hexabill.company") });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", TestJwtFactory.CreateAuthenticatedApiToken(userId, tenantId, slug, role: role));
        return client;
    }

    private static string NewSession() => Guid.NewGuid().ToString("N");
    private static object Ping(string session, double lat = 25.2048, double lng = 55.2708, bool consent = false, double? accuracy = 12) =>
        new { latitude = lat, longitude = lng, accuracyMeters = accuracy, sessionId = session, consent };

    private async Task ResetRoute(int routeId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.SetRequestTenantScope(null, true);
        db.DriverLocationCurrents.RemoveRange(db.DriverLocationCurrents.IgnoreQueryFilters().Where(l => l.RouteId == routeId));
        foreach (var run in await db.RouteRuns.IgnoreQueryFilters().Where(r => r.RouteId == routeId && r.EndedAt == null).ToListAsync()) run.EndedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }

    private static async Task<JsonElement> Data(HttpResponseMessage r) => (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");

    private async Task<int> RowCount(int routeId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.SetRequestTenantScope(null, true);
        return await db.DriverLocationCurrents.IgnoreQueryFilters().CountAsync(l => l.RouteId == routeId);
    }

    private async Task StartRun(HttpClient client, int routeId = Route) =>
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync($"/api/routes/{routeId}/run/start", new { })).StatusCode);

    [Fact]
    public async Task Feature_IsOffUnlessSwitchedOn()
    {
        var off = new DriverLocationService(null!, new ConfigurationBuilder().Build());
        Assert.False(off.IsEnabled());
        var on = new DriverLocationService(null!, new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["FeatureFlags:LiveDriverLocation"] = "true" }).Build());
        Assert.True(on.IsEnabled());
        // And through the host (switched on in the test configuration) the flag endpoint says so.
        using var owner = As(Owner, "Owner");
        Assert.True((await Data(await owner.GetAsync("/api/routes/feature-flags/live-location"))).GetProperty("enabled").GetBoolean());
    }

    [Fact]
    public async Task NothingIsShared_WithoutAnOpenRun()
    {
        await ResetRoute(Route);
        using var driver = As(Driver, "Staff");
        var response = await driver.PostAsJsonAsync($"/api/routes/{Route}/location", Ping(NewSession(), consent: true));
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal(0, await RowCount(Route));
    }

    [Fact]
    public async Task ConsentIsRequired_ForTheFirstUpdateOfASession()
    {
        await ResetRoute(Route);
        using var driver = As(Driver, "Staff");
        await StartRun(driver);
        var session = NewSession();
        var refused = await driver.PostAsJsonAsync($"/api/routes/{Route}/location", Ping(session, consent: false));
        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
        Assert.Equal(0, await RowCount(Route));
        Assert.Equal(HttpStatusCode.OK, (await driver.PostAsJsonAsync($"/api/routes/{Route}/location", Ping(session, consent: true))).StatusCode);
        Assert.Equal(1, await RowCount(Route));
        await Task.Delay(1200);
        // Later updates of the same session need no consent flag; a new session does.
        Assert.Equal(HttpStatusCode.OK, (await driver.PostAsJsonAsync($"/api/routes/{Route}/location", Ping(session, 25.21, 55.28, consent: false))).StatusCode);
        await Task.Delay(1200);
        Assert.Equal(HttpStatusCode.Conflict, (await driver.PostAsJsonAsync($"/api/routes/{Route}/location", Ping(NewSession(), consent: false))).StatusCode);
        await ResetRoute(Route);
    }

    [Fact]
    public async Task OnlyAnAssignedDriver_CanShare()
    {
        await ResetRoute(Route);
        using var driver = As(Driver, "Staff");
        await StartRun(driver);
        using var owner = As(Owner, "Owner");
        Assert.Equal(HttpStatusCode.Forbidden, (await owner.PostAsJsonAsync($"/api/routes/{Route}/location", Ping(NewSession(), consent: true))).StatusCode);
        using var stranger = As(Unassigned, "Staff");
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.PostAsJsonAsync($"/api/routes/{Route}/location", Ping(NewSession(), consent: true))).StatusCode);
        // Assigned to another route only: the route does not exist for them.
        using var second = As(SecondDriver, "Staff");
        Assert.Equal(HttpStatusCode.Conflict, (await second.PostAsJsonAsync($"/api/routes/{OtherRoute}/location", Ping(NewSession(), consent: true))).StatusCode); // no run open on that route
        Assert.Equal(0, await RowCount(Route));
        await ResetRoute(Route);
    }

    [Theory]
    [InlineData(95.0, 55.0)]
    [InlineData(25.0, -181.0)]
    [InlineData(0.0, 0.0)]
    public async Task ImpossiblePositions_AreRefused(double lat, double lng)
    {
        await ResetRoute(Route);
        using var driver = As(Driver, "Staff");
        await StartRun(driver);
        var response = await driver.PostAsJsonAsync($"/api/routes/{Route}/location", Ping(NewSession(), lat, lng, consent: true));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, await RowCount(Route));
        await ResetRoute(Route);
    }

    [Fact]
    public async Task TooManyUpdates_AreSlowedDown_AndOnlyOneRowIsKept()
    {
        await ResetRoute(Route);
        using var driver = As(Driver, "Staff");
        await StartRun(driver);
        var session = NewSession();
        Assert.Equal(HttpStatusCode.OK, (await driver.PostAsJsonAsync($"/api/routes/{Route}/location", Ping(session, consent: true))).StatusCode);
        var tooSoon = await driver.PostAsJsonAsync($"/api/routes/{Route}/location", Ping(session, 25.3, 55.3));
        Assert.Equal((HttpStatusCode)429, tooSoon.StatusCode);
        Assert.True(tooSoon.Headers.Contains("Retry-After"));
        for (var i = 0; i < 3; i++)
        {
            await Task.Delay(1100);
            Assert.Equal(HttpStatusCode.OK, (await driver.PostAsJsonAsync($"/api/routes/{Route}/location", Ping(session, 25.2 + i * 0.01, 55.2))).StatusCode);
        }
        Assert.Equal(1, await RowCount(Route)); // overwritten, never a trail
        await ResetRoute(Route);
    }

    [Fact]
    public async Task OwnerSeesEveryDriver_DriverSeesOnlyTheirOwn_OthersSeeNothing()
    {
        await ResetRoute(Route);
        using var driver = As(Driver, "Staff");
        using var second = As(SecondDriver, "Staff");
        await StartRun(driver);
        Assert.Equal(HttpStatusCode.OK, (await driver.PostAsJsonAsync($"/api/routes/{Route}/location", Ping(NewSession(), 25.20, 55.27, consent: true))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await second.PostAsJsonAsync($"/api/routes/{Route}/location", Ping(NewSession(), 25.30, 55.37, consent: true))).StatusCode);

        using var owner = As(Owner, "Owner");
        var all = (await Data(await owner.GetAsync($"/api/routes/{Route}/location"))).EnumerateArray().ToArray();
        Assert.Equal(2, all.Length);
        Assert.All(all, d => Assert.False(d.GetProperty("isStale").GetBoolean()));
        Assert.All(all, d => Assert.False(string.IsNullOrWhiteSpace(d.GetProperty("userName").GetString())));

        var mine = (await Data(await driver.GetAsync($"/api/routes/{Route}/location"))).EnumerateArray().ToArray();
        Assert.Single(mine);
        Assert.Equal(Driver, mine[0].GetProperty("userId").GetInt32());

        using var stranger = As(Unassigned, "Staff");
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"/api/routes/{Route}/location")).StatusCode);
        using var ownerB = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        Assert.Equal(HttpStatusCode.NotFound, (await ownerB.GetAsync($"/api/routes/{Route}/location")).StatusCode);
        await ResetRoute(Route);
    }

    [Fact]
    public async Task OldPositions_AreMarkedStale_AndExpiredOnesDisappear()
    {
        await ResetRoute(Route);
        using var driver = As(Driver, "Staff");
        await StartRun(driver);
        Assert.Equal(HttpStatusCode.OK, (await driver.PostAsJsonAsync($"/api/routes/{Route}/location", Ping(NewSession(), consent: true))).StatusCode);
        using var owner = As(Owner, "Owner");

        await Age(Route, updatedMinutesAgo: 5, expiresInMinutes: 5);
        var stale = (await Data(await owner.GetAsync($"/api/routes/{Route}/location"))).EnumerateArray().Single();
        Assert.True(stale.GetProperty("isStale").GetBoolean());
        Assert.True(stale.GetProperty("ageSeconds").GetInt32() >= 290);

        await Age(Route, updatedMinutesAgo: 20, expiresInMinutes: -10);
        Assert.Empty((await Data(await owner.GetAsync($"/api/routes/{Route}/location"))).EnumerateArray());
        await ResetRoute(Route);
    }

    private async Task Age(int routeId, int updatedMinutesAgo, int expiresInMinutes)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.SetRequestTenantScope(null, true);
        var row = await db.DriverLocationCurrents.IgnoreQueryFilters().FirstAsync(l => l.RouteId == routeId);
        row.UpdatedAt = DateTime.UtcNow.AddMinutes(-updatedMinutesAgo);
        row.ExpiresAt = DateTime.UtcNow.AddMinutes(expiresInMinutes);
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task StoppingSharing_DeletesThePositionAtOnce_AndAuditsWithoutCoordinates()
    {
        await ResetRoute(Route);
        using var driver = As(Driver, "Staff");
        await StartRun(driver);
        Assert.Equal(HttpStatusCode.OK, (await driver.PostAsJsonAsync($"/api/routes/{Route}/location", Ping(NewSession(), 25.123456, 55.654321, consent: true))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await driver.DeleteAsync($"/api/routes/{Route}/location")).StatusCode);
        Assert.Equal(0, await RowCount(Route));

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.SetRequestTenantScope(null, true);
        var audits = await db.AuditLogs.IgnoreQueryFilters().Where(a => a.TenantId == Company && a.Action.StartsWith("LocationSharing")).ToListAsync();
        Assert.Contains(audits, a => a.Action == "LocationSharingStarted");
        Assert.Contains(audits, a => a.Action == "LocationSharingStopped");
        Assert.All(audits, a => Assert.DoesNotContain("25.12", (a.Details ?? "") + (a.NewValues ?? "") + (a.OldValues ?? "")));
        await ResetRoute(Route);
    }

    [Fact]
    public async Task EndingTheRoute_ClearsEveryPosition()
    {
        await ResetRoute(Route);
        using var driver = As(Driver, "Staff");
        using var second = As(SecondDriver, "Staff");
        await StartRun(driver);
        await driver.PostAsJsonAsync($"/api/routes/{Route}/location", Ping(NewSession(), consent: true));
        await second.PostAsJsonAsync($"/api/routes/{Route}/location", Ping(NewSession(), 25.3, 55.3, consent: true));
        Assert.Equal(2, await RowCount(Route));
        Assert.Equal(HttpStatusCode.OK, (await driver.PostAsJsonAsync($"/api/routes/{Route}/run/end", new { })).StatusCode);
        Assert.Equal(0, await RowCount(Route));
        // After the run ended nobody can share until it is started again.
        Assert.Equal(HttpStatusCode.Conflict, (await driver.PostAsJsonAsync($"/api/routes/{Route}/location", Ping(NewSession(), consent: true))).StatusCode);
    }
}
