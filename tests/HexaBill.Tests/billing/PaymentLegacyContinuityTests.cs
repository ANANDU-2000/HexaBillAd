using System;
using System.Linq;
using System.Threading.Tasks;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Models.Legacy;
using HexaBill.Api.Modules.Payments;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HexaBill.Tests.Billing;

/// <summary>
/// FrozenHub 1 / Starplus continuity — the negative-ID convention.
/// Legacy Starplus invoices are surfaced to payment endpoints as NEGATIVE ids so they can
/// never collide with a live Sales row that happens to share the same numeric id. Payments
/// settle the LegacyInvoices row (never a Sales row).
/// </summary>
public class PaymentLegacyContinuityTests
{
    private static async Task<AppDbContext> DatabaseAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        db.SetRequestTenantScope(10, false);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        PaymentAllocationTests.Seed(db, 10, 1);
        // A live invoice whose id collides with the legacy invoice id below — must stay untouched.
        db.Sales.Add(new Sale
        {
            Id = 501, TenantId = 10, OwnerId = 10, CustomerId = 1, InvoiceNo = "LIVE-501", GrandTotal = 999m,
            PaidAmount = 0m, PaymentStatus = SalePaymentStatus.Pending, CreatedBy = 1, CreatedAt = DateTime.UtcNow, InvoiceDate = DateTime.UtcNow
        });
        db.LegacyInvoices.Add(new LegacyInvoice
        {
            Id = 501,
            TenantId = 10,
            SourceInvoiceId = 4403,
            SourceSystem = "Starplus",
            LegacyInvoiceNumber = "4403",
            LegacyIssuer = "Starplus Foodstuff Trading",
            InvoiceDate = new DateTime(2026, 4, 21, 0, 0, 0, DateTimeKind.Utc),
            DestinationCustomerId = 1,
            GrandTotal = 945m,
            TotalAmount = 945m,
            PaidAmount = 0m,
            OutstandingCalculated = 945m,
            Status = "Pending",
            IsDeleted = false
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        return db;
    }

    [Fact]
    public async Task LegacyPayment_NegativeSaleId_SettlesLegacyInvoice_NotTheCollidingLiveSale()
    {
        await using var db = await DatabaseAsync();
        var service = new PaymentService(db, NullLogger<PaymentService>.Instance, new ValidationService(db), null!, null!);

        var result = await service.CreatePaymentAsync(new CreatePaymentRequest
        {
            // NEGATIVE convention: -501 is the legacy invoice 4403, never LIVE-501.
            SaleId = -501,
            CustomerId = 1,
            Amount = 500m,
            Mode = "CASH"
        }, 1, 10);

        db.ChangeTracker.Clear();

        var payment = await db.Payments.AsNoTracking().SingleAsync();
        Assert.Equal(-501, payment.LegacyInvoiceId.HasValue ? -payment.LegacyInvoiceId : 0); // stored as +501
        Assert.Null(payment.SaleId);
        Assert.Equal(500m, payment.Amount);

        var legacy = await db.LegacyInvoices.AsNoTracking().SingleAsync(i => i.Id == 501);
        Assert.Equal(500m, legacy.PaidAmount);
        Assert.Equal(445m, legacy.OutstandingCalculated);

        // The colliding LIVE-501 sale must be completely untouched.
        var liveSale = await db.Sales.AsNoTracking().SingleAsync(s => s.Id == 501);
        Assert.Equal(0m, liveSale.PaidAmount);
        Assert.Equal(SalePaymentStatus.Pending, liveSale.PaymentStatus);

        // Invoice summary in the response names the legacy invoice, not the live sale.
        Assert.NotNull(result.Invoice);
        Assert.Equal("4403", result.Invoice!.InvoiceNo);
    }

    [Fact]
    public async Task LegacyPayment_NegativeSaleId_RejectsOverpaymentAgainstLegacyOutstanding()
    {
        await using var db = await DatabaseAsync();
        var service = new PaymentService(db, NullLogger<PaymentService>.Instance, new ValidationService(db), null!, null!);

        await Assert.ThrowsAsync<ArgumentException>(() => service.CreatePaymentAsync(new CreatePaymentRequest
        {
            SaleId = -501,
            CustomerId = 1,
            Amount = 1000m, // > 945 legacy outstanding
            Mode = "CASH"
        }, 1, 10));

        db.ChangeTracker.Clear();
        Assert.Empty(await db.Payments.ToListAsync());
        Assert.Equal(0m, (await db.LegacyInvoices.AsNoTracking().SingleAsync(i => i.Id == 501)).PaidAmount);
        Assert.Equal(0m, (await db.Sales.AsNoTracking().SingleAsync(s => s.Id == 501)).PaidAmount);
    }

    [Fact]
    public async Task LegacyOutstanding_IsReturnedWithNegativeId_AndIsolatedByTenant()
    {
        await using var db = await DatabaseAsync();
        db.SetRequestTenantScope(20, false);

        var customer20 = new Customer
        {
            Id = 136, TenantId = 20, OwnerId = 20, Name = "LEGACY BUYER", Balance = 945m,
            CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        };
        db.Customers.Add(customer20);
        db.LegacyInvoices.Add(new LegacyInvoice
        {
            Id = 601,
            TenantId = 20,
            SourceInvoiceId = 4403,
            SourceSystem = "Starplus",
            LegacyInvoiceNumber = "4403",
            LegacyIssuer = "Starplus Foodstuff Trading",
            InvoiceDate = new DateTime(2026, 4, 21, 0, 0, 0, DateTimeKind.Utc),
            DestinationCustomerId = 136,
            GrandTotal = 945m,
            TotalAmount = 945m,
            PaidAmount = 0m,
            OutstandingCalculated = 945m,
            Status = "Pending",
            IsDeleted = false
        });
        await db.SaveChangesAsync();

        var result = await new HexaBill.Api.Modules.Customers.CustomerService(db).GetOutstandingInvoicesAsync(136, 20);

        var legacyEntry = Assert.Single(result);
        Assert.True(legacyEntry.IsLegacy);
        Assert.Equal(-601, legacyEntry.Id);      // negative ID convention
        Assert.Equal(601, legacyEntry.LegacyInvoiceId); // positive id preserved
        Assert.Equal("4403", legacyEntry.InvoiceNo);
        Assert.Equal(945m, legacyEntry.BalanceAmount);
    }
}