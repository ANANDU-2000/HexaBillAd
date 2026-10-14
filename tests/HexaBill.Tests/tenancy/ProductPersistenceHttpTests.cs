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
    public async Task Product_FailedCreateWithInactiveSku_DoesNotRenameHistory_AndOriginalCanReactivate()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var sku = "HISTORY-" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
        var original = await DataAsync(await client.PostAsJsonAsync("/api/products", Body(sku, "Original historical item", 5m, 8m, 0m)));
        var id = original.GetProperty("id").GetInt32();
        Assert.True((await client.DeleteAsync($"/api/products/{id}")).IsSuccessStatusCode);
        var otherSku = "BARCODE-" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
        var holder = await DataAsync(await client.PostAsJsonAsync("/api/products", Body(otherSku, "Barcode holder", 1m, 2m, 0m)));

        var rejected = await client.PostAsJsonAsync("/api/products", new
        {
            sku, barcode = otherSku + "-BC", nameEn = "Rejected replacement", unitType = "PCS", conversionToBase = 1m, costPrice = 1m, sellPrice = 2m,
        });
        Assert.False(rejected.IsSuccessStatusCode);
        var after = await DataAsync(await client.GetAsync($"/api/products/{id}"));
        Assert.Equal(sku, after.GetProperty("sku").GetString());
        Assert.Equal("Original historical item", after.GetProperty("nameEn").GetString());
        Assert.False(after.GetProperty("isActive").GetBoolean());
        Assert.True((await client.PostAsync($"/api/products/{id}/activate", null)).IsSuccessStatusCode);
        Assert.Equal(sku, (await DataAsync(await client.GetAsync($"/api/products/{id}"))).GetProperty("sku").GetString());
        Assert.True((await client.DeleteAsync($"/api/products/{id}")).IsSuccessStatusCode);
        Assert.True((await client.DeleteAsync($"/api/products/{holder.GetProperty("id").GetInt32()}")).IsSuccessStatusCode);
    }

    [Fact]
    public async Task Product_InactiveList_FiltersBeforePagination_AndRemainsTenantScoped()
    {
        using var a = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        using var b = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var prefix = "STATUS-" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
        var activeIds = new List<int>();
        var inactiveIds = new List<int>();
        for (var i = 0; i < 15; i++)
        {
            var item = await DataAsync(await a.PostAsJsonAsync("/api/products", Body($"{prefix}-{i}", $"{prefix} {i:D2}", 1m, 2m, 0m)));
            var id = item.GetProperty("id").GetInt32();
            if (i < 12) activeIds.Add(id);
            else
            {
                inactiveIds.Add(id);
                Assert.True((await a.DeleteAsync($"/api/products/{id}")).IsSuccessStatusCode);
            }
        }
        var foreign = (await DataAsync(await b.PostAsJsonAsync("/api/products", Body($"{prefix}-FOREIGN", $"{prefix} foreign", 1m, 2m, 0m)))).GetProperty("id").GetInt32();
        Assert.True((await b.DeleteAsync($"/api/products/{foreign}")).IsSuccessStatusCode);

        var first = await DataAsync(await a.GetAsync($"/api/products?search={prefix}&inactiveOnly=true&page=1&pageSize=2&tenantId=2"));
        Assert.Equal(3, first.GetProperty("totalCount").GetInt32());
        Assert.Equal(2, first.GetProperty("totalPages").GetInt32());
        var firstItems = first.GetProperty("items").EnumerateArray().ToList();
        Assert.Equal(2, firstItems.Count);
        Assert.All(firstItems, item =>
        {
            Assert.False(item.GetProperty("isActive").GetBoolean());
            Assert.Contains(item.GetProperty("id").GetInt32(), inactiveIds);
        });
        var second = await DataAsync(await a.GetAsync($"/api/products?search={prefix}&inactiveOnly=true&page=2&pageSize=2"));
        var last = Assert.Single(second.GetProperty("items").EnumerateArray().ToList());
        Assert.Equal(inactiveIds[2], last.GetProperty("id").GetInt32());

        var legacyAll = await DataAsync(await a.GetAsync($"/api/products?search={prefix}&includeInactive=true&pageSize=50"));
        Assert.Equal(15, legacyAll.GetProperty("totalCount").GetInt32());
        var active = await DataAsync(await a.GetAsync($"/api/products?search={prefix}&pageSize=50"));
        Assert.Equal(12, active.GetProperty("totalCount").GetInt32());
        Assert.All(active.GetProperty("items").EnumerateArray(), item => Assert.True(item.GetProperty("isActive").GetBoolean()));

        var reopenedId = inactiveIds[0];
        Assert.True((await a.PostAsync($"/api/products/{reopenedId}/activate", null)).IsSuccessStatusCode);
        var after = await DataAsync(await a.GetAsync($"/api/products?search={prefix}&inactiveOnly=true&includeInactive=true&pageSize=50"));
        Assert.Equal(2, after.GetProperty("totalCount").GetInt32());
        Assert.DoesNotContain(after.GetProperty("items").EnumerateArray(), item => item.GetProperty("id").GetInt32() == reopenedId);
        foreach (var id in activeIds.Append(reopenedId)) Assert.True((await a.DeleteAsync($"/api/products/{id}")).IsSuccessStatusCode);
    }

    [Fact]
    public async Task Product_Image_ReadRequiresAuthenticationAndMatchingTenant()
    {
        using var a = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        using var b = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var sku = "IMG-" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
        var id = (await DataAsync(await a.PostAsJsonAsync("/api/products", Body(sku, "Synthetic photo fixture", 1m, 2m, 0m)))).GetProperty("id").GetInt32();
        var png = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAO0lEQVR4nO3RQREAMAjEwKNqKrHCEFgJ4cMvK+CYCXVfZ9NZXY8HBvwBMhEyETIRMhEyETIRMhEyUcgHqGsBlLFhwGoAAAAASUVORK5CYII=");
        using var multipart = new MultipartFormDataContent();
        var photo = new ByteArrayContent(png);
        photo.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/png");
        multipart.Add(photo, "file", "synthetic.png");
        var upload = await a.PostAsync($"/api/products/{id}/upload-image", multipart);
        Assert.True(upload.IsSuccessStatusCode, await upload.Content.ReadAsStringAsync());
        var own = await a.GetAsync($"/api/products/{id}/image");
        Assert.True(own.IsSuccessStatusCode);
        Assert.Equal("image/png", own.Content.Headers.ContentType?.MediaType);
        Assert.Equal(png, await own.Content.ReadAsByteArrayAsync());
        Assert.True(own.Headers.CacheControl?.Private);
        Assert.True(own.Headers.CacheControl?.NoStore);
        Assert.Equal(HttpStatusCode.NotFound, (await b.GetAsync($"/api/products/{id}/image")).StatusCode);
        using var anonymous = _factory.CreateClient();
        foreach (var header in a.DefaultRequestHeaders.Where(h => h.Key != "Authorization")) anonymous.DefaultRequestHeaders.TryAddWithoutValidation(header.Key, header.Value);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync($"/api/products/{id}/image")).StatusCode);
        Assert.True((await a.DeleteAsync($"/api/products/{id}")).IsSuccessStatusCode);
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
