using System.Net;
using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HexaBill.Tests;

[Collection("HttpIntegration")]
public sealed class DiagnosticsSchemaRepairIsolationTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public DiagnosticsSchemaRepairIsolationTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task TenantOwner_CannotRunGlobalSchemaRepair_AndRepairEndpointIsRetired()
    {
        decimal originalTotal;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.SetRequestTenantScope(null, isPlatformScope: true);
            var otherTenantSale = await db.Sales.IgnoreQueryFilters().SingleAsync(s => s.Id == 2);
            originalTotal = otherTenantSale.TotalAmount;
            otherTenantSale.TotalAmount = 0m;
            await db.SaveChangesAsync();
        }

        try
        {
            using var tenantOwner = HttpIntegrationClient.Create(_factory, 1, 1, "tenanta");
            Assert.Equal(HttpStatusCode.Forbidden, (await tenantOwner.PostAsync("/api/fix-columns", content: null)).StatusCode);

            using var platformAdmin = HttpIntegrationClient.CreatePlatformAdmin(_factory);
            Assert.Equal(HttpStatusCode.Gone, (await platformAdmin.PostAsync("/api/fix-columns", content: null)).StatusCode);

            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.SetRequestTenantScope(null, isPlatformScope: true);
            Assert.Equal(0m, (await db.Sales.IgnoreQueryFilters().SingleAsync(s => s.Id == 2)).TotalAmount);
        }
        finally
        {
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.SetRequestTenantScope(null, isPlatformScope: true);
            var otherTenantSale = await db.Sales.IgnoreQueryFilters().SingleAsync(s => s.Id == 2);
            otherTenantSale.TotalAmount = originalTotal;
            await db.SaveChangesAsync();
        }
    }
}
