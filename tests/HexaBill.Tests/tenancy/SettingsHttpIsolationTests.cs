using System.Net;
using System.Net.Http.Json;
using HexaBill.Api.Core.Tenancy;

namespace HexaBill.Tests;

[Collection("HttpIntegration")]
public class SettingsHttpIsolationTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public SettingsHttpIsolationTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task TemplatePreview_UsesCurrentTenantDetailsAndNoInventedVat()
    {
        using var a = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        using var b = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var template = new { htmlCode = "<header>{{company_name_en}} | {{company_trn}}</header>" };
        var own = await a.PostAsJsonAsync("/api/invoice/templates/preview", template);
        own.EnsureSuccessStatusCode();
        var first = await own.Content.ReadFromJsonAsync<ServiceResponseStub<string>>();
        Assert.Contains("Tenant A Legal Name", first!.Data!);
        Assert.Contains("100000000000001", first.Data!);
        Assert.DoesNotContain("100366253100003", first.Data!);
        var other = await b.PostAsJsonAsync("/api/invoice/templates/preview", template);
        other.EnsureSuccessStatusCode();
        var second = await other.Content.ReadFromJsonAsync<ServiceResponseStub<string>>();
        Assert.Contains("100000000000002", second!.Data!);
        Assert.DoesNotContain("Tenant A Legal Name", second.Data!);
    }

    [Fact]
    public async Task MissingVat_AllowsOrdinaryInvoicePdf_AndDoesNotChangeTenantB()
    {
        // D8 / SampleVatTrn: empty VAT blocks Tax Invoice semantics only — ordinary Invoice PDF + sales stay allowed.
        using var a = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        using var b = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        try
        {
            var invalid = await a.PutAsJsonAsync("/api/settings", new { vat_trn = "not-a-vat-number" });
            Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
            (await a.PutAsJsonAsync("/api/settings", new { vat_trn = "", corporate_tax_trn = "100000000000009" })).EnsureSuccessStatusCode();
            var own = await a.GetFromJsonAsync<ServiceResponseStub<CompanySettingsStub>>("/api/settings/company");
            Assert.Equal("", own?.Data?.VatNumber);
            Assert.Equal("INVOICE", SampleVatTrn.DocumentTitle(own?.Data?.VatNumber));

            var pdf = await a.GetAsync("/api/sales/1/pdf");
            Assert.Equal(HttpStatusCode.OK, pdf.StatusCode);
            var bytes = await pdf.Content.ReadAsByteArrayAsync();
            Assert.True(bytes.Length > 4);
            Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(bytes, 0, 4));
            var pdfText = System.Text.Encoding.Latin1.GetString(bytes);
            Assert.DoesNotContain("TAX INVOICE", pdfText, StringComparison.OrdinalIgnoreCase);

            var create = await a.PostAsJsonAsync("/api/sales", new {
                customerId = 1,
                items = new[] { new { productId = 1, unitType = "PIECE", qty = 1m, unitPrice = 10m } }
            });
            Assert.True(create.StatusCode is HttpStatusCode.OK or HttpStatusCode.Created, $"create={(int)create.StatusCode}");

            var other = await b.GetFromJsonAsync<ServiceResponseStub<CompanySettingsStub>>("/api/settings/company");
            Assert.Equal("100000000000002", other?.Data?.VatNumber);
            Assert.Equal(HttpStatusCode.OK, (await b.GetAsync("/api/sales/2/pdf")).StatusCode);
        }
        finally
        {
            (await a.PutAsJsonAsync("/api/settings", new { vat_trn = "100000000000001", corporate_tax_trn = "" })).EnsureSuccessStatusCode();
        }
    }

    [Fact]
    public async Task GetCompanySettings_ReturnsOwnTenantTrnOnly()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/settings/company");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ServiceResponseStub<CompanySettingsStub>>();
        Assert.True(json?.Success);
        Assert.Equal("100000000000001", json?.Data?.VatNumber);
        Assert.Equal("Tenant A Legal Name", json?.Data?.LegalNameEn);
        Assert.DoesNotContain("TRN-TENANT-B", json?.Data?.VatNumber ?? string.Empty);
    }

    [Fact]
    public async Task GetCompanySettings_TenantB_ReturnsDistinctTrn()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var response = await client.GetAsync("/api/settings/company");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ServiceResponseStub<CompanySettingsStub>>();
        Assert.Equal("100000000000002", json?.Data?.VatNumber);
        Assert.DoesNotContain("TRN-TENANT-A", json?.Data?.VatNumber ?? string.Empty);
    }

    private sealed class ServiceResponseStub<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
    }

    private sealed class CompanySettingsStub
    {
        public string? LegalNameEn { get; set; }
        public string? VatNumber { get; set; }
    }
}
