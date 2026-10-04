using System.Net;
using System.Net.Http.Json;

namespace HexaBill.Tests;

[Collection("HttpIntegration")]
public class SettingsHttpIsolationTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public SettingsHttpIsolationTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task GetCompanySettings_ReturnsOwnTenantTrnOnly()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/settings/company");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ServiceResponseStub<CompanySettingsStub>>();
        Assert.True(json?.Success);
        Assert.Equal("TRN-TENANT-A-HTTP", json?.Data?.VatNumber);
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
        Assert.Equal("TRN-TENANT-B-HTTP", json?.Data?.VatNumber);
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
