using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Payments;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Logging.Abstractions;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Core.Storage;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text.Json;

namespace HexaBill.Tests;

public class PaymentReceiptTests
{
    [Theory]
    [InlineData(PaymentStatus.PENDING)]
    [InlineData(PaymentStatus.RETURNED)]
    [InlineData(PaymentStatus.VOID)]
    public async Task UnclearedPayment_CannotMintReceipt(PaymentStatus status)
    {
        await using var db = await CreateDbAsync();
        db.Payments.Single(p => p.Id == 1).Status = status;
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service(db).GenerateReceiptAsync(10, 1, 1));
        Assert.Empty(db.PaymentReceipts);
    }

    [Theory]
    [InlineData("refund")]
    [InlineData("credit")]
    [InlineData("zero")]
    [InlineData("negative")]
    public async Task NonIncomingEntry_CannotMintReceipt(string kind)
    {
        await using var db = await CreateDbAsync();
        var payment = db.Payments.Single(p => p.Id == 1);
        if (kind == "refund") payment.SaleReturnId = 99;
        if (kind == "credit") payment.Mode = PaymentMode.CREDIT;
        if (kind == "zero") payment.Amount = 0;
        if (kind == "negative") payment.Amount = -10;
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service(db).GenerateReceiptAsync(10, 1, 1));
        Assert.Empty(db.PaymentReceipts);
    }

    [Fact]
    public async Task SettlementAdjustment_CannotMintReceipt()
    {
        await using var db = await CreateDbAsync();
        db.Payments.Single(p => p.Id == 1).IsSettlementAdjustment = true;
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service(db).GenerateReceiptAsync(10, 1, 1));
        Assert.Empty(db.PaymentReceipts);
    }

    [Fact]
    public async Task MixedBatch_IsRejectedBeforeAnyReceiptIsCreated()
    {
        await using var db = await CreateDbAsync();
        db.Payments.Add(Payment(2, status: PaymentStatus.PENDING));
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service(db).GenerateBatchReceiptAsync(10, [1, 2], 1));
        Assert.Empty(db.PaymentReceipts);
    }

    [Fact]
    public async Task ReopeningReceipt_ReusesNumberAndDoesNotInventHistoricalBalance()
    {
        await using var db = await CreateDbAsync();
        var service = Service(db);
        var first = await service.GenerateReceiptAsync(10, 1, 1);
        db.Customers.Single(c => c.Id == 1).PendingBalance = 9999;
        await db.SaveChangesAsync();
        var reprint = await service.GenerateReceiptAsync(10, 1, 1);
        Assert.Equal(first.ReceiptNumber, reprint.ReceiptNumber);
        Assert.Equal(100m, reprint.AmountReceived);
        Assert.Equal("Receipt fixture company", reprint.CompanyName);
        Assert.Null(reprint.CompanyTrn);
        Assert.Null(reprint.CompanyNameAr);
        Assert.Null(reprint.CompanyPhone);
        Assert.Null(reprint.PreviousBalance);
        Assert.Null(reprint.RemainingBalance);
        Assert.Single(db.PaymentReceipts);
    }

    [Fact]
    public async Task DuplicateSelection_CountsPaymentOnce()
    {
        await using var db = await CreateDbAsync();
        var (detail, receipts) = await Service(db).GenerateBatchReceiptAsync(10, [1, 1], 1);
        Assert.Equal(100m, detail.AmountReceived);
        Assert.Single(receipts);
        Assert.Single(detail.Invoices);
    }

    [Fact]
    public async Task OtherTenantPayment_CannotBeSelectedOrDisclosed()
    {
        await using var db = await CreateDbAsync();
        db.SetRequestTenantScope(null, true);
        db.Payments.Add(new Payment { Id = 2, TenantId = 20, OwnerId = 20, Amount = 500,
            Status = PaymentStatus.CLEARED, Mode = PaymentMode.CASH });
        await db.SaveChangesAsync();
        db.SetRequestTenantScope(10, false);
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service(db).GenerateReceiptAsync(10, 2, 1));
        Assert.Empty(db.PaymentReceipts);
    }

    [Fact]
    public async Task DifferentCustomers_CannotShareCombinedReceipt()
    {
        await using var db = await CreateDbAsync();
        db.Customers.Add(new Customer { Id = 2, TenantId = 10, OwnerId = 10, Name = "Other customer" });
        var second = Payment(2);
        second.SaleId = null;
        second.CustomerId = 2;
        db.Payments.Add(second);
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service(db).GenerateBatchReceiptAsync(10, [1, 2], 1));
        Assert.Empty(db.PaymentReceipts);
    }

    [Theory]
    [InlineData("deleted")]
    [InlineData("mismatched-customer")]
    [InlineData("missing-invoice")]
    public async Task InvalidLinkedInvoice_CannotProduceProofOfPayment(string reason)
    {
        await using var db = await CreateDbAsync();
        var payment = db.Payments.Single(p => p.Id == 1);
        if (reason == "deleted") db.Sales.Single().IsDeleted = true;
        if (reason == "mismatched-customer") db.Sales.Single().CustomerId = null;
        if (reason == "missing-invoice") { payment.Sale = null; payment.SaleId = 999; }
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service(db).GenerateReceiptAsync(10, 1, 1));
        Assert.Empty(db.PaymentReceipts);
    }

    [Fact]
    public async Task VoidingPayment_PreventsReprintAsReceivedFunds()
    {
        await using var db = await CreateDbAsync();
        await Service(db).GenerateReceiptAsync(10, 1, 1);
        db.Payments.Single().Status = PaymentStatus.VOID;
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service(db).GenerateReceiptAsync(10, 1, 1));
        Assert.Single(db.PaymentReceipts);
    }

    [Fact]
    public async Task Snapshot_PreservesDocumentAfterCompanyCustomerInvoiceAndPaymentEdits()
    {
        await using var db = await CreateDbAsync();
        await EnableSnapshots(db);
        var first = await Service(db).GenerateReceiptAsync(10, 1, 1);
        var originalJson = db.PaymentReceipts.Single().SnapshotJson;
        db.Settings.Single().Value = "Changed company name";
        db.Customers.Single().Name = "Changed customer";
        db.Sales.Single().InvoiceNo = "CHANGED-2";
        db.Sales.Single().GrandTotal = 2000;
        db.Payments.Single().Amount = 80;
        db.Payments.Single().Reference = "Changed reference";
        await db.SaveChangesAsync();
        var reprint = await Service(db).GenerateReceiptAsync(10, 1, 1);
        Assert.True(reprint.IsHistoricalSnapshot);
        Assert.False(reprint.LegacyReconstruction);
        Assert.True(reprint.PaymentChangedSinceSnapshot);
        Assert.Equal(first.CompanyName, reprint.CompanyName);
        Assert.Equal(first.ReceivedFrom, reprint.ReceivedFrom);
        Assert.Equal("FIXTURE-1", reprint.Invoices.Single().InvoiceNo);
        Assert.Equal(1000m, reprint.Invoices.Single().InvoiceTotal);
        Assert.Equal(100m, reprint.AmountReceived);
        Assert.Null(reprint.Reference);
        Assert.Equal(originalJson, db.PaymentReceipts.Single().SnapshotJson);
    }

    [Fact]
    public async Task SnapshotFlag_DefaultOff_AndLegacyCaptureDoesNotClaimOriginalDetails()
    {
        await using var db = await CreateDbAsync();
        var original = await Service(db).GenerateReceiptAsync(10, 1, 1);
        Assert.Null(db.PaymentReceipts.Single().SnapshotJson);
        Assert.False(original.IsHistoricalSnapshot);
        await EnableSnapshots(db);
        var captured = await Service(db).GenerateReceiptAsync(10, 1, 1);
        Assert.True(captured.LegacyReconstruction);
        Assert.True(captured.IsHistoricalSnapshot);
        db.Tenants.Single().FeaturesJson = "[]";
        db.Settings.Single().Value = "Changed after flag rollback";
        await db.SaveChangesAsync();
        var reprint = await Service(db).GenerateReceiptAsync(10, 1, 1);
        Assert.Equal(captured.CompanyName, reprint.CompanyName);
        Assert.True(reprint.LegacyReconstruction);
    }

    [Fact]
    public async Task InvalidSnapshot_FailsWithoutReplacingEvidence()
    {
        await using var db = await CreateDbAsync();
        await EnableSnapshots(db);
        await Service(db).GenerateReceiptAsync(10, 1, 1);
        // Simulate corrupt imported/storage data rather than an authorized application update.
        var row = db.PaymentReceipts.Single();
        row.SnapshotJson = "{broken";
        db.Entry(row).Property(r => r.SnapshotJson).OriginalValue = "{broken";
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service(db).GenerateReceiptAsync(10, 1, 1));
        Assert.Equal("{broken", db.PaymentReceipts.Single().SnapshotJson);
        Assert.Single(db.PaymentReceipts);
    }

    [Fact]
    public async Task CombinedPreview_DoesNotMutateIndividualSnapshots()
    {
        await using var db = await CreateDbAsync();
        await EnableSnapshots(db);
        db.Payments.Add(Payment(2));
        await db.SaveChangesAsync();
        var (combined, _) = await Service(db).GenerateBatchReceiptAsync(10, [1, 2], 1);
        Assert.Equal(200m, combined.AmountReceived);
        Assert.Equal(2, combined.Invoices.Count);
        var saved = db.PaymentReceipts.ToDictionary(r => r.Id, r => r.SnapshotJson);
        var single = await Service(db).GenerateReceiptAsync(10, 1, 1);
        Assert.Equal(100m, single.AmountReceived);
        Assert.Single(single.Invoices);
        Assert.All(db.PaymentReceipts, r => Assert.Equal(saved[r.Id], r.SnapshotJson));
    }

    private static async Task EnableSnapshots(AppDbContext db)
    {
        var tenant = await db.Tenants.SingleOrDefaultAsync(t => t.Id == 10);
        if (tenant == null)
        {
            tenant = new Tenant { Id = 10, Name = "Receipt fixture company", Subdomain = "receipt-fixture" };
            db.Tenants.Add(tenant);
        }
        tenant.FeaturesJson = "[\"receipt_snapshots\"]";
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task ExistingSnapshot_CannotBeOverwrittenByApplicationSave()
    {
        await using var db = await CreateDbAsync();
        await EnableSnapshots(db);
        await Service(db).GenerateReceiptAsync(10, 1, 1);
        db.PaymentReceipts.Single().SnapshotJson = "replacement";
        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void SnapshotMigration_IsAdditiveNullableAndGeneratesForBothProviders(bool postgres)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>();
        if (postgres) options.UseNpgsql("Host=localhost;Database=fixture;Username=fixture;Password=unused");
        else options.UseSqlite("Data Source=:memory:");
        using var db = new AppDbContext(options.Options);
        var migration = new HexaBill.Api.Migrations.AddPaymentReceiptSnapshot();
        var operation = Assert.Single(migration.UpOperations.OfType<AddColumnOperation>());
        Assert.True(operation.IsNullable);
        Assert.Equal("PaymentReceipts", operation.Table);
        Assert.Equal("SnapshotJson", operation.Name);
        var index = Assert.Single(migration.UpOperations.OfType<CreateIndexOperation>());
        Assert.True(index.IsUnique);
        Assert.Equal("\"SnapshotJson\" IS NOT NULL", index.Filter);
        Assert.Throws<NotSupportedException>(() => migration.DownOperations);
        var commands = db.GetService<IMigrationsSqlGenerator>().Generate(migration.UpOperations, db.Model);
        Assert.Contains("ADD", string.Join("\n", commands.Select(c => c.CommandText)));
        Assert.Contains("20261003090000_AddPaymentReceiptSnapshot", db.Database.GetMigrations());
    }

    [Fact]
    public async Task Receipt_SeparatesCashReceivedFromSettlementAdjustment()
    {
        await using var db = await CreateDbAsync();
        db.Sales.Single().GrandTotal = 1331m;
        db.Payments.Single().Amount = 1330m;
        db.Payments.Add(new Payment
        {
            Id = 2, TenantId = 10, OwnerId = 10, CustomerId = 1, SaleId = 1, ParentPaymentId = 1,
            Amount = 1m, Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED, IsSettlementAdjustment = true,
            Reference = "Authorized rounding", CreatedBy = 1,
            PaymentDate = new DateTime(2026, 10, 1, 12, 0, 0, DateTimeKind.Utc), CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        var detail = await Service(db).GenerateReceiptAsync(10, 1, 1);
        Assert.Equal(1330m, detail.AmountReceived);
        Assert.Equal(1331m, detail.AmountPaid);
        Assert.Equal(1m, detail.SettlementAdjustmentAmount);
        Assert.Equal(1331m, detail.Invoices.Single().AmountApplied);
        Assert.Equal(1331m, detail.Invoices.Single().InvoiceTotal);
    }

    [Fact]
    public async Task Snapshot_CapturesSettlementAdjustmentOnFirstMint()
    {
        await using var db = await CreateDbAsync();
        await EnableSnapshots(db);
        db.Sales.Single().GrandTotal = 1331m;
        db.Payments.Single().Amount = 1330m;
        db.Payments.Add(new Payment
        {
            Id = 2, TenantId = 10, OwnerId = 10, CustomerId = 1, SaleId = 1, ParentPaymentId = 1,
            Amount = 1m, Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED, IsSettlementAdjustment = true,
            Reference = "Authorized rounding", CreatedBy = 1,
            PaymentDate = new DateTime(2026, 10, 1, 12, 0, 0, DateTimeKind.Utc), CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var detail = await Service(db).GenerateReceiptAsync(10, 1, 1);

        Assert.True(detail.IsHistoricalSnapshot);
        Assert.False(detail.LegacyReconstruction);
        Assert.Equal(1m, detail.SettlementAdjustmentAmount);
        var json = db.PaymentReceipts.Single().SnapshotJson;
        Assert.NotNull(json);
        using var doc = JsonDocument.Parse(json);
        var saved = doc.RootElement.GetProperty("Detail");
        Assert.Equal(1330m, saved.GetProperty("AmountReceived").GetDecimal());
        Assert.Equal(1331m, saved.GetProperty("AmountPaid").GetDecimal());
        Assert.Equal(1m, saved.GetProperty("SettlementAdjustmentAmount").GetDecimal());

        db.Payments.Single(p => p.IsSettlementAdjustment).Amount = 99m;
        await db.SaveChangesAsync();
        var reprint = await Service(db).GenerateReceiptAsync(10, 1, 1);
        Assert.Equal(1m, reprint.SettlementAdjustmentAmount);
        Assert.Equal(1331m, reprint.AmountPaid);
    }

    [Fact]
    public async Task ReceiptPdf_RendersSavedDetailsWithoutLoadingCurrentCompanySettings()
    {
        await using var db = await CreateDbAsync();
        var pdf = new PdfService(db, null!, new ReceiptFonts(), null!, null!, NullLogger<PdfService>.Instance, null!);
        var detail = new PaymentReceiptDetailDto
        {
            CompanyName = "Saved Fixture Trading LLC", CompanyNameAr = "شركة التجربة",
            CompanyAddress = "Abu Dhabi", CompanyTrn = "100123456789012",
            ReceiptNumber = "REC-FIXTURE-001", ReceivedFrom = "Saved customer", Currency = "AED",
            ReceiptDate = new DateTime(2026, 10, 1), PaymentMethod = "CASH", Reference = "Fixture reference",
            AmountReceived = 1330m, AmountPaid = 1330m, IsHistoricalSnapshot = true,
            Invoices = [new PaymentReceiptInvoiceLineDto { InvoiceNo = "INV-FIXTURE-001",
                InvoiceDate = new DateTime(2026, 10, 1), InvoiceTotal = 1331m, AmountApplied = 1330m }]
        };
        var bytes = await pdf.GeneratePaymentReceiptPdfAsync(detail);
        Assert.True(bytes.Length > 1000);
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(bytes, 0, 4));
        var artifact = Environment.GetEnvironmentVariable("HEXABILL_RECEIPT_PDF_FIXTURE");
        if (!string.IsNullOrWhiteSpace(artifact)) await File.WriteAllBytesAsync(artifact, bytes);
    }

    private sealed class ReceiptFonts : IFontService
    {
        public void RegisterFonts() { }
        public string GetArabicFontFamily() => "Arial";
        public string GetEnglishFontFamily() => "Arial";
    }

    [Fact]
    public async Task PdfEndpoint_ExportsReviewedSnapshotAndRefusesStalePreview()
    {
        await using var db = await CreateDbAsync();
        await EnableSnapshots(db);
        var reviewed = await Service(db).GenerateReceiptAsync(10, 1, 1);
        var controller = PdfController(db);
        var request = new PaymentReceiptPdfRequest { PaymentIds = [1], ExpectedDocumentFingerprint = reviewed.DocumentFingerprint };
        var file = Assert.IsType<FileContentResult>(await controller.DownloadReceiptPdf(request));
        Assert.Equal("application/pdf", file.ContentType);
        Assert.Equal("no-store", controller.Response.Headers.CacheControl);
        Assert.True(file.FileContents.Length > 1000);
        db.Payments.Single().Reference = "Changed after preview";
        await db.SaveChangesAsync();
        Assert.IsType<ConflictObjectResult>(await controller.DownloadReceiptPdf(request));
        Assert.Single(db.PaymentReceipts);
    }

    [Fact]
    public async Task PdfEndpoint_CannotCreateReceiptWithoutPreviewOrReadAnotherTenantReceipt()
    {
        await using var db = await CreateDbAsync();
        await EnableSnapshots(db);
        var request = new PaymentReceiptPdfRequest { PaymentIds = [1], ExpectedDocumentFingerprint = "not-reviewed" };
        Assert.IsType<BadRequestObjectResult>(await PdfController(db).DownloadReceiptPdf(request));
        Assert.Empty(db.PaymentReceipts);
        var reviewed = await Service(db).GenerateReceiptAsync(10, 1, 1);
        request.ExpectedDocumentFingerprint = reviewed.DocumentFingerprint;
        db.SetRequestTenantScope(20, false);
        Assert.IsType<BadRequestObjectResult>(await PdfController(db, 20).DownloadReceiptPdf(request));
    }

    private static PaymentsController PdfController(AppDbContext db, int tenantId = 10)
    {
        var pdf = new PdfService(db, null!, new ReceiptFonts(), null!, null!, NullLogger<PdfService>.Instance, null!);
        var controller = new PaymentsController(null!, Service(db), NullLogger<PaymentsController>.Instance, pdf, db);
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("tid", tenantId.ToString()),
                new Claim(ClaimTypes.NameIdentifier, "1"), new Claim(ClaimTypes.Role, "Owner")], "fixture"))
        } };
        return controller;
    }

    [Fact]
    public async Task InvoiceSelection_ExcludesSettlementAdjustmentRows()
    {
        await using var db = await CreateDbAsync();
        var adjustment = Payment(2);
        adjustment.IsSettlementAdjustment = true;
        db.Payments.Add(adjustment);
        await db.SaveChangesAsync();
        var ids = await Service(db).GetReceiptPaymentIdsForSaleAsync(10, 1);
        Assert.Single(ids);
        Assert.Equal(1, ids[0]);
    }

    [Fact]
    public async Task InvoiceSelection_ContainsAllEligiblePaymentsBeyondFirstPage()
    {
        await using var db = await CreateDbAsync();
        for (var id = 2; id <= 121; id++) db.Payments.Add(Payment(id));
        db.Payments.Add(Payment(122, PaymentStatus.PENDING));
        var refund = Payment(123); refund.SaleReturnId = 9; db.Payments.Add(refund);
        await db.SaveChangesAsync();
        var ids = await Service(db).GetReceiptPaymentIdsForSaleAsync(10, 1);
        Assert.Equal(121, ids.Count);
        Assert.Contains(121, ids);
        Assert.DoesNotContain(122, ids);
        Assert.DoesNotContain(123, ids);
        Assert.Empty(db.PaymentReceipts);
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service(db).GetReceiptPaymentIdsForSaleAsync(20, 1));
    }

    [Fact]
    public async Task InvoiceSelection_ReportsLimitRatherThanReturningPartialReceipt()
    {
        await using var db = await CreateDbAsync();
        for (var id = 2; id <= 501; id++) db.Payments.Add(Payment(id));
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service(db).GetReceiptPaymentIdsForSaleAsync(10, 1));
        Assert.Empty(db.PaymentReceipts);
    }

    [Fact]
    public async Task PaymentList_FiltersCustomerBeforePaginationAndIncludesRefundIdentity()
    {
        await using var db = await CreateDbAsync();
        db.Customers.Add(new Customer { Id = 2, TenantId = 10, OwnerId = 10, Name = "Other customer" });
        var other = Payment(2); other.CustomerId = 2; other.SaleId = null;
        other.PaymentDate = DateTime.UtcNow; db.Payments.Add(other);
        var refund = Payment(3); refund.SaleReturnId = 99; db.Payments.Add(refund);
        await db.SaveChangesAsync();
        var service = new PaymentService(db, NullLogger<PaymentService>.Instance, null!, null!, null!);
        var page = await service.GetPaymentsAsync(10, page: 1, pageSize: 1, customerId: 1);
        Assert.Equal(2, page.TotalCount);
        Assert.Equal(1, page.Items.Single().CustomerId);
        Assert.Equal(99, page.Items.Single().SaleReturnId);
        var otherPage = await service.GetPaymentsAsync(10, customerId: 2);
        Assert.Single(otherPage.Items);
        Assert.Equal(2, otherPage.Items.Single().Id);
    }

    [Fact]
    public async Task CashInvoice_CanCombineItsOwnPaymentsButNotDifferentUnknownCustomers()
    {
        await using var db = await CreateDbAsync();
        db.Payments.Single().CustomerId = null;
        db.Sales.Single().CustomerId = null;
        var second = Payment(2); second.CustomerId = null; db.Payments.Add(second);
        await db.SaveChangesAsync();
        var (detail, _) = await Service(db).GenerateBatchReceiptAsync(10, [1, 2], 1);
        Assert.Equal(200m, detail.AmountReceived);
        Assert.Equal("Cash customer", detail.ReceivedFrom);
        var unknown = Payment(3); unknown.CustomerId = null; unknown.SaleId = null;
        db.Payments.Add(unknown); await db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service(db).GenerateBatchReceiptAsync(10, [1, 3], 1));
    }

    [Fact]
    public async Task RelationalFailure_RollsBackWholeBatchAndDetachesFailedAttemptRows()
    {
        var failure = new FailSecondReceiptSave();
        await using var db = await CreateDbAsync(sqlite: true, interceptor: failure);
        db.Payments.Add(Payment(2));
        await db.SaveChangesAsync();
        failure.Enabled = true;
        await Assert.ThrowsAsync<InjectedReceiptFailure>(() => Service(db).GenerateBatchReceiptAsync(10, [1, 2], 1));
        Assert.Empty(await db.PaymentReceipts.AsNoTracking().ToListAsync());
        Assert.Empty(db.ChangeTracker.Entries<PaymentReceipt>());
        failure.Enabled = false;
        var (detail, receipts) = await Service(db).GenerateBatchReceiptAsync(10, [1, 2], 1);
        Assert.Equal(200m, detail.AmountReceived);
        Assert.Equal(2, receipts.Count);
        Assert.Equal(2, await db.PaymentReceipts.CountAsync());
    }

    [Fact]
    public async Task RelationalRead_DoesNotUseStaleTrackedClearedPayment()
    {
        await using var db = await CreateDbAsync(sqlite: true);
        Assert.Equal(PaymentStatus.CLEARED, db.Payments.Local.Single().Status);
        await db.Payments.Where(p => p.Id == 1).ExecuteUpdateAsync(update => update.SetProperty(p => p.Status, PaymentStatus.VOID));
        Assert.Equal(PaymentStatus.CLEARED, db.Payments.Local.Single().Status);
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service(db).GenerateReceiptAsync(10, 1, 1));
        Assert.Empty(await db.PaymentReceipts.AsNoTracking().ToListAsync());
    }

    [Fact]
    public async Task RelationalFailure_RestoresLegacyRowsBeforeSnapshotCaptureRetry()
    {
        var failure = new FailSecondReceiptSave();
        await using var db = await CreateDbAsync(sqlite: true, interceptor: failure);
        db.Payments.Add(Payment(2)); await db.SaveChangesAsync();
        await Service(db).GenerateBatchReceiptAsync(10, [1, 2], 1);
        await EnableSnapshots(db);
        failure.Enabled = true;
        await Assert.ThrowsAsync<InjectedReceiptFailure>(() => Service(db).GenerateBatchReceiptAsync(10, [1, 2], 1));
        var rows = await db.PaymentReceipts.AsNoTracking().ToListAsync();
        Assert.Equal(2, rows.Count);
        Assert.All(rows, row => Assert.Null(row.SnapshotJson));
        Assert.Empty(db.ChangeTracker.Entries<PaymentReceipt>());
        failure.Enabled = false;
        var (detail, _) = await Service(db).GenerateBatchReceiptAsync(10, [1, 2], 1);
        Assert.True(detail.IsHistoricalSnapshot);
        Assert.True(detail.LegacyReconstruction);
        Assert.Equal(2, await db.PaymentReceipts.CountAsync());
    }

    [Fact]
    public async Task RelationalAutomaticRetry_RebuildsBatchAfterTransientSaveFailure()
    {
        var failure = new FailSecondReceiptSave();
        await using var db = await CreateDbAsync(sqlite: true, interceptor: failure, retryOnce: true);
        db.Payments.Add(Payment(2)); await db.SaveChangesAsync();
        await EnableSnapshots(db);
        failure.Enabled = true;
        var (detail, receipts) = await Service(db).GenerateBatchReceiptAsync(10, [1, 2], 1);
        Assert.Equal(200m, detail.AmountReceived);
        Assert.Equal(2, receipts.Count);
        Assert.Equal(2, await db.PaymentReceipts.CountAsync());
        Assert.True(detail.IsHistoricalSnapshot);
        Assert.All(await db.PaymentReceipts.ToListAsync(), row => Assert.NotNull(row.SnapshotJson));
    }

    [Fact]
    public async Task RelationalMigration_PreservesLegacyRowsAndEnforcesCapturedPaymentUniqueness()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options;
        await using var db = new AppDbContext(options);
        db.SetRequestTenantScope(null, true);
        await db.Database.OpenConnectionAsync();
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE "PaymentReceipts" (
                "Id" INTEGER PRIMARY KEY, "TenantId" INTEGER NOT NULL,
                "ReceiptNumber" TEXT NOT NULL, "PaymentId" INTEGER NOT NULL,
                "GeneratedAt" TEXT NOT NULL, "GeneratedByUserId" INTEGER NOT NULL,
                "PdfStoragePath" TEXT NULL
            );
            INSERT INTO "PaymentReceipts" VALUES (1,10,'LEGACY-1',1,'2026-10-01',1,NULL);
            INSERT INTO "PaymentReceipts" VALUES (2,10,'LEGACY-2',1,'2026-10-01',1,NULL);
            """);
        var migration = new HexaBill.Api.Migrations.AddPaymentReceiptSnapshot();
        var commands = db.GetService<IMigrationsSqlGenerator>().Generate(migration.UpOperations, db.Model);
        foreach (var command in commands) await db.Database.ExecuteSqlRawAsync(command.CommandText);
        var rows = await db.PaymentReceipts.AsNoTracking().ToListAsync();
        Assert.Equal(2, rows.Count);
        Assert.All(rows, row => Assert.Null(row.SnapshotJson));
        await db.Database.ExecuteSqlRawAsync("""
            UPDATE "PaymentReceipts" SET "SnapshotJson"={0} WHERE "Id"=1;
            """, "{}");
        await Assert.ThrowsAsync<Microsoft.Data.Sqlite.SqliteException>(() => db.Database.ExecuteSqlRawAsync("""
            UPDATE "PaymentReceipts" SET "SnapshotJson"={0} WHERE "Id"=2;
            """, "{}"));
        await db.Database.ExecuteSqlRawAsync("""
            INSERT INTO "PaymentReceipts" VALUES (3,20,'OTHER-TENANT-1',1,'2026-10-01',1,NULL,{0});
            """, "{}");
        Assert.Equal(3, await db.PaymentReceipts.CountAsync());
        Assert.Throws<NotSupportedException>(() => migration.DownOperations);
        Assert.Equal(3, await db.PaymentReceipts.CountAsync());
    }

    private sealed class FailSecondReceiptSave : SaveChangesInterceptor
    {
        public bool Enabled { get; set; }
        private int _receiptWrites;
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData,
            InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (Enabled && eventData.Context!.ChangeTracker.Entries<PaymentReceipt>().Any(entry =>
                entry.State == EntityState.Added || entry.State == EntityState.Modified) &&
                ++_receiptWrites == 2) throw new InjectedReceiptFailure();
            return ValueTask.FromResult(result);
        }
    }

    private sealed class InjectedReceiptFailure : InvalidOperationException { }
    private sealed class ReceiptRetryFactory(ExecutionStrategyDependencies dependencies) : IExecutionStrategyFactory
    {
        public IExecutionStrategy Create() => new ReceiptRetryStrategy(dependencies);
    }
    private sealed class ReceiptRetryStrategy(ExecutionStrategyDependencies dependencies)
        : ExecutionStrategy(dependencies, 1, TimeSpan.Zero)
    {
        protected override bool ShouldRetryOn(Exception exception) => exception is InjectedReceiptFailure;
    }

    private static PaymentReceiptService Service(AppDbContext db) => new(db, NullLogger<PaymentReceiptService>.Instance);
    private static Payment Payment(int id, PaymentStatus status = PaymentStatus.CLEARED) => new()
    {
        Id = id, TenantId = 10, OwnerId = 10, CustomerId = 1, SaleId = 1,
        Amount = 100m, Mode = PaymentMode.CASH, Status = status, CreatedBy = 1,
        PaymentDate = new DateTime(2026, 10, 1, 12, 0, 0, DateTimeKind.Utc), CreatedAt = DateTime.UtcNow,
    };
    private static async Task<AppDbContext> CreateDbAsync(bool sqlite = false, SaveChangesInterceptor? interceptor = null, bool retryOnce = false)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>();
        if (sqlite) options.UseSqlite("Data Source=:memory:");
        else options.UseInMemoryDatabase("PaymentReceipts_" + Guid.NewGuid())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning));
        if (interceptor != null) options.AddInterceptors(interceptor);
        if (retryOnce) options.ReplaceService<IExecutionStrategyFactory, ReceiptRetryFactory>();
        var db = new AppDbContext(options.Options);
        db.SetRequestTenantScope(10, false);
        if (sqlite) await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        if (sqlite)
        {
            db.Tenants.Add(new Tenant { Id = 10, Name = "Receipt fixture company", Subdomain = "receipt-fixture" });
            db.Users.Add(new User { Id = 1, TenantId = 10, OwnerId = 10, Email = "receipt@example.com",
                Name = "Receipt owner", PasswordHash = "fixture-only", Role = UserRole.Owner });
        }
        db.Customers.Add(new Customer { Id = 1, TenantId = 10, OwnerId = 10, Name = "Receipt customer", PendingBalance = 900 });
        db.Sales.Add(new Sale { Id = 1, TenantId = 10, OwnerId = 10, CustomerId = 1,
            InvoiceNo = "FIXTURE-1", GrandTotal = 1000, InvoiceDate = DateTime.UtcNow, CreatedBy = 1 });
        db.Payments.Add(Payment(1));
        db.Settings.Add(new Setting { TenantId = 10, OwnerId = 10, Key = "COMPANY_NAME_EN", Value = "Receipt fixture company" });
        await db.SaveChangesAsync();
        return db;
    }
}
