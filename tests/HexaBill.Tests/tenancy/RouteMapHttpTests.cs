using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Net.Http.Json;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HexaBill.Tests;

/// <summary>
/// Route Map data: one grouped call returns each stop with what is owed and how late, scoped exactly like the route itself.
/// A driver sees the money of their own route (the collection sheet already shows it) but not credit limits; other routes and
/// other companies look like they do not exist.
/// </summary>
[Collection("HttpIntegration")]
public class RouteMapHttpTests
{
    private const int Company = 9410;
    private const int OtherCompany = 9411;
    private const string Slug = "routemap";
    private const string OtherSlug = "routemapother";
    private const int Owner = 9410;
    private const int Driver = 9412;
    private const int OtherStaff = 9413;
    private const int ManagerNone = 9414;
    private const int OtherOwner = 9415;
    private const int RouteA = 9410;
    private const int RouteB = 9411;
    private const int OtherRoute = 9412;
    private const int Owing = 9410;      // owes 150, one invoice 40 days past due, on route A
    private const int Settled = 9411;    // owes nothing, on route A
    private const int OnOtherRoute = 9412; // owes 999, on route B
    private const int Foreign = 9413;    // other company, on its own route

    private static readonly object FixtureLock = new();
    private readonly HexaBillWebApplicationFactory _factory;

    public RouteMapHttpTests(HexaBillWebApplicationFactory factory)
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
            if (db.Users.IgnoreQueryFilters().Any(u => u.Id == Owner)) return;
            var now = DateTime.UtcNow;
            db.Tenants.AddRange(
                new Tenant { Id = Company, Name = "Route map company", Subdomain = Slug, Status = TenantStatus.Active, FeaturesJson = "[]" },
                new Tenant { Id = OtherCompany, Name = "Route map other company", Subdomain = OtherSlug, Status = TenantStatus.Active, FeaturesJson = "[]" });
            db.SaveChanges();
            db.Users.AddRange(
                new User { Id = Owner, TenantId = Company, OwnerId = Company, Name = "Map owner", Email = "map-owner@http.test", PasswordHash = "x", Role = UserRole.Owner, SessionVersion = 1, IsActive = true, CreatedAt = now },
                new User { Id = OtherOwner, TenantId = OtherCompany, OwnerId = OtherCompany, Name = "Map other owner", Email = "map-other@http.test", PasswordHash = "x", Role = UserRole.Owner, SessionVersion = 1, IsActive = true, CreatedAt = now });
            foreach (var id in new[] { Driver, OtherStaff })
                db.Users.Add(new User { Id = id, TenantId = Company, OwnerId = Company, Name = $"Map staff {id}", Email = $"map-{id}@http.test", PasswordHash = "x", Role = UserRole.Staff, SessionVersion = 1, IsActive = true, CreatedAt = now });
            db.Users.Add(new User { Id = ManagerNone, TenantId = Company, OwnerId = Company, Name = "Map manager", Email = "map-mgr@http.test", PasswordHash = "x", Role = UserRole.Staff, SessionVersion = 1, IsActive = true, CreatedAt = now });
            db.Branches.AddRange(
                new Branch { Id = 9410, TenantId = Company, Name = "Map branch", IsActive = true, CreatedAt = now },
                new Branch { Id = 9411, TenantId = OtherCompany, Name = "Map other branch", IsActive = true, CreatedAt = now });
            db.Routes.AddRange(
                new HexaBill.Api.Models.Route { Id = RouteA, BranchId = 9410, TenantId = Company, Name = "Map route A", IsActive = true, CreatedAt = now },
                new HexaBill.Api.Models.Route { Id = RouteB, BranchId = 9410, TenantId = Company, Name = "Map route B", IsActive = true, CreatedAt = now },
                new HexaBill.Api.Models.Route { Id = OtherRoute, BranchId = 9411, TenantId = OtherCompany, Name = "Map other route", IsActive = true, CreatedAt = now });
            db.Customers.AddRange(
                new Customer { Id = Owing, TenantId = Company, OwnerId = Company, Name = "Map owing customer", Phone = "0501110001", Balance = 150m, PendingBalance = 150m, CreditLimit = 1000m, LastPaymentDate = now.AddDays(-50), CreatedAt = now, UpdatedAt = now },
                new Customer { Id = Settled, TenantId = Company, OwnerId = Company, Name = "Map settled customer", Phone = "0501110002", CreatedAt = now, UpdatedAt = now },
                new Customer { Id = OnOtherRoute, TenantId = Company, OwnerId = Company, Name = "Map other route customer", Balance = 999m, PendingBalance = 999m, CreatedAt = now, UpdatedAt = now },
                new Customer { Id = Foreign, TenantId = OtherCompany, OwnerId = OtherCompany, Name = "Map foreign customer", Balance = 777m, PendingBalance = 777m, CreatedAt = now, UpdatedAt = now });
            db.SaveChanges();
            db.RouteStaff.Add(new RouteStaff { RouteId = RouteA, UserId = Driver, AssignedAt = now });
            db.RouteCustomers.AddRange(
                new RouteCustomer { RouteId = RouteA, CustomerId = Owing, SortOrder = 1, AssignedAt = now },
                new RouteCustomer { RouteId = RouteA, CustomerId = Settled, SortOrder = 2, AssignedAt = now },
                new RouteCustomer { RouteId = RouteB, CustomerId = OnOtherRoute, SortOrder = 1, AssignedAt = now },
                new RouteCustomer { RouteId = OtherRoute, CustomerId = Foreign, SortOrder = 1, AssignedAt = now });
            db.Sales.Add(new Sale
            {
                TenantId = Company, OwnerId = Company, CreatedBy = Owner, CustomerId = Owing, InvoiceNo = "MAP-0001",
                InvoiceDate = now.AddDays(-70), DueDate = DateTime.Today.AddDays(-40), GrandTotal = 150m, TotalAmount = 150m, PaidAmount = 0m,
                PaymentStatus = SalePaymentStatus.Pending, CreatedAt = now,
            });
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

    private static async Task<JsonElement> Data(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
    }

    private static JsonElement Stop(JsonElement stops, int customerId) =>
        stops.EnumerateArray().Single(s => s.GetProperty("customerId").GetInt32() == customerId);

    [Fact]
    public async Task Owner_GetsBalanceOverdueAndCreditLimit_ForEachStop_InRouteOrder()
    {
        using var owner = As(Owner, "Owner");
        var stops = await Data(await owner.GetAsync($"/api/routes/{RouteA}/map-stops"));
        Assert.Equal(new[] { Owing, Settled }, stops.EnumerateArray().Select(s => s.GetProperty("customerId").GetInt32()).ToArray());

        var owing = Stop(stops, Owing);
        Assert.Equal(150m, owing.GetProperty("balance").GetDecimal());
        Assert.Equal(150m, owing.GetProperty("overdueAmount").GetDecimal());
        Assert.InRange(owing.GetProperty("overdueDays").GetInt32(), 39, 41);
        Assert.Equal(1000m, owing.GetProperty("creditLimit").GetDecimal());
        Assert.Equal("0501110001", owing.GetProperty("phone").GetString());
        Assert.NotEqual(JsonValueKind.Null, owing.GetProperty("lastPaymentDate").ValueKind);

        var settled = Stop(stops, Settled);
        Assert.Equal(0m, settled.GetProperty("balance").GetDecimal());
        Assert.Equal(0m, settled.GetProperty("overdueAmount").GetDecimal());
        Assert.Equal(0, settled.GetProperty("overdueDays").GetInt32());
    }

    [Fact]
    public async Task AssignedDriver_SeesTheMoneyOfTheirRoute_ButNotCreditLimits()
    {
        using var driver = As(Driver, "Staff");
        var stops = await Data(await driver.GetAsync($"/api/routes/{RouteA}/map-stops"));
        var owing = Stop(stops, Owing);
        Assert.Equal(150m, owing.GetProperty("balance").GetDecimal());
        Assert.Equal(JsonValueKind.Null, owing.GetProperty("creditLimit").ValueKind);
    }

    [Fact]
    public async Task OtherRoutesAndCompanies_LookMissing()
    {
        using var driver = As(Driver, "Staff");
        Assert.Equal(HttpStatusCode.NotFound, (await driver.GetAsync($"/api/routes/{RouteB}/map-stops")).StatusCode);
        using var staff = As(OtherStaff, "Staff");
        Assert.Equal(HttpStatusCode.NotFound, (await staff.GetAsync($"/api/routes/{RouteA}/map-stops")).StatusCode);
        using var manager = As(ManagerNone, "Manager");
        Assert.Equal(HttpStatusCode.NotFound, (await manager.GetAsync($"/api/routes/{RouteA}/map-stops")).StatusCode);
        using var owner = As(Owner, "Owner");
        Assert.Equal(HttpStatusCode.NotFound, (await owner.GetAsync($"/api/routes/{OtherRoute}/map-stops")).StatusCode);
    }

    [Fact]
    public async Task Overview_TotalsEveryAccessibleRoute_AndNothingElse()
    {
        using var owner = As(Owner, "Owner");
        var routes = (await Data(await owner.GetAsync("/api/route-map/overview"))).GetProperty("routes");
        var ids = routes.EnumerateArray().Select(r => r.GetProperty("routeId").GetInt32()).ToArray();
        Assert.Contains(RouteA, ids);
        Assert.Contains(RouteB, ids);
        Assert.DoesNotContain(OtherRoute, ids);
        var a = routes.EnumerateArray().Single(r => r.GetProperty("routeId").GetInt32() == RouteA);
        Assert.Equal(2, a.GetProperty("stopCount").GetInt32());
        Assert.Equal(150m, a.GetProperty("outstandingTotal").GetDecimal());
        Assert.Equal(150m, a.GetProperty("overdueTotal").GetDecimal());
        Assert.Equal(1, a.GetProperty("overdueCustomers").GetInt32());
        var b = routes.EnumerateArray().Single(r => r.GetProperty("routeId").GetInt32() == RouteB);
        Assert.Equal(999m, b.GetProperty("outstandingTotal").GetDecimal());

        using var driver = As(Driver, "Staff");
        var mine = (await Data(await driver.GetAsync("/api/route-map/overview"))).GetProperty("routes")
            .EnumerateArray().Select(r => r.GetProperty("routeId").GetInt32()).Where(i => i >= 9410).ToArray();
        Assert.Equal(new[] { RouteA }, mine);

        using var other = As(OtherOwner, "Owner", OtherCompany, OtherSlug);
        var theirs = (await Data(await other.GetAsync("/api/route-map/overview"))).GetProperty("routes")
            .EnumerateArray().Select(r => r.GetProperty("routeId").GetInt32()).Where(i => i >= 9410).ToArray();
        Assert.Equal(new[] { OtherRoute }, theirs);
    }

    private static async Task<JsonElement[]> Tool(HttpClient client, string tool, string query)
    {
        var response = await client.PostAsJsonAsync($"/api/assistant/tools/{tool}", new { query, limit = 10 });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await Data(response)).GetProperty("data").EnumerateArray().ToArray();
    }

    [Fact]
    public async Task AssistantRouteTools_AnswerFromTheCallersOwnRoutesOnly()
    {
        using var owner = As(Owner, "Owner");
        var overdue = await Tool(owner, "route_overdue", "Map route A");
        var row = Assert.Single(overdue);
        Assert.Equal(Owing, row.GetProperty("customerId").GetInt32());
        Assert.Equal(RouteA, row.GetProperty("routeId").GetInt32());
        Assert.Equal(150m, row.GetProperty("overdueAmount").GetDecimal());

        var everything = (await Tool(owner, "route_summary", "all")).Select(r => r.GetProperty("routeId").GetInt32()).Where(i => i >= 9410).ToArray();
        Assert.Contains(RouteA, everything);
        Assert.Contains(RouteB, everything);
        Assert.DoesNotContain(OtherRoute, everything); // another company

        var unpinned = (await Tool(owner, "customers_without_pin", "Map route A")).Select(r => r.GetProperty("customerId").GetInt32()).ToArray();
        Assert.Equal(new[] { Owing, Settled }, unpinned);
        var notVisited = (await Tool(owner, "route_unvisited", "Map route A")).Select(r => r.GetProperty("customerId").GetInt32()).ToArray();
        Assert.Equal(new[] { Owing, Settled }, notVisited);

        using var driver = As(Driver, "Staff");
        var mine = (await Tool(driver, "route_summary", "all")).Select(r => r.GetProperty("routeId").GetInt32()).Where(i => i >= 9410).ToArray();
        Assert.Equal(new[] { RouteA }, mine);
        Assert.Empty(await Tool(driver, "route_overdue", "Map route B")); // not theirs, so it simply is not found

        using var staff = As(OtherStaff, "Staff");
        Assert.Empty((await Tool(staff, "route_summary", "all")).Where(r => r.GetProperty("routeId").GetInt32() >= 9410));
    }

    [Fact]
    public async Task AssistantRouteTools_RejectExtraArguments()
    {
        using var owner = As(Owner, "Owner");
        var response = await owner.PostAsJsonAsync("/api/assistant/tools/route_overdue", new { query = "all", routeId = RouteB });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task TheModelMayPickARouteTool_AndTheServerRunsItForTheCaller()
    {
        var ai = _factory.Services.GetRequiredService<TestAiControl>();
        ai.ResetAll();
        ai.Good.Reply = "{\"tool\":\"route_summary\",\"query\":\"all\"}";
        using var owner = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await owner.PostAsJsonAsync("/api/assistant/chat", new { message = "how are my routes doing today?" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var data = await Data(response);
        Assert.Equal("tool", data.GetProperty("mode").GetString());
        Assert.Equal("route_summary", data.GetProperty("tool").GetString());
        // Company 1's own routes only, never the fixtures of other companies in this database.
        Assert.DoesNotContain(data.GetProperty("result").GetProperty("data").EnumerateArray(), r => r.GetProperty("routeId").GetInt32() >= 9410);
        Assert.DoesNotContain("Map route", ai.Good.LastSystem ?? "");
    }
}
