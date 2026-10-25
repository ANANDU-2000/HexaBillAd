using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using UglyToad.PdfPig;

namespace HexaBill.Tests;

/// <summary>
/// P0-PRINT-QA-MATRIX: synthetic invoice print matrix (FH1/FH2/Gulf Harvest x Legacy/BilingualMonochrome x
/// full/preprinted(body) x A4/A5/80mm/58mm x 1/5/20/50 items x pre/post VAT effective date x logo present/missing).
/// Every cell uses long product names and a long grand total (1,234,567.89). Synthetic data only.
/// Per cell: no exception and no silent logo-drop fallback, selectable text containing the totals, correct
/// document title for the VAT effective date, and a whole receiver block on the last page.
/// Known gap: A5/80mm/58mm body mode has no receiver block (asserted absent). 80mm/58mm ignore body mode and print the header.
/// Skipped: preprinted(body) with logo missing (body layout never prints the logo, so it duplicates logo present).
/// </summary>
public class PrintQaMatrixTests
{
    private const string VatEffective = "2026-11-01";
    private static readonly (int Id, string Slug, string Name, string NameAr, bool FrozenHub)[] Tenants =
    [
        (89201, "frozenhub", "FROZENHUB FOODSTUFF TRADING - L.L.C - S.P.C", "فروزن هب لتجارة المواد الغذائية - ذ.م.م - ش.ش.و", true),
        (89202, "frozenhub2", "FROZENHUB2 SYNTHETIC GENERAL TRADING - L.L.C", "فروزن هب ٢ للتجارة العامة - ذ.م.م", true),
        (89203, "gulfharvest", "GULF HARVEST SYNTHETIC FOODSTUFF TRADING L.L.C", "جلف هارفست لتجارة المواد الغذائية ذ.م.م", false),
    ];

    public static TheoryData<string, string, string, string, int, string, bool> Cells()
    {
        var d = new TheoryData<string, string, string, string, int, string, bool>();
        foreach (var t in Tenants)
            foreach (var style in new[] { "Legacy", "BilingualMonochrome" })
                foreach (var layout in new[] { "full", "body" })
                    foreach (var fmt in new[] { "A4", "A5", "80mm", "58mm" })
                        foreach (var items in new[] { 1, 5, 20, 50 })
                            foreach (var tax in new[] { "pre", "post" })
                                foreach (var logo in new[] { true, false })
                                {
                                    if (layout == "body" && !logo) continue;
                                    d.Add(t.Slug, style, layout, fmt, items, tax, logo);
                                }
        return d;
    }

    [Theory]
    [MemberData(nameof(Cells))]
    public async Task Cell_RendersSelectableTotalsTitleAndWholeReceiverBlock(
        string tenant, string style, string layout, string format, int items, string tax, bool logo)
    {
        var t = Tenants.Single(x => x.Slug == tenant);
        await using var db = await SeedAsync(t, style, logo ? CreateLogo(720, 279) : null);
        var logger = new CapturingLogger();
        var sale = CreateSale(t.Id, items, tax == "pre" ? new DateTime(2026, 10, 24) : new DateTime(2026, 11, 5));
        var bytes = await CreatePdfService(db, logger).GenerateInvoicePdfAsync(sale, format, layout);
        var name = $"{tenant}_{style}_{layout}_{format}_{items:00}_{tax}_{(logo ? "logo" : "nologo")}.pdf";
        var dir = Path.Combine(AppContext.BaseDirectory, "print-qa-matrix");
        Directory.CreateDirectory(dir);
        await File.WriteAllBytesAsync(Path.Combine(dir, name), bytes);

        Assert.False(logger.LayoutFallback, "layout exception was swallowed by the logo-drop retry");
        using var document = PdfDocument.Open(bytes);
        var text = string.Concat(document.GetPages().SelectMany(p => p.Text.Where(c => !char.IsWhiteSpace(c))));
        Assert.False(string.IsNullOrEmpty(text));
        Assert.True(text.Contains("1,234,567.89") || text.Contains("1234567.89"), "grand total not in PDF text");
        Assert.True(text.Contains(sale.VatTotal.ToString("N2")) || text.Contains(sale.VatTotal.ToString("0.00")), "VAT total not in PDF text");
        if (tax == "pre")
            Assert.DoesNotContain("TAXINVOICE", text);
        else
            Assert.Contains("TAXINVOICE", text);

        var last = document.GetPage(document.NumberOfPages);
        if (layout == "body" && format != "A4")
        {
            // Known gap (P0-PRINT-QA-MATRIX finding): A5/80mm/58mm in preprinted (body) mode print no receiver
            // block at all. Characterised here so a fix flips this assertion deliberately.
            Assert.DoesNotContain("Receivedtheabovegoods", text);
            return;
        }
        var lastText = new string(last.Text.Where(c => !char.IsWhiteSpace(c)).ToArray());
        Assert.Contains("Receivedtheabovegoods", lastText);
        Assert.Contains("Receiver'sName", lastText);
        Assert.Contains("Receiver'sSign", lastText);
        var r = last.Letters.Where(l => "Receiver'sSign".Contains(l.Value)).ToList();
        Assert.All(r, l => Assert.InRange(l.GlyphRectangle.Bottom, 0, last.Height));
    }

    public static TheoryData<string, string, string, string> LeadingZeroCases()
    {
        var d = new TheoryData<string, string, string, string>();
        foreach (var tenant in new[] { "frozenhub2", "gulfharvest" })
            foreach (var layout in new[] { "full", "body" })
                foreach (var fmt in new[] { "A4", "A5", "80mm", "58mm" })
                    foreach (var no in new[] { "00000", "00001" })
                        d.Add(tenant, layout, fmt, no);
        return d;
    }

    /// <summary>P0-NUM-001 literal five-digit numbers: PdfService prints InvoiceNo verbatim (never parsed/reformatted).</summary>
    [Theory]
    [MemberData(nameof(LeadingZeroCases))]
    public async Task InvoiceNumber_LeadingZerosPrintedExactlyAsStored(string tenant, string layout, string format, string invoiceNo)
    {
        var t = Tenants.Single(x => x.Slug == tenant);
        await using var db = await SeedAsync(t, "BilingualMonochrome", CreateLogo(720, 279));
        var sale = CreateSale(t.Id, 1, new DateTime(2026, 11, 5));
        sale.InvoiceNo = invoiceNo;
        var bytes = await CreatePdfService(db, NullLogger<PdfService>.Instance).GenerateInvoicePdfAsync(sale, format, layout);
        using var document = PdfDocument.Open(bytes);
        var words = document.GetPages().SelectMany(p => p.GetWords()).Select(w => w.Text.TrimStart('#')).ToList();
        Assert.Contains(invoiceNo, words);
        var other = invoiceNo == "00000" ? "00001" : "00000";
        Assert.DoesNotContain(other, words);
    }

    private sealed class CapturingLogger : Microsoft.Extensions.Logging.ILogger<PdfService>
    {
        public bool LayoutFallback { get; private set; }
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(Microsoft.Extensions.Logging.LogLevel logLevel) => true;
        public void Log<TState>(Microsoft.Extensions.Logging.LogLevel logLevel, Microsoft.Extensions.Logging.EventId eventId,
            TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (exception != null || formatter(state, exception).Contains("retrying without logo")) LayoutFallback = true;
        }
    }

    private static PdfService CreatePdfService(AppDbContext db, Microsoft.Extensions.Logging.ILogger<PdfService> logger)
    {
        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        return new PdfService(db, null!, fonts, new SettingsService(db), null!, logger, null!);
    }

    private static byte[] CreateLogo(int w, int h)
    {
        using var img = new Image<Rgba32>(w, h, new Rgba32(20, 60, 120));
        using var ms = new MemoryStream();
        img.SaveAsPng(ms);
        return ms.ToArray();
    }

    private static SaleDto CreateSale(int tenantId, int items, DateTime date)
    {
        var lines = Enumerable.Range(1, items).Select(i => new SaleItemDto
        {
            ProductId = i,
            ProductName = $"SYNTHETIC FROZEN product {i:00} WHOLE GRILLER CHICKEN 1200G X 10 PCS PER CARTON EXTRA LONG TEST BRAND PREMIUM DESCRIPTION LINE",
            Qty = 10, UnitType = "CTN", UnitPrice = 1234.56m, LineTotal = 12962.88m, VatAmount = 617.28m
        }).ToList();
        const decimal grand = 1234567.89m;
        var vat = Math.Round(grand / 21m, 2);
        return new SaleDto
        {
            Id = 9101, OwnerId = tenantId, InvoiceNo = "SYN-QA-0001", InvoiceDate = date,
            CustomerName = "Synthetic Restaurant With A Long Trading Name L.L.C", Subtotal = grand - vat, Discount = 0m,
            VatTotal = vat, GrandTotal = grand, Items = lines
        };
    }

    private static async Task<AppDbContext> SeedAsync((int Id, string Slug, string Name, string NameAr, bool FrozenHub) t, string style, byte[]? logo)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.SetRequestTenantScope(null, true);
        db.Tenants.Add(new Tenant { Id = t.Id, Name = t.Name, Subdomain = t.Slug });
        var settings = new Dictionary<string, string>
        {
            ["COMPANY_NAME_EN"] = t.Name,
            ["COMPANY_NAME_AR"] = t.NameAr,
            ["COMPANY_PHONE"] = "+971500000000",
            ["COMPANY_EMAIL"] = "synthetic@example.invalid",
            ["COMPANY_ADDRESS"] = "Synthetic Building 1, Synthetic Street, Abu Dhabi",
            ["COMPANY_TRN"] = "100000000000003",
            ["VAT_EFFECTIVE_DATE"] = VatEffective,
            ["INVOICE_HEADER_STYLE"] = style,
            ["CURRENCY"] = "AED",
        };
        if (t.FrozenHub && style == "BilingualMonochrome") settings["INVOICE_HEADER_STYLE_LOCKED"] = "true";
        if (logo != null) settings["LOGO_BASE64_DATA_URI"] = "data:image/png;base64," + Convert.ToBase64String(logo);
        foreach (var pair in settings)
            db.Settings.Add(new Setting { TenantId = t.Id, OwnerId = t.Id, Key = pair.Key, Value = pair.Value });
        await db.SaveChangesAsync();
        return db;
    }
}
