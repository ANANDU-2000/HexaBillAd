using System.Net.Http.Json;
using System.Text.Json;

namespace HexaBill.Tests;

/// <summary>T-004b: a credit invoice must move stock and customer balance exactly, through create, edit and delete.</summary>
[Collection("HttpIntegration")]
public class SalePersistenceHttpTests
{
    private readonly HexaBillWebApplicationFactory _factory;
    public SalePersistenceHttpTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    private static async Task<JsonElement> DataAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, text);
        return JsonDocument.Parse(text).RootElement.GetProperty("data").Clone();
    }

    private static decimal Num(JsonElement e, string name) => e.GetProperty(name).GetDecimal();

    [Fact]
    public async Task CreditSale_CreateEditDelete_StockAndBalanceReconcile()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var tag = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();

        var productId = (await DataAsync(await client.PostAsJsonAsync("/api/products", new
        {
            sku = "SALE-" + tag, nameEn = "Sale item " + tag, unitType = "PIECE", conversionToBase = 1m, costPrice = 6m, sellPrice = 10m,
        }))).GetProperty("id").GetInt32();
        await DataAsync(await client.PostAsJsonAsync($"/api/products/{productId}/adjust-stock", new { changeQty = 20m, reason = "Opening stock" }));
        var customerId = (await DataAsync(await client.PostAsJsonAsync("/api/customers", new { name = "Ledger " + tag, customerType = "Credit" })))
            .GetProperty("id").GetInt32();

        async Task<decimal> Stock() => Num(await DataAsync(await client.GetAsync($"/api/products/{productId}")), "stockQty");
        async Task<decimal> Balance() => Num(await DataAsync(await client.GetAsync($"/api/customers/{customerId}")), "balance");

        // Create: 2 units @ 10
        var sale = await DataAsync(await client.PostAsJsonAsync("/api/sales", new
        {
            customerId, items = new[] { new { productId, unitType = "PIECE", qty = 2m, unitPrice = 10m } },
        }));
        var saleId = sale.GetProperty("id").GetInt32();
        var total1 = Num(sale, "grandTotal");
        Assert.True(total1 > 0);
        Assert.Equal(18m, await Stock());
        Assert.Equal(total1, await Balance());

        var read = await DataAsync(await client.GetAsync($"/api/sales/{saleId}"));
        Assert.Equal(total1, Num(read, "grandTotal"));
        Assert.Equal(customerId, read.GetProperty("customerId").GetInt32());

        // Edit: 5 units
        var edited = await DataAsync(await client.PutAsJsonAsync($"/api/sales/{saleId}", new
        {
            customerId, items = new[] { new { productId, unitType = "PIECE", qty = 5m, unitPrice = 10m } },
        }));
        var total2 = Num(edited, "grandTotal");
        Assert.True(total2 > total1);
        Assert.Equal(15m, await Stock());
        Assert.Equal(total2, await Balance());

        // Delete: stock and balance fully restored
        var del = await client.DeleteAsync($"/api/sales/{saleId}");
        Assert.True(del.IsSuccessStatusCode, await del.Content.ReadAsStringAsync());
        Assert.Equal(20m, await Stock());
        Assert.Equal(0m, await Balance());
    }
}
