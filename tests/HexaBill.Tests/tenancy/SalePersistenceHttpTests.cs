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

    [Fact]
    public async Task Payment_PartialThenDelete_SaleStatusAndBalanceReconcile_AndRetryIsIdempotent()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var tag = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
        var productId = (await DataAsync(await client.PostAsJsonAsync("/api/products", new
        {
            sku = "PAY-" + tag, nameEn = "Pay item " + tag, unitType = "PIECE", conversionToBase = 1m, costPrice = 6m, sellPrice = 10m,
        }))).GetProperty("id").GetInt32();
        await DataAsync(await client.PostAsJsonAsync($"/api/products/{productId}/adjust-stock", new { changeQty = 10m, reason = "Opening stock" }));
        var customerId = (await DataAsync(await client.PostAsJsonAsync("/api/customers", new { name = "Payer " + tag, customerType = "Credit" })))
            .GetProperty("id").GetInt32();
        var sale = await DataAsync(await client.PostAsJsonAsync("/api/sales", new
        {
            customerId, items = new[] { new { productId, unitType = "PIECE", qty = 4m, unitPrice = 10m } },
        }));
        var saleId = sale.GetProperty("id").GetInt32();
        var total = Num(sale, "grandTotal");
        async Task<decimal> Balance() => Num(await DataAsync(await client.GetAsync($"/api/customers/{customerId}")), "balance");

        var key = "persist-" + tag;
        async Task<HttpResponseMessage> Pay()
        {
            var msg = new HttpRequestMessage(HttpMethod.Post, "/api/payments")
            { Content = JsonContent.Create(new { saleId, customerId, amount = 10m, mode = "CASH" }) };
            msg.Headers.TryAddWithoutValidation("Idempotency-Key", key);
            return await client.SendAsync(msg);
        }
        var first = await DataAsync(await Pay());
        var paymentId = first.GetProperty("payment").GetProperty("id").GetInt32();
        var replay = await DataAsync(await Pay());                       // lost-response retry, same key
        Assert.Equal(paymentId, replay.GetProperty("payment").GetProperty("id").GetInt32());

        Assert.Equal(total - 10m, await Balance());
        var afterPay = await DataAsync(await client.GetAsync($"/api/sales/{saleId}"));
        Assert.Equal(10m, Num(afterPay, "paidAmount"));
        Assert.Equal("Partial", afterPay.GetProperty("paymentStatus").GetString(), StringComparer.OrdinalIgnoreCase);

        var del = await client.DeleteAsync($"/api/payments/{paymentId}");
        Assert.True(del.IsSuccessStatusCode, await del.Content.ReadAsStringAsync());
        Assert.Equal(total, await Balance());
        var afterDelete = await DataAsync(await client.GetAsync($"/api/sales/{saleId}"));
        Assert.Equal(0m, Num(afterDelete, "paidAmount"));
        Assert.NotEqual("Partial", afterDelete.GetProperty("paymentStatus").GetString(), StringComparer.OrdinalIgnoreCase);
    }
}
