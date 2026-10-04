using System.Net;
using System.Net.Http.Json;
using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HexaBill.Tests;

[Collection("HttpIntegration")]
public class SuperAdminHttpIsolationTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public SuperAdminHttpIsolationTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task GlobalSearch_TenantOwner_ReturnsForbidden()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/superadmin/GlobalSearch?q=Cust");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GlobalSearch_TenantBOwner_ReturnsForbidden()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var response = await client.GetAsync("/api/superadmin/GlobalSearch?q=Cust");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task ListTenants_TenantOwner_ReturnsForbidden()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/superadmin/Tenant");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetTenantById_TenantOwner_ReturnsForbidden()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/superadmin/Tenant/2");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GlobalSearch_PlatformAdmin_ReturnsSuccess()
    {
        using var client = HttpIntegrationClient.CreatePlatformAdmin(_factory);
        var response = await client.GetAsync("/api/superadmin/GlobalSearch?q=Cust%20A");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GlobalSearch_PlatformAdmin_FindsCustomersAcrossTenants_WithTenantIds()
    {
        using var client = HttpIntegrationClient.CreatePlatformAdmin(_factory);
        var response = await client.GetAsync("/api/superadmin/GlobalSearch?q=Cust");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<GlobalSearchResultStub>>();
        Assert.True(json?.Success);
        var tenantIds = json!.Data!.Customers!.Select(c => c.TenantId).Distinct().OrderBy(x => x).ToList();
        Assert.Contains(1, tenantIds);
        Assert.Contains(2, tenantIds);
        Assert.DoesNotContain(json.Data!.Customers!, c => c.TenantId == 1 && c.CustomerId == 2);
    }

    [Fact]
    public async Task GlobalSearch_PlatformAdmin_FindsInvoicesByNumberPerTenant()
    {
        using var client = HttpIntegrationClient.CreatePlatformAdmin(_factory);
        var response = await client.GetAsync("/api/superadmin/GlobalSearch?q=A-1001");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<GlobalSearchResultStub>>();
        Assert.Contains(json!.Data!.Invoices!, i => i.TenantId == 1 && i.InvoiceNo == "A-1001");
        Assert.DoesNotContain(json.Data.Invoices!, i => i.TenantId == 2);
    }

    [Fact]
    public async Task UpdateVatCalculationBasis_TenantOwner_ReturnsForbidden()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.PutAsJsonAsync(
            "/api/superadmin/Tenant/1/vat-calculation-basis",
            new { basis = "ProfitBased" });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetTenant_PlatformAdmin_IncludesVatCalculationBasis()
    {
        using var client = HttpIntegrationClient.CreatePlatformAdmin(_factory);
        var response = await client.GetAsync("/api/superadmin/Tenant/1");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<TenantDetailStub>>();
        Assert.True(json?.Success);
        Assert.Equal("SalesBased", json!.Data!.VatCalculationBasis);
    }

    [Fact(DisplayName = "FIN13_Http_PlatformAdmin_VatBasisChange_AppendsHistory")]
    public async Task UpdateVatCalculationBasis_PlatformAdmin_AppendsHistory()
    {
        using var client = HttpIntegrationClient.CreatePlatformAdmin(_factory);
        var effectiveFrom = new DateTime(2025, 7, 1, 0, 0, 0, DateTimeKind.Utc);
        var response = await client.PutAsJsonAsync(
            "/api/superadmin/Tenant/1/vat-calculation-basis",
            new { basis = "ProfitBased", effectiveFrom });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HexaBill.Api.Data.AppDbContext>();
        db.SetRequestTenantScope(null, isPlatformScope: true);
        var tenant = await db.Tenants.AsNoTracking().FirstAsync(t => t.Id == 1);
        Assert.Equal(HexaBill.Api.Models.VatCalculationBasis.ProfitBased, tenant.VatCalculationBasis);
        Assert.True(await db.TenantVatBasisHistory.AnyAsync(h =>
            h.TenantId == 1
            && h.Basis == HexaBill.Api.Models.VatCalculationBasis.ProfitBased
            && h.EffectiveFrom == effectiveFrom));
    }

    private sealed class ApiEnvelope<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
    }

    private sealed class GlobalSearchResultStub
    {
        public List<GlobalSearchInvoiceStub>? Invoices { get; set; }
        public List<GlobalSearchCustomerStub>? Customers { get; set; }
    }

    private sealed class GlobalSearchInvoiceStub
    {
        public int TenantId { get; set; }
        public string? InvoiceNo { get; set; }
    }

    private sealed class GlobalSearchCustomerStub
    {
        public int CustomerId { get; set; }
        public int TenantId { get; set; }
        public string? Name { get; set; }
    }

    private sealed class TenantDetailStub
    {
        public string? VatCalculationBasis { get; set; }
    }
}
