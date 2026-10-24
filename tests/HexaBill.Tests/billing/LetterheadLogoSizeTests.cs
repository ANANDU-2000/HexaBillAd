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
        Assert.InRange(a4.Height, 1f, 62.4f);
        Assert.InRange(a4.Width, 170f, 174f);
        Assert.InRange(a4.Column, 178f, 182f);
        Assert.True(a4.Column >= a4.Width);
        Assert.True(a4.Height > mid.Height && mid.Height > small.Height);
    }

    [Fact]
    public void SharedBilingualHeader_SplitsTheLongFoodstuffLegalNameForTheLeftColumn()
    {
        var split = PdfService.SplitBilingualCompanyNameLines("FROZENHUB FOODSTUFF TRADING - L.L.C - S.P.C");

        Assert.Equal("FROZENHUB", split.Title);
        Assert.Equal("FOODSTUFF TRADING - L.L.C - S.P.C", split.Subtitle);
    }

    [Fact]
    public async Task A4Invoice_PrintsSquareLogoWithTargetHeightAndCentred()
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
        Assert.InRange(logo!.Bounds.Height, 55, 65);
        Assert.InRange(logo.Bounds.Centroid.X, page.Width / 2 - 40, page.Width / 2 + 40);
    }

    [Theory]
    [InlineData("A4", 55f, 65f)]
    [InlineData("A5", 45f, 60f)]
    public async Task FrozenHubAutoPrint_GeneratesBilingualHeaderOnA4AndA5(string format, float minLogoHeight, float maxLogoHeight)
    {
        await using var db = await SeedSquareLogoTenantAsync();
        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        var pdf = new PdfService(db, null!, fonts, new SettingsService(db), null!, NullLogger<PdfService>.Instance, null!);
        var invoice = new SaleDto
        {
            Id = 1, OwnerId = TenantId, InvoiceNo = "FH-HEADER-QA", InvoiceDate = new DateTime(2026, 11, 2),
            CustomerName = "Synthetic customer", Subtotal = 20m, VatTotal = 1m, GrandTotal = 21m,
            Items = [new SaleItemDto { ProductId = 1, ProductName = "Synthetic frozen item", Qty = 1, UnitType = "CTN", UnitPrice = 20m, LineTotal = 21m, VatAmount = 1m }]
        };

        var bytes = await pdf.GenerateInvoicePdfAsync(invoice, format, "auto");
        await File.WriteAllBytesAsync(Path.Combine(AppContext.BaseDirectory, $"FrozenHub-{format}-synthetic.pdf"), bytes);
        using var document = PdfDocument.Open(bytes);
        var page = document.GetPage(1);
        var logo = Assert.Single(page.GetImages());

        Assert.Contains("FROZENHUB", page.Text);
        Assert.Contains("FOODSTUFF TRADING - L.L.C - S.P.C", page.Text);
        Assert.InRange(logo.Bounds.Height, minLogoHeight, maxLogoHeight);
        Assert.InRange(logo.Bounds.Centroid.X, page.Width / 2 - 45, page.Width / 2 + 45);
    }

    private static async Task<AppDbContext> SeedSquareLogoTenantAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.SetRequestTenantScope(null, true);
        db.Tenants.Add(new Tenant { Id = TenantId, Name = "FrozenHub QA", Subdomain = "frozenhub" });
        using var logo = new Image<Rgba32>(420, 420, new Rgba32(20, 20, 20));
        using var ms = new MemoryStream();
        logo.SaveAsPng(ms);
        foreach (var pair in new Dictionary<string, string>
        {
            ["COMPANY_NAME_EN"] = "FROZENHUB FOODSTUFF TRADING - L.L.C - S.P.C",
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
