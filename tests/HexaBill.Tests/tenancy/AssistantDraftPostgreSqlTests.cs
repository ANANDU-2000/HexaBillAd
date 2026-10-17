using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HexaBill.Tests;

/// <summary>Draft confirm is exactly-once on PostgreSQL too (claim by conditional update, unique idempotency key, retrying execution strategy).</summary>
[Collection("HttpPostgresIntegration")]
public class AssistantDraftPostgreSqlTests
{
    private readonly HttpPostgresIntegrationFixture _fixture;

    public AssistantDraftPostgreSqlTests(HttpPostgresIntegrationFixture fixture) => _fixture = fixture;

    private static async Task<(Guid id, string hash)> Propose(HttpClient client, string name)
    {
        var response = await client.PostAsJsonAsync("/api/assistant/drafts/customer", new { name, phone = "0501112222" });
        Assert.True(response.StatusCode == HttpStatusCode.Created, $"{(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        var data = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
        Assert.Equal(0, data.GetProperty("errors").GetArrayLength());
        return (data.GetProperty("id").GetGuid(), data.GetProperty("payloadHash").GetString()!);
    }

    private static Task<HttpResponseMessage> Confirm(HttpClient client, Guid id, string hash, string key) =>
        client.PostAsJsonAsync($"/api/assistant/drafts/{id}/confirm", new { payloadHash = hash, idempotencyKey = key });

    [SkippableFact]
    public async Task Confirm_IsExactlyOnce_UnderConcurrency_AndReplaysWithTheSameKey_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);
        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var name = "PG Draft Buyer " + Guid.NewGuid().ToString("N")[..8];
        var (id, hash) = await Propose(client, name);

        var results = await Task.WhenAll(Enumerable.Range(0, 4).Select(i => Confirm(client, id, hash, $"pg-draft-{Guid.NewGuid():N}")));
        Assert.Equal(1, results.Count(r => r.StatusCode == HttpStatusCode.OK));
        Assert.All(results.Where(r => r.StatusCode != HttpStatusCode.OK), r => Assert.Equal(HttpStatusCode.Conflict, r.StatusCode));

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(1, await db.Customers.IgnoreQueryFilters().CountAsync(c => c.TenantId == factory.TenantAId && c.Name == name));

        // The winner's key replays the same answer; a fresh key is refused.
        var winnerKey = (await db.AssistantDrafts.IgnoreQueryFilters().AsNoTracking().FirstAsync(d => d.Id == id)).IdempotencyKey!;
        var replay = await Confirm(client, id, hash, winnerKey);
        Assert.Equal(HttpStatusCode.OK, replay.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Confirm(client, id, hash, $"pg-draft-{Guid.NewGuid():N}")).StatusCode);
        Assert.Equal(1, await db.Customers.IgnoreQueryFilters().CountAsync(c => c.TenantId == factory.TenantAId && c.Name == name));
    }

    [SkippableFact]
    public async Task OtherCompany_CannotConfirmTheDraft_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);
        using var a = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        using var b = HttpIntegrationClient.Create(factory, factory.TenantBId, factory.TenantBId, factory.SlugB);
        var name = "PG Draft Isolation " + Guid.NewGuid().ToString("N")[..8];
        var (id, hash) = await Propose(a, name);
        Assert.Equal(HttpStatusCode.NotFound, (await Confirm(b, id, hash, $"pg-draft-{Guid.NewGuid():N}")).StatusCode);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(0, await db.Customers.IgnoreQueryFilters().CountAsync(c => c.Name == name));
    }

    [SkippableFact]
    public async Task ExpenseConfirm_IsExactlyOnce_UnderConcurrency_AndOtherCompanyIsRefused_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);
        using var a = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        using var b = HttpIntegrationClient.Create(factory, factory.TenantBId, factory.TenantBId, factory.SlugB);
        var marker = "pg-draft-exp-" + Guid.NewGuid().ToString("N")[..10];
        var proposed = await a.PostAsJsonAsync("/api/assistant/drafts/expense",
            new { categoryId = factory.ExpenseCategoryAId, amount = 19.995, date = DateTime.UtcNow.ToString("yyyy-MM-dd"), note = marker });
        Assert.True(proposed.StatusCode == HttpStatusCode.Created, $"{(int)proposed.StatusCode}: {await proposed.Content.ReadAsStringAsync()}");
        var data = (await proposed.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
        var id = data.GetProperty("id").GetGuid();
        var hash = data.GetProperty("payloadHash").GetString()!;
        Assert.Equal(20.00m, data.GetProperty("fields").GetProperty("amount").GetDecimal()); // half rounds up

        Assert.Equal(HttpStatusCode.NotFound, (await Confirm(b, id, hash, $"pg-draft-{Guid.NewGuid():N}")).StatusCode);

        var results = await Task.WhenAll(Enumerable.Range(0, 4).Select(i => Confirm(a, id, hash, $"pg-draft-{Guid.NewGuid():N}")));
        Assert.Equal(1, results.Count(r => r.StatusCode == HttpStatusCode.OK));
        Assert.All(results.Where(r => r.StatusCode != HttpStatusCode.OK), r => Assert.Equal(HttpStatusCode.Conflict, r.StatusCode));

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var rows = await db.Expenses.IgnoreQueryFilters().Where(e => e.Note == marker).ToListAsync();
        var row = Assert.Single(rows);
        Assert.Equal(factory.TenantAId, row.TenantId);
        Assert.Equal(20.00m, row.Amount);
    }

    [SkippableFact]
    public async Task ExpenseConfirm_ClosedDayAndVatLockedPeriod_AreRefusedWithNothingWritten_ThenWorkOnceReopened_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);
        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var closedDay = new DateTime(2026, 9, 16, 0, 0, 0, DateTimeKind.Utc);
        var lockedDay = new DateTime(2026, 7, 21, 0, 0, 0, DateTimeKind.Utc);
        int closeId, periodId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var close = new HexaBill.Api.Models.DailyCashClose
            {
                TenantId = factory.TenantAId, OwnerId = factory.TenantAId, BusinessDate = closedDay, Version = 1,
                Status = HexaBill.Api.Models.DailyCashCloseStatus.Closed, OpeningCash = 0, ExpectedCash = 0, CountedCash = 0, Variance = 0,
                CreatedByUserId = factory.TenantAId, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow, ClosedAt = DateTime.UtcNow, ClosedByUserId = factory.TenantAId,
            };
            var period = new HexaBill.Api.Models.VatReturnPeriod
            {
                TenantId = factory.TenantAId, PeriodType = "Monthly", PeriodLabel = "PG-UX-LOCK", PeriodStart = lockedDay, PeriodEnd = lockedDay.AddDays(1).AddTicks(-1),
                DueDate = lockedDay.AddDays(28), Status = "Locked", LockedAt = DateTime.UtcNow, LockedByUserId = factory.TenantAId,
            };
            db.DailyCashCloses.Add(close);
            db.VatReturnPeriods.Add(period);
            await db.SaveChangesAsync();
            closeId = close.Id;
            periodId = period.Id;
        }

        async Task<(Guid id, string hash)> ProposeOn(string date, string note)
        {
            var response = await client.PostAsJsonAsync("/api/assistant/drafts/expense",
                new { categoryId = factory.ExpenseCategoryAId, amount = 15, date, note });
            Assert.True(response.StatusCode == HttpStatusCode.Created, $"{(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
            var data = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
            return (data.GetProperty("id").GetGuid(), data.GetProperty("payloadHash").GetString()!);
        }

        async Task<int> CountWith(string note)
        {
            using var scope = factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            return await db.Expenses.IgnoreQueryFilters().CountAsync(e => e.Note == note);
        }

        try
        {
            var closedNote = "pg-draft-closed-" + Guid.NewGuid().ToString("N")[..8];
            var lockedNote = "pg-draft-vatlock-" + Guid.NewGuid().ToString("N")[..8];
            var (closedId, closedHash) = await ProposeOn("2026-09-16", closedNote);
            var (lockedId, lockedHash) = await ProposeOn("2026-07-21", lockedNote);

            var closedRefused = await Confirm(client, closedId, closedHash, $"pg-draft-{Guid.NewGuid():N}");
            Assert.Equal(HttpStatusCode.Conflict, closedRefused.StatusCode);
            Assert.Contains("closed", (await closedRefused.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("message").GetString()!, StringComparison.OrdinalIgnoreCase);
            var lockedRefused = await Confirm(client, lockedId, lockedHash, $"pg-draft-{Guid.NewGuid():N}");
            Assert.Equal(HttpStatusCode.Conflict, lockedRefused.StatusCode);
            Assert.Contains("locked", (await lockedRefused.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("message").GetString()!, StringComparison.OrdinalIgnoreCase);
            Assert.Equal(0, await CountWith(closedNote));
            Assert.Equal(0, await CountWith(lockedNote));

            using (var scope = factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                (await db.DailyCashCloses.IgnoreQueryFilters().FirstAsync(c => c.Id == closeId)).Status = HexaBill.Api.Models.DailyCashCloseStatus.Draft;
                (await db.VatReturnPeriods.IgnoreQueryFilters().FirstAsync(x => x.Id == periodId)).Status = "Draft";
                await db.SaveChangesAsync();
            }
            Assert.Equal(HttpStatusCode.OK, (await Confirm(client, closedId, closedHash, $"pg-draft-{Guid.NewGuid():N}")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await Confirm(client, lockedId, lockedHash, $"pg-draft-{Guid.NewGuid():N}")).StatusCode);
            Assert.Equal(1, await CountWith(closedNote));
            Assert.Equal(1, await CountWith(lockedNote));
        }
        finally
        {
            using var scope = factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var close = await db.DailyCashCloses.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Id == closeId);
            var period = await db.VatReturnPeriods.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == periodId);
            if (close != null) close.Status = HexaBill.Api.Models.DailyCashCloseStatus.Draft;
            if (period != null) period.Status = "Draft";
            await db.SaveChangesAsync();
        }
    }
}
