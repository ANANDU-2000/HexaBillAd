using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Import;
using HexaBill.Api.Modules.Purchases;
using HexaBill.Api.Modules.Reports;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Tests;

/// <summary>Write paths that must not change figures inside a Locked/Submitted VAT period.</summary>
public sealed class VatPeriodWriteGuardGapTests
{
    private const int Tenant = 60006;

    private static async Task<AppDbContext> FrozenPeriodDbAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite("Data Source=:memory:").Options);
        db.SetRequestTenantScope(null, isPlatformScope: true);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        db.Tenants.Add(new Tenant { Id = Tenant, Name = "Guard gap fixture", Subdomain = "guard-gap", Country = "AE", Currency = "AED" });
        db.Users.Add(new User
        {
            Id = 1, TenantId = Tenant, OwnerId = Tenant, Name = "Owner", Email = "owner@guard.test",
            PasswordHash = "x", Role = UserRole.Owner, CreatedAt = DateTime.UtcNow
        });
        db.VatReturnPeriods.Add(new VatReturnPeriod
        {
            TenantId = Tenant, PeriodLabel = "Q1-2025", Status = "Locked",
            PeriodStart = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            PeriodEnd = new DateTime(2025, 3, 31, 0, 0, 0, DateTimeKind.Utc),
        });
        await db.SaveChangesAsync();
        return db;
    }

    [Fact]
    public async Task SalesLedgerImport_BackdatedIntoLockedPeriod_IsRejected()
    {
        await using var db = await FrozenPeriodDbAsync();
        var service = new SalesLedgerImportService(db);
        var result = await service.ApplyImportAsync(Tenant, 1, new SalesLedgerApplyRequest
        {
            ColumnMapping = new() { ["invoiceNo"] = 0, ["customerName"] = 1, ["paymentDate"] = 2, ["netSales"] = 3, ["vat"] = 4, ["paymentType"] = 5 },
            Rows = [["IMP-1", "Acme", "2025-02-10", "105", "5", "CREDIT"]],
        });
        Assert.Equal(0, await db.Sales.CountAsync());
        Assert.Equal(0, result.SalesCreated);
        Assert.Contains(result.Errors, e => e.Contains("locked", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task BulkSetTaxClaimable_DoesNotChangePurchasesInLockedPeriod()
    {
        await using var db = await FrozenPeriodDbAsync();
        db.Purchases.Add(new Purchase
        {
            TenantId = Tenant, OwnerId = Tenant, InvoiceNo = "P-LOCKED",
            PurchaseDate = new DateTime(2025, 2, 10, 12, 0, 0, DateTimeKind.Utc),
            Subtotal = 100m, VatTotal = 5m, TotalAmount = 105m, IsTaxClaimable = false, CreatedBy = 1,
        });
        db.Purchases.Add(new Purchase
        {
            TenantId = Tenant, OwnerId = Tenant, InvoiceNo = "P-OPEN",
            PurchaseDate = new DateTime(2025, 5, 10, 12, 0, 0, DateTimeKind.Utc),
            Subtotal = 100m, VatTotal = 5m, TotalAmount = 105m, IsTaxClaimable = false, CreatedBy = 1,
        });
        await db.SaveChangesAsync();

        var updated = await new PurchaseService(db, new VatReturnValidationService(db))
            .BulkSetTaxClaimableForPurchasesWithVatAsync(Tenant);

        Assert.Equal(1, updated);
        Assert.False((await db.Purchases.SingleAsync(p => p.InvoiceNo == "P-LOCKED")).IsTaxClaimable);
        Assert.True((await db.Purchases.SingleAsync(p => p.InvoiceNo == "P-OPEN")).IsTaxClaimable);
    }
}
