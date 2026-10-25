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
