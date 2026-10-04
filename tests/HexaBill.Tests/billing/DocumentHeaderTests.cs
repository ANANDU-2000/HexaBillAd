using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;

namespace HexaBill.Tests;

public class DocumentHeaderTests
{
    private static byte[] ColorLogo()
    {
        using var image = new Image<Rgba32>(100, 40, new Rgba32(220, 30, 10));
        using var stream = new MemoryStream();
        image.SaveAsPng(stream);
        return stream.ToArray();
    }

    [Fact]
    public void MonochromeLogo_RemovesColorWithoutModifyingSource()
    {
        var original = ColorLogo();
        using var result = Image.Load<Rgba32>(PdfService.MonochromeLogo(original)!);
        var pixel = result[0, 0];
        Assert.Equal(pixel.R, pixel.G);
        Assert.Equal(pixel.G, pixel.B);
        using var source = Image.Load<Rgba32>(original);
        Assert.NotEqual(source[0, 0].R, source[0, 0].G);
    }

    [Theory]
    [InlineData("A4")]
    [InlineData("A5")]
    [InlineData("80mm")]
    [InlineData("58mm")]
    public async Task InvoiceFormats_RenderCurrentBilingualHeader_AndChangedSettings(string format)
    {
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.SetRequestTenantScope(null, true);
        foreach (var pair in new Dictionary<string, string> {
            ["COMPANY_NAME_EN"] = "Fixture Foodstuff Trading LLC",
            ["COMPANY_NAME_AR"] = "شركة التجربة لتجارة المواد الغذائية",
            ["COMPANY_TRN"] = "123456789012345", ["COMPANY_PHONE"] = "+971 500000001",
            ["COMPANY_EMAIL"] = "fixture@example.test", ["COMPANY_ADDRESS"] = "Fixture address, Abu Dhabi",
            ["INVOICE_HEADER_STYLE"] = "BilingualMonochrome",
            ["LOGO_BASE64_DATA_URI"] = "data:image/png;base64," + Convert.ToBase64String(ColorLogo())
        }) db.Settings.Add(new Setting { TenantId = 10, OwnerId = 10, Key = pair.Key, Value = pair.Value });
        await db.SaveChangesAsync();
        var settings = new SettingsService(db);
        var pdf = new PdfService(db, null!, ProductionFonts(), settings, null!, NullLogger<PdfService>.Instance, null!);
        var sale = new SaleDto {
            Id = 1, OwnerId = 10, InvoiceNo = "FIXTURE-001", InvoiceDate = new DateTime(2026, 10, 4),
            CustomerName = "Fixture cash customer", Subtotal = 200, VatTotal = 10, GrandTotal = 210,
            Items = [new SaleItemDto { ProductId = 1, ProductName = "Fixture product", Qty = 2, UnitType = "CRTN", UnitPrice = 100, LineTotal = 200, VatAmount = 10 }]
        };
        var bytes = await pdf.GenerateInvoicePdfAsync(sale, format, "full");
        Assert.True(bytes.Length > 1000);
        SaveEvidence($"invoice-{format}.pdf", bytes);
        db.Settings.Single(s => s.Key == "COMPANY_NAME_EN").Value = "Updated Fixture Trading LLC";
        await db.SaveChangesAsync();
        var updated = await pdf.GenerateInvoicePdfAsync(sale, format, "full");
        Assert.False(bytes.SequenceEqual(updated));
        SaveEvidence($"invoice-{format}-updated.pdf", updated);
        // Generate the original layout to compare the preserved table/totals/footer.
        db.Settings.Single(s => s.Key == "INVOICE_HEADER_STYLE").Value = "Legacy";
        await db.SaveChangesAsync();
        SaveEvidence($"invoice-{format}-legacy.pdf", await pdf.GenerateInvoicePdfAsync(sale, format, "full"));
    }

    [Fact]
    public async Task ReceiptHeader_AllowsEmptyVat_AndRendersCurrentContacts()
    {
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var pdf = new PdfService(db, null!, ProductionFonts(), null!, null!, NullLogger<PdfService>.Instance, null!);
        var bytes = await pdf.GeneratePaymentReceiptPdfAsync(new PaymentReceiptDetailDto {
            CompanyName = "Current Fixture Trading LLC", CompanyNameAr = "شركة التجربة",
            CompanyTrn = "", CompanyPhone = "+971 500000001", CompanyEmail = "fixture@example.test",
            CompanyLogoDataUri = "data:image/png;base64," + Convert.ToBase64String(ColorLogo()),
            BilingualMonochromeHeader = true, ReceiptNumber = "REC-001", AmountReceived = 1330, AmountPaid = 1331,
            SettlementAdjustmentAmount = 1, PaymentMethod = "CASH", ReceiptDate = new DateTime(2026, 10, 4), ReceivedFrom = "Fixture customer",
            Invoices = [new PaymentReceiptInvoiceLineDto { InvoiceNo = "FIXTURE-001", InvoiceDate = new DateTime(2026, 10, 4), InvoiceTotal = 1331, AmountApplied = 1331 }]
        });
        Assert.True(bytes.Length > 1000);
        SaveEvidence("receipt-empty-vat.pdf", bytes);
    }

    private static void SaveEvidence(string filename, byte[] bytes)
    {
        var output = Environment.GetEnvironmentVariable("HEXABILL_PDF_EVIDENCE_DIR");
        if (string.IsNullOrWhiteSpace(output)) return;
        Directory.CreateDirectory(output);
        File.WriteAllBytes(Path.Combine(output, filename), bytes);
    }

    private static IFontService ProductionFonts()
    {
        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        Assert.Equal("Noto Sans Arabic", fonts.GetArabicFontFamily());
        return fonts;
    }
}
