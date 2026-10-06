using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Returns;
using HexaBill.Api.Modules.Sales;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Tests;

/// <summary>
/// Requires PostgreSQL: set HEXABILL_TEST_POSTGRES to a connection string (dedicated test DB).
/// Skips when unset so CI/SQLite-only runs stay green.
/// </summary>
public class ReturnConcurrencyPostgreSqlTests
{
    [Fact]
    public async Task ParallelApproval_OnlyOneSucceedsAndStockMovesOnce()
    {
        var connectionString = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        if (string.IsNullOrWhiteSpace(connectionString))
            return;

        var tenantId = 900_000 + Random.Shared.Next(1, 50_000);
        int returnId;
        await using (var seed = await OpenPostgresAsync(connectionString, tenantId))
        {
            returnId = await SeedPendingReturnAsync(seed, tenantId);
        }

        var successCount = 0;
        var rejectCount = 0;
        var tasks = Enumerable.Range(0, 4).Select(_ => Task.Run(async () =>
        {
            await using var db = await OpenPostgresAsync(connectionString, tenantId);
            var service = new ReturnService(db, null!, null!, null!);
            try
            {
                await service.ApproveSaleReturnAsync(returnId, tenantId);
                Interlocked.Increment(ref successCount);
            }
            catch (InvalidOperationException)
            {
                Interlocked.Increment(ref rejectCount);
            }
        }));
        await Task.WhenAll(tasks);

        await using (var verify = await OpenPostgresAsync(connectionString, tenantId))
        {
            Assert.Equal(1, successCount);
            Assert.Equal(3, rejectCount);
            Assert.Equal(ReturnStatus.Approved, (await verify.SaleReturns.SingleAsync(r => r.Id == returnId)).Status);
            var product = await verify.Products.SingleAsync(p => p.TenantId == tenantId);
            Assert.Equal(20m, product.StockQty);
            Assert.Single(await verify.InventoryTransactions.Where(t => t.TenantId == tenantId).ToListAsync());
            await CleanupTenantAsync(verify, tenantId);
        }
    }

    [Fact]
    public async Task ParallelPurchaseReturn_OnlyOneCanReturnPurchasedQuantity()
    {
        var connectionString = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        if (string.IsNullOrWhiteSpace(connectionString))
            return;

        var tenantId = 1_000_000 + Random.Shared.Next(1, 50_000);
        await using (var seed = await OpenPostgresAsync(connectionString, tenantId))
        {
            var now = DateTime.UtcNow;
            seed.Tenants.Add(new Tenant { Id = tenantId, Name = $"PG purchase return {tenantId}", Subdomain = $"pg-purch-ret-{tenantId}" });
            seed.Users.Add(new User
            {
                Id = tenantId,
                TenantId = tenantId,
                OwnerId = tenantId,
                Name = "PG purchase return fixture",
                Email = $"pg-purch-ret-{tenantId}@example.test",
                PasswordHash = "fixture",
                Role = UserRole.Owner,
                CreatedAt = now
            });
            seed.Products.Add(new Product
            {
                Id = tenantId,
                TenantId = tenantId,
                OwnerId = tenantId,
                NameEn = "PG purchase return product",
                Sku = $"PG-PURCH-RET-{tenantId}",
                StockQty = 100,
                CostPrice = 50,
                ConversionToBase = 12,
                CreatedAt = now,
                UpdatedAt = now
            });
            seed.Purchases.Add(new Purchase
            {
                Id = tenantId,
                TenantId = tenantId,
                OwnerId = tenantId,
                CreatedBy = tenantId,
                SupplierName = "Synthetic supplier",
                InvoiceNo = $"PG-PO-{tenantId}",
                PurchaseDate = now,
                CreatedAt = now,
                TotalAmount = 100
            });
            seed.PurchaseItems.Add(new PurchaseItem
            {
                Id = tenantId,
                PurchaseId = tenantId,
                ProductId = tenantId,
                Qty = 2,
                UnitCost = 50,
                LineTotal = 100,
                ConversionAtPurchase = 12
            });
            await seed.SaveChangesAsync();
        }

        var successCount = 0;
        var rejectCount = 0;
        var attempts = Enumerable.Range(0, 2).Select(_ => Task.Run(async () =>
        {
            await using var db = await OpenPostgresAsync(connectionString, tenantId);
            var service = new ReturnService(db, null!, null!, null!);
            try
            {
                await service.CreatePurchaseReturnAsync(new CreatePurchaseReturnRequest
                {
                    PurchaseId = tenantId,
                    Items = [new PurchaseReturnItemRequest { PurchaseItemId = tenantId, Qty = 2 }]
                }, tenantId, tenantId);
                Interlocked.Increment(ref successCount);
            }
            catch (InvalidOperationException)
            {
                Interlocked.Increment(ref rejectCount);
            }
        }));

        try
        {
            await Task.WhenAll(attempts);
            await using var verify = await OpenPostgresAsync(connectionString, tenantId);
            Assert.Equal(1, successCount);
            Assert.Equal(1, rejectCount);
            Assert.Single(await verify.PurchaseReturns.Where(r => r.TenantId == tenantId).ToListAsync());
            Assert.Equal(76m, (await verify.Products.SingleAsync(p => p.TenantId == tenantId)).StockQty);
            Assert.Single(await verify.InventoryTransactions.Where(t => t.TenantId == tenantId).ToListAsync());
        }
        finally
        {
            await using var cleanup = await OpenPostgresAsync(connectionString, tenantId);
            await cleanup.PurchaseReturnItems.Where(i => i.PurchaseReturn.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.PurchaseReturns.Where(r => r.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.InventoryTransactions.Where(t => t.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.AuditLogs.Where(a => a.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.PurchaseItems.Where(i => i.PurchaseId == tenantId).ExecuteDeleteAsync();
            await cleanup.Purchases.Where(p => p.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.Products.Where(p => p.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.Users.Where(u => u.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.Tenants.Where(t => t.Id == tenantId).ExecuteDeleteAsync();
        }
    }

    private static async Task<AppDbContext> OpenPostgresAsync(string connectionString, int tenantId)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connectionString).Options);
        db.SetRequestTenantScope(tenantId, false);
        await PostgresTestSchema.EnsureCreatedAsync(db);
        return db;
    }

    private static async Task<int> SeedPendingReturnAsync(AppDbContext db, int tenantId)
    {
        var now = DateTime.UtcNow;
        db.Tenants.Add(new Tenant { Id = tenantId, Name = $"PG return {tenantId}", Subdomain = $"pg-ret-{tenantId}" });
        db.Users.Add(new User
        {
            Id = tenantId,
            TenantId = tenantId,
            OwnerId = tenantId,
            Name = "PG fixture",
            Email = $"pg-{tenantId}@example.test",
            PasswordHash = "fixture",
            Role = UserRole.Owner,
            CreatedAt = now
        });
        var product = new Product
        {
            Id = tenantId,
            TenantId = tenantId,
            OwnerId = tenantId,
            NameEn = "PG return product",
            Sku = $"PG-{tenantId}",
            StockQty = 8,
            CostPrice = 25,
            ConversionToBase = 12,
            CreatedAt = now,
            UpdatedAt = now
        };
        var line = new SaleItem { Id = tenantId, SaleId = tenantId, ProductId = tenantId, Qty = 2, UnitPrice = 50, LineTotal = 100 };
        SaleCostBasis.Capture(line, product, tenantId, true);
        db.Products.Add(product);
        db.Sales.Add(new Sale
        {
            Id = tenantId,
            TenantId = tenantId,
            OwnerId = tenantId,
            CreatedBy = tenantId,
            InvoiceNo = $"PG-INV-{tenantId}",
            InvoiceDate = now,
            CreatedAt = now,
            GrandTotal = 100
        });
        db.SaleItems.Add(line);
        var saleReturn = new SaleReturn
        {
            Id = tenantId,
            TenantId = tenantId,
            OwnerId = tenantId,
            SaleId = tenantId,
            CreatedBy = tenantId,
            ReturnNo = $"PG-RET-{tenantId}",
            ReturnDate = now,
            CreatedAt = now,
            Status = ReturnStatus.Pending,
            GrandTotal = 50
        };
        db.SaleReturns.Add(saleReturn);
        db.SaleReturnItems.Add(new SaleReturnItem
        {
            Id = tenantId,
            SaleReturnId = tenantId,
            SaleItemId = tenantId,
            ProductId = tenantId,
            Qty = 1,
            UnitPrice = 50,
            LineTotal = 50,
            StockEffect = true,
            Condition = "resellable"
        });
        await db.SaveChangesAsync();
        product.ConversionToBase = 24;
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return tenantId;
    }

    private static async Task CleanupTenantAsync(AppDbContext db, int tenantId)
    {
        await db.InventoryTransactions.Where(t => t.TenantId == tenantId).ExecuteDeleteAsync();
        await db.SaleReturnItems.Where(i => i.SaleReturnId == tenantId).ExecuteDeleteAsync();
        await db.SaleReturns.Where(r => r.TenantId == tenantId).ExecuteDeleteAsync();
        await db.SaleItems.Where(i => i.SaleId == tenantId).ExecuteDeleteAsync();
        await db.Sales.Where(s => s.TenantId == tenantId).ExecuteDeleteAsync();
        await db.Products.Where(p => p.TenantId == tenantId).ExecuteDeleteAsync();
        await db.Users.Where(u => u.TenantId == tenantId).ExecuteDeleteAsync();
        await db.Tenants.Where(t => t.Id == tenantId).ExecuteDeleteAsync();
    }
}
