using System.Net;
using System.Net.Http.Json;

namespace HexaBill.Tests;

[Collection("HttpIntegration")]
public class PurchasesHttpIsolationTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public PurchasesHttpIsolationTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task GetPurchase_OwnTenant_ReturnsSuccess()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/purchases/1");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<PurchaseDtoStub>>();
        Assert.True(json?.Success);
        Assert.Equal(1, json?.Data?.Id);
    }

    [Fact]
    public async Task GetPurchase_OtherTenantsPurchase_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/purchases/2");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetPurchase_TenantBCannotReadTenantAPurchase_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var response = await client.GetAsync("/api/purchases/1");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PostCreatePurchase_CreditBill_ReturnsCreated()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var invoiceNo = $"PO-{Guid.NewGuid():N}".Substring(0, 18);
        var body = new
        {
            supplierName = "Sup A",
            invoiceNo,
            purchaseDate = DateTime.UtcNow,
            paymentType = "Credit",
            items = new[] { new { productId = 1, unitType = "PIECE", qty = 2m, unitCost = 10m } }
        };
        var response = await client.PostAsJsonAsync("/api/purchases", body);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<PurchaseDtoStub>>();
        Assert.True(json?.Success);
        Assert.True(json?.Data?.TotalAmount > 0);
    }

    [Fact]
    public async Task PostCreatePurchase_CrossTenantProduct_ReturnsConflictOrBadRequest()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var body = new
        {
            supplierName = "Sup B",
            invoiceNo = $"PB-X-{Guid.NewGuid():N}".Substring(0, 16),
            purchaseDate = DateTime.UtcNow,
            paymentType = "Credit",
            items = new[] { new { productId = 1, unitType = "PIECE", qty = 1m, unitCost = 10m } }
        };
        var response = await client.PostAsJsonAsync("/api/purchases", body);
        Assert.True(response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task GetSupplierBalance_SameSupplierNameDifferentTenant_Isolated()
    {
        using var clientA = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var balA = await clientA.GetAsync("/api/suppliers/balance/Sup%20A");
        var jsonA = await balA.Content.ReadFromJsonAsync<ApiEnvelope<SupplierBalanceStub>>();
        Assert.True(jsonA?.Data?.TotalPurchases >= 50m);

        using var clientB = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var balB = await clientB.GetAsync("/api/suppliers/balance/Sup%20A");
        var jsonB = await balB.Content.ReadFromJsonAsync<ApiEnvelope<SupplierBalanceStub>>();
        Assert.Equal(0m, jsonB?.Data?.TotalPurchases);
        Assert.Equal(0m, jsonB?.Data?.NetPayable);
    }

    [Fact]
    public async Task PostPurchase_Fin10_CreditCashConversionReturnAndAdjustment_ReconcilesStockAndPayable()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var supplier = $"Fin10-{Guid.NewGuid():N}"[..20];
        const decimal conversion = 6m;

        var createProduct = await client.PostAsJsonAsync("/api/products", new
        {
            sku = $"F10-{Guid.NewGuid():N}"[..12],
            nameEn = "FIN10 carton product",
            unitType = "CARTON",
            conversionToBase = conversion,
            costPrice = 2m,
            sellPrice = 5m,
            stockQty = 0m
        });
        Assert.Equal(HttpStatusCode.Created, createProduct.StatusCode);
        var productId = (await createProduct.Content.ReadFromJsonAsync<ApiEnvelope<ProductIdStub>>())!.Data!.Id;

        var balance0 = await GetSupplierBalanceAsync(client, supplier);
        var purchaseDate = DateTime.UtcNow.AddMinutes(-5);

        var cashInvoice = $"CA-{Guid.NewGuid():N}"[..16];
        var cashResp = await client.PostAsJsonAsync("/api/purchases", new
        {
            supplierName = supplier,
            invoiceNo = cashInvoice,
            purchaseDate,
            paymentType = "Cash",
            items = new[] { new { productId, unitType = "CARTON", qty = 1m, unitCost = 30m } }
        });
        Assert.Equal(HttpStatusCode.Created, cashResp.StatusCode);
        var cashJson = await cashResp.Content.ReadFromJsonAsync<ApiEnvelope<PurchaseDetailStub>>();
        var cashTotal = cashJson!.Data!.TotalAmount;
        Assert.Equal("Paid", cashJson.Data!.PaymentStatus, StringComparer.OrdinalIgnoreCase);
        Assert.Equal(cashTotal, cashJson.Data!.PaidAmount);

        var stockAfterCash = (await (await client.GetAsync($"/api/products/{productId}")).Content
            .ReadFromJsonAsync<ApiEnvelope<ProductStub>>())!.Data!.StockQty;
        Assert.Equal(conversion, stockAfterCash);

        var creditInvoice = $"CR-{Guid.NewGuid():N}"[..16];
        var creditResp = await client.PostAsJsonAsync("/api/purchases", new
        {
            supplierName = supplier,
            invoiceNo = creditInvoice,
            purchaseDate = DateTime.UtcNow,
            paymentType = "Credit",
            items = new[] { new { productId, unitType = "CARTON", qty = 1m, unitCost = 60m } }
        });
        Assert.Equal(HttpStatusCode.Created, creditResp.StatusCode);
        var creditJson = await creditResp.Content.ReadFromJsonAsync<ApiEnvelope<PurchaseDetailStub>>();
        var creditPurchaseId = creditJson!.Data!.Id;
        var creditTotal = creditJson.Data!.TotalAmount;
        var purchaseItemId = creditJson.Data!.Items!.Single().Id;
        Assert.NotEqual("Paid", creditJson.Data!.PaymentStatus, StringComparer.OrdinalIgnoreCase);

        var stockAfterCredit = (await (await client.GetAsync($"/api/products/{productId}")).Content
            .ReadFromJsonAsync<ApiEnvelope<ProductStub>>())!.Data!.StockQty;
        Assert.Equal(conversion * 2, stockAfterCredit);

        var balanceAfterCredit = await GetSupplierBalanceAsync(client, supplier);
        Assert.True(balanceAfterCredit.NetPayable >= balance0.NetPayable + creditTotal - 0.02m);
        Assert.True(balanceAfterCredit.TotalPayments >= cashTotal - 0.01m);

        var returnResp = await client.PostAsJsonAsync("/api/returns/purchases", new
        {
            purchaseId = creditPurchaseId,
            reason = "FIN10 supplier return",
            items = new[] { new { purchaseItemId, qty = 1m, reason = "Damaged carton" } }
        });
        Assert.Equal(HttpStatusCode.OK, returnResp.StatusCode);
        var returnJson = await returnResp.Content.ReadFromJsonAsync<ApiEnvelope<PurchaseReturnStub>>();
        Assert.True(returnJson?.Success);
        Assert.True(returnJson?.Data?.GrandTotal > 0);

        var stockAfterReturn = (await (await client.GetAsync($"/api/products/{productId}")).Content
            .ReadFromJsonAsync<ApiEnvelope<ProductStub>>())!.Data!.StockQty;
        Assert.Equal(conversion, stockAfterReturn);

        var adjustResp = await client.PostAsJsonAsync($"/api/products/{productId}/adjust-stock", new
        {
            changeQty = -2m,
            reason = "FIN10 damage write-off"
        });
        Assert.Equal(HttpStatusCode.OK, adjustResp.StatusCode);
        var stockAfterAdjust = (await (await client.GetAsync($"/api/products/{productId}")).Content
            .ReadFromJsonAsync<ApiEnvelope<ProductStub>>())!.Data!.StockQty;
        Assert.Equal(conversion - 2m, stockAfterAdjust);
    }

    [Fact]
    public async Task PurchaseSupplierPaymentJourney_CreateBillPayBalanceAndLedger()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var invoiceNo = $"PJ-{Guid.NewGuid():N}".Substring(0, 18);

        var productBefore = await client.GetAsync("/api/products/1");
        var productBeforeJson = await productBefore.Content.ReadFromJsonAsync<ApiEnvelope<ProductStub>>();
        var stockBefore = productBeforeJson?.Data?.StockQty ?? 0m;

        var purchaseBody = new
        {
            supplierName = "Sup A",
            invoiceNo,
            purchaseDate = DateTime.UtcNow,
            paymentType = "Credit",
            items = new[] { new { productId = 1, unitType = "PIECE", qty = 3m, unitCost = 20m } }
        };
        var purchaseResponse = await client.PostAsJsonAsync("/api/purchases", purchaseBody);
        Assert.Equal(HttpStatusCode.Created, purchaseResponse.StatusCode);
        var purchaseJson = await purchaseResponse.Content.ReadFromJsonAsync<ApiEnvelope<PurchaseDtoStub>>();
        var purchaseId = purchaseJson!.Data!.Id;
        var billTotal = purchaseJson.Data!.TotalAmount;

        var productAfter = await client.GetAsync("/api/products/1");
        var productAfterJson = await productAfter.Content.ReadFromJsonAsync<ApiEnvelope<ProductStub>>();
        Assert.True(productAfterJson!.Data!.StockQty >= stockBefore + 3m);

        var balanceBeforePay = await client.GetAsync("/api/suppliers/balance/Sup%20A");
        var balanceBeforeJson = await balanceBeforePay.Content.ReadFromJsonAsync<ApiEnvelope<SupplierBalanceStub>>();
        Assert.True(balanceBeforeJson!.Data!.NetPayable >= billTotal - 0.01m);

        var payBody = new
        {
            amount = 25m,
            paymentDate = DateTime.UtcNow,
            mode = 0,
            reference = $"sup-pay-{purchaseId}"
        };
        var payResponse = await client.PostAsJsonAsync("/api/suppliers/Sup%20A/payments", payBody);
        Assert.Equal(HttpStatusCode.OK, payResponse.StatusCode);

        var balanceAfter = await client.GetAsync("/api/suppliers/balance/Sup%20A");
        var balanceAfterJson = await balanceAfter.Content.ReadFromJsonAsync<ApiEnvelope<SupplierBalanceStub>>();
        Assert.True(balanceAfterJson!.Data!.NetPayable < balanceBeforeJson!.Data!.NetPayable);
        Assert.True(balanceAfterJson.Data!.TotalPayments >= 25m);

        var txResponse = await client.GetAsync("/api/suppliers/transactions/Sup%20A");
        Assert.Equal(HttpStatusCode.OK, txResponse.StatusCode);
        var txJson = await txResponse.Content.ReadFromJsonAsync<ApiEnvelope<List<SupplierTransactionStub>>>();
        Assert.Contains(txJson!.Data!, t => t.Type == "Payment" && t.Credit == 25m);
        Assert.Contains(txJson.Data!, t => t.Type == "Purchase" && t.Debit >= billTotal - 0.01m);

        var from = DateTime.UtcNow.AddDays(-1).ToString("yyyy-MM-dd");
        var to = DateTime.UtcNow.AddDays(1).ToString("yyyy-MM-dd");
        var statementResponse = await client.GetAsync($"/api/suppliers/Sup%20A/statement?fromDate={from}&toDate={to}");
        Assert.Equal(HttpStatusCode.OK, statementResponse.StatusCode);
        Assert.Equal("application/pdf", statementResponse.Content.Headers.ContentType?.MediaType);
        var pdfBytes = await statementResponse.Content.ReadAsByteArrayAsync();
        Assert.True(pdfBytes.Length > 500);
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(pdfBytes, 0, 4));
    }

    private sealed class ApiEnvelope<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
    }

    private sealed class PurchaseDtoStub
    {
        public int Id { get; set; }
        public decimal TotalAmount { get; set; }
    }

    private sealed class PurchaseDetailStub
    {
        public int Id { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal PaidAmount { get; set; }
        public string? PaymentStatus { get; set; }
        public List<PurchaseItemLineStub>? Items { get; set; }
    }

    private sealed class PurchaseItemLineStub
    {
        public int Id { get; set; }
    }

    private sealed class ProductIdStub
    {
        public int Id { get; set; }
    }

    private sealed class PurchaseReturnStub
    {
        public int Id { get; set; }
        public decimal GrandTotal { get; set; }
    }

    private static async Task<SupplierBalanceStub> GetSupplierBalanceAsync(HttpClient client, string supplier)
    {
        var response = await client.GetAsync($"/api/suppliers/balance/{Uri.EscapeDataString(supplier)}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<SupplierBalanceStub>>();
        return json!.Data!;
    }

    private sealed class ProductStub
    {
        public decimal StockQty { get; set; }
    }

    private sealed class SupplierBalanceStub
    {
        public decimal TotalPurchases { get; set; }
        public decimal TotalPayments { get; set; }
        public decimal NetPayable { get; set; }
    }

    private sealed class SupplierTransactionStub
    {
        public string? Type { get; set; }
        public decimal Debit { get; set; }
        public decimal Credit { get; set; }
    }
}
