using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using UglyToad.PdfPig;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace HexaBill.Tests;

/// <summary>
/// P0-PRINT-001/004 repro matrix for the FrozenHub bilingual header, using synthetic data only:
/// logos are generated in code, settings copy the FrozenHub field shapes with a synthetic TRN and no customer data.
/// PDFs are written under the test output directory (print-v3) for visual inspection.
/// </summary>
public class FrozenHubHeaderReproTests
{
    private const int TenantId = 9020;
    private static readonly string[] Formats = ["A4", "A5", "80mm", "58mm"];

    public static TheoryData<int, int, int, string> LogoCases()
    {
        var d = new TheoryData<int, int, int, string>();
        foreach (var (w, h) in new[] { (720, 279), (200, 200), (100, 400), (40, 800), (800, 40), (1, 1) })
            foreach (var items in new[] { 1, 2, 3, 4 })
                foreach (var fmt in Formats)
                    d.Add(w, h, items, fmt);
        return d;
    }

    public static TheoryData<string, int> SizeCases()
    {
        var d = new TheoryData<string, int>();
        foreach (var fmt in Formats)
            foreach (var items in new[] { 1, 2, 5, 20, 50 })
                d.Add(fmt, items);
        return d;
    }

    [Theory]
    [MemberData(nameof(LogoCases))]
    public async Task SyntheticFrozenHubSettings_GenerateWithAnyLogoShape(int w, int h, int items, string format)
    {
        await using var db = await SeedAsync(CreateLogo(w, h));
        var bytes = await CreatePdfService(db).GenerateInvoicePdfAsync(CreateSale(items), format, "full");
        await SaveAsync(bytes, $"repro-{format}-{w}x{h}-{items}.pdf");

        using var document = PdfDocument.Open(bytes);
        var all = Normalized(document);
        Assert.Contains("FROZENHUB", all);
        Assert.Contains(CreateSale(items).GrandTotal.ToString("0.00"), all);
        Assert.DoesNotContain("+971500000000", all);
    }

    [Theory]
    [MemberData(nameof(SizeCases))]
    public async Task ItemCountMatrix_TotalsPrintAndReceiverBlockIsWholeOnLastPage(string format, int items)
    {
        await using var db = await SeedAsync(CreateLogo(720, 279));
        var sale = CreateSale(items);
        var bytes = await CreatePdfService(db).GenerateInvoicePdfAsync(sale, format, "full");
        await SaveAsync(bytes, $"{format}-{items}-items.pdf");

        using var document = PdfDocument.Open(bytes);
        var pages = document.GetPages().Select(p => new string(p.Text.Where(c => !char.IsWhiteSpace(c)).ToArray())).ToList();
        var all = string.Concat(pages);
        Assert.Contains(sale.GrandTotal.ToString("0.00"), all);
        Assert.Contains(sale.Subtotal.ToString("0.00"), all);
        Assert.Contains("0.40", all); // discount

        // Receiver block: every part on the last page, so it was never split across pages.
        var last = pages[^1];
        foreach (var marker in new[] { "Receivedtheabovegoodsingoodorder", "Receiver'sName", "Receiver'sSign", "ForFROZENHUB" })
        {
            Assert.Contains(marker, last);
            for (var i = 0; i < pages.Count - 1; i++)
                Assert.DoesNotContain(marker, pages[i]);
        }
        for (var i = 1; i <= items; i++)
            Assert.Contains($"product{i:00}", all);

        if (format == "A5" && items <= 20)
            Assert.Equal(1, document.NumberOfPages);
        if (format == "A5" && items == 50)
        {
            Assert.True(document.NumberOfPages >= 2);
            foreach (var page in pages)
                Assert.Contains("UnitPrice", page); // table header repeats on every page
        }
        if (format is "80mm" or "58mm")
            Assert.Equal(1, document.NumberOfPages);
    }

    [Theory]
    [InlineData("58mm")]
    [InlineData("80mm")]
    public async Task Thermal_ArabicCompanyNameTakesAtMostTwoLines_AndAddressStaysWhole(string format)
    {
        await using var db = await SeedAsync(CreateLogo(720, 279));
        var bytes = await CreatePdfService(db).GenerateInvoicePdfAsync(CreateSale(3), format, "full");
        await SaveAsync(bytes, $"header-{format}.pdf");
        using var document = PdfDocument.Open(bytes);
        var page = document.GetPage(1);
        // Arabic name glyphs are the bold Arabic letters in the header, above the Arabic address label line.
        static bool IsArabic(string v) => v.Any(c => c is >= '\u0600' and <= '\u06FF' or >= '\uFB50' and <= '\uFEFF');
        var arabic = page.Letters.Where(l => IsArabic(l.Value)).ToList();
        var nameLines = arabic.Where(l => l.FontName.Contains("Bold", StringComparison.OrdinalIgnoreCase))
            .GroupBy(l => Math.Round(l.StartBaseLine.Y))
            .OrderByDescending(g => g.Key).ToList();
        var headerTop = nameLines.First().Key;
        var nameLineCount = nameLines.Count(g => headerTop - g.Key < 40);
        Assert.InRange(nameLineCount, 1, 2);
        // "Abu Dhabi, Musaffah 17" sits on one baseline (no break after "Abu Dhabi,").
        var address = page.Letters.Where(l => "AbuDhabiMusaffah17".Contains(l.Value)).GroupBy(l => Math.Round(l.StartBaseLine.Y))
            .Where(g => string.Concat(g.OrderBy(l => l.StartBaseLine.X).Select(l => l.Value)).Contains("Musaffah17")).ToList();
        Assert.NotEmpty(address);
        Assert.Contains(address, g => string.Concat(g.OrderBy(l => l.StartBaseLine.X).Select(l => l.Value)).Contains("AbuDhabiMusaffah17"));
        Assert.DoesNotContain("+971500000000", page.Text);
    }

    [Theory]
    [InlineData("58mm", 100, 400)]
    [InlineData("80mm", 100, 400)]
    [InlineData("58mm", 200, 200)]
    [InlineData("80mm", 200, 200)]
    [InlineData("58mm", 720, 279)]
    [InlineData("80mm", 720, 279)]
    [InlineData("58mm", 1000, 100)]
    [InlineData("80mm", 1000, 100)]
    public async Task Thermal_LogoRendersAtReadableSizeInsideContentWidth(string format, int w, int h)
    {
        await using var db = await SeedAsync(CreateLogo(w, h));
        var bytes = await CreatePdfService(db).GenerateInvoicePdfAsync(CreateSale(1), format, "full");
        await SaveAsync(bytes, $"logo-{format}-{w}x{h}.pdf");
        using var document = PdfDocument.Open(bytes);
        var page = document.GetPage(1);
        var image = Assert.Single(page.GetImages());
        var b = image.Bounds;
        Assert.InRange(b.Width, 1, 141);
        Assert.InRange(b.Height, 1, 40.5);
        Assert.InRange(b.Left, 0, page.Width);
        Assert.InRange(b.Right, 0, page.Width);
        Assert.Equal(w / (double)h, b.Width / b.Height, 1);
        if (h >= w) Assert.True(b.Height >= 39, $"tall/square logo height {b.Height}pt");
    }

    /// <summary>
    /// Root cause of the 24 Oct production crash (deployed b7e45a9, PdfService.cs:559): the A4 items-table
    /// filler row used <c>Height(spacerHeight).Text("")</c> with spacerHeight = 72 - 18*items. At 3 items
    /// that is 18pt, but the empty Text inherits the page default (10pt Noto Sans Arabic), whose line box is
    /// taller than 18pt, so QuestPDF throws "conflicting size constraints". Minimal reproduction of that structure.
    /// </summary>
    [Fact]
    public void CrashRepro_FixedHeightEmptyTextWithArabicDefaultStyle_ThrowsUnlessFontShrunk()
    {
        QuestPDF.Settings.License = LicenseType.Community;
        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        byte[] Build(bool fixedVersion) => Document.Create(c => c.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.DefaultTextStyle(x => x.FontFamily(fonts.GetArabicFontFamily()).FontSize(10));
            page.Content().Table(table =>
            {
                table.ColumnsDefinition(cols => { for (var i = 0; i < 8; i++) cols.RelativeColumn(); });
                for (var i = 0; i < 8; i++)
                {
                    var cell = table.Cell().BorderLeft(0.5f).BorderRight(0.5f).Height(18f).Text("");
                    if (fixedVersion) cell.FontSize(1);
                }
            });
        })).GeneratePdf();

        Assert.Throws<QuestPDF.Drawing.Exceptions.DocumentLayoutException>(() => Build(false));
        Assert.NotEmpty(Build(true));
    }

    [Fact]
    public async Task CrashRepro_CurrentA4ThreeItemInvoiceRenders()
    {
        await using var db = await SeedAsync(CreateLogo(720, 279));
        var bytes = await CreatePdfService(db).GenerateInvoicePdfAsync(CreateSale(3), "A4", "full");
        using var document = PdfDocument.Open(bytes);
        Assert.Equal(1, document.NumberOfPages);
    }

    private static PdfService CreatePdfService(AppDbContext db)
    {
        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        return new PdfService(db, null!, fonts, new SettingsService(db), null!, NullLogger<PdfService>.Instance, null!);
    }

    private static string Normalized(PdfDocument document) =>
        string.Concat(document.GetPages().SelectMany(p => p.Text.Where(c => !char.IsWhiteSpace(c))));

    private static byte[] CreateLogo(int w, int h)
    {
        using var logo = new Image<Rgba32>(w, h, new Rgba32(20, 60, 120));
        using var ms = new MemoryStream();
        logo.SaveAsPng(ms);
        return ms.ToArray();
    }

    private static async Task SaveAsync(byte[] bytes, string name)
    {
        var dir = Path.Combine(AppContext.BaseDirectory, "print-v3");
        Directory.CreateDirectory(dir);
        await File.WriteAllBytesAsync(Path.Combine(dir, name), bytes);
    }

    private static SaleDto CreateSale(int items)
    {
        var lines = Enumerable.Range(1, items).Select(i => new SaleItemDto
        {
            ProductId = i,
            ProductName = $"SYNTHETIC FROZEN product {i:00} WHOLE GRILLER 1200G X 10 TEST BRAND PREMIUM",
            Qty = 10, UnitType = "CTN", UnitPrice = 123.45m, LineTotal = 1296.23m, VatAmount = 61.73m
        }).ToList();
        var subtotal = 1234.5m * items;
        var vat = 61.73m * items;
        return new SaleDto
        {
            Id = 9001, OwnerId = TenantId, InvoiceNo = "SYN-0001", InvoiceDate = new DateTime(2026, 10, 24),
            CustomerName = "Synthetic Restaurant", Subtotal = subtotal, Discount = 0.40m, VatTotal = vat,
            GrandTotal = subtotal - 0.40m + vat, Items = lines
        };
    }

    private static async Task<AppDbContext> SeedAsync(byte[] logo)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.SetRequestTenantScope(null, true);
        db.Tenants.Add(new Tenant { Id = TenantId, Name = "Synthetic FrozenHub", Subdomain = "frozenhub" });
        foreach (var pair in new Dictionary<string, string>
        {
            ["COMPANY_NAME_EN"] = "FROZENHUB FOODSTUFF TRADING - L.L.C - S.P.C",
            ["COMPANY_NAME_AR"] = "فروزن هب لتجارة المواد الغذائية - ذ.م.م - ش.ش.و",
            ["COMPANY_PHONE"] = "+971500000000",
            ["COMPANY_EMAIL"] = "synthetic@example.invalid",
            ["COMPANY_ADDRESS"] = "Synthetic Building 1, Synthetic Street, Abu Dhabi",
            ["COMPANY_TRN"] = "100000000000003",
            ["INVOICE_HEADER_STYLE"] = "BilingualMonochrome",
            ["INVOICE_HEADER_STYLE_LOCKED"] = "true",
            ["CURRENCY"] = "AED",
            ["LOGO_BASE64_DATA_URI"] = "data:image/png;base64," + Convert.ToBase64String(logo)
        })
            db.Settings.Add(new Setting { TenantId = TenantId, OwnerId = TenantId, Key = pair.Key, Value = pair.Value });
        await db.SaveChangesAsync();
        return db;
    }
}
