using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Branches;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

/// <summary>Ordered stops, start and end of a route, and the frozen counts. Own company so route lists elsewhere stay exact.</summary>
[Collection("HttpIntegration")]
public class RouteRunHttpTests
{
    private const int Company = 9302;
    private const string Slug = "routerun";
    private const int Owner = 9320;
    private const int Driver = 9321;
    private const int OtherStaff = 9322;
    private const int RunRoute = 9321;     // driver assigned; three customers
    private const int EmptyRoute = 9322;   // nobody assigned
    private const int C1 = 9321, C2 = 9322, C3 = 9323; // C3 has no saved location
    private const int Stranger = 9324;     // a customer of the company who is on no route

    private static readonly object FixtureLock = new();
    private readonly HexaBillWebApplicationFactory _factory;

    public RouteRunHttpTests(HexaBillWebApplicationFactory factory)
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
            db.Tenants.Add(new Tenant { Id = Company, Name = "Route run company", Subdomain = Slug, Status = TenantStatus.Active, FeaturesJson = "[]" });
            db.SaveChanges();
            foreach (var (id, role) in new[] { (Owner, UserRole.Owner), (Driver, UserRole.Staff), (OtherStaff, UserRole.Staff) })
                db.Users.Add(new User { Id = id, TenantId = Company, OwnerId = Company, Name = $"Run fixture {id}", Email = $"run-{id}@http.test", PasswordHash = "x", Role = role, SessionVersion = 1, IsActive = true, CreatedAt = now });
            db.Branches.Add(new Branch { Id = 9320, TenantId = Company, Name = "Run branch", IsActive = true, CreatedAt = now });
            db.Routes.AddRange(
                new HexaBill.Api.Models.Route { Id = RunRoute, BranchId = 9320, TenantId = Company, Name = "Run route", IsActive = true, CreatedAt = now },
                new HexaBill.Api.Models.Route { Id = EmptyRoute, BranchId = 9320, TenantId = Company, Name = "Empty route", IsActive = true, CreatedAt = now });
            db.Customers.AddRange(
                new Customer { Id = C1, TenantId = Company, OwnerId = Company, Name = "Bravo Mart", Address = "Street 1", MainLatitude = 25.20m, MainLongitude = 55.27m, CreatedAt = now, UpdatedAt = now },
                new Customer { Id = C2, TenantId = Company, OwnerId = Company, Name = "Alpha Store", Address = "Street 2", MainLatitude = 25.21m, MainLongitude = 55.28m, CreatedAt = now, UpdatedAt = now },
                new Customer { Id = C3, TenantId = Company, OwnerId = Company, Name = "Charlie Shop", Address = "Street 3", CreatedAt = now, UpdatedAt = now },
                new Customer { Id = Stranger, TenantId = Company, OwnerId = Company, Name = "Not on a route", CreatedAt = now, UpdatedAt = now });
            db.SaveChanges();
            db.RouteStaff.Add(new RouteStaff { RouteId = RunRoute, UserId = Driver, AssignedAt = now });
            db.RouteCustomers.AddRange(
                new RouteCustomer { RouteId = RunRoute, CustomerId = C1, AssignedAt = now },
                new RouteCustomer { RouteId = RunRoute, CustomerId = C2, AssignedAt = now },
                new RouteCustomer { RouteId = RunRoute, CustomerId = C3, AssignedAt = now });
            db.SaveChanges();
        }
    }

    private HttpClient As(int userId, string role)
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, BaseAddress = new Uri($"http://{Slug}.hexabill.company") });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", TestJwtFactory.CreateAuthenticatedApiToken(userId, Company, Slug, role: role));
        return client;
    }

    private static async Task<JsonElement> Data(HttpResponseMessage r) => (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");

    private async Task<int[]> StoredOrder(int routeId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.RouteCustomers.Where(rc => rc.RouteId == routeId).OrderBy(rc => rc.SortOrder).Select(rc => rc.CustomerId).ToArrayAsync();
    }

    private async Task CloseAnyOpenRun(int routeId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.SetRequestTenantScope(null, true);
        foreach (var run in await db.RouteRuns.IgnoreQueryFilters().Where(r => r.RouteId == routeId && r.EndedAt == null).ToListAsync())
            run.EndedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }

    // ---- ordering ----

    [Fact]
    public async Task Owner_SetsTheStopOrder_AndItIsStored()
    {
        using var owner = As(Owner, "Owner");
        var response = await owner.PutAsJsonAsync($"/api/routes/{RunRoute}/stops/order", new { customerIds = new[] { C3, C1, C2 } });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(new[] { C3, C1, C2 }, await StoredOrder(RunRoute));

        // A partial list puts those first and keeps the rest after them in their existing order.
        var partial = await owner.PutAsJsonAsync($"/api/routes/{RunRoute}/stops/order", new { customerIds = new[] { C2 } });
        Assert.Equal(HttpStatusCode.OK, partial.StatusCode);
        Assert.Equal(new[] { C2, C3, C1 }, await StoredOrder(RunRoute));
        await owner.PutAsJsonAsync($"/api/routes/{RunRoute}/stops/order", new { customerIds = new[] { C1, C2, C3 } });
    }

    [Fact]
    public async Task BadOrderRequests_AreRefused_AndNothingChanges()
    {
        using var owner = As(Owner, "Owner");
        var before = await StoredOrder(RunRoute);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsJsonAsync($"/api/routes/{RunRoute}/stops/order", new { customerIds = new int[0] })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsJsonAsync($"/api/routes/{RunRoute}/stops/order", new { customerIds = new[] { C1, C1 } })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsJsonAsync($"/api/routes/{RunRoute}/stops/order", new { customerIds = new[] { C1, Stranger } })).StatusCode);
        Assert.Equal(before, await StoredOrder(RunRoute));
    }

    [Fact]
    public async Task OnlyManagersOfTheRoute_CanReorder()
    {
        using var driver = As(Driver, "Staff");
        Assert.Equal(HttpStatusCode.Forbidden, (await driver.PutAsJsonAsync($"/api/routes/{RunRoute}/stops/order", new { customerIds = new[] { C2, C1 } })).StatusCode);
        using var other = As(OtherStaff, "Staff");
        Assert.Equal(HttpStatusCode.NotFound, (await other.PutAsJsonAsync($"/api/routes/{RunRoute}/stops/order", new { customerIds = new[] { C2, C1 } })).StatusCode);
        using var ownerOfOtherCompany = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        Assert.Equal(HttpStatusCode.NotFound, (await ownerOfOtherCompany.PutAsJsonAsync($"/api/routes/{RunRoute}/stops/order", new { customerIds = new[] { C2, C1 } })).StatusCode);
    }

    // ---- stop map data (service level: the HTTP host has the stop-location flag off) ----

    [Fact]
    public async Task StopsMap_IsNumbered_InOrder_AndMarksStopsWithoutALocation()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        await using var _ = db;
        db.SetRequestTenantScope(11, false);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        var now = DateTime.UtcNow;
        db.Tenants.Add(new Tenant { Id = 11, Name = "Map tenant", Subdomain = "map11" });
        await db.SaveChangesAsync();
        db.Users.Add(new User { Id = 11, TenantId = 11, OwnerId = 11, Name = "Map owner", Email = "map11@example.test", PasswordHash = "x", Role = UserRole.Owner, CreatedAt = now });
        db.Branches.Add(new Branch { Id = 11, TenantId = 11, Name = "Map branch", CreatedAt = now });
        db.Customers.AddRange(
            new Customer { Id = 111, TenantId = 11, OwnerId = 11, Name = "B", Address = "Addr B", MainLatitude = 25m, MainLongitude = 55m, CreatedAt = now, UpdatedAt = now },
            new Customer { Id = 112, TenantId = 11, OwnerId = 11, Name = "A", CreatedAt = now, UpdatedAt = now },
            new Customer { Id = 113, TenantId = 11, OwnerId = 11, Name = "C", MainLatitude = 25.1m, MainLongitude = 55.1m, CreatedAt = now, UpdatedAt = now });
        await db.SaveChangesAsync();
        db.Routes.Add(new HexaBill.Api.Models.Route { Id = 11, TenantId = 11, BranchId = 11, Name = "Map route", CreatedAt = now });
        await db.SaveChangesAsync();
        db.RouteCustomers.AddRange(
            new RouteCustomer { RouteId = 11, CustomerId = 111, AssignedAt = now, SortOrder = 2 },
            new RouteCustomer { RouteId = 11, CustomerId = 112, AssignedAt = now, SortOrder = 1 },
            new RouteCustomer { RouteId = 11, CustomerId = 113, AssignedAt = now }); // no order yet: after the ordered ones
        await db.SaveChangesAsync();
        var service = new RouteService(db, new SalesSchemaService(db), new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["FeatureFlags:CustomerStopLocation"] = "true" }).Build(), NullLogger<RouteService>.Instance);

        var stops = (await service.GetRouteStopsMapAsync(11, 11, DateTime.UtcNow.Date))!;
        Assert.Equal(new[] { 112, 111, 113 }, stops.Select(s => s.CustomerId).ToArray());
        Assert.Equal(new[] { 1, 2, 3 }, stops.Select(s => s.Position).ToArray());
        Assert.Equal(new[] { true, false, false }, stops.Select(s => s.NeedsLocation).ToArray());
        Assert.Equal("Addr B", stops[1].Address);
        Assert.All(stops, s => Assert.Equal("not_reached", s.MapStatus));

        // A new stop goes to the end and keeps the order stable.
        db.Customers.Add(new Customer { Id = 114, TenantId = 11, OwnerId = 11, Name = "AA", CreatedAt = now, UpdatedAt = now });
        await db.SaveChangesAsync();
        await service.AssignCustomerToRouteAsync(11, 114, 11);
        var after = (await service.GetRouteStopsMapAsync(11, 11, DateTime.UtcNow.Date))!;
        Assert.Equal(new[] { 112, 111, 113, 114 }, after.Select(s => s.CustomerId).ToArray());
    }

    [Fact]
    public async Task StopsMap_WithTheLocationFeatureOff_StillListsTheStops_WithoutMapPoints()
    {
        using var owner = As(Owner, "Owner");
        var response = await owner.GetAsync($"/api/routes/{RunRoute}/stops-map?date={DateTime.UtcNow:yyyy-MM-dd}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var stops = (await Data(response)).EnumerateArray().ToArray();
        Assert.Equal(3, stops.Length);
        Assert.All(stops, s => Assert.Equal(JsonValueKind.Null, s.GetProperty("mainLatitude").ValueKind));
        Assert.All(stops, s => Assert.False(s.GetProperty("needsLocation").GetBoolean()));
        Assert.Equal(new[] { 1, 2, 3 }, stops.Select(s => s.GetProperty("position").GetInt32()).ToArray());
    }

    [Theory]
    [InlineData(null, "not_reached")]
    [InlineData(VisitStatus.NotVisited, "not_reached")]
    [InlineData(VisitStatus.Arrived, "arrived")]
    [InlineData(VisitStatus.Delivered, "delivered")]
    [InlineData(VisitStatus.PaymentCollected, "delivered")]
    [InlineData(VisitStatus.Failed, "failed")]
    [InlineData(VisitStatus.NotHome, "failed")]
    [InlineData(VisitStatus.Skipped, "skipped")]
    [InlineData(VisitStatus.Rescheduled, "skipped")]
    public void MapStatus_NamesTheOutcome(VisitStatus? status, string expected) => Assert.Equal(expected, RouteService.MapStatusOf(status));

    // ---- runs ----

    [Fact]
    public async Task Driver_StartsOnce_AndAnotherTapReturnsTheSameRun()
    {
        await CloseAnyOpenRun(RunRoute);
        using var driver = As(Driver, "Staff");
        var first = await driver.PostAsJsonAsync($"/api/routes/{RunRoute}/run/start", new { });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var run = await Data(first);
        Assert.True(run.GetProperty("isOpen").GetBoolean());
        Assert.Equal(Driver, run.GetProperty("startedByUserId").GetInt32());
        var second = await Data(await driver.PostAsJsonAsync($"/api/routes/{RunRoute}/run/start", new { }));
        Assert.Equal(run.GetProperty("id").GetInt32(), second.GetProperty("id").GetInt32());

        var state = await Data(await driver.GetAsync($"/api/routes/{RunRoute}/run"));
        Assert.Equal(run.GetProperty("id").GetInt32(), state.GetProperty("current").GetProperty("id").GetInt32());
        Assert.Equal(3, state.GetProperty("current").GetProperty("stopsTotal").GetInt32());
        await CloseAnyOpenRun(RunRoute);
    }

    [Fact]
    public async Task ManyTapsAtOnce_LeaveExactlyOneOpenRun()
    {
        await CloseAnyOpenRun(RunRoute);
        using var driver = As(Driver, "Staff");
        var responses = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => driver.PostAsJsonAsync($"/api/routes/{RunRoute}/run/start", new { })));
        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        var ids = (await Task.WhenAll(responses.Select(async r => (await Data(r)).GetProperty("id").GetInt32()))).Distinct().ToArray();
        Assert.Single(ids);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.SetRequestTenantScope(null, true);
        Assert.Equal(1, await db.RouteRuns.IgnoreQueryFilters().CountAsync(r => r.RouteId == RunRoute && r.EndedAt == null));
        await CloseAnyOpenRun(RunRoute);
    }

    [Fact]
    public async Task Unassigned_CannotStartOrEnd_AndOtherCompanyCannot()
    {
        using var other = As(OtherStaff, "Staff");
        Assert.Equal(HttpStatusCode.NotFound, (await other.PostAsJsonAsync($"/api/routes/{RunRoute}/run/start", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.PostAsJsonAsync($"/api/routes/{RunRoute}/run/end", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/routes/{RunRoute}/run")).StatusCode);
        using var ownerB = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        Assert.Equal(HttpStatusCode.NotFound, (await ownerB.PostAsJsonAsync($"/api/routes/{RunRoute}/run/start", new { })).StatusCode);
    }

    [Fact]
    public async Task Ending_FreezesTheCounts_ListsMissedStops_AndWritesAnAuditRow()
    {
        await CloseAnyOpenRun(RunRoute);
        using var driver = As(Driver, "Staff");
        await driver.PostAsJsonAsync($"/api/routes/{RunRoute}/run/start", new { });
        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
        Assert.Equal(HttpStatusCode.OK, (await driver.PostAsJsonAsync($"/api/routes/{RunRoute}/visits", new { customerId = C1, visitDate = today, status = "Delivered" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await driver.PostAsJsonAsync($"/api/routes/{RunRoute}/visits", new { customerId = C2, visitDate = today, status = "Failed", notes = "Shop was closed" })).StatusCode);

        var live = await Data(await driver.GetAsync($"/api/routes/{RunRoute}/run"));
        Assert.Equal(1, live.GetProperty("current").GetProperty("stopsDelivered").GetInt32());
        Assert.Equal(1, live.GetProperty("current").GetProperty("stopsNotVisited").GetInt32());

        var ended = await driver.PostAsJsonAsync($"/api/routes/{RunRoute}/run/end", new { note = "  Back at the depot  " });
        Assert.Equal(HttpStatusCode.OK, ended.StatusCode);
        var run = await Data(ended);
        Assert.False(run.GetProperty("isOpen").GetBoolean());
        Assert.Equal("Back at the depot", run.GetProperty("endNote").GetString());
        Assert.Equal((3, 1, 1, 0, 1), (run.GetProperty("stopsTotal").GetInt32(), run.GetProperty("stopsDelivered").GetInt32(), run.GetProperty("stopsFailed").GetInt32(), run.GetProperty("stopsSkipped").GetInt32(), run.GetProperty("stopsNotVisited").GetInt32()));

        // Later visits do not rewrite the frozen counts.
        await driver.PostAsJsonAsync($"/api/routes/{RunRoute}/visits", new { customerId = C3, visitDate = today, status = "Delivered" });
        var state = await Data(await driver.GetAsync($"/api/routes/{RunRoute}/run"));
        Assert.Equal(JsonValueKind.Null, state.GetProperty("current").ValueKind);
        Assert.Equal(1, state.GetProperty("last").GetProperty("stopsNotVisited").GetInt32());

        Assert.Equal(HttpStatusCode.NotFound, (await driver.PostAsJsonAsync($"/api/routes/{RunRoute}/run/end", new { })).StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.SetRequestTenantScope(null, true);
        var audit = await db.AuditLogs.IgnoreQueryFilters().Where(a => a.TenantId == Company && a.Action == "RouteRunEnded").OrderByDescending(a => a.Id).FirstAsync();
        Assert.Contains("1 delivered", audit.Details);
        Assert.Contains("1 not visited", audit.Details);
        Assert.Equal(Driver, audit.UserId);
    }

    [Fact]
    public async Task OverlongEndNote_IsRefused_AndTheRunStaysOpen()
    {
        await CloseAnyOpenRun(RunRoute);
        using var driver = As(Driver, "Staff");
        await driver.PostAsJsonAsync($"/api/routes/{RunRoute}/run/start", new { });
        Assert.Equal(HttpStatusCode.BadRequest, (await driver.PostAsJsonAsync($"/api/routes/{RunRoute}/run/end", new { note = new string('x', 501) })).StatusCode);
        var state = await Data(await driver.GetAsync($"/api/routes/{RunRoute}/run"));
        Assert.True(state.GetProperty("current").GetProperty("isOpen").GetBoolean());
        await CloseAnyOpenRun(RunRoute);
    }

    [Fact]
    public async Task ARunLeftOpenForDays_IsClosedByTheNextStart()
    {
        await CloseAnyOpenRun(RunRoute);
        int staleId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.SetRequestTenantScope(null, true);
            var stale = new RouteRun { TenantId = Company, RouteId = RunRoute, ServiceDate = DateTime.UtcNow.Date.AddDays(-2), StartedByUserId = Driver, StartedAt = DateTime.UtcNow.AddHours(-30) };
            db.RouteRuns.Add(stale);
            await db.SaveChangesAsync();
            staleId = stale.Id;
        }
        using var driver = As(Driver, "Staff");
        var run = await Data(await driver.PostAsJsonAsync($"/api/routes/{RunRoute}/run/start", new { }));
        Assert.NotEqual(staleId, run.GetProperty("id").GetInt32());
        using var check = _factory.Services.CreateScope();
        var db2 = check.ServiceProvider.GetRequiredService<AppDbContext>();
        db2.SetRequestTenantScope(null, true);
        var closed = await db2.RouteRuns.IgnoreQueryFilters().AsNoTracking().FirstAsync(r => r.Id == staleId);
        Assert.NotNull(closed.EndedAt);
        Assert.Contains("never ended", closed.EndNote);
        await CloseAnyOpenRun(RunRoute);
    }
}
