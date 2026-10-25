using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Sales;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

/// <summary>P0-PRINT-007: SaleDto carries ExternalReference so the PDF can label rebuilt Starplus reprints.</summary>
public class SaleDtoExternalReferenceTests
{
    [Theory]
    [InlineData("starplus:sale:4242", false)]
    [InlineData(null, false)]
    // Projection path (production schema). The branch/route path needs Branch/Route fixtures and maps the same field.
    public async Task GetSaleById_CarriesExternalReference(string? reference, bool hasBranchRoute)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("SaleDtoExtRef_" + Guid.NewGuid())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)).Options;
        await using var db = new AppDbContext(options);
        db.SetRequestTenantScope(30, false);
        var now = new DateTime(2026, 3, 14, 10, 0, 0, DateTimeKind.Utc);
        db.Customers.Add(new Customer { Id = 1, TenantId = 30, OwnerId = 30, Name = "Synthetic customer" });
        db.Sales.Add(new Sale { Id = 501, TenantId = 30, OwnerId = 30, CustomerId = 1, CreatedBy = 1, InvoiceNo = "6001",
            InvoiceDate = now, CreatedAt = now, Subtotal = 100m, VatTotal = 5m, GrandTotal = 105m, TotalAmount = 105m,
            IsFinalized = true, ExternalReference = reference });
        await db.SaveChangesAsync();
        var service = new SaleService(db, null!, null!, null!, null!, null!, null!, null!, null!, new FixedSchema(hasBranchRoute), null!, null!, null!, null!, NullLogger<SaleService>.Instance);

        var dto = await service.GetSaleByIdAsync(501, 30);

        Assert.NotNull(dto);
        Assert.Equal(reference, dto!.ExternalReference);
    }

    private sealed class FixedSchema(bool hasBranchRoute) : ISalesSchemaService
    {
        public Task<bool> SalesHasBranchIdAndRouteIdAsync() => Task.FromResult(hasBranchRoute);
        public void ClearColumnCheckCache() { }
    }
}
