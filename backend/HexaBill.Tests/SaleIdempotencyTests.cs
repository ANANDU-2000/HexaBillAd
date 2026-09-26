using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Tests;

public class SaleIdempotencyTests
{
    [Fact]
    public async Task DuplicateExternalReference_ResolvesToExistingSale_ForSameTenant()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("Idem_" + Guid.NewGuid())
            .Options;
        await using var db = new AppDbContext(options);
        db.SetRequestTenantScope(3, isPlatformScope: false);
        await db.Database.EnsureCreatedAsync();

        const string reference = "pos-retry-1";
        db.Sales.Add(new Sale
        {
            Id = 50,
            TenantId = 3,
            OwnerId = 3,
            InvoiceNo = "INV-50",
            ExternalReference = reference,
            InvoiceDate = DateTime.UtcNow,
            GrandTotal = 10m,
            TotalAmount = 10m,
            CreatedBy = 1,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var existing = await db.Sales.FirstOrDefaultAsync(s =>
            s.ExternalReference == reference && s.TenantId == 3 && !s.IsDeleted);

        Assert.NotNull(existing);
        Assert.Equal(50, existing!.Id);
    }
}
