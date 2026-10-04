using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Modules.Reports;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;

namespace HexaBill.Tests;

public class VatBasisIsolationTests
{
    [Fact(DisplayName = "FIN13_ChangingOneTenantBasis_LeavesPeerTenantsAndSalesBoxesUnchanged")]
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
        // D5: ProfitVat is never filing VAT; estimate flag + ProfitAmount carry the operating view.
        Assert.Equal(0, afterChanged.ProfitVat);
        Assert.True(afterChanged.ProfitEstimateNotForFiling);
        Assert.True(afterChanged.ProfitAmount != 0 || afterChanged.ProfitSales > 0);
        Assert.Equal(historyBefore[3] + 1, await context.TenantVatBasisHistory.CountAsync(h => h.TenantId == 3));
    }

    [Fact(DisplayName = "FIN13_FutureBasisHistoryRow_DoesNotChangeSalesBasedTenantProfitVat")]
    public async Task FutureBasisHistoryRow_DoesNotChangeSalesBasedTenantProfitVat()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("VatFin13_" + Guid.NewGuid())
            .Options;
        await using var context = new AppDbContext(options);
        context.SetRequestTenantScope(null, isPlatformScope: true);
        await context.Database.EnsureCreatedAsync();

        var when = new DateTime(2025, 6, 15, 10, 0, 0, DateTimeKind.Utc);
        context.Tenants.Add(new Tenant
        {
            Id = 1,
            Name = "Sales tenant",
            Subdomain = "sales",
            Country = "AE",
            Currency = "AED",
            VatCalculationBasis = VatCalculationBasis.SalesBased
        });
        context.TenantVatBasisHistory.Add(new TenantVatBasisHistory
        {
            TenantId = 1,
            Basis = VatCalculationBasis.SalesBased,
            EffectiveFrom = when,
            SetByUserId = 1,
            CreatedAt = when
        });
        context.Products.Add(new Product
        {
            Id = 1,
            OwnerId = 1,
            TenantId = 1,
            Sku = "Z1",
            NameEn = "Item",
            UnitType = "PIECE",
            ConversionToBase = 1,
            CostPrice = 10
        });
        context.Sales.Add(new Sale
        {
            Id = 1,
            TenantId = 1,
            OwnerId = 1,
            InvoiceNo = "Z-1",
            InvoiceDate = when,
            Subtotal = 100m,
            VatTotal = 5m,
            GrandTotal = 105m,
            IsDeleted = false,
            VatScenario = "Standard",
            CreatedBy = 1,
            CreatedAt = when
        });
        context.SaleItems.Add(new SaleItem
        {
            SaleId = 1,
            ProductId = 1,
            UnitType = "PIECE",
            Qty = 2,
            UnitPrice = 50m,
            LineTotal = 100m
        });
        await context.SaveChangesAsync();

        var service = new VatReturnReportService(context, NullLogger<VatReturnReportService>.Instance);
        var from = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var before = await service.GetVatReturn201Async(1, from, to);

        context.TenantVatBasisHistory.Add(new TenantVatBasisHistory
        {
            TenantId = 1,
            Basis = VatCalculationBasis.ProfitBased,
            EffectiveFrom = when.AddYears(1),
            SetByUserId = 1,
            CreatedAt = when.AddDays(1)
        });
        await context.SaveChangesAsync();

        var after = await service.GetVatReturn201Async(1, from, to);
        Assert.Equal(before.Box1a, after.Box1a);
        Assert.Equal(before.Box1b, after.Box1b);
        Assert.Equal(before.ProfitVat, after.ProfitVat);
        Assert.Equal(0, after.ProfitVat);
        Assert.Equal(nameof(VatCalculationBasis.SalesBased), after.VatCalculationBasis);
    }

    [Fact(DisplayName = "FIN13_EffectiveDatingFlag_UsesHistoryAsOfPeriodEnd_NotCurrentColumn")]
    public async Task EffectiveDatingFlag_UsesHistoryAsOfPeriodEnd_NotCurrentColumn()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("VatFin13Eff_" + Guid.NewGuid())
            .Options;
        await using var context = new AppDbContext(options);
        context.SetRequestTenantScope(null, isPlatformScope: true);
        await context.Database.EnsureCreatedAsync();

        var salesStart = new DateTime(2025, 5, 10, 0, 0, 0, DateTimeKind.Utc);
        var profitEffective = new DateTime(2025, 7, 1, 0, 0, 0, DateTimeKind.Utc);
        context.Tenants.Add(new Tenant
        {
            Id = 1,
            Name = "Margin tenant",
            Subdomain = "margin",
            Country = "AE",
            Currency = "AED",
            VatCalculationBasis = VatCalculationBasis.ProfitBased,
            FeaturesJson = $"[\"{TenantFeatureFlags.VatBasisEffectiveDating}\"]"
        });
        context.TenantVatBasisHistory.Add(new TenantVatBasisHistory
        {
            TenantId = 1,
            Basis = VatCalculationBasis.SalesBased,
            EffectiveFrom = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            SetByUserId = 1,
            CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        });
        context.TenantVatBasisHistory.Add(new TenantVatBasisHistory
        {
            TenantId = 1,
            Basis = VatCalculationBasis.ProfitBased,
            EffectiveFrom = profitEffective,
            SetByUserId = 1,
            CreatedAt = profitEffective
        });
        context.Products.Add(new Product
        {
            Id = 1,
            OwnerId = 1,
            TenantId = 1,
            Sku = "M1",
            NameEn = "Item",
            UnitType = "PIECE",
            ConversionToBase = 1,
            CostPrice = 40
        });
        var salesAfterProfit = profitEffective.AddDays(15);
        context.Sales.Add(new Sale
        {
            Id = 1,
            TenantId = 1,
            OwnerId = 1,
            InvoiceNo = "M-1",
            InvoiceDate = salesStart,
            Subtotal = 100m,
            VatTotal = 5m,
            GrandTotal = 105m,
            IsDeleted = false,
            VatScenario = "Standard",
            CreatedBy = 1,
            CreatedAt = salesStart
        });
        context.Sales.Add(new Sale
        {
            Id = 2,
            TenantId = 1,
            OwnerId = 1,
            InvoiceNo = "M-2",
            InvoiceDate = salesAfterProfit,
            Subtotal = 200m,
            VatTotal = 10m,
            GrandTotal = 210m,
            IsDeleted = false,
            VatScenario = "Standard",
            CreatedBy = 1,
            CreatedAt = salesAfterProfit
        });
        context.SaleItems.Add(new SaleItem
        {
            SaleId = 1,
            ProductId = 1,
            UnitType = "PIECE",
            Qty = 2,
            UnitPrice = 50m,
            LineTotal = 100m
        });
        context.SaleItems.Add(new SaleItem
        {
            SaleId = 2,
            ProductId = 1,
            UnitType = "PIECE",
            Qty = 4,
            UnitPrice = 50m,
            LineTotal = 200m
        });
        context.Expenses.Add(new Expense
        {
            TenantId = 1,
            OwnerId = 1,
            CategoryId = 1,
            Amount = 10m,
            Date = salesStart,
            CreatedBy = 1,
            CreatedAt = salesStart
        });
        await context.SaveChangesAsync();

        var service = new VatReturnReportService(context, NullLogger<VatReturnReportService>.Instance);
        var h1From = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var h1To = profitEffective;
        var h1 = await service.GetVatReturn201Async(1, h1From, h1To);
        Assert.Equal(nameof(VatCalculationBasis.SalesBased), h1.VatCalculationBasis);
        Assert.Equal(0, h1.ProfitVat);

        var h2From = profitEffective;
        var h2To = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var h2 = await service.GetVatReturn201Async(1, h2From, h2To);
        Assert.Equal(nameof(VatCalculationBasis.ProfitBased), h2.VatCalculationBasis);
        Assert.Equal(0, h2.ProfitVat);
        Assert.True(h2.ProfitEstimateNotForFiling);
        Assert.True(h2.ProfitAmount != 0 || h2.ProfitSales > 0);
    }

    [Fact(DisplayName = "FIN12_ProfitEstimate_NotFivePercentVat_StandardBoxesRemain")]
    public async Task ProfitVat_UsesSalesMinusCogsMinusExpenses()
    {
        await using var context = await CreateProfitTenantContextAsync();
        var when = new DateTime(2025, 8, 1, 0, 0, 0, DateTimeKind.Utc);
        var product = new Product
        {
            Id = 1,
            OwnerId = 1,
            TenantId = 1,
            Sku = "M",
            NameEn = "Margin item",
            UnitType = "PIECE",
            ConversionToBase = 1,
            CostPrice = 40m
        };
        var line = new SaleItem { SaleId = 1, ProductId = 1, UnitType = "PIECE", Qty = 2, UnitPrice = 50m, LineTotal = 100m };
        SaleCostBasis.Capture(line, product, 1, enabled: true);
        context.Products.Add(product);
        context.Sales.Add(new Sale
        {
            Id = 1,
            TenantId = 1,
            OwnerId = 1,
            InvoiceNo = "MARGIN-1",
            InvoiceDate = when,
            Subtotal = 100m,
            VatTotal = 5m,
            GrandTotal = 105m,
            IsDeleted = false,
            VatScenario = "Standard",
            CreatedBy = 1,
            CreatedAt = when
        });
        context.SaleItems.Add(line);
        context.Expenses.Add(new Expense
        {
            TenantId = 1,
            OwnerId = 1,
            CategoryId = 1,
            Amount = 15m,
            Date = when,
            CreatedBy = 1,
            CreatedAt = when
        });
        await context.SaveChangesAsync();

        var dto = await new VatReturnReportService(context, NullLogger<VatReturnReportService>.Instance)
            .GetVatReturn201Async(1, new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc), new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc));

        const decimal expectedProfit = 105m - 80m - 15m;
        Assert.Equal(VatCalculator.Round(expectedProfit), dto.ProfitAmount);
        // D5: never treat profit × 5% as VAT. Standard boxes remain the filing figures.
        Assert.Equal(0m, dto.ProfitVat);
        Assert.True(dto.ProfitEstimateNotForFiling);
        Assert.True(dto.Box1b > 0);
        Assert.NotEqual(VatCalculator.Round(expectedProfit * VatCalculator.StandardRate), dto.ProfitVat);
    }

    [Fact(DisplayName = "FIN12_ZeroOrNegativeMargin_ProfitVatIsZero")]
    public async Task ZeroOrNegativeMargin_ProfitVatIsZero()
    {
        await using var context = await CreateProfitTenantContextAsync();
        var when = new DateTime(2025, 9, 1, 0, 0, 0, DateTimeKind.Utc);
        var product = new Product
        {
            Id = 1,
            OwnerId = 1,
            TenantId = 1,
            Sku = "L",
            NameEn = "Loss item",
            UnitType = "PIECE",
            ConversionToBase = 1,
            CostPrice = 50m
        };
        var line = new SaleItem { SaleId = 1, ProductId = 1, UnitType = "PIECE", Qty = 1, UnitPrice = 60m, LineTotal = 60m };
        SaleCostBasis.Capture(line, product, 1, enabled: true);
        context.Products.Add(product);
        context.Sales.Add(new Sale
        {
            Id = 1,
            TenantId = 1,
            OwnerId = 1,
            InvoiceNo = "LOSS-1",
            InvoiceDate = when,
            Subtotal = 60m,
            VatTotal = 3m,
            GrandTotal = 63m,
            IsDeleted = false,
            VatScenario = "Standard",
            CreatedBy = 1,
            CreatedAt = when
        });
        context.SaleItems.Add(line);
        context.Expenses.Add(new Expense
        {
            TenantId = 1,
            OwnerId = 1,
            CategoryId = 1,
            Amount = 20m,
            Date = when,
            CreatedBy = 1,
            CreatedAt = when
        });
        await context.SaveChangesAsync();

        var dto = await new VatReturnReportService(context, NullLogger<VatReturnReportService>.Instance)
            .GetVatReturn201Async(1, new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc), new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc));

        Assert.True(dto.ProfitAmount <= 0);
        Assert.Equal(0, dto.ProfitVat);
        Assert.True(dto.Box1b > 0);
    }

    private static async Task<AppDbContext> CreateProfitTenantContextAsync()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("VatFin12_" + Guid.NewGuid())
            .Options;
        var context = new AppDbContext(options);
        context.SetRequestTenantScope(null, isPlatformScope: true);
        await context.Database.EnsureCreatedAsync();
        context.Tenants.Add(new Tenant
        {
            Id = 1,
            Name = "Profit margin tenant",
            Subdomain = "margin",
            Country = "AE",
            Currency = "AED",
            VatCalculationBasis = VatCalculationBasis.ProfitBased
        });
        context.TenantVatBasisHistory.Add(new TenantVatBasisHistory
        {
            TenantId = 1,
            Basis = VatCalculationBasis.ProfitBased,
            EffectiveFrom = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            SetByUserId = 1,
            CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        });
        await context.SaveChangesAsync();
        return context;
    }

    [Fact(DisplayName = "FIN13_ApplyTenantBasisChange_NoOpWhenBasisUnchanged")]
    public async Task ApplyTenantBasisChange_NoOpWhenBasisUnchanged()
    {
        await using var context = await CreateProfitTenantContextAsync();
        var tenant = await context.Tenants.FirstAsync(t => t.Id == 1);
        var historyBefore = await context.TenantVatBasisHistory.CountAsync(h => h.TenantId == 1);

        var changed = await VatBasisResolver.ApplyTenantBasisChangeAsync(
            context,
            tenant,
            VatCalculationBasis.ProfitBased,
            DateTime.UtcNow,
            1);

        Assert.False(changed);
        Assert.Equal(historyBefore, await context.TenantVatBasisHistory.CountAsync(h => h.TenantId == 1));
    }
}
