using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Purchases;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

public sealed class SupplierMergeIsolationTests
{
    [Fact]
    public async Task Merge_DoesNotCountOrUpdateForeignTenantPurchaseReturnReferencingLoserSupplier()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options;
        await using var db = new AppDbContext(options);
        db.SetRequestTenantScope(null, isPlatformScope: true);
        await db.Database.EnsureCreatedAsync();

        db.Tenants.AddRange(
            new Tenant { Id = 10, Name = "Tenant A", Subdomain = "tenant-a" },
            new Tenant { Id = 20, Name = "Tenant B", Subdomain = "tenant-b" });
        db.Users.Add(new User
        {
            Id = 1, TenantId = 10, OwnerId = 10, Name = "Merge operator", Email = "merge@example.test",
            PasswordHash = "not-used", Role = UserRole.Owner, IsActive = true, CreatedAt = DateTime.UtcNow
        });
        db.Suppliers.AddRange(
            new Supplier { Id = 101, TenantId = 10, Name = "Survivor", NormalizedName = "survivor" },
            new Supplier { Id = 102, TenantId = 10, Name = "Loser", NormalizedName = "loser" });
        db.Purchases.Add(new Purchase
        {
            Id = 201, TenantId = 20, OwnerId = 20, SupplierName = "Other tenant supplier",
            InvoiceNo = "OTHER-201", PurchaseDate = DateTime.UtcNow, CreatedBy = 1, CreatedAt = DateTime.UtcNow
        });
        db.PurchaseReturns.Add(new PurchaseReturn
        {
            Id = 301, TenantId = 20, OwnerId = 20, PurchaseId = 201, SupplierId = 102,
            ReturnNo = "OTHER-RETURN-301", ReturnDate = DateTime.UtcNow, Status = ReturnStatus.Approved,
            CreatedBy = 1, CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var configuration = new ConfigurationBuilder().AddInMemoryCollection(
            new Dictionary<string, string?> { [SupplierMergeService.FeatureFlagKey] = "true" }).Build();
        var service = new SupplierMergeService(
            db, new SupplierService(db), configuration, NullLogger<SupplierMergeService>.Instance);

        var result = await service.MergeAsync(10, 101, new[] { 102 }, dryRun: false, actingUserId: 1);

        Assert.True(result.Success, string.Join("; ", result.Errors));
        Assert.Equal(0, result.RowsMoved["PurchaseReturns"]);
        var foreignReturn = await db.PurchaseReturns.IgnoreQueryFilters().SingleAsync(r => r.Id == 301);
        Assert.Equal(20, foreignReturn.TenantId);
        Assert.Equal(102, foreignReturn.SupplierId);
    }
}
