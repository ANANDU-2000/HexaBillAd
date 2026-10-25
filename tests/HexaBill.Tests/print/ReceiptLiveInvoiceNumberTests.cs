using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Payments;
using HexaBill.Api.Modules.Sales;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using UglyToad.PdfPig;

namespace HexaBill.Tests;

/// <summary>P0-PRINT-013: reprinted receipts show the sale's current invoice number (after a P0-NUM-004 renumber); the snapshot is never rewritten.</summary>
public class ReceiptLiveInvoiceNumberTests
{
    internal const int TenantId = 20;
    internal const int OtherTenantId = 22;
    internal const string OldNo = "1791254853";

    internal static async Task<AppDbContext> NewDbAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("ReceiptLiveNo_" + Guid.NewGuid())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)).Options);
        db.SetRequestTenantScope(null, true);
        db.Tenants.AddRange(
            new Tenant { Id = TenantId, Name = "Print QA", Subdomain = "print-qa", FeaturesJson = "[\"receipt_snapshots\"]" },
            new Tenant { Id = OtherTenantId, Name = "Other QA", Subdomain = "other-qa" });
        db.Settings.Add(new Setting { TenantId = TenantId, OwnerId = TenantId, Key = "COMPANY_NAME_EN", Value = "Print QA Trading" });
        db.Settings.Add(new Setting { TenantId = TenantId, OwnerId = TenantId, Key = InvoiceNumberService.SeriesStartSettingKey, Value = "7000" });
        db.Customers.Add(new Customer { Id = 1, TenantId = TenantId, OwnerId = TenantId, Name = "Fixture customer" });
        db.Sales.Add(new Sale { Id = 1, TenantId = TenantId, OwnerId = TenantId, CustomerId = 1, InvoiceNo = OldNo,
            InvoiceDate = new DateTime(2026, 10, 20, 9, 0, 0, DateTimeKind.Utc), GrandTotal = 720m, TotalAmount = 720m,
            PaidAmount = 200m, IsFinalized = true, CreatedBy = 1 });
        db.Payments.Add(new Payment { Id = 1, TenantId = TenantId, OwnerId = TenantId, CustomerId = 1, SaleId = 1, Amount = 200m,
            Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED, CreatedBy = 1,
            PaymentDate = new DateTime(2026, 10, 20, 10, 0, 0, DateTimeKind.Utc), CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
        return db;
    }

    internal static PaymentReceiptService Receipts(AppDbContext db) => new(db, NullLogger<PaymentReceiptService>.Instance);

    private static async Task Renumber(AppDbContext db, string newNo)
    {
        var svc = new InvoiceRenumberService(db, new InvoiceNumberService(db, new ConfigurationBuilder().Build()));
        var (outcome, problem, _) = await svc.ChangeAsync(1, TenantId, 77,
            new ChangeInvoiceNumberRequest { NewInvoiceNumber = newNo, Reason = "FH1 7000 series" }, false);
        Assert.True(outcome == InvoiceNumberChangeOutcome.Ok, problem);
    }

    [Fact]
    public async Task Reprint_AfterRenumber_ShowsNewNumber_SnapshotKeepsOld()
    {
        await using var db = await NewDbAsync();
        var first = await Receipts(db).GenerateReceiptAsync(TenantId, 1, 1);
        Assert.Equal(OldNo, first.Invoices.Single().InvoiceNo);
        await Renumber(db, "7001");
        db.ChangeTracker.Clear();

        var reprint = await Receipts(db).GenerateReceiptAsync(TenantId, 1, 1);
        Assert.Equal("7001", reprint.Invoices.Single().InvoiceNo);
        Assert.Equal(first.ReceiptNumber, reprint.ReceiptNumber);
        Assert.True(reprint.IsHistoricalSnapshot);

        var row = await db.PaymentReceipts.AsNoTracking().SingleAsync();
        Assert.Contains(OldNo, row.SnapshotJson);
        Assert.DoesNotContain("7001", row.SnapshotJson);
    }

    [Fact]
    public async Task ReprintById_AfterRenumber_ShowsNewNumber()
    {
        await using var db = await NewDbAsync();
        await Receipts(db).GenerateReceiptAsync(TenantId, 1, 1);
        await Renumber(db, "7002");
        db.ChangeTracker.Clear();
        var receiptId = (await db.PaymentReceipts.AsNoTracking().SingleAsync()).Id;
        var detail = await Receipts(db).GetReceiptDetailByIdAsync(TenantId, receiptId, 1);
        Assert.Equal("7002", detail!.Invoices.Single().InvoiceNo);
    }

    [Fact]
    public async Task ReceiptPdf_AfterRenumber_PrintsNewNumberNotOld()
    {
        await using var db = await NewDbAsync();
        await Receipts(db).GenerateReceiptAsync(TenantId, 1, 1);
        await Renumber(db, "7003");
        db.ChangeTracker.Clear();
        var detail = await Receipts(db).GenerateReceiptAsync(TenantId, 1, 1);
        var pdf = new PdfService(db, null!, new Fonts(), null!, null!, NullLogger<PdfService>.Instance, null!);
        var bytes = await pdf.GeneratePaymentReceiptPdfAsync(detail);
        using var doc = PdfDocument.Open(bytes);
        var text = string.Concat(doc.GetPages().Select(p => p.Text));
        Assert.Contains("7003", text);
        Assert.DoesNotContain(OldNo, text);
    }

    private sealed class Fonts : HexaBill.Api.Core.Storage.IFontService
    {
        public void RegisterFonts() { }
        public string GetArabicFontFamily() => "Arial";
        public string GetEnglishFontFamily() => "Arial";
    }
}
