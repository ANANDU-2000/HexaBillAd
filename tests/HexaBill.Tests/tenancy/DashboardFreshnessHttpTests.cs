using System.Net.Http.Json;
using System.Text.Json;

namespace HexaBill.Tests;

/// <summary>T-005: dashboard totals must reflect a transaction immediately, not after the 5-minute cache expires.</summary>
[Collection("HttpIntegration")]
public class DashboardFreshnessHttpTests
{
    private readonly HexaBillWebApplicationFactory _factory;
    public DashboardFreshnessHttpTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    private static async Task<JsonElement> DataAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, text);
        return JsonDocument.Parse(text).RootElement.GetProperty("data").Clone();
    }

    [Fact]
    public async Task MultiDaySummary_ReflectsNewSaleAndExpense_Immediately()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var to = DateTime.UtcNow.Date.AddDays(1);
        var from = to.AddDays(-40);
        var url = $"/api/reports/summary?fromDate={from:yyyy-MM-dd}&toDate={to:yyyy-MM-dd}";

        var before = await DataAsync(await client.GetAsync(url));
        var tag = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
        var productId = (await DataAsync(await client.PostAsJsonAsync("/api/products", new
        {
            sku = "DASH-" + tag, nameEn = "Dash item " + tag, unitType = "PIECE", conversionToBase = 1m, costPrice = 6m, sellPrice = 10m,
        }))).GetProperty("id").GetInt32();
        await DataAsync(await client.PostAsJsonAsync($"/api/products/{productId}/adjust-stock", new { changeQty = 5m, reason = "Opening stock" }));
        var sale = await DataAsync(await client.PostAsJsonAsync("/api/sales", new
        {
            customerId = 1, items = new[] { new { productId, unitType = "PIECE", qty = 1m, unitPrice = 100m } },
        }));
        await DataAsync(await client.PostAsJsonAsync("/api/expenses", new { categoryId = 1, amount = 40m, date = DateTime.UtcNow.Date, note = "dash " + tag, paidFrom = "Cash" }));

        var after = await DataAsync(await client.GetAsync(url));
        Assert.True(after.GetProperty("salesToday").GetDecimal() > before.GetProperty("salesToday").GetDecimal(),
            $"sales before {before.GetProperty("salesToday")} after {after.GetProperty("salesToday")} (sale total {sale.GetProperty("grandTotal")})");
        Assert.True(after.GetProperty("expensesToday").GetDecimal() > before.GetProperty("expensesToday").GetDecimal());
    }
}
