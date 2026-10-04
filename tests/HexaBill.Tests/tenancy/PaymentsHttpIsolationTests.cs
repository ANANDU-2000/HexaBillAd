using System.Net;
using System.Net.Http.Json;

namespace HexaBill.Tests;

[Collection("HttpIntegration")]
public class PaymentsHttpIsolationTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public PaymentsHttpIsolationTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task GetPayment_OwnTenant_ReturnsSuccess()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/payments/1");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<PaymentDtoStub>>();
        Assert.True(json?.Success);
        Assert.Equal(1, json?.Data?.Id);
    }

    [Fact]
    public async Task GetPayment_OtherTenantsPayment_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/payments/2");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetPayment_TenantBCannotReadTenantAPayment_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var response = await client.GetAsync("/api/payments/1");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetPayment_CashLine_IsNotSettlementAdjustment()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/payments/1");
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<PaymentDtoStub>>();
        Assert.False(json?.Data?.IsSettlementAdjustment);
    }

    [Fact]
    public async Task GetPayment_AdjustmentLine_ExposesSettlementFlag()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/payments/3");
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<PaymentDtoStub>>();
        Assert.True(json?.Data?.IsSettlementAdjustment);
    }

    [Fact]
    public async Task GetReceiptByPayment_OwnTenant_ReturnsSuccess()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/payments/receipt/by-payment/1");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<ReceiptByPaymentStub>>();
        Assert.True(json?.Success);
        Assert.Equal("REC-A-1", json?.Data?.ReceiptNumber);
    }

    [Fact]
    public async Task GetReceiptByPayment_OtherTenantsPayment_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/payments/receipt/by-payment/2");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetReceiptByPayment_TenantBCannotReadTenantAPayment_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var response = await client.GetAsync("/api/payments/receipt/by-payment/1");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DownloadReceiptPdf_OtherTenantsPayment_ReturnsBadRequest()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var body = new { paymentIds = new[] { 2 }, expectedDocumentFingerprint = "any" };
        var response = await client.PostAsJsonAsync("/api/payments/receipt/pdf", body);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ReceiptPreviewThenPdfDownload_ReturnsPdfWithMatchingFingerprint()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var preview = await client.PostAsync("/api/payments/1/receipt", null);
        Assert.Equal(HttpStatusCode.OK, preview.StatusCode);
        var previewJson = await preview.Content.ReadFromJsonAsync<ApiEnvelope<ReceiptPostDataStub>>();
        var fingerprint = previewJson?.Data?.Detail?.DocumentFingerprint;
        Assert.False(string.IsNullOrWhiteSpace(fingerprint));

        var pdfBody = new { paymentIds = new[] { 1 }, expectedDocumentFingerprint = fingerprint };
        var pdfResponse = await client.PostAsJsonAsync("/api/payments/receipt/pdf", pdfBody);
        Assert.Equal(HttpStatusCode.OK, pdfResponse.StatusCode);
        Assert.Equal("application/pdf", pdfResponse.Content.Headers.ContentType?.MediaType);
        var bytes = await pdfResponse.Content.ReadAsByteArrayAsync();
        Assert.True(bytes.Length > 500);
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(bytes, 0, 4));
        Assert.Equal("no-store", pdfResponse.Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task ReceiptPdf_StaleFingerprint_ReturnsConflict()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        await client.PostAsync("/api/payments/1/receipt", null);
        var pdfBody = new { paymentIds = new[] { 1 }, expectedDocumentFingerprint = "deadbeef" };
        var pdfResponse = await client.PostAsJsonAsync("/api/payments/receipt/pdf", pdfBody);
        Assert.Equal(HttpStatusCode.Conflict, pdfResponse.StatusCode);
    }

    [Fact]
    public async Task PostGenerateReceipt_OwnTenant_ReturnsSuccess()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.PostAsync("/api/payments/1/receipt", null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<ReceiptGenerateStub>>();
        Assert.True(json?.Success);
        Assert.Equal("REC-A-1", json?.Data?.ReceiptNumber);
    }

    [Fact]
    public async Task PostGenerateReceipt_SettlementAdjustmentPayment_ReturnsBadRequest()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.PostAsync("/api/payments/3/receipt", null);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostGenerateReceipt_OtherTenantsPayment_ReturnsBadRequest()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.PostAsync("/api/payments/2/receipt", null);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostGenerateReceiptBatch_MixedTenants_ReturnsBadRequest()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var body = new { paymentIds = new[] { 1, 2 } };
        var response = await client.PostAsJsonAsync("/api/payments/receipt/batch", body);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CustomerLedgerReceiptJourney_LedgerPaymentsThenInvoiceReceipt()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");

        var ledgerResponse = await client.GetAsync("/api/customers/1/ledger");
        Assert.Equal(HttpStatusCode.OK, ledgerResponse.StatusCode);

        var paymentsResponse = await client.GetAsync("/api/payments?customerId=1&pageSize=100");
        Assert.Equal(HttpStatusCode.OK, paymentsResponse.StatusCode);
        var paymentsJson = await paymentsResponse.Content.ReadFromJsonAsync<ApiEnvelope<PagedPaymentsStub>>();
        Assert.True(paymentsJson?.Success);
        var items = paymentsJson!.Data!.Items!;
        Assert.Contains(items, p => p.Id == 1 && !p.IsSettlementAdjustment);
        Assert.Contains(items, p => p.Id == 3 && p.IsSettlementAdjustment);

        var idsResponse = await client.GetAsync("/api/payments/receipt/invoice/1/payment-ids");
        var idsJson = await idsResponse.Content.ReadFromJsonAsync<ApiEnvelope<List<int>>>();
        Assert.Equal(new[] { 1 }, idsJson!.Data);

        var receiptResponse = await client.PostAsync("/api/payments/1/receipt", null);
        Assert.Equal(HttpStatusCode.OK, receiptResponse.StatusCode);
    }

    [Fact]
    public async Task BillingHistoryReceiptJourney_SalePaymentIdsThenGenerateReceipt()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");

        var saleResponse = await client.GetAsync("/api/sales/1");
        Assert.Equal(HttpStatusCode.OK, saleResponse.StatusCode);

        var idsResponse = await client.GetAsync("/api/payments/receipt/invoice/1/payment-ids");
        Assert.Equal(HttpStatusCode.OK, idsResponse.StatusCode);
        var idsJson = await idsResponse.Content.ReadFromJsonAsync<ApiEnvelope<List<int>>>();
        Assert.True(idsJson?.Success);
        Assert.Equal(new[] { 1 }, idsJson!.Data);

        var receiptResponse = await client.PostAsync("/api/payments/1/receipt", null);
        Assert.Equal(HttpStatusCode.OK, receiptResponse.StatusCode);
        var receiptJson = await receiptResponse.Content.ReadFromJsonAsync<ApiEnvelope<ReceiptGenerateStub>>();
        Assert.True(receiptJson?.Success);
        Assert.Equal("REC-A-1", receiptJson?.Data?.ReceiptNumber);
    }

    [Fact]
    public async Task GetInvoiceReceiptPaymentIds_OwnSale_ReturnsEligiblePaymentIds()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/payments/receipt/invoice/1/payment-ids");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<List<int>>>();
        Assert.True(json?.Success);
        Assert.Equal(new[] { 1 }, json!.Data);
    }

    [Fact]
    public async Task GetInvoiceReceiptPaymentIds_ExcludesSettlementAdjustmentRows()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/payments/receipt/invoice/1/payment-ids");
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<List<int>>>();
        Assert.NotNull(json?.Data);
        Assert.DoesNotContain(3, json!.Data!);
    }

    [Fact]
    public async Task GetInvoiceReceiptPaymentIds_OtherTenantsSale_ReturnsBadRequest()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/payments/receipt/invoice/2/payment-ids");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetInvoiceReceiptPaymentIds_TenantBCannotReadTenantASale_ReturnsBadRequest()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var response = await client.GetAsync("/api/payments/receipt/invoice/1/payment-ids");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetCustomerReceipts_OwnCustomer_ReturnsTenantReceiptsOnly()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/payments/customers/1/receipts");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<List<ReceiptStub>>>();
        Assert.True(json?.Success);
        Assert.NotEmpty(json!.Data!);
        Assert.Contains(json.Data!, r => r.ReceiptNumber == "REC-A-1");
    }

    [Fact]
    public async Task GetCustomerReceipts_TenantBCannotReadTenantACustomer_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var response = await client.GetAsync("/api/payments/customers/1/receipts");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetCustomerReceipts_OtherTenantsCustomer_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/payments/customers/2/receipts");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Health_DoesNotRequireAuthentication()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task PostCreatePayment_UnpaidOwnSale_ReturnsCreatedAndUpdatesInvoice()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var body = new { saleId = 3, customerId = 1, amount = 30m, mode = "CASH", reference = "http-partial-30" };
        var response = await PostPaymentAsync(client, body, $"create-pay-30-{Guid.NewGuid():N}");
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<CreatePaymentResponseStub>>();
        Assert.True(json?.Success);
        Assert.Equal(3, json?.Data?.Payment?.SaleId);
        Assert.Equal(30m, json?.Data?.Payment?.Amount);
        Assert.False(json?.Data?.Payment?.IsSettlementAdjustment);
        Assert.Equal(30m, json?.Data?.Invoice?.PaidAmount);
        Assert.Equal(50m, json?.Data?.Invoice?.OutstandingAmount);
        Assert.Equal("Partial", json?.Data?.Invoice?.Status, StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task PostCreatePayment_OtherTenantsSale_ReturnsBadRequest()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var body = new { saleId = 2, customerId = 1, amount = 10m, mode = "CASH" };
        var response = await PostPaymentAsync(client, body);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostCreatePayment_TenantBCannotPayTenantASale_ReturnsBadRequest()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var body = new { saleId = 3, customerId = 1, amount = 10m, mode = "CASH" };
        var response = await PostPaymentAsync(client, body);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostCreatePayment_CustomerMismatchOnOwnSale_ReturnsBadRequest()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var body = new { saleId = 3, customerId = 2, amount = 10m, mode = "CASH" };
        var response = await PostPaymentAsync(client, body);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostCreatePayment_OtherTenantsCustomerWithoutSale_ReturnsBadRequest()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var body = new { customerId = 2, amount = 10m, mode = "CASH" };
        var response = await PostPaymentAsync(client, body);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostCreatePayment_IdempotencyKey_ReplaysSamePaymentWithoutDuplicate()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var key = $"idem-{Guid.NewGuid():N}";
        var body = new { saleId = 4, customerId = 1, amount = 17m, mode = "CASH", reference = "http-idem-17" };
        var first = await PostPaymentAsync(client, body, key);
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        var firstJson = await first.Content.ReadFromJsonAsync<ApiEnvelope<CreatePaymentResponseStub>>();
        var paymentId = firstJson!.Data!.Payment!.Id;

        var second = await PostPaymentAsync(client, body, key);
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        var secondJson = await second.Content.ReadFromJsonAsync<ApiEnvelope<CreatePaymentResponseStub>>();
        Assert.Equal(paymentId, secondJson?.Data?.Payment?.Id);
        Assert.Equal(17m, secondJson?.Data?.Invoice?.PaidAmount);

        var saleResponse = await client.GetAsync("/api/sales/4");
        var saleJson = await saleResponse.Content.ReadFromJsonAsync<ApiEnvelope<SaleSummaryStub>>();
        Assert.Equal(17m, saleJson?.Data?.PaidAmount);
    }

    [Fact]
    public async Task PostCreatePayment_Fin04_DuplicateClickWithoutIdempotency_ReturnsBadRequest()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var (saleId, _) = await CreateHttpTestSaleAsync(client, 80m);
        var body = new { saleId, customerId = 1, amount = 20m, mode = "CASH", reference = "fin04-dup-click" };
        var first = await PostPaymentAsync(client, body, $"fin04-a-{Guid.NewGuid():N}");
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        var duplicate = await PostPaymentAsync(client, body, $"fin04-b-{Guid.NewGuid():N}");
        Assert.Equal(HttpStatusCode.BadRequest, duplicate.StatusCode);

        var saleResponse = await client.GetAsync($"/api/sales/{saleId}");
        var saleJson = await saleResponse.Content.ReadFromJsonAsync<ApiEnvelope<SaleSummaryStub>>();
        Assert.Equal(20m, saleJson?.Data?.PaidAmount);
    }

    [Fact]
    public async Task PostCreatePayment_Fin04_DistinctIdempotencyKeys_CreateTwoPaymentsOnceEach()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var (saleId, grandTotal) = await CreateHttpTestSaleAsync(client, 100m);
        var firstBody = new { saleId, customerId = 1, amount = 25m, mode = "CASH", reference = "fin04-split-1" };
        var secondBody = new { saleId, customerId = 1, amount = 30m, mode = "CASH", reference = "fin04-split-2" };

        var first = await PostPaymentAsync(client, firstBody, $"fin04-key-1-{Guid.NewGuid():N}");
        var second = await PostPaymentAsync(client, secondBody, $"fin04-key-2-{Guid.NewGuid():N}");
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);

        var firstJson = await first.Content.ReadFromJsonAsync<ApiEnvelope<CreatePaymentResponseStub>>();
        var secondJson = await second.Content.ReadFromJsonAsync<ApiEnvelope<CreatePaymentResponseStub>>();
        Assert.NotEqual(firstJson?.Data?.Payment?.Id, secondJson?.Data?.Payment?.Id);
        Assert.Equal(55m, secondJson?.Data?.Invoice?.PaidAmount);
        Assert.Equal(grandTotal - 55m, secondJson?.Data?.Invoice?.OutstandingAmount);
    }

    [Fact]
    public async Task PostCreatePayment_Fin05_ChequePayment_PendingClearedReturned_UpdatesInvoiceAndCustomerBalance()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var (saleId, grandTotal) = await CreateHttpTestSaleAsync(client, 75m);

        var customerAfterSale = await client.GetAsync("/api/customers/1");
        Assert.Equal(HttpStatusCode.OK, customerAfterSale.StatusCode);
        var balanceAfterSale = (await customerAfterSale.Content.ReadFromJsonAsync<ApiEnvelope<CustomerBalanceStub>>())!.Data!.Balance;

        var body = new { saleId, customerId = 1, amount = grandTotal, mode = "CHEQUE", reference = "CHQ-FIN05" };
        var create = await PostPaymentAsync(client, body, $"fin05-{Guid.NewGuid():N}");
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var created = await create.Content.ReadFromJsonAsync<ApiEnvelope<CreatePaymentResponseStub>>();
        Assert.Equal("PENDING", created?.Data?.Payment?.Status, StringComparer.OrdinalIgnoreCase);
        Assert.Equal(0m, created?.Data?.Invoice?.PaidAmount);
        Assert.Equal(grandTotal, created?.Data?.Invoice?.OutstandingAmount);

        var customerAfterPending = await client.GetAsync("/api/customers/1");
        var balanceAfterPending = (await customerAfterPending.Content.ReadFromJsonAsync<ApiEnvelope<CustomerBalanceStub>>())!.Data!.Balance;
        Assert.Equal(balanceAfterSale, balanceAfterPending);

        var paymentId = created!.Data!.Payment!.Id;
        var payGet = await client.GetAsync($"/api/payments/{paymentId}");
        var payJson = await payGet.Content.ReadFromJsonAsync<ApiEnvelope<PaymentDtoStub>>();
        Assert.Equal("PENDING", payJson?.Data?.Status, StringComparer.OrdinalIgnoreCase);

        var salePending = await client.GetAsync($"/api/sales/{saleId}");
        var salePendingJson = await salePending.Content.ReadFromJsonAsync<ApiEnvelope<SaleSummaryStub>>();
        Assert.Equal(0m, salePendingJson?.Data?.PaidAmount);
        Assert.NotEqual("Paid", salePendingJson?.Data?.PaymentStatus, StringComparer.OrdinalIgnoreCase);

        var clear = await client.PutAsJsonAsync($"/api/payments/{paymentId}/status", new { status = "Cleared" });
        Assert.Equal(HttpStatusCode.OK, clear.StatusCode);

        var saleCleared = await client.GetAsync($"/api/sales/{saleId}");
        var saleClearedJson = await saleCleared.Content.ReadFromJsonAsync<ApiEnvelope<SaleSummaryStub>>();
        Assert.Equal(grandTotal, saleClearedJson?.Data?.PaidAmount);
        Assert.Equal("Paid", saleClearedJson?.Data?.PaymentStatus, StringComparer.OrdinalIgnoreCase);

        var customerAfterClear = await client.GetAsync("/api/customers/1");
        var balanceAfterClear = (await customerAfterClear.Content.ReadFromJsonAsync<ApiEnvelope<CustomerBalanceStub>>())!.Data!.Balance;
        Assert.Equal(balanceAfterSale - grandTotal, balanceAfterClear);

        var bounce = await client.PutAsJsonAsync($"/api/payments/{paymentId}/status", new { status = "BOUNCED" });
        Assert.Equal(HttpStatusCode.OK, bounce.StatusCode);

        var payReturned = await client.GetAsync($"/api/payments/{paymentId}");
        var payReturnedJson = await payReturned.Content.ReadFromJsonAsync<ApiEnvelope<PaymentDtoStub>>();
        Assert.Equal("RETURNED", payReturnedJson?.Data?.Status, StringComparer.OrdinalIgnoreCase);

        var saleReturned = await client.GetAsync($"/api/sales/{saleId}");
        var saleReturnedJson = await saleReturned.Content.ReadFromJsonAsync<ApiEnvelope<SaleSummaryStub>>();
        Assert.Equal(0m, saleReturnedJson?.Data?.PaidAmount);
        Assert.NotEqual("Paid", saleReturnedJson?.Data?.PaymentStatus, StringComparer.OrdinalIgnoreCase);

        var customerAfterBounce = await client.GetAsync("/api/customers/1");
        var balanceAfterBounce = (await customerAfterBounce.Content.ReadFromJsonAsync<ApiEnvelope<CustomerBalanceStub>>())!.Data!.Balance;
        Assert.Equal(balanceAfterSale, balanceAfterBounce);
    }

    [Fact]
    public async Task PostGenerateReceipt_Fin06_SecondPaymentOnInvoice_ReprintPreservesFirstReceiptMeaning()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var (saleId, grandTotal) = await CreateHttpTestSaleAsync(client, 50m);
        const decimal firstPaymentAmount = 20m;
        const decimal secondPaymentAmount = 15m;

        var firstPay = await PostPaymentAsync(client,
            new { saleId, customerId = 1, amount = firstPaymentAmount, mode = "CASH", reference = "fin06-pay-1" },
            $"fin06-pay-1-{Guid.NewGuid():N}");
        Assert.Equal(HttpStatusCode.Created, firstPay.StatusCode);
        var firstPayJson = await firstPay.Content.ReadFromJsonAsync<ApiEnvelope<CreatePaymentResponseStub>>();
        var firstPaymentId = firstPayJson!.Data!.Payment!.Id;

        var firstReceiptResponse = await client.PostAsync($"/api/payments/{firstPaymentId}/receipt", null);
        Assert.Equal(HttpStatusCode.OK, firstReceiptResponse.StatusCode);
        var firstReceipt = await firstReceiptResponse.Content.ReadFromJsonAsync<ApiEnvelope<ReceiptPostFin06DataStub>>();
        Assert.True(firstReceipt?.Success);
        var firstDetail = firstReceipt!.Data!.Detail!;
        Assert.Equal(firstPaymentAmount, firstDetail.AmountReceived);
        Assert.Equal(grandTotal, firstDetail.Invoices!.Single().InvoiceTotal);
        Assert.Equal(firstPaymentAmount, firstDetail.Invoices!.Single().AmountApplied);
        Assert.False(string.IsNullOrWhiteSpace(firstDetail.DocumentFingerprint));
        Assert.Null(firstDetail.PreviousBalance);
        Assert.Null(firstDetail.RemainingBalance);
        var firstReceiptNumber = firstReceipt.Data!.ReceiptNumber;
        var firstFingerprint = firstDetail.DocumentFingerprint;
        var firstReceiptId = firstReceipt.Data!.ReceiptId;
        Assert.NotNull(firstReceiptId);

        var secondPay = await PostPaymentAsync(client,
            new { saleId, customerId = 1, amount = secondPaymentAmount, mode = "CASH", reference = "fin06-pay-2" },
            $"fin06-pay-2-{Guid.NewGuid():N}");
        Assert.Equal(HttpStatusCode.Created, secondPay.StatusCode);

        var reprintResponse = await client.PostAsync($"/api/payments/{firstPaymentId}/receipt", null);
        Assert.Equal(HttpStatusCode.OK, reprintResponse.StatusCode);
        var reprint = await reprintResponse.Content.ReadFromJsonAsync<ApiEnvelope<ReceiptPostFin06DataStub>>();
        Assert.Equal(firstReceiptNumber, reprint?.Data?.ReceiptNumber);
        Assert.Equal(firstReceiptId, reprint?.Data?.ReceiptId);
        Assert.Equal(firstPaymentAmount, reprint?.Data?.Detail?.AmountReceived);
        Assert.Equal(firstFingerprint, reprint?.Data?.Detail?.DocumentFingerprint);
        Assert.True(reprint?.Data?.Detail?.IsHistoricalSnapshot);
        Assert.Equal(grandTotal, reprint?.Data?.Detail?.Invoices?.Single().InvoiceTotal);
        Assert.Equal(firstPaymentAmount, reprint?.Data?.Detail?.Invoices?.Single().AmountApplied);
        Assert.Null(reprint?.Data?.Detail?.PreviousBalance);
        Assert.Null(reprint?.Data?.Detail?.RemainingBalance);

        var byPayment = await client.GetAsync($"/api/payments/receipt/by-payment/{firstPaymentId}");
        var byPaymentJson = await byPayment.Content.ReadFromJsonAsync<ApiEnvelope<ReceiptByPaymentStub>>();
        Assert.Equal(firstReceiptNumber, byPaymentJson?.Data?.ReceiptNumber);
    }

    [Fact]
    public async Task PutUpdatePayment_OtherTenantsPayment_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var body = new { amount = 40m, mode = "CASH" };
        var response = await client.PutAsJsonAsync("/api/payments/2", body);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeletePayment_OtherTenantsPayment_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.DeleteAsync("/api/payments/2");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeletePayment_TenantBCannotDeleteTenantAPayment_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var response = await client.DeleteAsync("/api/payments/1");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PartialCreditJourney_CreatePaymentThenSaleLedgerAndReceipt()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var body = new { saleId = 6, customerId = 1, amount = 25m, mode = "CASH", reference = "http-credit-journey-25" };
        var createResponse = await PostPaymentAsync(client, body, $"credit-journey-{Guid.NewGuid():N}");
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<ApiEnvelope<CreatePaymentResponseStub>>();
        var paymentId = created!.Data!.Payment!.Id;

        var saleResponse = await client.GetAsync("/api/sales/6");
        var saleJson = await saleResponse.Content.ReadFromJsonAsync<ApiEnvelope<SaleSummaryStub>>();
        Assert.True(saleJson?.Data?.PaidAmount >= 25m);

        var ledgerResponse = await client.GetAsync("/api/customers/1/ledger");
        Assert.Equal(HttpStatusCode.OK, ledgerResponse.StatusCode);

        var receiptResponse = await client.PostAsync($"/api/payments/{paymentId}/receipt", null);
        Assert.Equal(HttpStatusCode.OK, receiptResponse.StatusCode);
    }

    [Fact]
    public async Task PostCreatePayment_Fin01Journey_1330CashPlus1Adjustment_SettlesInvoice()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var body = new
        {
            saleId = 7,
            customerId = 1,
            amount = 1330m,
            settlementAdjustmentAmount = 1m,
            settlementAdjustmentReason = "Rounding shortfall authorized",
            mode = "CASH",
            reference = "http-fin01-1330"
        };
        var createResponse = await PostPaymentAsync(client, body, $"fin01-{Guid.NewGuid():N}");
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<ApiEnvelope<CreatePaymentResponseStub>>();
        Assert.True(created?.Success);
        Assert.Equal(1330m, created!.Data!.Payment!.Amount);
        Assert.False(created.Data.Payment.IsSettlementAdjustment);
        Assert.NotNull(created.Data.SettlementAdjustment);
        Assert.Equal(1m, created.Data.SettlementAdjustment!.Amount);
        Assert.True(created.Data.SettlementAdjustment.IsSettlementAdjustment);
        var cashPaymentId = created.Data.Payment.Id;
        var adjGet = await client.GetAsync($"/api/payments/{created.Data.SettlementAdjustment.Id}");
        var adjJson = await adjGet.Content.ReadFromJsonAsync<ApiEnvelope<PaymentParentStub>>();
        Assert.Equal(cashPaymentId, adjJson?.Data?.ParentPaymentId);
        Assert.Equal(1331m, created.Data.Invoice?.PaidAmount);
        Assert.Equal(0m, created.Data.Invoice?.OutstandingAmount);
        Assert.Equal("Paid", created.Data.Invoice?.Status, StringComparer.OrdinalIgnoreCase);
        var idsResponse = await client.GetAsync("/api/payments/receipt/invoice/7/payment-ids");
        var idsJson = await idsResponse.Content.ReadFromJsonAsync<ApiEnvelope<List<int>>>();
        Assert.Equal(new[] { cashPaymentId }, idsJson!.Data);
        Assert.DoesNotContain(created.Data.SettlementAdjustment.Id, idsJson.Data!);

        var receiptResponse = await client.PostAsync($"/api/payments/{cashPaymentId}/receipt", null);
        Assert.Equal(HttpStatusCode.OK, receiptResponse.StatusCode);
        var receiptJson = await receiptResponse.Content.ReadFromJsonAsync<ApiEnvelope<ReceiptPostResponseStub>>();
        Assert.Equal(1330m, receiptJson?.Data?.Detail?.AmountReceived);
        Assert.Equal(1331m, receiptJson?.Data?.Detail?.AmountPaid);
        Assert.Equal(1m, receiptJson?.Data?.Detail?.SettlementAdjustmentAmount);
        Assert.Equal(1331m, receiptJson?.Data?.Detail?.Invoices?.Single().InvoiceTotal);
        Assert.Equal(1331m, receiptJson?.Data?.Detail?.Invoices?.Single().AmountApplied);
    }

    [Fact]
    public async Task PostCreatePayment_Fin02Journey_1330CashWithoutAdjustment_LeavesOneAedDue()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var body = new
        {
            saleId = 10,
            customerId = 1,
            amount = 1330m,
            mode = "CASH",
            reference = "http-fin02-leave-due"
        };
        var createResponse = await PostPaymentAsync(client, body, $"fin02-{Guid.NewGuid():N}");
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<ApiEnvelope<CreatePaymentResponseStub>>();
        Assert.True(created?.Success);
        Assert.Equal(1330m, created!.Data!.Payment!.Amount);
        Assert.Null(created.Data.SettlementAdjustment);
        Assert.Equal(1330m, created.Data.Invoice?.PaidAmount);
        Assert.Equal(1m, created.Data.Invoice?.OutstandingAmount);
        Assert.Equal("Partial", created.Data.Invoice?.Status, StringComparer.OrdinalIgnoreCase);

        var saleResponse = await client.GetAsync("/api/sales/10");
        var saleJson = await saleResponse.Content.ReadFromJsonAsync<ApiEnvelope<SaleSummaryStub>>();
        Assert.Equal(1330m, saleJson?.Data?.PaidAmount);
        Assert.Equal("Partial", saleJson?.Data?.PaymentStatus, StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task PostCreatePayment_Fin03_ExceedsInvoiceOutstanding_ReturnsBadRequest()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var (saleId, grandTotal) = await CreateHttpTestSaleAsync(client, 100m);
        var body = new { saleId, customerId = 1, amount = grandTotal + 1m, mode = "CASH", reference = "fin03-over" };
        var response = await PostPaymentAsync(client, body, $"fin03-over-{Guid.NewGuid():N}");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostCreatePayment_Fin03_SplitPartialPayments_SettleWithoutCashInflation()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var (saleId, grandTotal) = await CreateHttpTestSaleAsync(client, 66.67m);
        var firstAmount = 30m;
        var secondAmount = grandTotal - firstAmount;
        var first = await PostPaymentAsync(client,
            new { saleId, customerId = 1, amount = firstAmount, mode = "CASH", reference = "fin03-a" },
            $"fin03-a-{Guid.NewGuid():N}");
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        var firstJson = await first.Content.ReadFromJsonAsync<ApiEnvelope<CreatePaymentResponseStub>>();
        Assert.Equal(firstAmount, firstJson?.Data?.Invoice?.PaidAmount);
        Assert.Equal(secondAmount, firstJson?.Data?.Invoice?.OutstandingAmount);

        var second = await PostPaymentAsync(client,
            new { saleId, customerId = 1, amount = secondAmount, mode = "CASH", reference = "fin03-b" },
            $"fin03-b-{Guid.NewGuid():N}");
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        var secondJson = await second.Content.ReadFromJsonAsync<ApiEnvelope<CreatePaymentResponseStub>>();
        Assert.Equal(grandTotal, secondJson?.Data?.Invoice?.PaidAmount);
        Assert.Equal(0m, secondJson?.Data?.Invoice?.OutstandingAmount);
        Assert.Equal("Paid", secondJson?.Data?.Invoice?.Status, StringComparer.OrdinalIgnoreCase);
        Assert.Equal(secondAmount, secondJson?.Data?.Payment?.Amount);

        var third = await PostPaymentAsync(client,
            new { saleId, customerId = 1, amount = 1m, mode = "CASH" },
            $"fin03-c-{Guid.NewGuid():N}");
        Assert.Equal(HttpStatusCode.BadRequest, third.StatusCode);
    }

    [Fact]
    public async Task PostCreatePayment_Fin03_CashPlusAdjustmentCannotExceedOutstanding_ReturnsBadRequest()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var (saleId, grandTotal) = await CreateHttpTestSaleAsync(client, 57.14m);
        var body = new
        {
            saleId,
            customerId = 1,
            amount = grandTotal - 10m,
            settlementAdjustmentAmount = 15m,
            settlementAdjustmentReason = "Attempted over settle",
            mode = "CASH"
        };
        var response = await PostPaymentAsync(client, body, $"fin03-adj-{Guid.NewGuid():N}");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PutUpdatePayment_AfterFin01CashPayment_RecalculatesInvoiceToPartial()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var body = new
        {
            saleId = 9,
            customerId = 1,
            amount = 1330m,
            settlementAdjustmentAmount = 1m,
            settlementAdjustmentReason = "Update recalc test",
            mode = "CASH",
            reference = "http-fin01-upd"
        };
        var createResponse = await PostPaymentAsync(client, body, $"fin01-upd-{Guid.NewGuid():N}");
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<ApiEnvelope<CreatePaymentResponseStub>>();
        var cashId = created!.Data!.Payment!.Id;

        var update = await client.PutAsJsonAsync($"/api/payments/{cashId}", new { amount = 1320m, mode = "CASH" });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);

        var saleResponse = await client.GetAsync("/api/sales/9");
        var saleJson = await saleResponse.Content.ReadFromJsonAsync<ApiEnvelope<SaleSummaryStub>>();
        Assert.True(saleJson?.Data?.PaidAmount is > 0 and < 1331m);
        Assert.Equal("Partial", saleJson?.Data?.PaymentStatus, StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task DeletePayment_AfterFin01CashPayment_ReopensInvoiceAndRemovesPairedAdjustment()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var body = new
        {
            saleId = 8,
            customerId = 1,
            amount = 1330m,
            settlementAdjustmentAmount = 1m,
            settlementAdjustmentReason = "Delete reversal test",
            mode = "CASH",
            reference = "http-fin01-del"
        };
        var createResponse = await PostPaymentAsync(client, body, $"fin01-del-{Guid.NewGuid():N}");
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<ApiEnvelope<CreatePaymentResponseStub>>();
        var cashId = created!.Data!.Payment!.Id;
        var adjId = created.Data.SettlementAdjustment!.Id;

        var deleteResponse = await client.DeleteAsync($"/api/payments/{cashId}");
        Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);

        var getAdj = await client.GetAsync($"/api/payments/{adjId}");
        Assert.Equal(HttpStatusCode.NotFound, getAdj.StatusCode);

        var saleResponse = await client.GetAsync("/api/sales/8");
        var saleJson = await saleResponse.Content.ReadFromJsonAsync<ApiEnvelope<SaleSummaryStub>>();
        Assert.Equal(0m, saleJson?.Data?.PaidAmount);
        Assert.Equal(1331m, saleJson?.Data?.GrandTotal);
    }

    [Fact]
    public async Task PostCreatePayment_SettlementAdjustment_WhenFlagDisabled_ReturnsBadRequest()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var body = new
        {
            saleId = 2,
            customerId = 2,
            amount = 209m,
            settlementAdjustmentAmount = 1m,
            settlementAdjustmentReason = "Should be rejected",
            mode = "CASH"
        };
        var response = await PostPaymentAsync(client, body);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PostCreatePaymentPartialJourney_PaymentIdsThenReceipt()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var body = new { saleId = 5, customerId = 1, amount = 22m, mode = "CASH", reference = "http-journey-22" };
        var createResponse = await PostPaymentAsync(client, body, $"journey-22-{Guid.NewGuid():N}");
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<ApiEnvelope<CreatePaymentResponseStub>>();
        var newPaymentId = created!.Data!.Payment!.Id;

        var idsResponse = await client.GetAsync("/api/payments/receipt/invoice/5/payment-ids");
        var idsJson = await idsResponse.Content.ReadFromJsonAsync<ApiEnvelope<List<int>>>();
        Assert.Contains(newPaymentId, idsJson!.Data!);

        var receiptResponse = await client.PostAsync($"/api/payments/{newPaymentId}/receipt", null);
        Assert.Equal(HttpStatusCode.OK, receiptResponse.StatusCode);
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

    private static async Task<(int SaleId, decimal GrandTotal)> CreateHttpTestSaleAsync(HttpClient client, decimal unitPrice)
    {
        var saleBody = new
        {
            customerId = 1,
            items = new[] { new { productId = 1, unitType = "PIECE", qty = 1m, unitPrice } }
        };
        var saleResponse = await client.PostAsJsonAsync("/api/sales", saleBody);
        Assert.Equal(HttpStatusCode.Created, saleResponse.StatusCode);
        var saleJson = await saleResponse.Content.ReadFromJsonAsync<ApiEnvelope<CreateSaleStub>>();
        Assert.True(saleJson?.Data?.Id > 0);
        Assert.True(saleJson?.Data?.GrandTotal > 0);
        return (saleJson!.Data!.Id, saleJson.Data.GrandTotal);
    }

    private sealed class ApiEnvelope<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
    }

    private sealed class CreateSaleStub
    {
        public int Id { get; set; }
        public decimal GrandTotal { get; set; }
    }

    private sealed class PaymentDtoStub
    {
        public int Id { get; set; }
        public int? SaleId { get; set; }
        public decimal Amount { get; set; }
        public string? Status { get; set; }
        public bool IsSettlementAdjustment { get; set; }
    }

    private sealed class CustomerBalanceStub
    {
        public decimal Balance { get; set; }
    }

    private sealed class PaymentParentStub
    {
        public int? ParentPaymentId { get; set; }
    }

    private sealed class CreatePaymentResponseStub
    {
        public PaymentDtoStub? Payment { get; set; }
        public PaymentDtoStub? SettlementAdjustment { get; set; }
        public InvoiceSummaryStub? Invoice { get; set; }
        public CustomerBalanceStub? Customer { get; set; }
    }

    private sealed class InvoiceSummaryStub
    {
        public decimal PaidAmount { get; set; }
        public decimal OutstandingAmount { get; set; }
        public string? Status { get; set; }
    }

    private sealed class SaleSummaryStub
    {
        public decimal PaidAmount { get; set; }
        public decimal GrandTotal { get; set; }
        public string? PaymentStatus { get; set; }
    }

    private sealed class PagedPaymentsStub
    {
        public List<PaymentDtoStub>? Items { get; set; }
    }

    private sealed class ReceiptStub
    {
        public string? ReceiptNumber { get; set; }
    }

    private sealed class ReceiptByPaymentStub
    {
        public string? ReceiptNumber { get; set; }
        public int PaymentId { get; set; }
    }

    private sealed class ReceiptGenerateStub
    {
        public string? ReceiptNumber { get; set; }
        public int? ReceiptId { get; set; }
    }

    private sealed class ReceiptPostDataStub
    {
        public ReceiptDetailStub? Detail { get; set; }
    }

    private sealed class ReceiptDetailStub
    {
        public string? DocumentFingerprint { get; set; }
        public bool IsHistoricalSnapshot { get; set; }
    }

    private sealed class ReceiptPostResponseStub
    {
        public ReceiptFin01DetailStub? Detail { get; set; }
    }

    private sealed class ReceiptFin01DetailStub
    {
        public decimal AmountReceived { get; set; }
        public decimal AmountPaid { get; set; }
        public decimal? SettlementAdjustmentAmount { get; set; }
        public List<ReceiptFin01InvoiceStub>? Invoices { get; set; }
    }

    private sealed class ReceiptFin01InvoiceStub
    {
        public decimal InvoiceTotal { get; set; }
        public decimal AmountApplied { get; set; }
    }

    private sealed class ReceiptPostFin06DataStub
    {
        public ReceiptFin06DetailStub? Detail { get; set; }
        public string? ReceiptNumber { get; set; }
        public int? ReceiptId { get; set; }
    }

    private sealed class ReceiptFin06DetailStub
    {
        public decimal AmountReceived { get; set; }
        public string? DocumentFingerprint { get; set; }
        public bool IsHistoricalSnapshot { get; set; }
        public decimal? PreviousBalance { get; set; }
        public decimal? RemainingBalance { get; set; }
        public List<ReceiptFin01InvoiceStub>? Invoices { get; set; }
    }
}
