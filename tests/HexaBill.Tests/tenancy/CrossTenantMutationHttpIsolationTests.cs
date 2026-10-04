using System.Net;
using System.Net.Http.Json;

namespace HexaBill.Tests;

/// <summary>Destructive HTTP calls against another tenant's entity IDs must not mutate foreign rows.</summary>
[Collection("HttpIntegration")]
public class CrossTenantMutationHttpIsolationTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public CrossTenantMutationHttpIsolationTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Theory]
    [InlineData(1, "tenanta", 2, 2, "tenantb")]
    [InlineData(2, "tenantb", 1, 1, "tenanta")]
    public async Task DeletePayment_OtherTenantsPayment_ReturnsNotFoundAndPreservesRow(
        int attackerTenantId, string attackerSlug, int foreignPaymentId, int ownerTenantId, string ownerSlug)
    {
        using var attacker = HttpIntegrationClient.Create(_factory, attackerTenantId, attackerSlug);
        var delete = await attacker.DeleteAsync($"/api/payments/{foreignPaymentId}");
        Assert.Equal(HttpStatusCode.NotFound, delete.StatusCode);

        using var owner = HttpIntegrationClient.Create(_factory, ownerTenantId, ownerSlug);
        var get = await owner.GetAsync($"/api/payments/{foreignPaymentId}");
        Assert.Equal(HttpStatusCode.OK, get.StatusCode);
    }

    [Theory]
    [InlineData(1, "tenanta", 2, 2, "tenantb")]
    [InlineData(2, "tenantb", 1, 1, "tenanta")]
    public async Task DeletePurchase_OtherTenantsPurchase_ReturnsNotFoundAndPreservesRow(
        int attackerTenantId, string attackerSlug, int foreignPurchaseId, int ownerTenantId, string ownerSlug)
    {
        using var attacker = HttpIntegrationClient.Create(_factory, attackerTenantId, attackerSlug);
        var delete = await attacker.DeleteAsync($"/api/purchases/{foreignPurchaseId}");
        Assert.Equal(HttpStatusCode.NotFound, delete.StatusCode);

        using var owner = HttpIntegrationClient.Create(_factory, ownerTenantId, ownerSlug);
        var get = await owner.GetAsync($"/api/purchases/{foreignPurchaseId}");
        Assert.Equal(HttpStatusCode.OK, get.StatusCode);
    }

    [Theory]
    [InlineData(1, "tenanta", 2)]
    [InlineData(2, "tenantb", 1)]
    public async Task PutUpdatePayment_OtherTenantsPayment_ReturnsNotFound(int attackerTenantId, string attackerSlug, int foreignPaymentId)
    {
        using var client = HttpIntegrationClient.Create(_factory, attackerTenantId, attackerSlug);
        var response = await client.PutAsJsonAsync($"/api/payments/{foreignPaymentId}", new { amount = 1m, mode = "CASH" });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData(1, "tenanta", 2)]
    [InlineData(2, "tenantb", 1)]
    public async Task PutUpdatePurchase_OtherTenantsPurchase_ReturnsNotFound(int attackerTenantId, string attackerSlug, int foreignPurchaseId)
    {
        using var client = HttpIntegrationClient.Create(_factory, attackerTenantId, attackerSlug);
        var body = new
        {
            supplierName = "Sup X",
            invoiceNo = "PX-1",
            purchaseDate = DateTime.UtcNow,
            items = new[] { new { productId = 1, unitType = "PIECE", qty = 1m, unitCost = 10m } }
        };
        var response = await client.PutAsJsonAsync($"/api/purchases/{foreignPurchaseId}", body);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData(1, "tenanta", 2, 2, "tenantb")]
    [InlineData(2, "tenantb", 1, 1, "tenanta")]
    public async Task DeleteSale_OtherTenantsSale_ReturnsNotFoundAndPreservesRow(
        int attackerTenantId, string attackerSlug, int foreignSaleId, int ownerTenantId, string ownerSlug)
    {
        using var attacker = HttpIntegrationClient.Create(_factory, attackerTenantId, attackerSlug);
        var delete = await attacker.DeleteAsync($"/api/sales/{foreignSaleId}");
        Assert.Equal(HttpStatusCode.NotFound, delete.StatusCode);

        using var owner = HttpIntegrationClient.Create(_factory, ownerTenantId, ownerSlug);
        var get = await owner.GetAsync($"/api/sales/{foreignSaleId}");
        Assert.Equal(HttpStatusCode.OK, get.StatusCode);
    }

    [Theory]
    [InlineData(1, "tenanta", 2)]
    [InlineData(2, "tenantb", 1)]
    public async Task PutUpdateSale_OtherTenantsSale_ReturnsNotFound(int attackerTenantId, string attackerSlug, int foreignSaleId)
    {
        using var client = HttpIntegrationClient.Create(_factory, attackerTenantId, attackerSlug);
        var body = new
        {
            customerId = 1,
            editReason = "Cross-tenant isolation probe",
            items = new[] { new { productId = 1, unitType = "PIECE", qty = 1m, unitPrice = 50m } }
        };
        var response = await client.PutAsJsonAsync($"/api/sales/{foreignSaleId}", body);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
