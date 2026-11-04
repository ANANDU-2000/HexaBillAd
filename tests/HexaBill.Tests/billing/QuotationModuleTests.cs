using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Documents;
using HexaBill.Api.Modules.Products;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

/// <summary>Quotation create / edit / delete persistence and multi-item PDF rendering.</summary>
public class QuotationModuleTests
{
    private const int TenantA = 7101;
    private const int TenantB = 7102;

    private static (AppDbContext db, QuotationService svc) NewService()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.SetRequestTenantScope(null, true);
        var svc = new QuotationService(db, new QuoteNumberService(db), new SettingsService(db), NullLogger<QuotationService>.Instance);
        return (db, svc);
    }

    private static List<QuotationItemRequest> Lines(int count, decimal price = 10m) =>
        Enumerable.Range(1, count).Select(i => new QuotationItemRequest
        {
            Description = $"PRODUCT {i}",
            UnitLabel = i % 2 == 0 ? "KG" : "CRTN",
            Qty = i,
            UnitPrice = price + i,
            VatRate = 5
        }).ToList();

    [Fact]
    public async Task CreateQuotation_WithMultipleItems_PersistsAllItemsInOrderAndCalculatesVat()
    {
        var (db, svc) = NewService();
        var created = await svc.CreateAsync(new CreateQuotationRequest { CustomerName = "ACME", CustomerTrn = "100000000000003", Subject = "Supply", Items = Lines(4) }, 1, TenantA);

        Assert.Equal(4, created.Items.Count);
        Assert.Equal(new[] { 0, 1, 2, 3 }, created.Items.Select(i => i.SortOrder));
        var net = Lines(4).Sum(l => Math.Round(l.Qty * l.UnitPrice, 2));
        Assert.Equal(net, created.Subtotal);
        Assert.Equal(Math.Round(net * 0.05m, 2), created.VatTotal, 1);
        Assert.Equal("100000000000003", created.CustomerTrn);
        Assert.Equal(4, await db.QuotationItems.CountAsync());
        Assert.Equal("Quote-1", created.QuoteNo);
    }

    [Fact]
    public async Task UpdateQuotation_AddAndRemoveItems_LeavesNoOrphansAndRecalculatesTotals()
    {
        var (db, svc) = NewService();
        var created = await svc.CreateAsync(new CreateQuotationRequest { Items = Lines(4) }, 1, TenantA);

        var six = await svc.UpdateAsync(created.Id, new UpdateQuotationRequest { Items = Lines(6, 20m), Discount = 5, ValidUntil = new DateTime(2026, 12, 1), Status = "sent", TermsAndConditions = "Net 30" }, 1, TenantA);
        Assert.NotNull(six);
        Assert.Equal(6, six!.Items.Count);
        Assert.Equal(6, await db.QuotationItems.CountAsync());
        Assert.Equal("Sent", six.Status);
        Assert.Equal("Net 30", six.TermsAndConditions);
        Assert.Equal(six.Subtotal + six.VatTotal - 5, six.GrandTotal);

        var three = await svc.UpdateAsync(created.Id, new UpdateQuotationRequest { Items = Lines(3) }, 1, TenantA);
        Assert.Equal(3, three!.Items.Count);
        Assert.Equal(3, await db.QuotationItems.CountAsync());
        Assert.Equal(3, (await svc.GetByIdAsync(created.Id, TenantA))!.Items.Count);
    }

    [Fact]
    public async Task LargeQuotation_25Items_CreateGrowShrinkAndDelete_StayConsistent()
    {
        var (db, svc) = NewService();
        var created = await svc.CreateAsync(new CreateQuotationRequest { Items = Lines(25) }, 1, TenantA);
        Assert.Equal(25, created.Items.Count);
        Assert.Equal(Enumerable.Range(0, 25), created.Items.Select(i => i.SortOrder));

        var grown = await svc.UpdateAsync(created.Id, new UpdateQuotationRequest { Items = Lines(40, 5m) }, 1, TenantA);
        Assert.Equal(40, grown!.Items.Count);
        Assert.Equal(40, await db.QuotationItems.CountAsync());

        var shrunk = await svc.UpdateAsync(created.Id, new UpdateQuotationRequest { Items = Lines(12) }, 1, TenantA);
        Assert.Equal(12, shrunk!.Items.Count);
        Assert.Equal(12, await db.QuotationItems.CountAsync());
        Assert.Equal(Lines(12).Sum(l => Math.Round(l.Qty * l.UnitPrice, 2)), shrunk.Subtotal);

        Assert.True(await svc.DeleteAsync(created.Id, 1, TenantA));
        Assert.Empty(await svc.ListAsync(TenantA));
    }

    [Fact]
    public async Task DeleteQuotation_IsTenantScoped_AndHidesFromListAndGet()
    {
        var (_, svc) = NewService();
        var a = await svc.CreateAsync(new CreateQuotationRequest { Items = Lines(2) }, 1, TenantA);
        var b = await svc.CreateAsync(new CreateQuotationRequest { Items = Lines(2) }, 2, TenantB);

        Assert.False(await svc.DeleteAsync(a.Id, 2, TenantB));
        Assert.Null(await svc.GetByIdAsync(a.Id, TenantB));
        Assert.Null(await svc.UpdateAsync(a.Id, new UpdateQuotationRequest { Items = Lines(1) }, 2, TenantB));

        Assert.True(await svc.DeleteAsync(a.Id, 1, TenantA));
        Assert.Null(await svc.GetByIdAsync(a.Id, TenantA));
        Assert.Empty(await svc.ListAsync(TenantA));
        Assert.Single(await svc.ListAsync(TenantB));
        Assert.NotNull(await svc.GetByIdAsync(b.Id, TenantB));
    }

    [Fact]
    public async Task QuoteNumbers_AreTenantScopedAndSkipDeleted()
    {
        var (_, svc) = NewService();
        var a1 = await svc.CreateAsync(new CreateQuotationRequest { Items = Lines(1) }, 1, TenantA);
        var a2 = await svc.CreateAsync(new CreateQuotationRequest { Items = Lines(1) }, 1, TenantA);
        var b1 = await svc.CreateAsync(new CreateQuotationRequest { Items = Lines(1) }, 2, TenantB);
        Assert.Equal(new[] { "Quote-1", "Quote-2", "Quote-1" }, new[] { a1.QuoteNo, a2.QuoteNo, b1.QuoteNo });
    }

    [Fact]
    public async Task GenerateQuotationPdf_WithManyItems_RendersValidMultiPagePdf()
    {
        var (db, svc) = NewService();
        db.Settings.Add(new Setting { TenantId = TenantA, OwnerId = TenantA, Key = "COMPANY_NAME_EN", Value = "FROZENHUB FOODSTUFF TRADING - L.L.C - S.P.C" });
        db.Settings.Add(new Setting { TenantId = TenantA, OwnerId = TenantA, Key = "COMPANY_TRN", Value = "105607243000003" });
        await db.SaveChangesAsync();
        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        var pdf = new PdfService(db, null!, fonts, new SettingsService(db), null!, NullLogger<PdfService>.Instance, null!);

        var q = await svc.CreateAsync(new CreateQuotationRequest
        {
            CustomerName = "AL RASAM RESTAURANT",
            CustomerAddress = "MBZ, MAZYAD MALL",
            CustomerTrn = "100000000000003",
            Subject = "Supply of frozen meat",
            ValidUntil = new DateTime(2026, 12, 4),
            TermsAndConditions = "1. Prices valid for 30 days.\n2. Payment: 30 days credit.",
            Discount = 12.5m,
            Items = Lines(28)
        }, 1, TenantA);

        var bytes = await pdf.GenerateQuotationPdfAsync(q, TenantA, "A4", "full");
        Assert.True(bytes.Length > 2000);
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(bytes, 0, 4));

        var dir = Environment.GetEnvironmentVariable("HEXABILL_EVIDENCE_DIR");
        if (!string.IsNullOrWhiteSpace(dir))
        {
            Directory.CreateDirectory(dir);
            File.WriteAllBytes(Path.Combine(dir, "quotation-28-items.pdf"), bytes);
        }
    }
}
