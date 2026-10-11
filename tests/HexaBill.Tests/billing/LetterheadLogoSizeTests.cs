using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Products;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using UglyToad.PdfPig;

namespace HexaBill.Tests;

/// <summary>The tenant logo must print large and centred on the A4 bilingual invoice header.</summary>
public class LetterheadLogoSizeTests
{
    private const int TenantId = 2207;

    [Fact]
    public void LetterheadLogoBox_A4IsLargerThanCompactReceipts()
    {
        var a4 = PdfService.LetterheadLogoBox(true, 14);
        var mid = PdfService.LetterheadLogoBox(false, 10);
        var small = PdfService.LetterheadLogoBox(false, 7);
        Assert.True(a4.Height >= 130f && a4.Width >= 180f);
        Assert.True(a4.Column >= a4.Width);
        Assert.True(a4.Height > mid.Height && mid.Height > small.Height);
    }

    [Fact]
    public async Task A4Invoice_PrintsSquareLogoAtLeast130ptHighAndCentred()
    {
        await using var db = await SeedSquareLogoTenantAsync();
        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        var pdf = new PdfService(db, null!, fonts, new SettingsService(db), null!, NullLogger<PdfService>.Instance, null!);

        var bytes = await pdf.GenerateInvoicePdfAsync(new SaleDto
        {
            Id = 1, OwnerId = TenantId, InvoiceNo = "LG-1", InvoiceDate = new DateTime(2026, 10, 11),
            CustomerName = "Logo test customer", Subtotal = 10, VatTotal = 0.5m, GrandTotal = 10.5m,
            Items = [new SaleItemDto { ProductId = 1, ProductName = "Item", Qty = 1, UnitType = "CTN", UnitPrice = 10, LineTotal = 10, VatAmount = 0.5m }]
        }, "A4", "full");

        using var document = PdfDocument.Open(bytes);
        var page = document.GetPage(1);
        var logo = page.GetImages().OrderByDescending(i => i.Bounds.Height).FirstOrDefault();
        Assert.NotNull(logo);
        Assert.InRange(logo!.Bounds.Height, 160, 176);
        Assert.InRange(logo.Bounds.Centroid.X, page.Width / 2 - 40, page.Width / 2 + 40);
    }

    private static async Task<AppDbContext> SeedSquareLogoTenantAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.SetRequestTenantScope(null, true);
        using var logo = new Image<Rgba32>(420, 420, new Rgba32(20, 20, 20));
        using var ms = new MemoryStream();
        logo.SaveAsPng(ms);
        foreach (var pair in new Dictionary<string, string>
        {
            ["COMPANY_NAME_EN"] = "LOGO SIZE TEST TRADING - L.L.C",
            ["COMPANY_NAME_AR"] = "اختبار الشعار",
            ["COMPANY_PHONE"] = "+971500000000",
            ["COMPANY_ADDRESS"] = "Abu Dhabi, UAE",
            ["INVOICE_HEADER_STYLE"] = "BilingualMonochrome",
            ["CURRENCY"] = "AED",
            ["LOGO_BASE64_DATA_URI"] = "data:image/png;base64," + Convert.ToBase64String(ms.ToArray())
        })
            db.Settings.Add(new Setting { TenantId = TenantId, OwnerId = TenantId, Key = pair.Key, Value = pair.Value });
        await db.SaveChangesAsync();
        return db;
    }
}
