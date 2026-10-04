using System.Net;
using System.Net.Http.Json;

namespace HexaBill.Tests;

[Collection("HttpIntegration")]
public class SalaryCertificatesHttpIsolationTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public SalaryCertificatesHttpIsolationTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task GetSalaryCertificate_OwnTenant_ReturnsSuccess()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/salary-certificates/1");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<ApiEnvelope<CertificateStub>>();
        Assert.True(json?.Success);
        Assert.Equal("SC-A-HTTP-1", json?.Data?.CertificateNo);
    }

    [Fact]
    public async Task GetSalaryCertificate_OtherTenantsCertificate_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.GetAsync("/api/salary-certificates/2");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetSalaryCertificate_TenantBCannotReadTenantA_ReturnsNotFound()
    {
        using var client = HttpIntegrationClient.Create(_factory, 2, "tenantb");
        var response = await client.GetAsync("/api/salary-certificates/1");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private sealed class ApiEnvelope<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
    }

    private sealed class CertificateStub
    {
        public string? CertificateNo { get; set; }
    }
}
