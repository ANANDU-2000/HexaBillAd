using System.Net;
using System.Net.Http.Json;

namespace HexaBill.Tests;

[Collection("HttpIntegration")]
public class DailyCloseHttpIsolationTests : IDisposable
{
    private const string BusinessDate = "2026-10-03";
    private readonly HexaBillWebApplicationFactory _factory;

    // Closing/reopening days must not lock the shared fixture used by unrelated
    // payment and sale tests when the fixed business date happens to be today.
    public DailyCloseHttpIsolationTests() => _factory = new HexaBillWebApplicationFactory();

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task GetHistory_ExcludesOtherTenantsCloses()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/daily-close/history");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<List<CloseStub>>>();
        Assert.True(json?.Success);
        var ids = json!.Data!.Select(c => c.Id).ToList();
        Assert.Contains(1, ids);
        Assert.DoesNotContain(2, ids);
    }

    [Fact]
    public async Task GetMovements_ExcludesOtherTenantsMovements()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync($"/api/daily-close/movements?businessDate={BusinessDate}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<List<MovementStub>>>();
        Assert.True(json?.Success);
        var ids = json!.Data!.Select(m => m.Id).ToList();
        Assert.Contains(1, ids);
        Assert.DoesNotContain(2, ids);
    }

    [Fact]
    public async Task DeleteMovement_OtherTenantsMovement_ReturnsBadRequest()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.DeleteAsync("/api/daily-close/movements/2");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PetrolCashExpense_IncreasesDailyCloseCashPaidOut_OnPreview()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        const decimal petrolAmount = 75m;
        var expenseAt = new DateTime(2026, 10, 3, 10, 30, 0, DateTimeKind.Utc);

        var before = await client.GetAsync($"/api/daily-close/preview?businessDate={BusinessDate}&openingCash=0");
        Assert.Equal(HttpStatusCode.OK, before.StatusCode);
        var beforeJson = await before.Content.ReadFromJsonAsync<ApiEnvelope<PreviewStub>>();
        Assert.True(beforeJson?.Success);
        var beforePreview = beforeJson!.Data!;

        var create = await client.PostAsJsonAsync("/api/expenses", new
        {
            categoryId = 1,
            amount = petrolAmount,
            date = expenseAt,
            note = "Petrol - HTTP journey",
            withVat = false,
            paidFrom = "Cash",
            taxType = "Petroleum"
        });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);

        var after = await client.GetAsync($"/api/daily-close/preview?businessDate={BusinessDate}&openingCash=0");
        Assert.Equal(HttpStatusCode.OK, after.StatusCode);
        var afterJson = await after.Content.ReadFromJsonAsync<ApiEnvelope<PreviewStub>>();
        Assert.True(afterJson?.Success);
        var afterPreview = afterJson!.Data!;

        Assert.Equal(beforePreview.ExpenseCount + 1, afterPreview.ExpenseCount);
        Assert.Equal(beforePreview.CollectionsCashPaidOut + petrolAmount, afterPreview.CollectionsCashPaidOut);
        Assert.Equal(beforePreview.CashPaidOut + petrolAmount, afterPreview.CashPaidOut);
        Assert.Equal(beforePreview.ExpectedCash - petrolAmount, afterPreview.ExpectedCash);
    }

    [Fact]
    public async Task PetrolCashExpense_ExpenseSummaryAndSubmitClose_MatchedVariance()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        const string businessDate = "2026-10-06";
        const decimal openingCash = 200m;
        const decimal petrolAmount = 75m;
        var expenseAt = new DateTime(2026, 10, 6, 9, 0, 0, DateTimeKind.Utc);
        var from = new DateTime(2026, 10, 6, 0, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2026, 10, 6, 23, 59, 59, DateTimeKind.Utc);

        var summaryBefore = await client.GetAsync($"/api/expenses/summary?fromDate={from:O}&toDate={to:O}");
        Assert.Equal(HttpStatusCode.OK, summaryBefore.StatusCode);
        var summaryBeforeJson = await summaryBefore.Content.ReadFromJsonAsync<ApiEnvelope<ExpenseSummaryStub>>();
        var countBefore = summaryBeforeJson?.Data?.ExpenseCount ?? 0;

        var create = await client.PostAsJsonAsync("/api/expenses", new
        {
            categoryId = 1,
            amount = petrolAmount,
            date = expenseAt,
            note = "Petrol close journey",
            withVat = false,
            paidFrom = "Cash",
            taxType = "Petroleum"
        });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);

        var list = await client.GetAsync($"/api/expenses?fromDate={from:O}&toDate={to:O}&pageSize=50");
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        var listJson = await list.Content.ReadFromJsonAsync<ApiEnvelope<PagedExpensesStub>>();
        Assert.Contains(listJson?.Data?.Items ?? [], e => e.Note == "Petrol close journey");

        var summaryAfter = await client.GetAsync($"/api/expenses/summary?fromDate={from:O}&toDate={to:O}");
        var summaryAfterJson = await summaryAfter.Content.ReadFromJsonAsync<ApiEnvelope<ExpenseSummaryStub>>();
        Assert.Equal(countBefore + 1, summaryAfterJson?.Data?.ExpenseCount);
        Assert.Equal((summaryBeforeJson?.Data?.TotalAmount ?? 0m) + petrolAmount, summaryAfterJson?.Data?.TotalAmount);

        var previewResp = await client.GetAsync($"/api/daily-close/preview?businessDate={businessDate}&openingCash={openingCash}");
        Assert.Equal(HttpStatusCode.OK, previewResp.StatusCode);
        var previewJson = await previewResp.Content.ReadFromJsonAsync<ApiEnvelope<PreviewStub>>();
        var expectedCash = previewJson!.Data!.ExpectedCash;

        var save = await client.PostAsJsonAsync("/api/daily-close", new
        {
            businessDate = expenseAt,
            openingCash,
            countedCash = expectedCash,
            submitClose = true
        });
        Assert.Equal(HttpStatusCode.OK, save.StatusCode);
        var saveJson = await save.Content.ReadFromJsonAsync<ApiEnvelope<CloseDetailStub>>();
        Assert.True(saveJson?.Success);
        Assert.Equal("Closed", saveJson?.Data?.Status);
        Assert.Equal(0m, saveJson?.Data?.Variance);
        Assert.Equal(expectedCash, saveJson?.Data?.CountedCash);

        var statusResp = await client.GetAsync($"/api/daily-close/status?businessDate={businessDate}");
        Assert.Equal(HttpStatusCode.OK, statusResp.StatusCode);
        var statusJson = await statusResp.Content.ReadFromJsonAsync<ApiEnvelope<CloseStatusStub>>();
        Assert.True(statusJson?.Data?.IsLocked);
    }

    [Fact]
    public async Task PostDailyClose_Fin09_LockedDayReopenLateExpense_SubmitsNewCloseVersion()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        const string businessDate = "2026-10-08";
        const decimal openingCash = 150m;
        const decimal latePetrol = 40m;
        var businessAt = new DateTime(2026, 10, 8, 0, 0, 0, DateTimeKind.Utc);
        var lateExpenseAt = new DateTime(2026, 10, 8, 18, 0, 0, DateTimeKind.Utc);

        var preview1 = await client.GetAsync($"/api/daily-close/preview?businessDate={businessDate}&openingCash={openingCash}");
        var expectedV1 = (await preview1.Content.ReadFromJsonAsync<ApiEnvelope<PreviewStub>>())!.Data!.ExpectedCash;

        var close1 = await client.PostAsJsonAsync("/api/daily-close", new
        {
            businessDate = businessAt,
            openingCash,
            countedCash = expectedV1,
            submitClose = true
        });
        Assert.Equal(HttpStatusCode.OK, close1.StatusCode);
        var close1Json = await close1.Content.ReadFromJsonAsync<ApiEnvelope<CloseDetailStub>>();
        Assert.Equal("Closed", close1Json?.Data?.Status);
        Assert.Equal(1, close1Json?.Data?.Version);

        var lockedStatus = await client.GetAsync($"/api/daily-close/status?businessDate={businessDate}");
        var lockedJson = await lockedStatus.Content.ReadFromJsonAsync<ApiEnvelope<CloseStatusStub>>();
        Assert.True(lockedJson?.Data?.IsLocked);
        Assert.False(lockedJson?.Data?.CanEdit);

        var blockedDraft = await client.PostAsJsonAsync("/api/daily-close", new
        {
            businessDate = businessAt,
            openingCash,
            countedCash = expectedV1,
            submitClose = false
        });
        Assert.Equal(HttpStatusCode.BadRequest, blockedDraft.StatusCode);

        var reopen = await client.PostAsJsonAsync("/api/daily-close/reopen", new
        {
            businessDate = businessAt,
            reason = "Late petrol expense after first close"
        });
        Assert.Equal(HttpStatusCode.OK, reopen.StatusCode);
        var reopenJson = await reopen.Content.ReadFromJsonAsync<ApiEnvelope<CloseDetailStub>>();
        Assert.Equal("Reopened", reopenJson?.Data?.Status);

        var editableStatus = await client.GetAsync($"/api/daily-close/status?businessDate={businessDate}");
        var editableJson = await editableStatus.Content.ReadFromJsonAsync<ApiEnvelope<CloseStatusStub>>();
        Assert.False(editableJson?.Data?.IsLocked);
        Assert.True(editableJson?.Data?.CanEdit);

        var createExpense = await client.PostAsJsonAsync("/api/expenses", new
        {
            categoryId = 1,
            amount = latePetrol,
            date = lateExpenseAt,
            note = "FIN09 late petrol",
            withVat = false,
            paidFrom = "Cash",
            taxType = "Petroleum"
        });
        Assert.Equal(HttpStatusCode.Created, createExpense.StatusCode);

        var preview2 = await client.GetAsync($"/api/daily-close/preview?businessDate={businessDate}&openingCash={openingCash}");
        var expectedV2 = (await preview2.Content.ReadFromJsonAsync<ApiEnvelope<PreviewStub>>())!.Data!.ExpectedCash;
        Assert.Equal(expectedV1 - latePetrol, expectedV2);

        var close2 = await client.PostAsJsonAsync("/api/daily-close", new
        {
            businessDate = businessAt,
            openingCash,
            countedCash = expectedV2,
            submitClose = true
        });
        Assert.Equal(HttpStatusCode.OK, close2.StatusCode);
        var close2Json = await close2.Content.ReadFromJsonAsync<ApiEnvelope<CloseDetailStub>>();
        Assert.Equal("Closed", close2Json?.Data?.Status);
        Assert.Equal(2, close2Json?.Data?.Version);
        Assert.Equal(0m, close2Json?.Data?.Variance);
    }

    [Fact]
    public async Task SubmitClose_WithVariance_RequiresReasonThenCloses()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        const string businessDate = "2026-10-07";
        const decimal openingCash = 100m;
        const decimal countedShort = 95m;

        var previewResp = await client.GetAsync($"/api/daily-close/preview?businessDate={businessDate}&openingCash={openingCash}");
        Assert.Equal(HttpStatusCode.OK, previewResp.StatusCode);
        var previewJson = await previewResp.Content.ReadFromJsonAsync<ApiEnvelope<PreviewStub>>();
        var expectedCash = previewJson!.Data!.ExpectedCash;

        var missingReason = await client.PostAsJsonAsync("/api/daily-close", new
        {
            businessDate = new DateTime(2026, 10, 7, 0, 0, 0, DateTimeKind.Utc),
            openingCash,
            countedCash = countedShort,
            submitClose = true
        });
        Assert.Equal(HttpStatusCode.BadRequest, missingReason.StatusCode);

        var save = await client.PostAsJsonAsync("/api/daily-close", new
        {
            businessDate = new DateTime(2026, 10, 7, 0, 0, 0, DateTimeKind.Utc),
            openingCash,
            countedCash = countedShort,
            varianceReason = "Counted till short",
            submitClose = true
        });
        Assert.Equal(HttpStatusCode.OK, save.StatusCode);
        var saveJson = await save.Content.ReadFromJsonAsync<ApiEnvelope<CloseDetailStub>>();
        Assert.Equal("Closed", saveJson?.Data?.Status);
        Assert.Equal(countedShort - expectedCash, saveJson?.Data?.Variance);

        var statusResp = await client.GetAsync($"/api/daily-close/status?businessDate={businessDate}");
        var statusJson = await statusResp.Content.ReadFromJsonAsync<ApiEnvelope<CloseStatusStub>>();
        Assert.True(statusJson?.Data?.IsLocked);
    }

    private sealed class ApiEnvelope<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
    }

    private sealed class CloseStub
    {
        public int Id { get; set; }
    }

    private sealed class MovementStub
    {
        public int Id { get; set; }
    }

    private sealed class PreviewStub
    {
        public decimal ExpectedCash { get; set; }
        public decimal CashPaidOut { get; set; }
        public decimal CollectionsCashPaidOut { get; set; }
        public int ExpenseCount { get; set; }
    }

    private sealed class ExpenseSummaryStub
    {
        public decimal TotalAmount { get; set; }
        public int ExpenseCount { get; set; }
    }

    private sealed class PagedExpensesStub
    {
        public List<ExpenseListItemStub>? Items { get; set; }
    }

    private sealed class ExpenseListItemStub
    {
        public string? Note { get; set; }
    }

    private sealed class CloseDetailStub
    {
        public string? Status { get; set; }
        public decimal Variance { get; set; }
        public decimal CountedCash { get; set; }
        public int Version { get; set; }
    }

    private sealed class CloseStatusStub
    {
        public bool IsLocked { get; set; }
        public bool CanEdit { get; set; }
    }
}
