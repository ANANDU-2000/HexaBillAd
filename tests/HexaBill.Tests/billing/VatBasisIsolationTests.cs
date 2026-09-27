using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Reports;

namespace HexaBill.Tests;

public class VatBasisIsolationTests
{
    [Fact]
    public async Task ChangingOneTenantBasis_LeavesTheOtherTwoOutputsAndHistoryUnchanged()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("VatBasisIsolation_" + Guid.NewGuid())
            .Options;
        await using var context = new AppDbContext(options);
        context.SetRequestTenantScope(null, isPlatformScope: true);
        await context.Database.EnsureCreatedAsync();

        var when = new DateTime(2025, 6, 15, 10, 0, 0, DateTimeKind.Utc);
        for (var id = 1; id <= 3; id++)
        {
            context.Tenants.Add(new Tenant
            {
                Id = id,
                Name = "Tenant " + id,
                Subdomain = "tenant-" + id,
                Country = "AE",
                Currency = "AED",
                VatCalculationBasis = id == 2 ? VatCalculationBasis.ProfitBased : VatCalculationBasis.SalesBased
            });
            context.TenantVatBasisHistory.Add(new TenantVatBasisHistory
            {
                TenantId = id,
                Basis = id == 2 ? VatCalculationBasis.ProfitBased : VatCalculationBasis.SalesBased,
                EffectiveFrom = when,
                SetByUserId = 1,
                CreatedAt = when
            });
            context.Products.Add(new Product
            {
                Id = id,
                OwnerId = id,
                TenantId = id,
                Sku = "SKU-" + id,
                NameEn = "Item " + id,
                UnitType = "PIECE",
                ConversionToBase = 1,
                CostPrice = 10
            });
            context.Sales.Add(new Sale
            {
                Id = id,
                TenantId = id,
                OwnerId = id,
                InvoiceNo = "INV-" + id,
                InvoiceDate = when,
                Subtotal = id * 100m,
                VatTotal = id * 5m,
                GrandTotal = id * 105m,
                IsDeleted = false,
                VatScenario = "Standard",
                CreatedBy = 1,
                CreatedAt = when
            });
            context.SaleItems.Add(new SaleItem
            {
                SaleId = id,
                ProductId = id,
                UnitType = "PIECE",
                Qty = 2,
                UnitPrice = id * 50m,
                LineTotal = id * 100m
            });
            context.Expenses.Add(new Expense
            {
                TenantId = id,
                OwnerId = id,
                CategoryId = 1,
                Amount = id * 5m,
                Date = when,
                CreatedBy = 1,
                CreatedAt = when
            });
        }
        await context.SaveChangesAsync();

        var service = new VatReturnReportService(context, NullLogger<VatReturnReportService>.Instance);
        var from = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var before = new Dictionary<int, VatReturn201Dto>();
        var historyBefore = new Dictionary<int, int>();
        for (var id = 1; id <= 3; id++)
        {
            before[id] = await service.GetVatReturn201Async(id, from, to);
            historyBefore[id] = await context.TenantVatBasisHistory.CountAsync(h => h.TenantId == id);
        }

        var changed = await context.Tenants.SingleAsync(t => t.Id == 3);
        changed.VatCalculationBasis = VatCalculationBasis.ProfitBased;
        context.TenantVatBasisHistory.Add(new TenantVatBasisHistory
        {
            TenantId = 3,
            Basis = VatCalculationBasis.ProfitBased,
            EffectiveFrom = when.AddDays(1),
            SetByUserId = 1,
            CreatedAt = when.AddDays(1)
        });
        await context.SaveChangesAsync();

        for (var id = 1; id <= 2; id++)
        {
            var after = await service.GetVatReturn201Async(id, from, to);
            Assert.Equal(before[id].Box1a, after.Box1a);
            Assert.Equal(before[id].Box1b, after.Box1b);
            Assert.Equal(before[id].Box13a, after.Box13a);
            Assert.Equal(before[id].ProfitSales, after.ProfitSales);
            Assert.Equal(before[id].ProfitCogs, after.ProfitCogs);
            Assert.Equal(before[id].ProfitExpenses, after.ProfitExpenses);
            Assert.Equal(before[id].ProfitVat, after.ProfitVat);
            Assert.Equal(before[id].VatCalculationBasis, after.VatCalculationBasis);
            Assert.Equal(historyBefore[id], await context.TenantVatBasisHistory.CountAsync(h => h.TenantId == id));
        }

        Assert.Equal(nameof(VatCalculationBasis.SalesBased), before[1].VatCalculationBasis);
        Assert.Equal(0, before[1].ProfitVat);
        Assert.Equal(nameof(VatCalculationBasis.ProfitBased), before[2].VatCalculationBasis);
        Assert.NotEqual(before[2].ProfitSales, before[1].ProfitSales);
        var afterChanged = await service.GetVatReturn201Async(3, from, to);
        Assert.Equal(before[3].Box1a, afterChanged.Box1a);
        Assert.Equal(before[3].Box1b, afterChanged.Box1b);
        Assert.Equal(nameof(VatCalculationBasis.ProfitBased), afterChanged.VatCalculationBasis);
        Assert.True(afterChanged.ProfitVat > 0);
        Assert.Equal(historyBefore[3] + 1, await context.TenantVatBasisHistory.CountAsync(h => h.TenantId == 3));
    }
}
