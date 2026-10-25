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
/// P0-PRINT-006 staging defects, synthetic data only: (a) A4 with ~10-20 items must keep the receiver block on page 1;
/// (b) A5 Qty column must keep decimal quantities such as 12.44 and 129.5 on one line.
/// </summary>
public class PrintPageFitTests
{
    private const int TenantId = 9060;
    private static readonly string[] Names =
    [
        "BEEF SLICE KAMIL 18KG", "SYNTHETIC CHICKEN BREAST BONELESS 2KG X 6", "FRENCH FRIES 9MM 2.5KG X 4", "MOZZARELLA SHREDDED 2KG",
        "SYNTHETIC LAMB LEG BONE-IN NZ 15KG CARTON", "MIXED VEGETABLES 1KG X 10", "SHRIMP PEELED DEVEINED 26/30 1KG", "BURGER PATTY 100G X 60",
    ];

    [Theory]
    [InlineData(10)]
    [InlineData(12)]
    [InlineData(15)]
    [InlineData(18)]
    [InlineData(20)]
    public async Task A4_TenToTwentyItems_ReceiverBlockStaysOnPageOne(int items)
    {
        await using var db = await SeedAsync();
        var bytes = await CreatePdfService(db).GenerateInvoicePdfAsync(CreateSale(items, 10m), "A4", "full");
        await SaveAsync(bytes, $"a4-{items:00}-items.pdf");
        using var document = PdfDocument.Open(bytes);
        Assert.Equal(1, document.NumberOfPages);
        var text = new string(document.GetPage(1).Text.Where(c => !char.IsWhiteSpace(c)).ToArray());
        Assert.Contains("Receiver'sSign", text);
    }

    [Fact]
    public async Task A4_ItemsThatGenuinelyFillPageOne_BreakWithWholeReceiverBlockOnLastPage()
    {
        await using var db = await SeedAsync();
        var bytes = await CreatePdfService(db).GenerateInvoicePdfAsync(CreateSale(50, 10m), "A4", "full");
        using var document = PdfDocument.Open(bytes);
        Assert.True(document.NumberOfPages > 1);
        var last = new string(document.GetPage(document.NumberOfPages).Text.Where(c => !char.IsWhiteSpace(c)).ToArray());
        Assert.Contains("Receivedtheabovegoods", last);
        Assert.Contains("Receiver'sSign", last);
    }

    [Theory]
    [InlineData("129.5")]
    [InlineData("12.44")]
    [InlineData("1234.5")]
    public async Task A5_DecimalQuantityStaysOnOneLine(string qty)
    {
        await using var db = await SeedAsync();
        var sale = CreateSale(3, decimal.Parse(qty, System.Globalization.CultureInfo.InvariantCulture));
        var bytes = await CreatePdfService(db).GenerateInvoicePdfAsync(sale, "A5", "full");
        await SaveAsync(bytes, $"a5-qty-{qty}.pdf");
        using var document = PdfDocument.Open(bytes);
        var page = document.GetPage(1);
        // Find each occurrence of the quantity by its digits; all its letters must share one baseline.
        var words = page.GetWords().Where(w => w.Text == qty).ToList();
        Assert.Equal(3, words.Count);
        foreach (var w in words)
            Assert.Single(w.Letters.Select(l => Math.Round(l.StartBaseLine.Y, 1)).Distinct());
        // Guard against a wrapped fragment ("129." / "5") appearing as separate words.
        Assert.DoesNotContain(page.GetWords(), w => qty.StartsWith(w.Text) && w.Text != qty && w.Text.EndsWith("."));
    }

    private static SaleDto CreateSale(int items, decimal qty)
    {
        var lines = Enumerable.Range(1, items).Select(i => new SaleItemDto
        {
            ProductId = i, ProductName = Names[(i - 1) % Names.Length], Qty = qty, UnitType = "CTN",
            UnitPrice = 45.5m, LineTotal = Math.Round(qty * 45.5m * 1.05m, 2), VatAmount = Math.Round(qty * 45.5m * 0.05m, 2)
        }).ToList();
        var sub = lines.Sum(l => qty * l.UnitPrice);
        var vat = lines.Sum(l => l.VatAmount);
        return new SaleDto
        {
            Id = 9061, OwnerId = TenantId, InvoiceNo = "SYN-0006", InvoiceDate = new DateTime(2026, 11, 5),
            CustomerName = "Synthetic Restaurant", Subtotal = sub, VatTotal = vat, GrandTotal = sub + vat, Items = lines
        };
    }

    private static PdfService CreatePdfService(AppDbContext db)
    {
        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        return new PdfService(db, null!, fonts, new SettingsService(db), null!, NullLogger<PdfService>.Instance, null!);
    }

    private static async Task SaveAsync(byte[] bytes, string name)
    {
        var dir = Path.Combine(AppContext.BaseDirectory, "print-p006");
        Directory.CreateDirectory(dir);
        await File.WriteAllBytesAsync(Path.Combine(dir, name), bytes);
    }

    private static async Task<AppDbContext> SeedAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.SetRequestTenantScope(null, true);
        db.Tenants.Add(new Tenant { Id = TenantId, Name = "Synthetic FrozenHub", Subdomain = "frozenhub" });
        using var img = new Image<Rgba32>(720, 279, new Rgba32(20, 60, 120));
        using var ms = new MemoryStream();
        img.SaveAsPng(ms);
        foreach (var kv in new Dictionary<string, string>
        {
            ["COMPANY_NAME_EN"] = "FROZENHUB FOODSTUFF TRADING - L.L.C - S.P.C",
            ["COMPANY_NAME_AR"] = "فروزن هب لتجارة المواد الغذائية - ذ.م.م - ش.ش.و",
            ["COMPANY_ADDRESS"] = "Synthetic Building 1, Abu Dhabi",
            ["COMPANY_TRN"] = "100000000000003",
            ["INVOICE_HEADER_STYLE"] = "BilingualMonochrome",
            ["INVOICE_HEADER_STYLE_LOCKED"] = "true",
            ["CURRENCY"] = "AED",
            ["LOGO_BASE64_DATA_URI"] = "data:image/png;base64," + Convert.ToBase64String(ms.ToArray()),
        })
            db.Settings.Add(new Setting { TenantId = TenantId, OwnerId = TenantId, Key = kv.Key, Value = kv.Value });
        await db.SaveChangesAsync();
        return db;
    }
}
