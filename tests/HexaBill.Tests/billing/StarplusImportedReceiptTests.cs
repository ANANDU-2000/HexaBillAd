using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Payments;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using System.Text.Json;

namespace HexaBill.Tests;

/// <summary>P0-NUM-003: imported Starplus receipts (SnapshotJson '{"marker": "starplus:...') are preserved history.
/// Synthetic data only, in the importer's exact key shape.</summary>
public class StarplusImportedReceiptTests
{
    private static string ImportedSnapshot(int sourceId, string number, params int[] targetPayments) =>
        JsonSerializer.Serialize(new Dictionary<string, object>
        {
            ["marker"] = $"starplus:{sourceId}", ["legacy_source"] = "starplus", ["source_receipt_id"] = sourceId,
            ["original_receipt_number"] = number, ["source_payment_ids"] = targetPayments.Select(p => p + 9000).ToArray(),
            ["target_payment_ids"] = targetPayments,
        }).Replace("{\"marker\":", "{\"marker\": ");   // importer writes json.dumps spacing

    private static async Task<AppDbContext> SevenImportedReceiptsOnOnePaymentAsync()
    {
        var db = await CreateDbAsync();
        db.Payments.Add(Payment(2, 50m));
        for (var i = 1; i <= 7; i++)
        {
            // receipt 7 covers payments 1 and 2 (multi-payment receipt linked to its first payment)
            var targets = i == 7 ? new[] { 1, 2 } : new[] { 1 };
            db.PaymentReceipts.Add(new PaymentReceipt { Id = 100 + i, TenantId = 10, PaymentId = 1,
                ReceiptNumber = $"REC-2026-000{i}", GeneratedByUserId = 1,
                GeneratedAt = new DateTime(2026, 1, i, 9, 0, 0, DateTimeKind.Utc),
                SnapshotJson = ImportedSnapshot(500 + i, $"REC-2026-000{i}", targets) });
        }
        await db.SaveChangesAsync();
        return db;
    }

    [Fact]
    public void Marker_MatchesImporterPrefixOnly()
    {
        Assert.True(PaymentReceiptService.IsStarplusImported(ImportedSnapshot(1, "R-1", 1)));
        Assert.False(PaymentReceiptService.IsStarplusImported("{\"Version\":1}"));
        Assert.False(PaymentReceiptService.IsStarplusImported("{\"marker\":\"starplus:1\"}"));
        Assert.False(PaymentReceiptService.IsStarplusImported(null));
    }

    [Fact]
    public async Task Generate_ForPaymentWithSevenImportedReceipts_ReturnsNewestExisting_NoNewRow()
    {
        await using var db = await SevenImportedReceiptsOnOnePaymentAsync();
        var before = db.PaymentReceipts.ToDictionary(r => r.Id, r => r.SnapshotJson);
        var detail = await Service(db).GenerateReceiptAsync(10, 1, 1);
        Assert.Equal("REC-2026-0007", detail.ReceiptNumber);
        Assert.True(detail.IsImportedHistory);
        Assert.Equal(150m, detail.AmountReceived);
        Assert.Equal(7, db.PaymentReceipts.Count());
        Assert.All(db.PaymentReceipts, r => Assert.Equal(before[r.Id], r.SnapshotJson));
        var single = await Service(db).GetReceiptByPaymentIdAsync(1, 10);
        Assert.Equal(107, single!.Id);
    }

    [Fact]
    public async Task EachImportedReceipt_ById_ReturnsItsOwnNumberAndPayments()
    {
        await using var db = await SevenImportedReceiptsOnOnePaymentAsync();
        for (var i = 1; i <= 7; i++)
        {
            var detail = await Service(db).GetReceiptDetailByIdAsync(10, 100 + i, 1);
            Assert.NotNull(detail);
            Assert.Equal($"REC-2026-000{i}", detail!.ReceiptNumber);
            Assert.True(detail.IsImportedHistory);
            Assert.Equal(i == 7 ? 2 : 1, detail.Invoices.Count);
            Assert.Equal(i == 7 ? 150m : 100m, detail.AmountReceived);
        }
        Assert.Null(await Service(db).GetReceiptDetailByIdAsync(11, 101, 1));
        Assert.Equal(7, db.PaymentReceipts.Count());
    }

    [Fact]
    public async Task ListByPayment_ReturnsAllSeven_NewestFirst()
    {
        await using var db = await SevenImportedReceiptsOnOnePaymentAsync();
        var list = await Service(db).GetReceiptsByPaymentIdAsync(1, 10);
        Assert.Equal(Enumerable.Range(1, 7).Reverse().Select(i => 100 + i), list.Select(r => r.Id));
        Assert.All(list, r => Assert.True(r.IsImported));
        Assert.Empty(await Service(db).GetReceiptsByPaymentIdAsync(1, 11));
    }

    [Fact]
    public async Task NormalVersion1Snapshot_StillValidates_AndById_Works()
    {
        await using var db = await CreateDbAsync();
        db.Tenants.Add(new Tenant { Id = 10, Name = "T", Subdomain = "t", FeaturesJson = "[\"receipt_snapshots\"]" });
        await db.SaveChangesAsync();
        var first = await Service(db).GenerateReceiptAsync(10, 1, 1);
        var reprint = await Service(db).GenerateReceiptAsync(10, 1, 1);
        Assert.Equal(first.ReceiptNumber, reprint.ReceiptNumber);
        Assert.False(reprint.IsImportedHistory);
        var row = db.PaymentReceipts.Single();
        var byId = await Service(db).GetReceiptDetailByIdAsync(10, row.Id, 1);
        Assert.Equal(row.ReceiptNumber, byId!.ReceiptNumber);
        Assert.Single(db.PaymentReceipts);
    }

    [Fact]
    public async Task CorruptNonStarplusSnapshot_StillThrows()
    {
        await using var db = await CreateDbAsync();
        db.PaymentReceipts.Add(new PaymentReceipt { Id = 1, TenantId = 10, PaymentId = 1, ReceiptNumber = "REC-2026-0001",
            GeneratedByUserId = 1, GeneratedAt = DateTime.UtcNow, SnapshotJson = "{\"marker\": \"other:1\"" });
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service(db).GenerateReceiptAsync(10, 1, 1));
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service(db).GetReceiptDetailByIdAsync(10, 1, 1));
        Assert.Single(db.PaymentReceipts);
    }

    private static PaymentReceiptService Service(AppDbContext db) => new(db, NullLogger<PaymentReceiptService>.Instance);
    private static Payment Payment(int id, decimal amount = 100m) => new()
    {
        Id = id, TenantId = 10, OwnerId = 10, CustomerId = 1, SaleId = 1,
        Amount = amount, Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED, CreatedBy = 1,
        PaymentDate = new DateTime(2026, 1, id, 12, 0, 0, DateTimeKind.Utc), CreatedAt = DateTime.UtcNow,
    };
    private static async Task<AppDbContext> CreateDbAsync()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("StarplusReceipts_" + Guid.NewGuid())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning));
        var db = new AppDbContext(options.Options);
        db.SetRequestTenantScope(10, false);
        await db.Database.EnsureCreatedAsync();
        db.Customers.Add(new Customer { Id = 1, TenantId = 10, OwnerId = 10, Name = "Synthetic customer" });
        db.Sales.Add(new Sale { Id = 1, TenantId = 10, OwnerId = 10, CustomerId = 1,
            InvoiceNo = "SYN-1", GrandTotal = 1000, InvoiceDate = new DateTime(2026, 1, 1), CreatedBy = 1 });
        db.Payments.Add(Payment(1));
        db.Settings.Add(new Setting { TenantId = 10, OwnerId = 10, Key = "COMPANY_NAME_EN", Value = "Synthetic company" });
        await db.SaveChangesAsync();
        return db;
    }
}
