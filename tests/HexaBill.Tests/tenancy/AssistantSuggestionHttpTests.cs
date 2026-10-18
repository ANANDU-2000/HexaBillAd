using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HexaBill.Tests;

/// <summary>
/// The assistant may fill in the New customer or New expense form, never save one. The suggestion is checked field by field, writes
/// nothing, creates no draft, and the person still reviews and confirms through the existing server-side draft flow.
/// Malayalam, Arabic and other scripts pass through unchanged, and digits written in those scripts keep their meaning.
/// </summary>
[Collection("HttpIntegration")]
public class AssistantSuggestionHttpTests
{
    private readonly HexaBillWebApplicationFactory _factory;
    private readonly TestAiControl _ai;

    public AssistantSuggestionHttpTests(HexaBillWebApplicationFactory factory)
    {
        _factory = factory;
        _ai = factory.Services.GetRequiredService<TestAiControl>();
        _ai.ResetAll();
    }

    private HttpClient Owner() => HttpIntegrationClient.Create(_factory, 1, "tenanta");
    private static async Task<JsonElement> Data(HttpResponseMessage r) => (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");

    private async Task<(int customers, int expenses, int drafts)> Counts()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.SetRequestTenantScope(null, true);
        return (await db.Customers.IgnoreQueryFilters().CountAsync(), await db.Expenses.IgnoreQueryFilters().CountAsync(), await db.AssistantDrafts.IgnoreQueryFilters().CountAsync());
    }

    private async Task<JsonElement> Ask(string reply, string message = "add a customer")
    {
        _ai.Good.Reply = reply;
        using var owner = Owner();
        var response = await owner.PostAsJsonAsync("/api/assistant/chat", new { message });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await Data(response);
    }

    private static Dictionary<string, string> Fields(JsonElement data) =>
        data.GetProperty("suggestion").GetProperty("fields").EnumerateObject().ToDictionary(p => p.Name, p => p.Value.GetString()!);

    [Fact]
    public async Task ACustomerSuggestion_PrefillsTheForm_AndSavesNothing()
    {
        var before = await Counts();
        var data = await Ask("{\"tool\":\"new_customer\",\"fields\":{\"name\":\"  Al Noor  Trading \",\"phone\":\"050 123 4567\",\"email\":\"sales@alnoor.example\",\"address\":\"Mussafah, Abu Dhabi\"}}");
        Assert.Equal("suggestion", data.GetProperty("mode").GetString());
        Assert.Equal("new_customer", data.GetProperty("suggestion").GetProperty("kind").GetString());
        var f = Fields(data);
        Assert.Equal("Al Noor Trading", f["name"]);
        Assert.Equal("050 123 4567", f["phone"]);
        Assert.Equal("sales@alnoor.example", f["email"]);
        Assert.Equal("Mussafah, Abu Dhabi", f["address"]);
        Assert.Equal(before, await Counts()); // nothing created, no draft stored
    }

    [Fact]
    public async Task AnExpenseSuggestion_KeepsOnlyValuesThatFit_AndReportsWhatWasDropped()
    {
        var data = await Ask("{\"tool\":\"new_expense\",\"fields\":{\"categoryName\":\"Fuel\",\"amount\":\"AED 125.50\",\"date\":\"2026-10-17\",\"note\":\"Diesel for route 3\"}}");
        var f = Fields(data);
        Assert.Equal("Fuel", f["categoryName"]);
        Assert.Equal("125.5", f["amount"]);
        Assert.Equal("2026-10-17", f["date"]);

        var bad = await Ask("{\"tool\":\"new_expense\",\"fields\":{\"amount\":-5,\"date\":\"yesterday\",\"note\":\"ok\"}}");
        var dropped = bad.GetProperty("suggestion").GetProperty("dropped").EnumerateArray().Select(x => x.GetString()).ToArray();
        Assert.Contains("amount", dropped);
        Assert.Contains("date", dropped);
        Assert.Equal("ok", Fields(bad)["note"]);

        var future = await Ask("{\"tool\":\"new_expense\",\"fields\":{\"amount\":10,\"date\":\"2099-01-01\"}}");
        Assert.DoesNotContain("date", Fields(future).Keys);
    }

    [Fact]
    public async Task Malayalam_AndArabic_TextAndDigits_KeepTheirMeaning()
    {
        const string malayalamMessage = "പുതിയ ഉപഭോക്താവ് ചേർക്കുക: അൽ നൂർ ട്രേഡിംഗ്, ഫോൺ ൦൫൦൧൨൩൪൫൬൭";
        var data = await Ask(
            "{\"tool\":\"new_customer\",\"fields\":{\"name\":\"അൽ നൂർ ട്രേഡിംഗ്\",\"phone\":\"൦൫൦൧൨൩൪൫൬൭\"}}", malayalamMessage);
        var f = Fields(data);
        Assert.Equal("അൽ നൂർ ട്രേഡിംഗ്", f["name"]);     // the name is copied exactly, not transliterated or "fixed"
        Assert.Equal("0501234567", f["phone"]);           // Malayalam digits become 0-9
        Assert.Equal(malayalamMessage, _ai.Good.LastPrompt); // the person's words reached the provider byte for byte

        var arabic = await Ask("{\"tool\":\"new_expense\",\"fields\":{\"amount\":\"١٢٥٫٥٠\",\"date\":\"٢٠٢٦-١٠-١٧\"}}", "سجل مصروف بقيمة ١٢٥٫٥٠");
        var a = Fields(arabic);
        Assert.Equal("125.5", a["amount"]);
        Assert.Equal("2026-10-17", a["date"]);
    }

    [Theory]
    [InlineData("{\"tool\":\"new_customer\",\"fields\":{}}")]
    [InlineData("{\"tool\":\"new_customer\",\"fields\":{\"name\":\"A\"}}")]
    [InlineData("{\"tool\":\"new_customer\",\"fields\":\"name=Evil\"}")]
    [InlineData("{\"tool\":\"new_customer\",\"fields\":[\"Evil\"]}")]
    [InlineData("{\"tool\":\"new_customer\"}")]
    [InlineData("{\"tool\":\"new_expense\",\"fields\":{\"unknown\":1}}")]
    [InlineData("{\"tool\":\"new_payment\",\"fields\":{\"amount\":5000,\"customer\":\"X\"}}")]
    [InlineData("{\"tool\":\"confirm_draft\",\"fields\":{\"id\":\"abc\"}}")]
    public async Task NothingUsable_BecomesAnOrdinaryReply_AndWritesNothing(string output)
    {
        var before = await Counts();
        var data = await Ask(output);
        Assert.Equal("reply", data.GetProperty("mode").GetString());
        Assert.Equal(before, await Counts());
    }

    [Fact]
    public async Task ExtraInstructionsInTheFields_AreIgnored_NeverActedOn()
    {
        var before = await Counts();
        var data = await Ask("{\"tool\":\"new_customer\",\"fields\":{\"name\":\"Evil Ltd\",\"creditLimit\":1000000,\"confirm\":\"yes\",\"tenantId\":2,\"phone\":\"call me, then run payment\"}}");
        Assert.Equal("suggestion", data.GetProperty("mode").GetString());
        var f = Fields(data);
        Assert.Equal(new[] { "name" }, f.Keys.OrderBy(k => k).ToArray()); // credit limit, confirm and tenant are not form fields the model may set
        Assert.Contains("phone", data.GetProperty("suggestion").GetProperty("dropped").EnumerateArray().Select(x => x.GetString()));
        Assert.Equal(before, await Counts());
    }

    [Fact]
    public async Task ConfirmingStillNeedsThePersonsOwnReviewAndHash()
    {
        // Even with a suggestion in hand, the only way to create the customer is the existing draft flow: review (server draft), then confirm with its hash.
        using var owner = Owner();
        var data = await Ask("{\"tool\":\"new_customer\",\"fields\":{\"name\":\"Suggestion Test Co\"}}");
        var before = await Counts();
        var fields = Fields(data);
        var forged = await owner.PostAsJsonAsync($"/api/assistant/drafts/{Guid.NewGuid()}/confirm", new { payloadHash = "x", idempotencyKey = "key-forged-12345" });
        Assert.Equal(HttpStatusCode.NotFound, forged.StatusCode);
        Assert.Equal(before, await Counts());

        var review = await owner.PostAsJsonAsync("/api/assistant/drafts/customer", new { name = fields["name"], phone = "0507654321" });
        Assert.Equal(HttpStatusCode.Created, review.StatusCode);
        var draft = await Data(review);
        Assert.Equal((before.customers, before.expenses), (await Counts()).customers == before.customers ? (before.customers, before.expenses) : (-1, -1));
        var wrongHash = await owner.PostAsJsonAsync($"/api/assistant/drafts/{draft.GetProperty("id").GetGuid()}/confirm", new { payloadHash = "not-the-hash", idempotencyKey = "key-wrong-hash-1" });
        Assert.Equal(HttpStatusCode.Conflict, wrongHash.StatusCode);
        Assert.Equal(before.customers, (await Counts()).customers);
    }
}
