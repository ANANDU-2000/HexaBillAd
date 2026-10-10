using System.Net.Http.Json;
using System.Text.Json;

namespace HexaBill.Tests;

/// <summary>T-004c: a credit purchase must move stock and supplier payable exactly, through create, edit and delete.</summary>
[Collection("HttpIntegration")]
public class PurchasePersistenceHttpTests
{
    private readonly HexaBillWebApplicationFactory _factory;
    public PurchasePersistenceHttpTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    private static async Task<JsonElement> DataAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, text);
        return JsonDocument.Parse(text).RootElement.GetProperty("data").Clone();
    }

    private static decimal Num(JsonElement e, string name) => e.GetProperty(name).GetDecimal();

    [Fact]
    public async Task CreditPurchase_CreateEditDelete_StockAndPayableReconcile()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var tag = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
        var supplier = "Supplier " + tag;
        var productId = (await DataAsync(await client.PostAsJsonAsync("/api/products", new
        {
            sku = "PUR-" + tag, nameEn = "Purchase item " + tag, unitType = "PIECE", conversionToBase = 1m, costPrice = 6m, sellPrice = 10m,
        }))).GetProperty("id").GetInt32();

        async Task<decimal> Stock() => Num(await DataAsync(await client.GetAsync($"/api/products/{productId}")), "stockQty");
        async Task<decimal> Payable() => Num(await DataAsync(await client.GetAsync($"/api/suppliers/balance/{Uri.EscapeDataString(supplier)}")), "netPayable");

        object Body(decimal qty) => new
        {
            supplierName = supplier, invoiceNo = "PINV-" + tag, purchaseDate = DateTime.UtcNow.Date,
            includesVat = false, vatPercent = 5m, isTaxClaimable = true, paymentType = "Credit",
            items = new[] { new { productId, unitType = "PIECE", qty, unitCost = 10m } },
        };

        var created = await DataAsync(await client.PostAsJsonAsync("/api/purchases", Body(4m)));
        var purchaseId = created.GetProperty("id").GetInt32();
        var total1 = Num(created, "totalAmount");
        Assert.Equal(42m, total1);                    // 4 x 10 + 5% VAT
        Assert.Equal(4m, await Stock());
        Assert.Equal(total1, await Payable());

        var read = await DataAsync(await client.GetAsync($"/api/purchases/{purchaseId}"));
        Assert.Equal(supplier, read.GetProperty("supplierName").GetString());
        Assert.Equal("PINV-" + tag, read.GetProperty("invoiceNo").GetString());
        Assert.Equal(total1, Num(read, "totalAmount"));

        var edited = await DataAsync(await client.PutAsJsonAsync($"/api/purchases/{purchaseId}", Body(6m)));
        Assert.Equal(63m, Num(edited, "totalAmount"));
        Assert.Equal(6m, await Stock());
        Assert.Equal(63m, await Payable());

        var del = await client.DeleteAsync($"/api/purchases/{purchaseId}");
        Assert.True(del.IsSuccessStatusCode, await del.Content.ReadAsStringAsync());
        Assert.Equal(0m, await Stock());
        Assert.Equal(0m, await Payable());
    }
}
