using System.Net;
using System.Text.Json;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.Extensions.DependencyInjection;

namespace HexaBill.Tests;

[Collection("HttpIntegration")]
public class PaymentListFiltersHttpTests
{
    [Fact]
    public async Task DateRange_IncludesBothCalendarDays_AndExcludesOtherTenants()
    {
        await using var factory = new HexaBillWebApplicationFactory();
        using var client = HttpIntegrationClient.Create(factory, 1, "tenanta");
        await SeedAsync(factory);
        var (status, total, ids) = await ListAsync(client, "fromDate=2024-01-01&toDate=2024-01-02&pageSize=100");
        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(5, total);
        Assert.Equal(new[] { 8002, 8003, 8101, 8102, 8201 }, ids.Order().ToArray());
    }

    [Fact]
    public async Task Filters_RunBeforePagination_AndFindMatchesBehindFirstHundredRows()
    {
        await using var factory = new HexaBillWebApplicationFactory();
        using var client = HttpIntegrationClient.Create(factory, 1, "tenanta");
        await SeedAsync(factory);
        var (status, total, ids) = await ListAsync(client,
            "fromDate=2024-01-01&toDate=2024-01-02&search=nEeDlE&method=cheque&status=pending&pageSize=1&tenantId=2");
        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(1, total);
        Assert.Equal(new[] { 8101 }, ids);
    }

    [Fact]
    public async Task DateRange_PagesContainEveryMatchOnce()
    {
        await using var factory = new HexaBillWebApplicationFactory();
        using var client = HttpIntegrationClient.Create(factory, 1, "tenanta");
        await SeedAsync(factory);
        var allIds = new List<int>();
        for (var page = 1; page <= 3; page++)
        {
            var (status, total, ids) = await ListAsync(client,
                $"fromDate=2024-01-01&toDate=2024-01-02&pageSize=2&page={page}");
            Assert.Equal(HttpStatusCode.OK, status);
            Assert.Equal(5, total);
            allIds.AddRange(ids);
        }
        Assert.Equal(new[] { 8002, 8003, 8101, 8102, 8201 }, allIds.Order().ToArray());
    }

    [Fact]
    public async Task FutureRange_ReturnsEmptyResults()
    {
        await using var factory = new HexaBillWebApplicationFactory();
        using var client = HttpIntegrationClient.Create(factory, 1, "tenanta");
        await SeedAsync(factory);
        var (status, total, ids) = await ListAsync(client, "fromDate=2030-01-01&toDate=2030-01-02");
        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(0, total);
        Assert.Empty(ids);
    }

    [Fact]
    public async Task CreditStatus_DoesNotBecomeCashPending()
    {
        await using var factory = new HexaBillWebApplicationFactory();
        using var client = HttpIntegrationClient.Create(factory, 1, "tenanta");
        await SeedAsync(factory);
        var (_, total, ids) = await ListAsync(client, "status=credit&fromDate=2024-01-01&toDate=2024-01-02");
        Assert.Equal(1, total);
        Assert.Equal(new[] { 8201 }, ids);
        var (_, cashTotal, cashIds) = await ListAsync(client, "status=credit&method=cash&fromDate=2024-01-01&toDate=2024-01-02");
        Assert.Equal(0, cashTotal);
        Assert.Empty(cashIds);
    }

    [Theory]
    [InlineData("fromDate=2024-01-03&toDate=2024-01-01")]
    [InlineData("method=not-a-payment-method")]
    [InlineData("status=not-a-payment-state")]
    public async Task InvalidFilter_ReturnsBadRequest(string query)
    {
        await using var factory = new HexaBillWebApplicationFactory();
        using var client = HttpIntegrationClient.Create(factory, 1, "tenanta");
        var response = await client.GetAsync("/api/payments?" + query);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static async Task SeedAsync(HexaBillWebApplicationFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.SetRequestTenantScope(null, true);
        Payment Row(int id, int tenant, DateTime date, PaymentMode mode = PaymentMode.CASH,
            PaymentStatus status = PaymentStatus.CLEARED, string? reference = null) => new()
        {
            Id = id, TenantId = tenant, OwnerId = tenant, CustomerId = tenant, CreatedBy = tenant,
            Amount = 10, PaymentDate = date, CreatedAt = date, Mode = mode, Status = status, Reference = reference
        };
        DateTime Day(int day) => new(2024, 1, day, 0, 0, 0, DateTimeKind.Utc);
        db.Payments.AddRange(
            Row(8001, 1, Day(1).AddTicks(-10)),
            Row(8002, 1, Day(1)),
            Row(8003, 1, Day(3).AddTicks(-10)),
            Row(8004, 1, Day(3)),
            Row(8101, 1, Day(2).AddHours(10), PaymentMode.CHEQUE, PaymentStatus.PENDING, "Needle Match"),
            Row(8102, 1, Day(2).AddHours(10), reference: "Needle Match"),
            Row(8201, 1, Day(2), PaymentMode.CREDIT, PaymentStatus.PENDING),
            Row(9001, 2, Day(2).AddHours(10), PaymentMode.CHEQUE, PaymentStatus.PENDING, "Needle Match"));
        for (var i = 0; i < 101; i++)
            db.Payments.Add(Row(10000 + i, 1, new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc).AddDays(i)));
        await db.SaveChangesAsync();
    }

    private static async Task<(HttpStatusCode Status, int Total, int[] Ids)> ListAsync(HttpClient client, string query)
    {
        using var response = await client.GetAsync("/api/payments?" + query);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var data = json.RootElement.GetProperty("data");
        return (response.StatusCode, data.GetProperty("totalCount").GetInt32(),
            data.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("id").GetInt32()).ToArray());
    }
}
