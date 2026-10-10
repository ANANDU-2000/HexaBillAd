using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace HexaBill.Tests;

/// <summary>T-004: every submitted product field must survive create → read → update → read through the real API.</summary>
[Collection("HttpIntegration")]
public class ProductPersistenceHttpTests
{
    private readonly HexaBillWebApplicationFactory _factory;
    public ProductPersistenceHttpTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    private static object Body(string sku, string name, decimal cost, decimal sell, decimal stock) => new
    {
        sku, barcode = sku + "-BC", nameEn = name, nameAr = "منتج تجريبي", unitType = "CRTN", conversionToBase = 12m,
        costPrice = cost, sellPrice = sell, stockQty = stock, reorderLevel = 3,
        descriptionEn = "Synthetic persistence fixture", descriptionAr = "وصف",
    };

    private static async Task<JsonElement> DataAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, text);
        return JsonDocument.Parse(text).RootElement.GetProperty("data").Clone();
    }

    [Fact]
    public async Task Product_AllFields_RoundTrip_CreateReadUpdateRead()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var sku = "PERSIST-" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();

        var created = await DataAsync(await client.PostAsJsonAsync("/api/products", Body(sku, "Persist Item", 10.125m, 15.5m, 24m)));
        var id = created.GetProperty("id").GetInt32();

        var read = await DataAsync(await client.GetAsync($"/api/products/{id}"));
        Assert.Equal(sku, read.GetProperty("sku").GetString());
        Assert.Equal(sku + "-BC", read.GetProperty("barcode").GetString());
        Assert.Equal("Persist Item", read.GetProperty("nameEn").GetString());
        Assert.Equal("منتج تجريبي", read.GetProperty("nameAr").GetString());
        Assert.Equal("CRTN", read.GetProperty("unitType").GetString());
        Assert.Equal(12m, read.GetProperty("conversionToBase").GetDecimal());
        Assert.Equal(10.125m, read.GetProperty("costPrice").GetDecimal());
        Assert.Equal(15.5m, read.GetProperty("sellPrice").GetDecimal());
        Assert.Equal(0m, read.GetProperty("stockQty").GetDecimal()); // by design: opening stock goes through Stock Adjustment
        Assert.Equal(3, read.GetProperty("reorderLevel").GetInt32());

        var update = await client.PutAsJsonAsync($"/api/products/{id}", Body(sku, "Persist Item v2", 11m, 16.75m, 24m));
        Assert.True(update.IsSuccessStatusCode, await update.Content.ReadAsStringAsync());
        var reread = await DataAsync(await client.GetAsync($"/api/products/{id}"));
        Assert.Equal("Persist Item v2", reread.GetProperty("nameEn").GetString());
        Assert.Equal(11m, reread.GetProperty("costPrice").GetDecimal());
        Assert.Equal(16.75m, reread.GetProperty("sellPrice").GetDecimal());
    }

    [Fact]
    public async Task Product_DuplicateSku_SameTenant_IsRejected_OtherTenant_IsAllowed()
    {
        var sku = "DUP-" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
        using var a = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        using var b = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        Assert.True((await a.PostAsJsonAsync("/api/products", Body(sku, "First", 1m, 2m, 0m))).IsSuccessStatusCode);

        var dup = await a.PostAsJsonAsync("/api/products", Body(sku, "Second", 1m, 2m, 0m));
        Assert.False(dup.IsSuccessStatusCode, await dup.Content.ReadAsStringAsync());

        var other = await b.PostAsJsonAsync("/api/products", Body(sku, "Other tenant", 1m, 2m, 0m));
        Assert.True(other.IsSuccessStatusCode, await other.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Product_NegativePrice_IsRejected()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.PostAsJsonAsync("/api/products", Body("NEG-" + Guid.NewGuid().ToString("N")[..6], "Negative", -1m, 2m, 0m));
        Assert.False(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Product_EditWithoutStockField_DoesNotResetStock()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var sku = "STK-" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
        var id = (await DataAsync(await client.PostAsJsonAsync("/api/products", Body(sku, "Stock keeper", 5m, 8m, 0m)))).GetProperty("id").GetInt32();
        var adjust = await client.PostAsJsonAsync($"/api/products/{id}/adjust-stock", new { changeQty = 40m, reason = "Opening stock" });
        Assert.True(adjust.IsSuccessStatusCode, await adjust.Content.ReadAsStringAsync());

        // The product form does not send stockQty; an ordinary edit must not touch stock.
        var edit = await client.PutAsJsonAsync($"/api/products/{id}", new
        {
            sku, nameEn = "Stock keeper renamed", unitType = "CRTN", conversionToBase = 12m, costPrice = 5m, sellPrice = 9m,
        });
        Assert.True(edit.IsSuccessStatusCode, await edit.Content.ReadAsStringAsync());
        var after = await DataAsync(await client.GetAsync($"/api/products/{id}"));
        Assert.Equal(40m, after.GetProperty("stockQty").GetDecimal());
        Assert.Equal("Stock keeper renamed", after.GetProperty("nameEn").GetString());
    }
}
