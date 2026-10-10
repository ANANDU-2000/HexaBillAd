using System.Net.Http.Json;
using System.Text.Json;

namespace HexaBill.Tests;

/// <summary>T-004c: every submitted expense field survives create → read → edit → read, and delete removes it.</summary>
[Collection("HttpIntegration")]
public class ExpensePersistenceHttpTests
{
    private readonly HexaBillWebApplicationFactory _factory;
    public ExpensePersistenceHttpTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    private static async Task<JsonElement> DataAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, text);
        return JsonDocument.Parse(text).RootElement.GetProperty("data").Clone();
    }

    [Fact]
    public async Task Expense_AllFields_RoundTrip_AndDelete()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var note = "Persist expense " + Guid.NewGuid().ToString("N")[..8];
        var date = DateTime.UtcNow.Date.AddDays(-1);

        var created = await DataAsync(await client.PostAsJsonAsync("/api/expenses", new
        {
            categoryId = 1, amount = 200m, date, note, withVat = true, vatInclusive = false, taxType = "Standard",
            isTaxClaimable = true, isEntertainment = false, partialCreditPct = 100m, paidFrom = "Bank",
        }));
        var id = created.GetProperty("id").GetInt32();

        var read = await DataAsync(await client.GetAsync($"/api/expenses/{id}"));
        Assert.Equal(1, read.GetProperty("categoryId").GetInt32());
        Assert.Equal(200m, read.GetProperty("amount").GetDecimal());
        Assert.Equal(10m, read.GetProperty("vatAmount").GetDecimal());
        Assert.Equal(210m, read.GetProperty("totalAmount").GetDecimal());
        Assert.Equal(note, read.GetProperty("note").GetString());
        Assert.Equal("Bank", read.GetProperty("paidFrom").GetString());
        Assert.True(read.GetProperty("isTaxClaimable").GetBoolean());
        Assert.Equal(date, read.GetProperty("date").GetDateTime().Date);

        var edit = await client.PutAsJsonAsync($"/api/expenses/{id}", new
        {
            categoryId = 1, amount = 300m, date, note = note + " v2", withVat = false, taxType = "OutOfScope",
            isTaxClaimable = false, partialCreditPct = 100m, paidFrom = "Cash",
        });
        Assert.True(edit.IsSuccessStatusCode, await edit.Content.ReadAsStringAsync());
        var reread = await DataAsync(await client.GetAsync($"/api/expenses/{id}"));
        Assert.Equal(300m, reread.GetProperty("amount").GetDecimal());
        Assert.Equal(note + " v2", reread.GetProperty("note").GetString());
        Assert.Equal("Cash", reread.GetProperty("paidFrom").GetString());
        Assert.False(reread.GetProperty("isTaxClaimable").GetBoolean());
        Assert.Equal(0m, reread.GetProperty("vatAmount").ValueKind == JsonValueKind.Null ? 0m : reread.GetProperty("vatAmount").GetDecimal());

        var del = await client.DeleteAsync($"/api/expenses/{id}");
        Assert.True(del.IsSuccessStatusCode, await del.Content.ReadAsStringAsync());
        Assert.False((await client.GetAsync($"/api/expenses/{id}")).IsSuccessStatusCode);
    }
}
