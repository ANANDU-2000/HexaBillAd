using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Reports;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

public class SalesLedgerReceiptStateTests
{
    [Fact]
    public async Task LedgerPreservesAuthoritativePaymentStateAndAdjustmentEligibility()
    {
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("LedgerReceipt_" + Guid.NewGuid()).Options);
        db.SetRequestTenantScope(null, true);
        var day = new DateTime(2026, 10, 8, 0, 0, 0, DateTimeKind.Utc);
        db.Payments.AddRange(
            new Payment { Id = 1, TenantId = 10, Amount = 50, Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED, PaymentDate = day },
            new Payment { Id = 2, TenantId = 10, Amount = 20, Mode = PaymentMode.CHEQUE, Status = PaymentStatus.PENDING, PaymentDate = day },
            new Payment { Id = 3, TenantId = 10, Amount = 30, Mode = PaymentMode.CHEQUE, Status = PaymentStatus.RETURNED, PaymentDate = day },
            new Payment { Id = 4, TenantId = 10, Amount = 1, Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED, IsSettlementAdjustment = true, PaymentDate = day },
            new Payment { Id = 5, TenantId = 20, Amount = 99, Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED, PaymentDate = day });
        await db.SaveChangesAsync();
        db.SetRequestTenantScope(10, false);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var service = new ReportService(db, null!, null!, null!, null!, cache,
            NullLogger<ReportService>.Instance, new TimeZoneService(), null!);
        var report = await service.GetComprehensiveSalesLedgerAsync(10, day, day);
        Assert.Equal(4, report.Entries.Count);
        var rawState = typeof(SalesLedgerEntryDto).GetProperty("PaymentLineStatus");
        var adjustment = typeof(SalesLedgerEntryDto).GetProperty("IsSettlementAdjustment");
        Assert.NotNull(rawState);
        Assert.NotNull(adjustment);
        foreach (var (id, state) in new[] { (1,"CLEARED"), (2,"PENDING"), (3,"RETURNED"), (4,"CLEARED") })
        {
            var row = Assert.Single(report.Entries, r => r.PaymentId == id);
            Assert.Equal(state, rawState.GetValue(row));
            Assert.Equal(id == 4, adjustment.GetValue(row));
        }
        Assert.Equal("Paid", Assert.Single(report.Entries, r => r.PaymentId == 1).Status);
    }
}
