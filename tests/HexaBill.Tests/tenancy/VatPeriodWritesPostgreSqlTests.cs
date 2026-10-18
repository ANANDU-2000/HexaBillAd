using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HexaBill.Tests;

/// <summary>
/// VAT period writes must work under the production database policy. Program.cs enables Npgsql
/// EnableRetryOnFailure, which rejects a transaction the code opens outside the execution strategy; SQLite hides that.
/// Live symptom: "VAT management report calculation failed" on Recalculate.
/// </summary>
[Collection("HttpPostgresIntegration")]
public class VatPeriodWritesPostgreSqlTests
{
    private readonly HttpPostgresIntegrationFixture _fixture;

    public VatPeriodWritesPostgreSqlTests(HttpPostgresIntegrationFixture fixture) => _fixture = fixture;

    [SkippableFact]
    public async Task Calculate_Review_Submit_Amend_DoNotFail_UnderTheProductionRetryPolicy()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);
        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);

        // FTA quarter Feb-Apr 2025: a full supported period with no overlap with other fixtures.
        var calculate = await client.PostAsJsonAsync("/api/reports/vat-return/calculate",
            new { from = "2025-02-01", to = "2025-04-30" });
        Assert.True(calculate.StatusCode == HttpStatusCode.OK,
            $"calculate returned {(int)calculate.StatusCode}: {await calculate.Content.ReadAsStringAsync()}");

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var periodId = await db.VatReturnPeriods.IgnoreQueryFilters()
            .Where(p => p.TenantId == factory.TenantAId && p.PeriodStart.Year == 2025 && p.PeriodStart.Month == 2)
            .Select(p => p.Id).SingleAsync();

        var review = await client.PostAsync($"/api/reports/vat-return/periods/{periodId}/review", null);
        Assert.True(review.StatusCode == HttpStatusCode.OK,
            $"review returned {(int)review.StatusCode}: {await review.Content.ReadAsStringAsync()}");

        // Not frozen yet, so these are business refusals (409), never a server error.
        var submit = await client.PostAsync($"/api/reports/vat-return/periods/{periodId}/submit", null);
        Assert.Equal(HttpStatusCode.Conflict, submit.StatusCode);
        var amend = await client.PostAsJsonAsync($"/api/reports/vat-return/periods/{periodId}/amend", new { reason = "Synthetic amend check" });
        Assert.Equal(HttpStatusCode.Conflict, amend.StatusCode);

        // Lock enters the same transaction path; a missing or sample TRN is a 422, a valid one freezes. Neither is a 500.
        var lockResponse = await client.PostAsync($"/api/reports/vat-return/periods/{periodId}/lock", null);
        Assert.True((int)lockResponse.StatusCode is 200 or 409 or 422,
            $"lock returned {(int)lockResponse.StatusCode}: {await lockResponse.Content.ReadAsStringAsync()}");
    }
}
