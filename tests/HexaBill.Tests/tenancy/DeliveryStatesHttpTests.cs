using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HexaBill.Tests;

/// <summary>Delivery states on existing route visits: arrived, delivered, failed, skipped. No GPS needed, a reason is required for failures.</summary>
[Collection("HttpIntegration")]
public class DeliveryStatesHttpTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public DeliveryStatesHttpTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    private HttpClient Owner(int tenantId, string slug) => HttpIntegrationClient.Create(_factory, tenantId, slug);

    // Each test uses its own day, so visits never collide between tests or runs.
    private static string Day(int offset) => DateTime.UtcNow.Date.AddDays(-400 - offset).ToString("yyyy-MM-dd");

    private static Task<HttpResponseMessage> Post(HttpClient client, int routeId, object body) =>
        client.PostAsJsonAsync($"/api/routes/{routeId}/visits", body);

    private static async Task<JsonElement> Data(HttpResponseMessage r) => (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");

    [Theory]
    [InlineData("Arrived")]
    [InlineData("Delivered")]
    public async Task ArrivedAndDelivered_AreAccepted_AndTimestampedWithoutGps(string status)
    {
        using var client = Owner(1, "tenanta");
        var day = Day(status == "Arrived" ? 1 : 2);
        var response = await Post(client, 1, new { customerId = 1, visitDate = day, status });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(status, (await Data(response)).GetProperty("status").GetString());

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var date = DateTime.Parse(day).Date;
        var row = await db.CustomerVisits.IgnoreQueryFilters().FirstAsync(v => v.TenantId == 1 && v.RouteId == 1 && v.CustomerId == 1 && v.VisitDate == date);
        Assert.NotNull(row.ReachedAt);
        Assert.Null(row.Latitude);
    }

    [Theory]
    [InlineData("Failed")]
    [InlineData("Skipped")]
    public async Task FailedAndSkipped_NeedAReason(string status)
    {
        using var client = Owner(1, "tenanta");
        var day = Day(status == "Failed" ? 3 : 4);
        Assert.Equal(HttpStatusCode.BadRequest, (await Post(client, 1, new { customerId = 1, visitDate = day, status })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Post(client, 1, new { customerId = 1, visitDate = day, status, notes = "  " })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Post(client, 1, new { customerId = 1, visitDate = day, status, notes = "ok" })).StatusCode); // too short to be a reason

        var accepted = await Post(client, 1, new { customerId = 1, visitDate = day, status, notes = "  Shop closed for stocktake  " });
        Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);
        var data = await Data(accepted);
        Assert.Equal(status, data.GetProperty("status").GetString());
        Assert.Equal("Shop closed for stocktake", data.GetProperty("notes").GetString());
    }

    [Theory]
    [InlineData("99")]
    [InlineData("1")]
    [InlineData("banana")]
    [InlineData("")]
    public async Task InvalidOrNumericStatus_IsRejected(string status)
    {
        using var client = Owner(1, "tenanta");
        var response = await Post(client, 1, new { customerId = 1, visitDate = Day(5), status });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task OverlongNote_IsRejected()
    {
        using var client = Owner(1, "tenanta");
        var response = await Post(client, 1, new { customerId = 1, visitDate = Day(6), status = "Delivered", notes = new string('x', 501) });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("NotHome")]
    [InlineData("Visited")]
    [InlineData("Rescheduled")]
    [InlineData("notvisited")]
    public async Task ExistingStatuses_StillWork_IncludingCaseInsensitiveNames(string status)
    {
        using var client = Owner(1, "tenanta");
        var response = await Post(client, 1, new { customerId = 1, visitDate = Day(7), status });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task AnotherCompany_CannotUpdateOrSeeThisRoutesVisits()
    {
        using var other = Owner(2, "tenantb");
        var response = await Post(other, 1, new { customerId = 1, visitDate = Day(8), status = "Delivered" }); // route 1 and customer 1 belong to tenant A
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        using var owner = Owner(1, "tenanta");
        Assert.Equal(HttpStatusCode.OK, (await Post(owner, 1, new { customerId = 1, visitDate = Day(8), status = "Delivered" })).StatusCode);
        var list = await other.GetAsync($"/api/routes/1/visits?date={Day(8)}");
        if (list.StatusCode == HttpStatusCode.OK)
            Assert.Equal(0, (await Data(list)).GetArrayLength()); // never tenant A's rows
    }

    [Fact]
    public async Task ListShowsTheDeliveryStatusByName()
    {
        using var client = Owner(1, "tenanta");
        var day = Day(9);
        Assert.Equal(HttpStatusCode.OK, (await Post(client, 1, new { customerId = 1, visitDate = day, status = "Failed", notes = "Customer refused delivery" })).StatusCode);
        var list = await client.GetAsync($"/api/routes/1/visits?date={day}");
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        var rows = await Data(list);
        Assert.Contains(rows.EnumerateArray(), r => r.GetProperty("status").GetString() == "Failed" && r.GetProperty("notes").GetString() == "Customer refused delivery");
    }
}
