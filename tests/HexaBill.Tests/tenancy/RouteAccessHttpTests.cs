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

/// <summary>
/// Route access: every route-id endpoint checks the caller's assignment, not only the tenant.
/// A same-company user who is not assigned gets the same 404 as a route that does not exist.
/// A visit never moves the customer's saved shop pin; only an explicit action by an owner, admin or granted manager can.
/// </summary>
[Collection("HttpIntegration")]
public class RouteAccessHttpTests
{
    // Tenant 1 fixture ids (seeded once per factory by EnsureFixture).
    private const int Driver = 9301;          // Staff, assigned to route 9301
    private const int OtherStaff = 9302;      // Staff, assigned to nothing
    private const int ManagerOnRoute = 9303;  // Manager, RouteStaff row on route 9301
    private const int ManagerOfBranch = 9304; // Manager, Branch.ManagerUserId of branch 9301 (route 9302)
    private const int ManagerNone = 9305;     // Manager, nothing granted
    private const int AssignedRoute = 9301;
    private const int BranchRoute = 9302;
    private const int UnassignedRoute = 9303;
    private const int CustomerOnRoute = 9301;
    private const int CustomerOffRoute = 9302;
    private const int Company = 9301;         // own company so the shared tenant 1 fixtures keep their exact route counts
    private const string Slug = "routeaccess";
    private const int CompanyOwner = 9306;

    private static readonly object FixtureLock = new();
    private readonly HexaBillWebApplicationFactory _factory;

    public RouteAccessHttpTests(HexaBillWebApplicationFactory factory)
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
            if (db.Users.IgnoreQueryFilters().Any(u => u.Id == Driver)) return;
            var now = DateTime.UtcNow;
            db.Tenants.Add(new Tenant { Id = Company, Name = "Route access company", Subdomain = Slug, Status = TenantStatus.Active, FeaturesJson = "[]" });
            db.SaveChanges();
            db.Users.Add(new User { Id = CompanyOwner, TenantId = Company, OwnerId = Company, Name = "Route access owner", Email = "route-owner@http.test", PasswordHash = "x", Role = UserRole.Owner, SessionVersion = 1, IsActive = true, CreatedAt = now });
            db.Branches.Add(new Branch { Id = 9300, TenantId = Company, Name = "Main branch", IsActive = true, CreatedAt = now });
            foreach (var id in new[] { Driver, OtherStaff, ManagerOnRoute, ManagerOfBranch, ManagerNone })
                db.Users.Add(new User
                {
                    Id = id, TenantId = Company, OwnerId = Company, Name = $"Route fixture {id}", Email = $"route-{id}@http.test", PasswordHash = "x",
                    Role = UserRole.Staff, SessionVersion = 1, IsActive = true, CreatedAt = now,
                });
            db.Branches.Add(new Branch { Id = 9301, TenantId = Company, Name = "Managed branch", ManagerUserId = ManagerOfBranch, IsActive = true, CreatedAt = now });
            db.Routes.AddRange(
                new HexaBill.Api.Models.Route { Id = AssignedRoute, BranchId = 9300, TenantId = Company, Name = "Assigned route", IsActive = true, CreatedAt = now },
                new HexaBill.Api.Models.Route { Id = BranchRoute, BranchId = 9301, TenantId = Company, Name = "Branch managed route", IsActive = true, CreatedAt = now },
                new HexaBill.Api.Models.Route { Id = UnassignedRoute, BranchId = 9300, TenantId = Company, Name = "Unassigned route", IsActive = true, CreatedAt = now });
            db.Customers.AddRange(
                new Customer { Id = CustomerOnRoute, TenantId = Company, OwnerId = Company, Name = "Route fixture on route", CreatedAt = now, UpdatedAt = now },
                new Customer { Id = CustomerOffRoute, TenantId = Company, OwnerId = Company, Name = "Route fixture off route", CreatedAt = now, UpdatedAt = now });
            db.SaveChanges();
            db.RouteStaff.AddRange(
                new RouteStaff { RouteId = AssignedRoute, UserId = Driver, AssignedAt = now },
                new RouteStaff { RouteId = AssignedRoute, UserId = ManagerOnRoute, AssignedAt = now });
            db.RouteCustomers.Add(new RouteCustomer { RouteId = AssignedRoute, CustomerId = CustomerOnRoute, AssignedAt = now });
            db.SaveChanges();
        }
    }

    private HttpClient As(int userId, string role, int tenantId = Company, string slug = Slug)
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            BaseAddress = new Uri($"http://{slug}.hexabill.company"),
        });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer", TestJwtFactory.CreateAuthenticatedApiToken(userId, tenantId, slug, role: role));
        return client;
    }

    private static string Day(int offset) => DateTime.UtcNow.Date.AddDays(-600 - offset).ToString("yyyy-MM-dd");

    private static string[] ReadUrls(int routeId) => new[]
    {
        $"/api/routes/{routeId}",
        $"/api/routes/{routeId}/summary",
        $"/api/routes/{routeId}/collection-sheet",
        $"/api/routes/{routeId}/visits",
        $"/api/routes/{routeId}/stops-map",
    };

    private static async Task AssertHidden(HttpClient client, int routeId)
    {
        foreach (var url in ReadUrls(routeId))
            Assert.True(HttpStatusCode.NotFound == (await client.GetAsync(url)).StatusCode, $"GET {url} should look like a missing route");
        var put = await client.PutAsJsonAsync($"/api/routes/{routeId}/visits/{CustomerOnRoute}", new { visitDate = Day(1), status = "Arrived" });
        Assert.Equal(HttpStatusCode.NotFound, put.StatusCode);
        var post = await client.PostAsJsonAsync($"/api/routes/{routeId}/visits", new { customerId = CustomerOnRoute, visitDate = Day(1), status = "Arrived" });
        Assert.Equal(HttpStatusCode.NotFound, post.StatusCode);
    }

    private static async Task AssertVisible(HttpClient client, int routeId)
    {
        foreach (var url in ReadUrls(routeId))
        {
            var status = (await client.GetAsync(url)).StatusCode;
            Assert.True(status == HttpStatusCode.OK, $"GET {url} returned {(int)status}");
        }
    }

    private static async Task<int[]> ListedRouteIds(HttpClient client)
    {
        var response = await client.GetAsync("/api/routes");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("data").EnumerateArray().Select(r => r.GetProperty("id").GetInt32()).ToArray();
    }

    [Fact]
    public async Task Owner_SeesEveryRouteOfTheCompany()
    {
        using var owner = As(CompanyOwner, "Owner");
        foreach (var id in new[] { AssignedRoute, BranchRoute, UnassignedRoute })
            await AssertVisible(owner, id);
        var listed = await ListedRouteIds(owner);
        Assert.Contains(AssignedRoute, listed);
        Assert.Contains(UnassignedRoute, listed);
    }

    [Fact]
    public async Task AssignedDriver_UsesTheirRoute_ButOtherRoutesLookMissing()
    {
        using var driver = As(Driver, "Staff");
        await AssertVisible(driver, AssignedRoute);
        await AssertHidden(driver, UnassignedRoute);
        await AssertHidden(driver, BranchRoute);
        Assert.Equal(new[] { AssignedRoute }, (await ListedRouteIds(driver)).Where(i => i >= 9301).ToArray());

        var visit = await driver.PostAsJsonAsync($"/api/routes/{AssignedRoute}/visits", new { customerId = CustomerOnRoute, visitDate = Day(2), status = "Arrived" });
        Assert.Equal(HttpStatusCode.OK, visit.StatusCode);
    }

    [Fact]
    public async Task UnassignedStaff_SeesNoFixtureRoute_AndCannotRecordVisits()
    {
        using var staff = As(OtherStaff, "Staff");
        foreach (var id in new[] { AssignedRoute, BranchRoute, UnassignedRoute })
            await AssertHidden(staff, id);
        Assert.DoesNotContain(await ListedRouteIds(staff), i => i >= 9301);
    }

    [Fact]
    public async Task Manager_NeedsAnExplicitGrant_ByRouteStaffRowOrBranchManager()
    {
        using var onRoute = As(ManagerOnRoute, "Manager");
        await AssertVisible(onRoute, AssignedRoute);
        await AssertHidden(onRoute, UnassignedRoute);
        await AssertHidden(onRoute, BranchRoute);
        Assert.Equal(new[] { AssignedRoute }, (await ListedRouteIds(onRoute)).Where(i => i >= 9301).ToArray());

        using var ofBranch = As(ManagerOfBranch, "Manager");
        await AssertVisible(ofBranch, BranchRoute);
        await AssertHidden(ofBranch, AssignedRoute);
        await AssertHidden(ofBranch, UnassignedRoute);

        using var none = As(ManagerNone, "Manager");
        foreach (var id in new[] { AssignedRoute, BranchRoute, UnassignedRoute })
            await AssertHidden(none, id);
        Assert.DoesNotContain(await ListedRouteIds(none), i => i >= 9301);
    }

    [Fact]
    public async Task OtherCompany_NeverSeesTheRoute()
    {
        using var ownerB = As(2, "Owner", tenantId: 2, slug: "tenantb");
        await AssertHidden(ownerB, AssignedRoute);
        Assert.DoesNotContain(AssignedRoute, await ListedRouteIds(ownerB));
    }

    [Fact]
    public async Task Visit_ForACustomerWhoIsNotOnTheRoute_IsRefused()
    {
        using var owner = As(CompanyOwner, "Owner");
        var response = await owner.PostAsJsonAsync($"/api/routes/{AssignedRoute}/visits", new { customerId = CustomerOffRoute, visitDate = Day(3), status = "Delivered" });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var put = await owner.PutAsJsonAsync($"/api/routes/{AssignedRoute}/visits/{CustomerOffRoute}", new { visitDate = Day(3), status = "Delivered" });
        Assert.Equal(HttpStatusCode.NotFound, put.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.CustomerVisits.IgnoreQueryFilters().AnyAsync(v => v.CustomerId == CustomerOffRoute));
    }

    [Fact]
    public async Task Driver_CannotAskToChangeTheSavedShopPin()
    {
        using var driver = As(Driver, "Staff");
        var response = await driver.PostAsJsonAsync($"/api/routes/{AssignedRoute}/visits",
            new { customerId = CustomerOnRoute, visitDate = Day(4), status = "Arrived", latitude = 25.2m, longitude = 55.3m, updateSavedLocation = true });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var put = await driver.PutAsJsonAsync($"/api/routes/{AssignedRoute}/visits/{CustomerOnRoute}",
            new { visitDate = Day(4), status = "Arrived", latitude = 25.2m, longitude = 55.3m, updateSavedLocation = true });
        Assert.Equal(HttpStatusCode.Forbidden, put.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var customer = await db.Customers.IgnoreQueryFilters().AsNoTracking().FirstAsync(c => c.Id == CustomerOnRoute);
        Assert.Null(customer.MainLatitude);
        Assert.False(await db.CustomerVisits.IgnoreQueryFilters().AnyAsync(v => v.CustomerId == CustomerOnRoute && v.VisitDate == DateTime.SpecifyKind(DateTime.Parse(Day(4)).Date, DateTimeKind.Utc)));
    }

    [Fact]
    public async Task Staff_CannotChangeRouteStructure_ButOwnerCan()
    {
        using var driver = As(Driver, "Staff");
        Assert.Equal(HttpStatusCode.Forbidden, (await driver.PostAsync($"/api/routes/{AssignedRoute}/staff/{OtherStaff}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await driver.PostAsync($"/api/routes/{AssignedRoute}/customers/{CustomerOffRoute}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await driver.DeleteAsync($"/api/routes/{AssignedRoute}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await driver.PutAsJsonAsync($"/api/routes/{AssignedRoute}", new { name = "Renamed", branchId = 9300 })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await driver.PostAsJsonAsync("/api/routes", new { name = "Staff made route", branchId = 9300 })).StatusCode);
        // A route the staff member is not on does not even admit to existing.
        Assert.Equal(HttpStatusCode.NotFound, (await driver.DeleteAsync($"/api/routes/{UnassignedRoute}")).StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.RouteStaff.AnyAsync(rs => rs.RouteId == AssignedRoute && rs.UserId == OtherStaff));
        Assert.True(await db.Routes.IgnoreQueryFilters().AnyAsync(r => r.Id == UnassignedRoute));

        using var owner = As(CompanyOwner, "Owner");
        Assert.Equal(HttpStatusCode.OK, (await owner.PostAsync($"/api/routes/{AssignedRoute}/customers/{CustomerOffRoute}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await owner.DeleteAsync($"/api/routes/{AssignedRoute}/customers/{CustomerOffRoute}")).StatusCode);
    }

    // ---- Service level: needs the stop-location flag ON, which the shared HTTP host does not enable. ----

    private static async Task<(AppDbContext db, RouteService service, int routeId, int customerId)> ServiceFixture(bool withPin = false)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        db.SetRequestTenantScope(10, false);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        var now = DateTime.UtcNow;
        db.Tenants.Add(new Tenant { Id = 10, Name = "Pin tenant", Subdomain = "pin10" });
        await db.SaveChangesAsync();
        db.Users.Add(new User { Id = 10, TenantId = 10, OwnerId = 10, Name = "Pin owner", Email = "pin10@example.test", PasswordHash = "x", Role = UserRole.Owner, CreatedAt = now });
        db.Branches.Add(new Branch { Id = 10, TenantId = 10, Name = "Pin branch", CreatedAt = now });
        db.Customers.Add(new Customer
        {
            Id = 10, TenantId = 10, OwnerId = 10, Name = "Pin customer", CreatedAt = now, UpdatedAt = now,
            MainLatitude = withPin ? 24.0m : null, MainLongitude = withPin ? 54.0m : null,
        });
        await db.SaveChangesAsync();
        db.Routes.Add(new HexaBill.Api.Models.Route { Id = 10, TenantId = 10, BranchId = 10, Name = "Pin route", CreatedAt = now });
        await db.SaveChangesAsync();
        db.RouteCustomers.Add(new RouteCustomer { RouteId = 10, CustomerId = 10, AssignedAt = now });
        await db.SaveChangesAsync();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["FeatureFlags:CustomerStopLocation"] = "true" }).Build();
        return (db, new RouteService(db, new SalesSchemaService(db), config, NullLogger<RouteService>.Instance), 10, 10);
    }

    private static UpdateCustomerVisitRequest Visit(string day, bool saveToCustomer) => new()
    {
        VisitDate = DateTime.Parse(day), Status = "Arrived", Latitude = 25.25m, Longitude = 55.30m, UpdateSavedLocation = saveToCustomer,
    };

    [Fact]
    public async Task VisitGps_IsStoredOnTheVisit_AndDoesNotFillAnEmptyShopPin()
    {
        var (db, service, routeId, customerId) = await ServiceFixture();
        await using var _ = db;
        var dto = await service.UpdateCustomerVisitAsync(routeId, customerId, Visit(Day(10), saveToCustomer: false), 10, 10, allowSavedPinUpdate: true);
        Assert.Equal(25.25m, dto!.Latitude);
        db.ChangeTracker.Clear();
        var customer = await db.Customers.AsNoTracking().FirstAsync(c => c.Id == customerId);
        Assert.Null(customer.MainLatitude);
        Assert.Null(customer.MainLongitude);
        Assert.Null(customer.LocationUpdatedAt);
    }

    [Fact]
    public async Task ExplicitSavedPinUpdate_WritesThePin_OnlyWhenTheCallerMayManageIt()
    {
        var (db, service, routeId, customerId) = await ServiceFixture(withPin: true);
        await using var _ = db;
        await service.UpdateCustomerVisitAsync(routeId, customerId, Visit(Day(11), saveToCustomer: true), 10, 10, allowSavedPinUpdate: false);
        db.ChangeTracker.Clear();
        var unchanged = await db.Customers.AsNoTracking().FirstAsync(c => c.Id == customerId);
        Assert.Equal(24.0m, unchanged.MainLatitude);

        await service.UpdateCustomerVisitAsync(routeId, customerId, Visit(Day(12), saveToCustomer: true), 10, 10, allowSavedPinUpdate: true);
        db.ChangeTracker.Clear();
        var updated = await db.Customers.AsNoTracking().FirstAsync(c => c.Id == customerId);
        Assert.Equal(25.25m, updated.MainLatitude);
        Assert.Equal(55.30m, updated.MainLongitude);
        Assert.Equal(10, updated.LocationUpdatedBy);
        Assert.NotNull(updated.LocationUpdatedAt);
    }
}
