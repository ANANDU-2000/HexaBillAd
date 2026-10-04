using System.Net;
using System.Net.Http.Json;

namespace HexaBill.Tests;

[Collection("HttpIntegration")]
public class SuperAdminProvisioningHttpTests
{
    private const int LegalSourceTenantId = 5;
    private readonly HexaBillWebApplicationFactory _factory;

    public SuperAdminProvisioningHttpTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task CreateTenant_TenantOwner_ReturnsForbidden()
    {
        using var client = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await client.PostAsJsonAsync("/api/superadmin/Tenant", new
        {
            name = "Blocked Co",
            subdomain = "blocked-co",
            email = "blocked@example.com",
        });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task CreateSharedLegalTenant_SourceWithoutFeatureFlag_ReturnsBadRequest()
    {
        using var admin = HttpIntegrationClient.CreatePlatformAdmin(_factory);
        var preview = await admin.GetFromJsonAsync<ApiEnvelope<TenantDetailStub>>("/api/superadmin/Tenant/1");
        Assert.False(string.IsNullOrWhiteSpace(preview?.Data?.LegalIdentityFingerprint));

        var response = await admin.PostAsJsonAsync("/api/superadmin/Tenant", new
        {
            name = "Should Fail",
            subdomain = "should-fail",
            email = "fail@example.com",
            sharedLegalIdentityFromTenantId = 1,
            confirmSharedLegalIdentity = true,
            expectedLegalIdentityFingerprint = preview!.Data!.LegalIdentityFingerprint,
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact(DisplayName = "TEN06_SharedLegalTenant_CreatesEmptyWorkspace_IsolatedFromSource")]
    public async Task CreateSharedLegalTenant_PlatformAdmin_ReturnsCreated_WithEmptyOperationalData()
    {
        using var admin = HttpIntegrationClient.CreatePlatformAdmin(_factory);
        var preview = await admin.GetFromJsonAsync<ApiEnvelope<TenantDetailStub>>(
            $"/api/superadmin/Tenant/{LegalSourceTenantId}");
        Assert.True(preview?.Success);
        Assert.Equal(1, preview!.Data!.UsageMetrics!.ProductCount);

        var response = await admin.PostAsJsonAsync("/api/superadmin/Tenant", new
        {
            name = "Legal Trading Company",
            subdomain = "owner-two-http",
            openingDataChoice = "Empty",
            ownerName = "Second Owner",
            email = "second-http@example.com",
            phone = "+971502222222",
            sharedLegalIdentityFromTenantId = LegalSourceTenantId,
            confirmSharedLegalIdentity = true,
            expectedLegalIdentityFingerprint = preview.Data!.LegalIdentityFingerprint,
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<ApiEnvelope<CreateTenantResponseStub>>();
        Assert.True(created?.Success);
        Assert.NotEqual(LegalSourceTenantId, created!.Data!.Tenant!.Id);
        Assert.Equal("owner-two-http", created.Data!.Tenant!.Subdomain);
        Assert.Equal("100123456789012", created.Data!.Tenant!.VatNumber);

        var newTenantId = created.Data!.Tenant!.Id;
        var newDetail = await admin.GetFromJsonAsync<ApiEnvelope<TenantDetailStub>>(
            $"/api/superadmin/Tenant/{newTenantId}");
        Assert.Equal(0, newDetail?.Data?.UsageMetrics?.ProductCount);
        Assert.Equal(0, newDetail?.Data?.UsageMetrics?.CustomerCount);

        var sourceAfter = await admin.GetFromJsonAsync<ApiEnvelope<TenantDetailStub>>(
            $"/api/superadmin/Tenant/{LegalSourceTenantId}");
        Assert.Equal(1, sourceAfter?.Data?.UsageMetrics?.ProductCount);

        var creds = created.Data!.ClientCredentials!;
        Assert.False(string.IsNullOrWhiteSpace(creds.InviteUrl));
        var inviteToken = ExtractInviteToken(creds.InviteUrl);
        const string ownerPassword = "OwnerHttpTest1!";
        using (var inviteClient = _factory.CreateClient(new()
        {
            AllowAutoRedirect = false,
            BaseAddress = new Uri("http://owner-two-http.hexabill.company"),
        }))
        {
            var accept = await inviteClient.PostAsJsonAsync("/api/auth/invite/accept",
                new { token = inviteToken, newPassword = ownerPassword });
            Assert.Equal(HttpStatusCode.OK, accept.StatusCode);
        }

        using var ownerClient = await HttpIntegrationClient.CreateFromLoginAsync(
            _factory, "owner-two-http", creds.Email, ownerPassword);
        Assert.Equal(HttpStatusCode.NotFound, (await ownerClient.GetAsync("/api/customers/1")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await ownerClient.GetAsync("/api/customers/2")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await ownerClient.GetAsync("/api/customers/50")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await ownerClient.GetAsync("/api/sales/1")).StatusCode);
    }

    private sealed class ApiEnvelope<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
    }

    private sealed class TenantDetailStub
    {
        public int Id { get; set; }
        public string? Subdomain { get; set; }
        public string? VatNumber { get; set; }
        public string? LegalIdentityFingerprint { get; set; }
        public UsageMetricsStub? UsageMetrics { get; set; }
    }

    private sealed class UsageMetricsStub
    {
        public int ProductCount { get; set; }
        public int CustomerCount { get; set; }
    }

    private sealed class CreateTenantResponseStub
    {
        public TenantDetailStub? Tenant { get; set; }
        public ClientCredentialsStub? ClientCredentials { get; set; }
    }

    private sealed class ClientCredentialsStub
    {
        public string Email { get; set; } = string.Empty;
        public string InviteUrl { get; set; } = string.Empty;
    }

    private static string ExtractInviteToken(string inviteUrl)
    {
        const string marker = "invite=";
        var start = inviteUrl.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (start < 0)
            throw new InvalidOperationException("Invite URL did not contain an invite token.");
        return Uri.UnescapeDataString(inviteUrl[(start + marker.Length)..]);
    }
}
