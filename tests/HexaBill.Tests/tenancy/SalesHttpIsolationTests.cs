using System.Net;
using System.Net.Http.Json;

namespace HexaBill.Tests;

[Collection("HttpIntegration")]
public class SalesHttpIsolationTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public SalesHttpIsolationTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task GetSale_OwnTenant_ReturnsSuccess()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/sales/1");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<SaleDtoStub>>();
        Assert.True(json?.Success);
        Assert.Equal(1, json?.Data?.Id);
    }

    [Fact]
    public async Task GetSale_OtherTenantsSale_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/sales/2");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetSale_TenantBCannotReadTenantASale_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var response = await client.GetAsync("/api/sales/1");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetInvoicePdf_OwnSale_ReturnsPdfBytes()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/sales/1/pdf?layout=full");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/pdf", response.Content.Headers.ContentType?.MediaType);
        var bytes = await response.Content.ReadAsByteArrayAsync();
        Assert.True(bytes.Length > 500);
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(bytes, 0, 4));
    }

    [Fact]
    public async Task GetInvoicePdf_OtherTenantsSale_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/sales/2/pdf");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PostCreateSale_CreditInvoice_ReturnsCreated()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var body = new
        {
            customerId = 1,
            items = new[] { new { productId = 1, unitType = "PIECE", qty = 1m, unitPrice = 50m } }
        };
        var response = await client.PostAsJsonAsync("/api/sales", body);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<SaleDtoStub>>();
        Assert.True(json?.Success);
        Assert.True(json?.Data?.Id > 0);
        Assert.False(string.IsNullOrWhiteSpace(json?.Data?.InvoiceNo));
    }

    [Fact]
    public async Task PostCreateSale_TenantBCannotUseTenantAProduct_ReturnsBadRequest()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var body = new
        {
            customerId = 2,
            items = new[] { new { productId = 1, unitType = "PIECE", qty = 1m, unitPrice = 50m } }
        };
        var response = await client.PostAsJsonAsync("/api/sales", body);
        Assert.True(response.StatusCode == HttpStatusCode.BadRequest || response.StatusCode == HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task NewSalePartialPaymentJourney_CreateSalePayPdfLedgerReceipt()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var saleBody = new
        {
            customerId = 1,
            items = new[] { new { productId = 1, unitType = "PIECE", qty = 1m, unitPrice = 100m } }
        };
        var saleResponse = await client.PostAsJsonAsync("/api/sales", saleBody);
        Assert.Equal(HttpStatusCode.Created, saleResponse.StatusCode);
        var saleJson = await saleResponse.Content.ReadFromJsonAsync<ApiEnvelope<SaleDtoStub>>();
        var saleId = saleJson!.Data!.Id;
        var invoiceNo = saleJson.Data!.InvoiceNo ?? saleId.ToString();
        var grandTotal = saleJson.Data.GrandTotal ?? 100m;
        var partialPay = 40m;

        var pdfResponse = await client.GetAsync($"/api/sales/{saleId}/pdf?layout=full");
        Assert.Equal(HttpStatusCode.OK, pdfResponse.StatusCode);

        var payBody = new { saleId, customerId = 1, amount = partialPay, mode = "CASH", reference = $"journey-{saleId}" };
        var payMessage = new HttpRequestMessage(HttpMethod.Post, "/api/payments") { Content = JsonContent.Create(payBody) };
        payMessage.Headers.TryAddWithoutValidation("Idempotency-Key", $"sale-journey-{Guid.NewGuid():N}");
        var payResponse = await client.SendAsync(payMessage);
        Assert.Equal(HttpStatusCode.Created, payResponse.StatusCode);
        var payJson = await payResponse.Content.ReadFromJsonAsync<ApiEnvelope<CreatePaymentStub>>();
        var paymentId = payJson!.Data!.Payment!.Id;
        Assert.Equal("Partial", payJson.Data!.Invoice?.Status, StringComparer.OrdinalIgnoreCase);
        Assert.Equal(partialPay, payJson.Data.Invoice?.PaidAmount);
        Assert.Equal(grandTotal - partialPay, payJson.Data.Invoice?.OutstandingAmount);

        var saleAfterPay = await client.GetAsync($"/api/sales/{saleId}");
        var saleAfterJson = await saleAfterPay.Content.ReadFromJsonAsync<ApiEnvelope<SaleAfterPayStub>>();
        Assert.Equal("Partial", saleAfterJson?.Data?.PaymentStatus, StringComparer.OrdinalIgnoreCase);
        Assert.Equal(partialPay, saleAfterJson?.Data?.PaidAmount);

        var ledgerResponse = await client.GetAsync("/api/customers/1/ledger");
        Assert.Equal(HttpStatusCode.OK, ledgerResponse.StatusCode);

        var idsResponse = await client.GetAsync($"/api/payments/receipt/invoice/{saleId}/payment-ids");
        var idsJson = await idsResponse.Content.ReadFromJsonAsync<ApiEnvelope<List<int>>>();
        Assert.Contains(paymentId, idsJson!.Data!);

        var receiptResponse = await client.PostAsync($"/api/payments/{paymentId}/receipt", null);
        Assert.Equal(HttpStatusCode.OK, receiptResponse.StatusCode);
    }

    [Fact]
    public async Task PostCreateSale_Fin07_InvoiceSavedWhenPdfFails_GetPdfRetrySucceedsWithoutDuplicateSale()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        try
        {
            HttpTestPdfService.SetFailNextInvoicePdfGenerations(1);
            var body = new
            {
                customerId = 1,
                items = new[] { new { productId = 1, unitType = "PIECE", qty = 1m, unitPrice = 77.77m } }
            };
            var create = await client.PostAsJsonAsync("/api/sales", body);
            Assert.Equal(HttpStatusCode.Created, create.StatusCode);
            var saleJson = await create.Content.ReadFromJsonAsync<ApiEnvelope<SaleDtoStub>>();
            var saleId = saleJson!.Data!.Id;
            var invoiceNo = saleJson.Data!.InvoiceNo;
            var grandTotal = saleJson.Data!.GrandTotal;

            var getSale = await client.GetAsync($"/api/sales/{saleId}");
            Assert.Equal(HttpStatusCode.OK, getSale.StatusCode);

            var pdfResponse = await client.GetAsync($"/api/sales/{saleId}/pdf?layout=full");
            Assert.Equal(HttpStatusCode.OK, pdfResponse.StatusCode);
            var bytes = await pdfResponse.Content.ReadAsByteArrayAsync();
            Assert.True(bytes.Length > 500);
            Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(bytes, 0, 4));

            var pdfRetry = await client.GetAsync($"/api/sales/{saleId}/pdf?layout=full");
            Assert.Equal(HttpStatusCode.OK, pdfRetry.StatusCode);

            var create2 = await client.PostAsJsonAsync("/api/sales", new
            {
                customerId = 1,
                items = new[] { new { productId = 1, unitType = "PIECE", qty = 1m, unitPrice = 10m } }
            });
            Assert.Equal(HttpStatusCode.Created, create2.StatusCode);
            var sale2Json = await create2.Content.ReadFromJsonAsync<ApiEnvelope<SaleDtoStub>>();
            Assert.NotEqual(saleId, sale2Json!.Data!.Id);

            var getAgain = await client.GetAsync($"/api/sales/{saleId}");
            var againJson = await getAgain.Content.ReadFromJsonAsync<ApiEnvelope<SaleDtoStub>>();
            Assert.Equal(invoiceNo, againJson?.Data?.InvoiceNo);
            Assert.Equal(grandTotal, againJson?.Data?.GrandTotal);
        }
        finally
        {
            HttpTestPdfService.SetFailNextInvoicePdfGenerations(0);
        }
    }

    [Fact(DisplayName = "Journey_CreditSaleThenFullPay_PdfLedgerReceipt")]
    public async Task CreditSaleThenFullPayJourney_CreatePendingPaySettlePdfLedgerReceipt()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var saleResponse = await client.PostAsJsonAsync("/api/sales", new
        {
            customerId = 1,
            items = new[] { new { productId = 1, unitType = "PIECE", qty = 2m, unitPrice = 55m } }
        });
        Assert.Equal(HttpStatusCode.Created, saleResponse.StatusCode);
        var saleId = (await saleResponse.Content.ReadFromJsonAsync<ApiEnvelope<SaleDtoStub>>())!.Data!.Id;

        var saleDetail = await (await client.GetAsync($"/api/sales/{saleId}")).Content
            .ReadFromJsonAsync<ApiEnvelope<SaleDetailJourneyStub>>();
        var grandTotal = saleDetail!.Data!.GrandTotal;
        Assert.Equal("Pending", saleDetail.Data!.PaymentStatus, StringComparer.OrdinalIgnoreCase);
        Assert.Equal(0m, saleDetail.Data!.PaidAmount);

        var payMessage = new HttpRequestMessage(HttpMethod.Post, "/api/payments")
        {
            Content = JsonContent.Create(new { saleId, customerId = 1, amount = grandTotal, mode = "CASH", reference = $"credit-full-{saleId}" })
        };
        payMessage.Headers.TryAddWithoutValidation("Idempotency-Key", $"credit-full-{Guid.NewGuid():N}");
        var payResponse = await client.SendAsync(payMessage);
        Assert.Equal(HttpStatusCode.Created, payResponse.StatusCode);
        var payJson = await payResponse.Content.ReadFromJsonAsync<ApiEnvelope<CreatePaymentStub>>();
        Assert.Equal("Paid", payJson!.Data!.Invoice?.Status, StringComparer.OrdinalIgnoreCase);
        var paymentId = payJson.Data!.Payment!.Id;

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/sales/{saleId}/pdf?layout=full")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/customers/1/ledger")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync($"/api/payments/{paymentId}/receipt", null)).StatusCode);
    }

    [Fact]
    public async Task PartialInvoiceJourney_PdfLedgerAndReceiptPaymentIds()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");

        var saleResponse = await client.GetAsync("/api/sales/1");
        Assert.Equal(HttpStatusCode.OK, saleResponse.StatusCode);

        var pdfResponse = await client.GetAsync("/api/sales/1/pdf?layout=full");
        Assert.Equal(HttpStatusCode.OK, pdfResponse.StatusCode);

        var ledgerResponse = await client.GetAsync("/api/customers/1/ledger");
        Assert.Equal(HttpStatusCode.OK, ledgerResponse.StatusCode);

        var idsResponse = await client.GetAsync("/api/payments/receipt/invoice/1/payment-ids");
        Assert.Equal(HttpStatusCode.OK, idsResponse.StatusCode);
        var idsJson = await idsResponse.Content.ReadFromJsonAsync<ApiEnvelope<List<int>>>();
        Assert.Equal(new[] { 1 }, idsJson!.Data);
    }

    private sealed class ApiEnvelope<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
    }

    private sealed class SaleDtoStub
    {
        public int Id { get; set; }
        public string? InvoiceNo { get; set; }
        public decimal? GrandTotal { get; set; }
    }

    private sealed class CreatePaymentStub
    {
        public PaymentIdStub? Payment { get; set; }
        public InvoiceSummaryJourneyStub? Invoice { get; set; }
    }

    private sealed class InvoiceSummaryJourneyStub
    {
        public decimal PaidAmount { get; set; }
        public decimal OutstandingAmount { get; set; }
        public string? Status { get; set; }
    }

    private sealed class SaleAfterPayStub
    {
        public decimal PaidAmount { get; set; }
        public string? PaymentStatus { get; set; }
    }

    private sealed class SaleDetailJourneyStub
    {
        public decimal GrandTotal { get; set; }
        public decimal PaidAmount { get; set; }
        public string? PaymentStatus { get; set; }
    }

    private sealed class PaymentIdStub
    {
        public int Id { get; set; }
    }
}
