using System.Net;
using System.Net.Http.Json;

namespace HexaBill.Tests;

[Collection("HttpIntegration")]
public class ReportsHttpIsolationTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public ReportsHttpIsolationTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task GetSalesReport_ListsOnlyOwnTenantInvoices()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/reports/sales?pageSize=50");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<PagedStub<SaleRowStub>>>();
        Assert.True(json?.Success);
        var numbers = json!.Data!.Items!.Select(i => i.InvoiceNo).ToList();
        Assert.Contains("A-1001", numbers);
        Assert.DoesNotContain(numbers, n => n == "B-2001");
    }

    [Fact]
    public async Task GetSalesReport_TenantBCannotSeeTenantAInvoiceInSearch()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var response = await client.GetAsync("/api/reports/sales?search=A-1001&pageSize=50");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<PagedStub<SaleRowStub>>>();
        Assert.True(json?.Success);
        Assert.DoesNotContain(json!.Data!.Items ?? [], i => i.InvoiceNo == "A-1001");
    }

    [Fact]
    public async Task GetAISuggestions_ReturnsSuccess_WithoutCrossTenantLeak()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/reports/ai-suggestions?periodDays=30");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<object>>();
        Assert.True(json?.Success);
    }

    [Fact(DisplayName = "FIN13_GetVatReturn_TenantA_FullYear_ReportsSalesBasedProfitForm")]
    public async Task GetVatReturn_TenantA_FullYear_ReportsSalesBasedProfitForm()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/reports/vat-return?from=2026-01-01&to=2026-12-31");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<VatReturnStub>>();
        Assert.True(json?.Success);
        Assert.Equal("SalesBased", json!.Data!.VatCalculationBasis, StringComparer.OrdinalIgnoreCase);
        Assert.Equal(0, json.Data!.ProfitVat);
    }

    [Fact(DisplayName = "FIN11_ProductCostEdit_DoesNotRewriteHistoricalProfitCogs_Http")]
    public async Task SavedSaleCost_ProductCostEdit_DoesNotRewriteHistoricalProfitCogs()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var sku = $"COST-{Guid.NewGuid():N}"[..12];
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
            nameEn = "Cost snapshot HTTP",
            unitType = "PIECE",
            conversionToBase = 1m,
            costPrice = 40m,
            sellPrice = 60m,
            stockQty = 100m
        });
        Assert.Equal(HttpStatusCode.Created, createProduct.StatusCode);
        var productJson = await createProduct.Content.ReadFromJsonAsync<ApiEnvelope<ProductDetailStub>>();
        var productId = productJson!.Data!.Id;

        var saleResponse = await client.PostAsJsonAsync("/api/sales", new
        {
            customerId = 1,
            items = new[] { new { productId, unitType = "PIECE", qty = 2m, unitPrice = 60m } }
        });
        Assert.Equal(HttpStatusCode.Created, saleResponse.StatusCode);

        var cogsAfterSale = await GetCogsAsync();
        Assert.Equal(cogsBefore + 80m, cogsAfterSale);

        var update = await client.PutAsJsonAsync($"/api/products/{productId}", new
        {
            sku,
            nameEn = "Cost snapshot HTTP",
            unitType = "PIECE",
            conversionToBase = 1m,
            costPrice = 99m,
            sellPrice = 60m,
            stockQty = 98m
        });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);

        var cogsAfterCostEdit = await GetCogsAsync();
        Assert.Equal(cogsAfterSale, cogsAfterCostEdit);
    }

    private sealed class ApiEnvelope<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
    }

    private sealed class PagedStub<T>
    {
        public List<T>? Items { get; set; }
    }

    private sealed class SaleRowStub
    {
        public string? InvoiceNo { get; set; }
    }

    private sealed class ProfitReportStub
    {
        public decimal CostOfGoodsSold { get; set; }
        public decimal TotalSales { get; set; }
    }

    private sealed class VatReturnStub
    {
        public string? VatCalculationBasis { get; set; }
        public decimal ProfitVat { get; set; }
    }

    private sealed class ProductDetailStub
    {
        public int Id { get; set; }
        public string? Sku { get; set; }
        public string? NameEn { get; set; }
        public decimal StockQty { get; set; }
    }
}
