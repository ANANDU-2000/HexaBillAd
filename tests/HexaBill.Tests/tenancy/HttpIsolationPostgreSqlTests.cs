using System.Net;
using System.Net.Http.Json;
using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HexaBill.Tests;

/// <summary>
/// HTTP pipeline tenant isolation on PostgreSQL (not SQLite). Skips when HEXABILL_TEST_POSTGRES is unset.
/// </summary>
[Collection("HttpPostgresIntegration")]
public class HttpIsolationPostgreSqlTests
{
    private readonly HttpPostgresIntegrationFixture _fixture;

    public HttpIsolationPostgreSqlTests(HttpPostgresIntegrationFixture fixture) => _fixture = fixture;

    [SkippableFact]
    public async Task ConcurrentVoid_RetainsPaymentAndRetryIdentity_AndAuditsOnce_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);
        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var key = $"pg-concurrent-void-{Guid.NewGuid():N}";
        var body = new { customerId = factory.CustomerAId, amount = 7m, mode = "CASH", reference = key };
        var created = await PostPaymentAsync(client, body, key);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var payload = await created.Content.ReadFromJsonAsync<ApiEnvelope<CreatePaymentResponseStub>>();
        var id = payload!.Data!.Payment!.Id;

        var responses = await Task.WhenAll(client.DeleteAsync($"/api/payments/{id}"), client.DeleteAsync($"/api/payments/{id}"));
        Assert.All(responses, response => Assert.Equal(HttpStatusCode.OK, response.StatusCode));
        var retained = await client.GetFromJsonAsync<ApiEnvelope<PaymentStub>>($"/api/payments/{id}");
        Assert.Equal(7m, retained!.Data!.Amount);
        Assert.Equal("VOID", retained.Data.Status, StringComparer.OrdinalIgnoreCase);
        var retry = await PostPaymentAsync(client, body, key);
        Assert.Equal(HttpStatusCode.Created, retry.StatusCode);
        var retried = await retry.Content.ReadFromJsonAsync<ApiEnvelope<CreatePaymentResponseStub>>();
        Assert.Equal(id, retried!.Data!.Payment!.Id);
        Assert.Equal("VOID", retried.Data.Payment.Status, StringComparer.OrdinalIgnoreCase);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var marker = $"\"PaymentId\":{id},";
        Assert.Equal(1, await db.AuditLogs.IgnoreQueryFilters().CountAsync(a => a.TenantId == factory.TenantAId
            && a.Action == "Payment Voided" && a.Details != null && a.Details.Contains(marker)));
        using var other = HttpIntegrationClient.Create(factory, factory.TenantBId, factory.TenantBId, factory.SlugB);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/payments/{id}")).StatusCode);
    }

    [SkippableFact]
    public async Task GetCustomer_OwnTenant_ReturnsSuccess_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var response = await client.GetAsync($"/api/customers/{factory.CustomerAId}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<CustomerStub>>();
        Assert.True(json?.Success);
        Assert.Equal(factory.CustomerAId, json?.Data?.Id);
    }

    [SkippableFact]
    public async Task GetCustomer_CrossTenant_ReturnsNotFound_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var response = await client.GetAsync($"/api/customers/{factory.CustomerBId}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [SkippableFact]
    public async Task GetPayment_CrossTenant_ReturnsNotFound_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var response = await client.GetAsync($"/api/payments/{factory.PaymentBId}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [SkippableFact]
    public async Task GetCustomer_TenantBCannotReadTenantA_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantBId, factory.TenantBId, factory.SlugB);
        var response = await client.GetAsync($"/api/customers/{factory.CustomerAId}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [SkippableFact]
    public async Task GetInvoicePdf_OwnSale_ReturnsPdf_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var response = await client.GetAsync($"/api/sales/{factory.SaleAId}/pdf?layout=full");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var bytes = await response.Content.ReadAsByteArrayAsync();
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(bytes, 0, 4));
    }

    [SkippableFact]
    public async Task GetSale_CrossTenant_ReturnsNotFound_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var response = await client.GetAsync($"/api/sales/{factory.SaleBId}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [SkippableFact]
    public async Task DeleteSale_CrossTenant_ReturnsNotFound_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var response = await client.DeleteAsync($"/api/sales/{factory.SaleBId}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [SkippableFact]
    public async Task PutUpdateSale_CrossTenant_ReturnsNotFound_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var body = new
        {
            customerId = factory.CustomerAId,
            editReason = "PG cross-tenant probe",
            items = new[] { new { productId = factory.ProductAId, unitType = "PIECE", qty = 1m, unitPrice = 50m } }
        };
        var response = await client.PutAsJsonAsync($"/api/sales/{factory.SaleBId}", body);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [SkippableFact]
    public async Task GetCompanySettings_ReturnsOwnTenantTrn_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var response = await client.GetAsync("/api/settings/company");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ServiceResponseStub<CompanyStub>>();
        Assert.True(json?.Success);
        Assert.Equal($"{factory.TenantAId:D15}", json?.Data?.VatNumber);
        Assert.DoesNotContain(factory.TenantBId.ToString(), json?.Data?.VatNumber ?? string.Empty);
    }

    [SkippableFact]
    public async Task GetTenantLogo_CrossTenant_ReturnsForbidden_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var response = await client.GetAsync($"/api/storage/tenants/{factory.TenantBId}/logos/secret.png");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [SkippableFact]
    public async Task GetReceiptByPayment_CrossTenant_ReturnsNotFound_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var response = await client.GetAsync($"/api/payments/receipt/by-payment/{factory.PaymentBId}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [SkippableFact]
    public async Task GetCustomerReceipts_CrossTenant_ReturnsNotFound_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var response = await client.GetAsync($"/api/payments/customers/{factory.CustomerBId}/receipts");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [SkippableFact]
    public async Task GetQuotation_CrossTenant_ReturnsNotFound_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var response = await client.GetAsync($"/api/quotations/{factory.QuotationBId}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [SkippableFact]
    public async Task GetQuotation_OwnTenant_ReturnsSuccess_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var response = await client.GetAsync($"/api/quotations/{factory.QuotationAId}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<QuotationStub>>();
        Assert.True(json?.Success);
        Assert.Equal(factory.QuotationAId, json?.Data?.Id);
    }

    [SkippableFact]
    public async Task GetInvoiceReceiptPaymentIds_CrossTenant_ReturnsBadRequest_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var response = await client.GetAsync($"/api/payments/receipt/invoice/{factory.SaleBId}/payment-ids");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [SkippableFact]
    public async Task GetInvoiceReceiptPaymentIds_OwnSale_ReturnsPaymentId_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var response = await client.GetAsync($"/api/payments/receipt/invoice/{factory.SaleAId}/payment-ids");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<List<int>>>();
        Assert.True(json?.Success);
        Assert.Equal(new[] { factory.PaymentAId }, json!.Data);
        Assert.DoesNotContain(factory.PaymentAdjustmentAId, json.Data!);
    }

    [SkippableFact]
    public async Task BillingHistoryReceiptJourney_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var saleResponse = await client.GetAsync($"/api/sales/{factory.SaleAId}");
        Assert.Equal(HttpStatusCode.OK, saleResponse.StatusCode);

        var idsResponse = await client.GetAsync($"/api/payments/receipt/invoice/{factory.SaleAId}/payment-ids");
        Assert.Equal(HttpStatusCode.OK, idsResponse.StatusCode);
        var idsJson = await idsResponse.Content.ReadFromJsonAsync<ApiEnvelope<List<int>>>();
        Assert.Equal(new[] { factory.PaymentAId }, idsJson!.Data);

        var receiptResponse = await client.PostAsync($"/api/payments/{factory.PaymentAId}/receipt", null);
        Assert.Equal(HttpStatusCode.OK, receiptResponse.StatusCode);
        var receiptJson = await receiptResponse.Content.ReadFromJsonAsync<ApiEnvelope<ReceiptGenerateStub>>();
        Assert.True(receiptJson?.Success);
        Assert.False(string.IsNullOrWhiteSpace(receiptJson?.Data?.ReceiptNumber));
    }

    [SkippableFact]
    public async Task ReceiptPreviewThenPdfDownload_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var preview = await client.PostAsync($"/api/payments/{factory.PaymentAId}/receipt", null);
        Assert.Equal(HttpStatusCode.OK, preview.StatusCode);
        var previewJson = await preview.Content.ReadFromJsonAsync<ApiEnvelope<ReceiptPostEnvelope>>();
        var fingerprint = previewJson?.Data?.Detail?.DocumentFingerprint;
        Assert.False(string.IsNullOrWhiteSpace(fingerprint));

        var pdfBody = new { paymentIds = new[] { factory.PaymentAId }, expectedDocumentFingerprint = fingerprint };
        var pdfResponse = await client.PostAsJsonAsync("/api/payments/receipt/pdf", pdfBody);
        Assert.Equal(HttpStatusCode.OK, pdfResponse.StatusCode);
        var bytes = await pdfResponse.Content.ReadAsByteArrayAsync();
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(bytes, 0, 4));
    }

    [SkippableFact]
    public async Task PostGenerateReceipt_SettlementAdjustment_ReturnsBadRequest_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var response = await client.PostAsync($"/api/payments/{factory.PaymentAdjustmentAId}/receipt", null);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [SkippableFact]
    public async Task GetSalaryCertificate_CrossTenant_ReturnsNotFound_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var response = await client.GetAsync($"/api/salary-certificates/{factory.SalaryCertificateBId}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [SkippableFact]
    public async Task GetAgreement_CrossTenant_ReturnsNotFound_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var response = await client.GetAsync($"/api/agreements/{factory.AgreementBId}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [SkippableFact]
    public async Task DeleteRecurringInvoice_CrossTenant_ReturnsNotFound_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var response = await client.DeleteAsync($"/api/RecurringInvoices/{factory.RecurringInvoiceBId}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [SkippableFact]
    public async Task PostCreatePayment_CrossTenantSale_ReturnsBadRequest_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var body = new { saleId = factory.SaleBId, customerId = factory.CustomerAId, amount = 10m, mode = "CASH" };
        var response = await PostPaymentAsync(client, body);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [SkippableFact]
    public async Task PostCreatePayment_CrossTenantCustomerWithoutSale_ReturnsBadRequest_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var body = new { customerId = factory.CustomerBId, amount = 10m, mode = "CASH" };
        var response = await PostPaymentAsync(client, body);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [SkippableFact]
    public async Task PutUpdatePayment_CrossTenant_ReturnsNotFound_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var body = new { amount = 40m, mode = "CASH" };
        var response = await client.PutAsJsonAsync($"/api/payments/{factory.PaymentBId}", body);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [SkippableFact]
    public async Task DeletePayment_CrossTenant_ReturnsNotFound_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var response = await client.DeleteAsync($"/api/payments/{factory.PaymentBId}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [SkippableFact]
    public async Task GetPurchase_OwnTenant_ReturnsSuccess_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var response = await client.GetAsync($"/api/purchases/{factory.PurchaseAId}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [SkippableFact]
    public async Task GetPurchase_CrossTenant_ReturnsNotFound_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var response = await client.GetAsync($"/api/purchases/{factory.PurchaseBId}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [SkippableFact]
    public async Task DeletePurchase_CrossTenant_ReturnsNotFound_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var response = await client.DeleteAsync($"/api/purchases/{factory.PurchaseBId}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [SkippableFact]
    public async Task PutUpdatePurchase_CrossTenant_ReturnsNotFound_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var body = new
        {
            supplierName = "PG Sup B",
            invoiceNo = "PG-PB-HACK",
            purchaseDate = DateTime.UtcNow,
            items = new[] { new { productId = factory.ProductAId, unitType = "PIECE", qty = 1m, unitCost = 10m } }
        };
        var response = await client.PutAsJsonAsync($"/api/purchases/{factory.PurchaseBId}", body);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [SkippableFact]
    public async Task PostCreatePayment_UnpaidOwnSale_ReturnsCreated_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var body = new
        {
            saleId = factory.SaleUnpaidAId,
            customerId = factory.CustomerAId,
            amount = 20m,
            mode = "CASH",
            reference = "pg-http-partial"
        };
        var response = await PostPaymentAsync(client, body, $"pg-pay-{Guid.NewGuid():N}");
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<CreatePaymentResponseStub>>();
        Assert.True(json?.Success);
        Assert.Equal(20m, json?.Data?.Payment?.Amount);
        Assert.Equal(factory.SaleUnpaidAId, json?.Data?.Payment?.SaleId);
    }

    [SkippableFact]
    public async Task GetExpense_CrossTenant_ReturnsNotFound_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var response = await client.GetAsync($"/api/expenses/{factory.ExpenseBId}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [SkippableFact]
    public async Task PostCreateExpense_CrossTenantCategory_ReturnsBadRequest_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantBId, factory.TenantBId, factory.SlugB);
        var response = await client.PostAsJsonAsync("/api/expenses", new
        {
            categoryId = factory.ExpenseCategoryAId,
            amount = 15m,
            date = DateTime.UtcNow,
            withVat = false,
            paidFrom = "Cash"
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [SkippableFact]
    public async Task PetrolCashExpense_DailyClosePreviewDelta_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);
        const decimal petrolAmount = 75m;
        var businessDate = DateTime.UtcNow.Date;
        var expenseAt = businessDate.AddHours(10).AddMinutes(30);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var dateQuery = businessDate.ToString("yyyy-MM-dd");
        var before = await client.GetAsync($"/api/daily-close/preview?businessDate={dateQuery}&openingCash=0");
        Assert.Equal(HttpStatusCode.OK, before.StatusCode);
        var beforeJson = await before.Content.ReadFromJsonAsync<ApiEnvelope<DailyClosePreviewStub>>();
        Assert.True(beforeJson?.Success);
        var beforePreview = beforeJson!.Data!;

        var create = await client.PostAsJsonAsync("/api/expenses", new
        {
            categoryId = factory.ExpenseCategoryAId,
            amount = petrolAmount,
            date = expenseAt,
            note = "Petrol PG HTTP",
            withVat = false,
            paidFrom = "Cash",
            taxType = "Petroleum"
        });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);

        var after = await client.GetAsync($"/api/daily-close/preview?businessDate={dateQuery}&openingCash=0");
        Assert.Equal(HttpStatusCode.OK, after.StatusCode);
        var afterJson = await after.Content.ReadFromJsonAsync<ApiEnvelope<DailyClosePreviewStub>>();
        Assert.True(afterJson?.Success);
        var afterPreview = afterJson!.Data!;

        Assert.Equal(beforePreview.ExpenseCount + 1, afterPreview.ExpenseCount);
        Assert.Equal(beforePreview.CollectionsCashPaidOut + petrolAmount, afterPreview.CollectionsCashPaidOut);
        Assert.Equal(beforePreview.ExpectedCash - petrolAmount, afterPreview.ExpectedCash);
    }

    [SkippableFact]
    public async Task DailyCloseSubmit_MatchedVariance_LocksDay_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);
        const string businessDate = "2026-11-20";
        const decimal openingCash = 200m;
        const decimal petrolAmount = 75m;
        var expenseAt = new DateTime(2026, 11, 20, 9, 0, 0, DateTimeKind.Utc);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);

        var create = await client.PostAsJsonAsync("/api/expenses", new
        {
            categoryId = factory.ExpenseCategoryAId,
            amount = petrolAmount,
            date = expenseAt,
            note = "Petrol PG close submit",
            withVat = false,
            paidFrom = "Cash",
            taxType = "Petroleum"
        });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);

        var previewResp = await client.GetAsync($"/api/daily-close/preview?businessDate={businessDate}&openingCash={openingCash}");
        Assert.Equal(HttpStatusCode.OK, previewResp.StatusCode);
        var previewJson = await previewResp.Content.ReadFromJsonAsync<ApiEnvelope<DailyClosePreviewStub>>();
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

    [SkippableFact]
    public async Task DailyCloseSubmit_WithVarianceReason_LocksDay_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);
        const string businessDate = "2026-11-21";
        const decimal openingCash = 100m;
        const decimal countedShort = 95m;

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);

        var previewResp = await client.GetAsync($"/api/daily-close/preview?businessDate={businessDate}&openingCash={openingCash}");
        Assert.Equal(HttpStatusCode.OK, previewResp.StatusCode);
        var previewJson = await previewResp.Content.ReadFromJsonAsync<ApiEnvelope<DailyClosePreviewStub>>();
        var expectedCash = previewJson!.Data!.ExpectedCash;

        var missingReason = await client.PostAsJsonAsync("/api/daily-close", new
        {
            businessDate = new DateTime(2026, 11, 21, 0, 0, 0, DateTimeKind.Utc),
            openingCash,
            countedCash = countedShort,
            submitClose = true
        });
        Assert.Equal(HttpStatusCode.BadRequest, missingReason.StatusCode);

        var save = await client.PostAsJsonAsync("/api/daily-close", new
        {
            businessDate = new DateTime(2026, 11, 21, 0, 0, 0, DateTimeKind.Utc),
            openingCash,
            countedCash = countedShort,
            varianceReason = "PG counted till short",
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

    [SkippableFact(DisplayName = "FIN11_ProductCostEdit_ProfitUnchangedAfterCostEdit_OnPostgreSql")]
    public async Task ProductCostSnapshot_ProfitUnchangedAfterCostEdit_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);
        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var sku = $"PGC-{Guid.NewGuid():N}"[..12];
        var from = DateTime.UtcNow.Date;
        var to = from.AddDays(1);

        async Task<decimal> GetCogsAsync()
        {
            var response = await client.GetAsync($"/api/profit/report?fromDate={from:O}&toDate={to:O}");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<ProfitReportStub>>();
            Assert.True(json?.Success);
            return json!.Data!.CostOfGoodsSold;
        }

        var cogsBefore = await GetCogsAsync();
        var createProduct = await client.PostAsJsonAsync("/api/products", new
        {
            sku,
            nameEn = "PG cost snapshot",
            unitType = "PIECE",
            conversionToBase = 1m,
            costPrice = 40m,
            sellPrice = 60m,
            stockQty = 100m
        });
        Assert.Equal(HttpStatusCode.Created, createProduct.StatusCode);
        var productId = (await createProduct.Content.ReadFromJsonAsync<ApiEnvelope<ProductIdStub>>())!.Data!.Id;

        var saleResponse = await client.PostAsJsonAsync("/api/sales", new
        {
            customerId = factory.CustomerAId,
            items = new[] { new { productId, unitType = "PIECE", qty = 2m, unitPrice = 60m } }
        });
        Assert.Equal(HttpStatusCode.Created, saleResponse.StatusCode);

        var cogsAfterSale = await GetCogsAsync();
        Assert.Equal(cogsBefore + 80m, cogsAfterSale);

        var update = await client.PutAsJsonAsync($"/api/products/{productId}", new
        {
            sku,
            nameEn = "PG cost snapshot",
            unitType = "PIECE",
            conversionToBase = 1m,
            costPrice = 99m,
            sellPrice = 60m,
            stockQty = 98m
        });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);

        Assert.Equal(cogsAfterSale, await GetCogsAsync());
    }

    [SkippableFact]
    public async Task PostCreatePayment_Fin01Settlement_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);
        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var body = new
        {
            saleId = factory.SaleFin01AId,
            customerId = factory.CustomerAId,
            amount = 1330m,
            settlementAdjustmentAmount = 1m,
            settlementAdjustmentReason = "PG FIN01 shortfall",
            mode = "CASH",
            reference = "pg-fin01"
        };
        var createResponse = await PostPaymentAsync(client, body, $"pg-fin01-{Guid.NewGuid():N}");
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<ApiEnvelope<CreatePaymentResponseStub>>();
        Assert.Equal(1330m, created!.Data!.Payment!.Amount);
        Assert.Equal(1m, created.Data.SettlementAdjustment!.Amount);
        Assert.Equal("Paid", created.Data.Invoice?.Status, StringComparer.OrdinalIgnoreCase);

        var idsResponse = await client.GetAsync($"/api/payments/receipt/invoice/{factory.SaleFin01AId}/payment-ids");
        var idsJson = await idsResponse.Content.ReadFromJsonAsync<ApiEnvelope<List<int>>>();
        Assert.Equal(new[] { created.Data.Payment.Id }, idsJson!.Data);
    }

    [SkippableFact]
    public async Task PostCreatePayment_Fin02LeaveDue_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);
        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var body = new
        {
            saleId = factory.SaleFin02LeaveAId,
            customerId = factory.CustomerAId,
            amount = 1330m,
            mode = "CASH",
            reference = "pg-fin02-leave"
        };
        var createResponse = await PostPaymentAsync(client, body, $"pg-fin02-{Guid.NewGuid():N}");
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<ApiEnvelope<CreatePaymentResponseStub>>();
        Assert.Null(created!.Data!.SettlementAdjustment);
        Assert.Equal(1330m, created.Data.Invoice?.PaidAmount);
        Assert.Equal(1m, created.Data.Invoice?.OutstandingAmount);
        Assert.Equal("Partial", created.Data.Invoice?.Status, StringComparer.OrdinalIgnoreCase);
    }

    [SkippableFact]
    public async Task PostCreatePayment_Fin05_ChequeLifecycle_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);
        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var (saleId, grandTotal) = await CreatePgSaleAsync(client, factory, 75m);
        var balanceAfterSale = await GetCustomerBalanceAsync(client, factory.CustomerAId);

        var create = await PostPaymentAsync(client, new
        {
            saleId,
            customerId = factory.CustomerAId,
            amount = grandTotal,
            mode = "CHEQUE",
            reference = "PG-CHQ-FIN05"
        }, $"pg-fin05-{Guid.NewGuid():N}");
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var created = await create.Content.ReadFromJsonAsync<ApiEnvelope<CreatePaymentResponseStub>>();
        Assert.Equal("PENDING", created?.Data?.Payment?.Status, StringComparer.OrdinalIgnoreCase);
        Assert.Equal(balanceAfterSale, await GetCustomerBalanceAsync(client, factory.CustomerAId));

        var paymentId = created!.Data!.Payment!.Id;
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync($"/api/payments/{paymentId}/status", new { status = "Cleared" })).StatusCode);
        var saleCleared = await client.GetAsync($"/api/sales/{saleId}");
        var saleClearedJson = await saleCleared.Content.ReadFromJsonAsync<ApiEnvelope<SaleSummaryStub>>();
        Assert.Equal(grandTotal, saleClearedJson?.Data?.PaidAmount);
        Assert.Equal(balanceAfterSale - grandTotal, await GetCustomerBalanceAsync(client, factory.CustomerAId));

        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync($"/api/payments/{paymentId}/status", new { status = "BOUNCED" })).StatusCode);
        var payReturned = await client.GetAsync($"/api/payments/{paymentId}");
        var payReturnedJson = await payReturned.Content.ReadFromJsonAsync<ApiEnvelope<PaymentStatusStub>>();
        Assert.Equal("RETURNED", payReturnedJson?.Data?.Status, StringComparer.OrdinalIgnoreCase);
        Assert.Equal(balanceAfterSale, await GetCustomerBalanceAsync(client, factory.CustomerAId));
    }

    [SkippableFact]
    public async Task PostGenerateReceipt_Fin06_ReprintPreservesFirstPayment_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);
        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var (saleId, grandTotal) = await CreatePgSaleAsync(client, factory, 50m);
        const decimal firstPay = 20m;
        const decimal secondPay = 15m;

        var firstPaymentId = (await PostPaymentAndGetIdAsync(client, saleId, factory.CustomerAId, firstPay, $"pg-fin06-1-{Guid.NewGuid():N}"));
        var firstReceipt = await client.PostAsync($"/api/payments/{firstPaymentId}/receipt", null);
        Assert.Equal(HttpStatusCode.OK, firstReceipt.StatusCode);
        var firstJson = await firstReceipt.Content.ReadFromJsonAsync<ApiEnvelope<ReceiptFin06PostStub>>();
        var firstNumber = firstJson!.Data!.ReceiptNumber;
        var firstId = firstJson.Data!.ReceiptId;
        var firstFingerprint = firstJson.Data!.Detail!.DocumentFingerprint;

        await PostPaymentAndGetIdAsync(client, saleId, factory.CustomerAId, secondPay, $"pg-fin06-2-{Guid.NewGuid():N}");

        var reprint = await client.PostAsync($"/api/payments/{firstPaymentId}/receipt", null);
        var reprintJson = await reprint.Content.ReadFromJsonAsync<ApiEnvelope<ReceiptFin06PostStub>>();
        Assert.Equal(firstNumber, reprintJson?.Data?.ReceiptNumber);
        Assert.Equal(firstId, reprintJson?.Data?.ReceiptId);
        Assert.Equal(firstFingerprint, reprintJson?.Data?.Detail?.DocumentFingerprint);
        Assert.Equal(firstPay, reprintJson?.Data?.Detail?.AmountReceived);
        Assert.Equal(grandTotal, reprintJson?.Data?.Detail?.Invoices?.Single().InvoiceTotal);
        Assert.True(reprintJson?.Data?.Detail?.IsHistoricalSnapshot);
    }

    [SkippableFact]
    public async Task PostCreateSale_Fin07_PdfFailThenRetry_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);
        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        try
        {
            HttpTestPdfService.SetFailNextInvoicePdfGenerations(1);
            var create = await client.PostAsJsonAsync("/api/sales", new
            {
                customerId = factory.CustomerAId,
                items = new[] { new { productId = factory.ProductAId, unitType = "PIECE", qty = 1m, unitPrice = 88.88m } }
            });
            Assert.Equal(HttpStatusCode.Created, create.StatusCode);
            var saleJson = await create.Content.ReadFromJsonAsync<ApiEnvelope<CreateSaleStub>>();
            var saleId = saleJson!.Data!.Id;

            var pdf = await client.GetAsync($"/api/sales/{saleId}/pdf?layout=full");
            Assert.Equal(HttpStatusCode.OK, pdf.StatusCode);
            var bytes = await pdf.Content.ReadAsByteArrayAsync();
            Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(bytes, 0, 4));
        }
        finally
        {
            HttpTestPdfService.SetFailNextInvoicePdfGenerations(0);
        }
    }

    [SkippableFact]
    public async Task DailyClose_Fin09_ReopenLateExpense_SubmitsVersionTwo_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);
        const string businessDate = "2026-11-22";
        const decimal openingCash = 120m;
        const decimal latePetrol = 35m;
        var businessAt = new DateTime(2026, 11, 22, 0, 0, 0, DateTimeKind.Utc);
        var lateExpenseAt = new DateTime(2026, 11, 22, 17, 0, 0, DateTimeKind.Utc);

        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var preview1 = await client.GetAsync($"/api/daily-close/preview?businessDate={businessDate}&openingCash={openingCash}");
        var expectedV1 = (await preview1.Content.ReadFromJsonAsync<ApiEnvelope<DailyClosePreviewStub>>())!.Data!.ExpectedCash;

        var close1 = await client.PostAsJsonAsync("/api/daily-close", new
        {
            businessDate = businessAt,
            openingCash,
            countedCash = expectedV1,
            submitClose = true
        });
        Assert.Equal(HttpStatusCode.OK, close1.StatusCode);

        var blocked = await client.PostAsJsonAsync("/api/daily-close", new
        {
            businessDate = businessAt,
            openingCash,
            countedCash = expectedV1,
            submitClose = false
        });
        Assert.Equal(HttpStatusCode.BadRequest, blocked.StatusCode);

        var reopen = await client.PostAsJsonAsync("/api/daily-close/reopen", new
        {
            businessDate = businessAt,
            reason = "PG FIN09 late expense correction"
        });
        Assert.Equal(HttpStatusCode.OK, reopen.StatusCode);

        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/expenses", new
        {
            categoryId = factory.ExpenseCategoryAId,
            amount = latePetrol,
            date = lateExpenseAt,
            note = "PG FIN09 petrol",
            withVat = false,
            paidFrom = "Cash",
            taxType = "Petroleum"
        })).StatusCode);

        var preview2 = await client.GetAsync($"/api/daily-close/preview?businessDate={businessDate}&openingCash={openingCash}");
        var expectedV2 = (await preview2.Content.ReadFromJsonAsync<ApiEnvelope<DailyClosePreviewStub>>())!.Data!.ExpectedCash;
        Assert.Equal(expectedV1 - latePetrol, expectedV2);

        var close2 = await client.PostAsJsonAsync("/api/daily-close", new
        {
            businessDate = businessAt,
            openingCash,
            countedCash = expectedV2,
            submitClose = true
        });
        var close2Json = await close2.Content.ReadFromJsonAsync<ApiEnvelope<CloseDetailPgStub>>();
        Assert.Equal("Closed", close2Json?.Data?.Status);
        Assert.Equal(2, close2Json?.Data?.Version);
    }

    [SkippableFact(DisplayName = "FIN10_CashPurchase_PostsPaidAtPurchase_OnPostgreSql")]
    public async Task PostPurchase_Fin10_CashAtPurchase_OnPostgreSql()
    {
        var factory = PostgresIntegrationSkip.RequireFactory(_fixture.Factory);
        using var client = HttpIntegrationClient.Create(factory, factory.TenantAId, factory.TenantAId, factory.SlugA);
        var supplier = $"PGF10-{Guid.NewGuid():N}"[..18];
        var invoiceNo = $"PGCA-{Guid.NewGuid():N}"[..14];

        var response = await client.PostAsJsonAsync("/api/purchases", new
        {
            supplierName = supplier,
            invoiceNo,
            purchaseDate = DateTime.UtcNow.AddMinutes(-10),
            paymentType = "Cash",
            items = new[] { new { productId = factory.ProductAId, unitType = "PIECE", qty = 2m, unitCost = 25m } }
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<PurchaseFin10Stub>>();
        Assert.True(json?.Success);
        var total = json!.Data!.TotalAmount;
        Assert.Equal("Paid", json.Data!.PaymentStatus, StringComparer.OrdinalIgnoreCase);
        Assert.Equal(total, json.Data!.PaidAmount);
    }

    private static async Task<(int SaleId, decimal GrandTotal)> CreatePgSaleAsync(
        HttpClient client, HexaBillPostgreSqlWebApplicationFactory factory, decimal unitPrice)
    {
        var response = await client.PostAsJsonAsync("/api/sales", new
        {
            customerId = factory.CustomerAId,
            items = new[] { new { productId = factory.ProductAId, unitType = "PIECE", qty = 1m, unitPrice } }
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<CreateSaleStub>>();
        return (json!.Data!.Id, json.Data.GrandTotal);
    }

    private static async Task<decimal> GetCustomerBalanceAsync(HttpClient client, int customerId)
    {
        var response = await client.GetAsync($"/api/customers/{customerId}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<CustomerBalanceStub>>();
        return json!.Data!.Balance;
    }

    private static async Task<int> PostPaymentAndGetIdAsync(
        HttpClient client, int saleId, int customerId, decimal amount, string idempotencyKey)
    {
        var response = await PostPaymentAsync(client, new
        {
            saleId,
            customerId,
            amount,
            mode = "CASH",
            reference = idempotencyKey
        }, idempotencyKey);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<CreatePaymentResponseStub>>();
        return json!.Data!.Payment!.Id;
    }

    private static async Task<HttpResponseMessage> PostPaymentAsync(HttpClient client, object body, string? idempotencyKey = null)
    {
        var message = new HttpRequestMessage(HttpMethod.Post, "/api/payments")
        {
            Content = JsonContent.Create(body)
        };
        if (!string.IsNullOrEmpty(idempotencyKey))
            message.Headers.TryAddWithoutValidation("Idempotency-Key", idempotencyKey);
        return await client.SendAsync(message);
    }

    private sealed class ApiEnvelope<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
    }

    private sealed class CustomerStub
    {
        public int Id { get; set; }
    }

    private sealed class ServiceResponseStub<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
    }

    private sealed class CompanyStub
    {
        public string? VatNumber { get; set; }
    }

    private sealed class QuotationStub
    {
        public int Id { get; set; }
    }

    private sealed class ReceiptGenerateStub
    {
        public string? ReceiptNumber { get; set; }
        public ReceiptDetailEnvelope? Detail { get; set; }
    }

    private sealed class ReceiptPostEnvelope
    {
        public ReceiptDetailEnvelope? Detail { get; set; }
    }

    private sealed class ReceiptDetailEnvelope
    {
        public string? DocumentFingerprint { get; set; }
    }

    private sealed class CreatePaymentResponseStub
    {
        public PaymentStub? Payment { get; set; }
        public PaymentStub? SettlementAdjustment { get; set; }
        public InvoiceSummaryStub? Invoice { get; set; }
    }

    private sealed class PaymentStub
    {
        public int Id { get; set; }
        public int? SaleId { get; set; }
        public decimal Amount { get; set; }
        public bool IsSettlementAdjustment { get; set; }
        public string? Status { get; set; }
    }

    private sealed class PaymentStatusStub
    {
        public string? Status { get; set; }
    }

    private sealed class SaleSummaryStub
    {
        public decimal PaidAmount { get; set; }
        public string? PaymentStatus { get; set; }
    }

    private sealed class CustomerBalanceStub
    {
        public decimal Balance { get; set; }
    }

    private sealed class CreateSaleStub
    {
        public int Id { get; set; }
        public decimal GrandTotal { get; set; }
    }

    private sealed class ReceiptFin06PostStub
    {
        public int? ReceiptId { get; set; }
        public string? ReceiptNumber { get; set; }
        public ReceiptFin06DetailStub? Detail { get; set; }
    }

    private sealed class ReceiptFin06DetailStub
    {
        public decimal AmountReceived { get; set; }
        public string? DocumentFingerprint { get; set; }
        public bool IsHistoricalSnapshot { get; set; }
        public List<ReceiptFin06InvoiceStub>? Invoices { get; set; }
    }

    private sealed class ReceiptFin06InvoiceStub
    {
        public decimal InvoiceTotal { get; set; }
        public decimal AmountApplied { get; set; }
    }

    private sealed class CloseDetailPgStub
    {
        public string? Status { get; set; }
        public int Version { get; set; }
    }

    private sealed class InvoiceSummaryStub
    {
        public decimal PaidAmount { get; set; }
        public decimal OutstandingAmount { get; set; }
        public string? Status { get; set; }
    }

    private sealed class DailyClosePreviewStub
    {
        public decimal ExpectedCash { get; set; }
        public decimal CollectionsCashPaidOut { get; set; }
        public int ExpenseCount { get; set; }
    }

    private sealed class CloseDetailStub
    {
        public string? Status { get; set; }
        public decimal Variance { get; set; }
        public decimal CountedCash { get; set; }
    }

    private sealed class CloseStatusStub
    {
        public bool IsLocked { get; set; }
    }

    private sealed class ProfitReportStub
    {
        public decimal CostOfGoodsSold { get; set; }
    }

    private sealed class ProductIdStub
    {
        public int Id { get; set; }
    }

    private sealed class PurchaseFin10Stub
    {
        public decimal TotalAmount { get; set; }
        public decimal PaidAmount { get; set; }
        public string? PaymentStatus { get; set; }
    }
}
