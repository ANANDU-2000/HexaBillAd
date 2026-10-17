using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using HexaBill.Api.Data;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HexaBill.Tests;

/// <summary>Expense drafts: a financial write goes through review, hash-checked confirm, exactly-once execution and the normal scope rules.</summary>
[Collection("HttpIntegration")]
public class AssistantExpenseDraftHttpTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public AssistantExpenseDraftHttpTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    private HttpClient Owner(int tenantId, string slug) => HttpIntegrationClient.Create(_factory, tenantId, slug);

    private HttpClient Staff(int tenantId, string slug)
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            BaseAddress = new Uri($"http://{slug}.hexabill.company"),
        });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer", TestJwtFactory.CreateAuthenticatedApiToken(tenantId, tenantId, slug, role: "Staff"));
        return client;
    }

    private static string Key() => "key-" + Guid.NewGuid().ToString("N");
    private static string Marker() => "draft-exp-" + Guid.NewGuid().ToString("N")[..10];
    private static string Today() => DateTime.UtcNow.ToString("yyyy-MM-dd");

    private async Task<(int count, decimal total)> ExpensesWith(int tenantId, string marker)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var rows = await db.Expenses.IgnoreQueryFilters().Where(e => e.TenantId == tenantId && e.Note == marker).ToListAsync();
        return (rows.Count, rows.Sum(e => e.Amount));
    }

    private async Task<int> StoredDrafts(int tenantId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.AssistantDrafts.IgnoreQueryFilters().CountAsync(d => d.TenantId == tenantId);
    }

    private static async Task<JsonElement> Body(HttpResponseMessage r) => await r.Content.ReadFromJsonAsync<JsonElement>();

    private static async Task<(Guid id, string hash, JsonElement data)> Propose(HttpClient client, object payload)
    {
        var response = await client.PostAsJsonAsync("/api/assistant/drafts/expense", payload);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var data = (await Body(response)).GetProperty("data");
        return (data.GetProperty("id").GetGuid(), data.GetProperty("payloadHash").GetString()!, data);
    }

    private static Task<HttpResponseMessage> Confirm(HttpClient client, Guid id, string hash, string key) =>
        client.PostAsJsonAsync($"/api/assistant/drafts/{id}/confirm", new { payloadHash = hash, idempotencyKey = key });

    [Fact]
    public async Task Draft_ChangesNothing_AndShowsTheCategoryNameAndRoundedAmount()
    {
        var marker = Marker();
        using var client = Owner(1, "tenanta");
        var (_, hash, data) = await Propose(client, new { categoryId = 1, amount = 12.345, date = Today(), note = "  " + marker + "  " });
        var fields = data.GetProperty("fields");
        Assert.Equal("Cat A", fields.GetProperty("categoryName").GetString());
        Assert.Equal(12.35m, fields.GetProperty("amount").GetDecimal());
        Assert.Equal(marker, fields.GetProperty("note").GetString());
        Assert.Equal(64, hash.Length);
        Assert.Equal((0, 0m), await ExpensesWith(1, marker));
    }

    [Fact]
    public async Task InvalidFields_AreShownPerField_NothingIsStored()
    {
        using var client = Owner(1, "tenanta");
        var before = await StoredDrafts(1);
        var response = await client.PostAsJsonAsync("/api/assistant/drafts/expense", new { categoryId = 0, amount = 0, date = "yesterday-ish", note = new string('x', 600) });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var data = (await Body(response)).GetProperty("data");
        Assert.Equal("Invalid", data.GetProperty("status").GetString());
        var names = data.GetProperty("errors").EnumerateArray().Select(e => e.GetProperty("field").GetString()).ToHashSet();
        Assert.Superset(new HashSet<string?> { "categoryId", "amount", "date", "note" }, names);
        Assert.Equal(before, await StoredDrafts(1));
    }

    [Theory]
    [InlineData(-5)]
    [InlineData(100000000)]
    public async Task OutOfRangeAmounts_AreRefused(double amount)
    {
        using var client = Owner(1, "tenanta");
        var response = await client.PostAsJsonAsync("/api/assistant/drafts/expense", new { categoryId = 1, amount, date = Today() });
        var data = (await Body(response)).GetProperty("data");
        Assert.Equal("Invalid", data.GetProperty("status").GetString());
        Assert.Contains(data.GetProperty("errors").EnumerateArray(), e => e.GetProperty("field").GetString() == "amount");
    }

    [Fact]
    public async Task FutureDate_IsRefused()
    {
        using var client = Owner(1, "tenanta");
        var future = DateTime.UtcNow.AddDays(30).ToString("yyyy-MM-dd");
        var response = await client.PostAsJsonAsync("/api/assistant/drafts/expense", new { categoryId = 1, amount = 10, date = future });
        var data = (await Body(response)).GetProperty("data");
        Assert.Contains(data.GetProperty("errors").EnumerateArray(), e => e.GetProperty("field").GetString() == "date");
    }

    [Fact]
    public async Task AnotherCompanysCategory_IsNotAccepted()
    {
        using var b = Owner(2, "tenantb");
        var response = await b.PostAsJsonAsync("/api/assistant/drafts/expense", new { categoryId = 1, amount = 10, date = Today() }); // category 1 belongs to tenant A
        var data = (await Body(response)).GetProperty("data");
        Assert.Equal("Invalid", data.GetProperty("status").GetString());
        Assert.Contains(data.GetProperty("errors").EnumerateArray(), e => e.GetProperty("field").GetString() == "categoryId");
    }

    [Fact]
    public async Task Confirm_CreatesExactlyOneApprovedExpense_InTheCallersCompany()
    {
        var marker = Marker();
        using var client = Owner(1, "tenanta");
        var (id, hash, _) = await Propose(client, new { categoryId = 1, amount = 42.5, date = Today(), note = marker });
        var response = await Confirm(client, id, hash, Key());
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = (await Body(response)).GetProperty("data").GetProperty("result");
        Assert.True(result.GetProperty("expenseId").GetInt32() > 0);
        Assert.Equal(42.5m, result.GetProperty("amount").GetDecimal());
        Assert.Equal((1, 42.5m), await ExpensesWith(1, marker));
        Assert.Equal((0, 0m), await ExpensesWith(2, marker));
    }

    [Fact]
    public async Task SameKey_Replays_AnotherKeyIsRefused_AndConcurrentConfirmsCreateOne()
    {
        var marker = Marker();
        using var client = Owner(1, "tenanta");
        var (id, hash, _) = await Propose(client, new { categoryId = 1, amount = 10, date = Today(), note = marker });
        var key = Key();
        var results = await Task.WhenAll(new[] { key, Key(), Key(), Key() }.Select(k => Confirm(client, id, hash, k)));
        Assert.Equal(1, results.Count(r => r.StatusCode == HttpStatusCode.OK));
        Assert.All(results.Where(r => r.StatusCode != HttpStatusCode.OK), r => Assert.Equal(HttpStatusCode.Conflict, r.StatusCode));
        Assert.Equal((1, 10m), await ExpensesWith(1, marker));

        // Whichever request won, its key replays the stored answer without a second expense.
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var winnerKey = (await db.AssistantDrafts.IgnoreQueryFilters().AsNoTracking().FirstAsync(d => d.Id == id)).IdempotencyKey!;
        Assert.Equal(HttpStatusCode.OK, (await Confirm(client, id, hash, winnerKey)).StatusCode);
        Assert.Equal((1, 10m), await ExpensesWith(1, marker));
    }

    [Fact]
    public async Task WrongHash_IsRefused_NothingCreated()
    {
        var marker = Marker();
        using var client = Owner(1, "tenanta");
        var (id, _, _) = await Propose(client, new { categoryId = 1, amount = 10, date = Today(), note = marker });
        Assert.Equal(HttpStatusCode.Conflict, (await Confirm(client, id, new string('b', 64), Key())).StatusCode);
        Assert.Equal((0, 0m), await ExpensesWith(1, marker));
    }

    [Fact]
    public async Task OtherCompany_CannotConfirmTheDraft()
    {
        var marker = Marker();
        using var a = Owner(1, "tenanta");
        using var b = Owner(2, "tenantb");
        var (id, hash, _) = await Propose(a, new { categoryId = 1, amount = 10, date = Today(), note = marker });
        Assert.Equal(HttpStatusCode.NotFound, (await Confirm(b, id, hash, Key())).StatusCode);
        Assert.Equal((0, 0m), await ExpensesWith(1, marker));
        Assert.Equal((0, 0m), await ExpensesWith(2, marker));
    }

    [Fact]
    public async Task Staff_WithoutAnAssignedBranch_IsRefusedLikeTheNormalScreen_AndTheDraftStaysUsable()
    {
        var marker = Marker();
        using var staff = Staff(1, "tenanta");
        var (id, hash, _) = await Propose(staff, new { categoryId = 1, amount = 10, date = Today(), note = marker });
        var first = await Confirm(staff, id, hash, Key());
        Assert.Equal(HttpStatusCode.Conflict, first.StatusCode);
        Assert.Contains("branch", (await Body(first)).GetProperty("message").GetString()!, StringComparison.OrdinalIgnoreCase);
        // A refusal before anything was written reopens the draft, so it is not stuck as "being confirmed".
        var second = await Confirm(staff, id, hash, Key());
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        Assert.Contains("branch", (await Body(second)).GetProperty("message").GetString()!, StringComparison.OrdinalIgnoreCase);
        Assert.Equal((0, 0m), await ExpensesWith(1, marker));
    }

    [Fact]
    public async Task Confirm_WritesAnAuditRow_WithoutTheNoteOrAmount()
    {
        var marker = Marker();
        using var client = Owner(1, "tenanta");
        var (id, hash, _) = await Propose(client, new { categoryId = 1, amount = 77.77, date = Today(), note = marker });
        await Confirm(client, id, hash, Key());
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var row = await db.AuditLogs.IgnoreQueryFilters().FirstOrDefaultAsync(a => a.TenantId == 1 && a.Action == "AssistantDraftConfirmed" && a.Details!.Contains(id.ToString()));
        Assert.NotNull(row);
        Assert.DoesNotContain(marker, row!.Details);
        Assert.DoesNotContain("77.77", row.Details);
        Assert.Contains("kind=expense.create", row.Details);
    }

    [Fact]
    public async Task ClosedBusinessDay_RefusesConfirm_WritesNothing_AndTheSameDraftWorksOnceTheDayIsReopened()
    {
        var marker = Marker();
        // A date no other test uses, so closing it here cannot affect them.
        var day = new DateTime(2026, 9, 15, 0, 0, 0, DateTimeKind.Utc);
        int closeId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var close = new HexaBill.Api.Models.DailyCashClose
            {
                TenantId = 1, OwnerId = 1, BusinessDate = day, Version = 1, Status = HexaBill.Api.Models.DailyCashCloseStatus.Closed,
                OpeningCash = 0, ExpectedCash = 0, CountedCash = 0, Variance = 0, CreatedByUserId = 1,
                CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow, ClosedAt = DateTime.UtcNow, ClosedByUserId = 1,
            };
            db.DailyCashCloses.Add(close);
            await db.SaveChangesAsync();
            closeId = close.Id;
        }

        using var client = Owner(1, "tenanta");
        var (id, hash, _) = await Propose(client, new { categoryId = 1, amount = 30, date = "2026-09-15", note = marker });

        var refused = await Confirm(client, id, hash, Key());
        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
        Assert.Contains("closed", (await Body(refused)).GetProperty("message").GetString()!, StringComparison.OrdinalIgnoreCase);
        Assert.Equal((0, 0m), await ExpensesWith(1, marker));
        // The refusal happened before any write, so the draft is not stuck as "being confirmed".
        var again = await Confirm(client, id, hash, Key());
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        Assert.Contains("closed", (await Body(again)).GetProperty("message").GetString()!, StringComparison.OrdinalIgnoreCase);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var close = await db.DailyCashCloses.IgnoreQueryFilters().FirstAsync(c => c.Id == closeId);
            close.Status = HexaBill.Api.Models.DailyCashCloseStatus.Draft; // reopened
            await db.SaveChangesAsync();
        }
        var ok = await Confirm(client, id, hash, Key());
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.Equal((1, 30m), await ExpensesWith(1, marker));
    }

    [Fact]
    public async Task VatLockedPeriod_RefusesConfirm_WritesNothing_AndTheSameDraftWorksOnceUnlocked()
    {
        var marker = Marker();
        // A one-day period no other test posts into.
        var day = new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc);
        int periodId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var period = new HexaBill.Api.Models.VatReturnPeriod
            {
                TenantId = 1, PeriodType = "Monthly", PeriodLabel = "UX-LOCK", PeriodStart = day, PeriodEnd = day.AddDays(1).AddTicks(-1),
                DueDate = day.AddDays(28), Status = "Locked", LockedAt = DateTime.UtcNow, LockedByUserId = 1,
            };
            db.VatReturnPeriods.Add(period);
            await db.SaveChangesAsync();
            periodId = period.Id;
        }

        try
        {
            using var client = Owner(1, "tenanta");
            var (id, hash, _) = await Propose(client, new { categoryId = 1, amount = 25, date = "2026-07-20", note = marker });

            var refused = await Confirm(client, id, hash, Key());
            Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
            Assert.Contains("locked", (await Body(refused)).GetProperty("message").GetString()!, StringComparison.OrdinalIgnoreCase);
            Assert.Equal((0, 0m), await ExpensesWith(1, marker));

            using (var scope = _factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var period = await db.VatReturnPeriods.IgnoreQueryFilters().FirstAsync(p => p.Id == periodId);
                period.Status = "Draft"; // unlocked (amended) by the owner through the normal VAT screens
                await db.SaveChangesAsync();
            }
            var ok = await Confirm(client, id, hash, Key());
            Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
            Assert.Equal((1, 25m), await ExpensesWith(1, marker));
        }
        finally
        {
            // Leave no locked period behind for other tests.
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var period = await db.VatReturnPeriods.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == periodId);
            if (period != null) { period.Status = "Draft"; await db.SaveChangesAsync(); }
        }
    }
}
