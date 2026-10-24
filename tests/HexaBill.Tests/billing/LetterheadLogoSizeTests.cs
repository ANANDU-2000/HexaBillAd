using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Products;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
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
    public async Task A4Invoice_PrintsOriginalLogoWithAspectRatioAndCentred()
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
        Assert.InRange(logo!.Bounds.Height, 40, 62);
        Assert.InRange(logo.Bounds.Centroid.X, page.Width / 2 - 40, page.Width / 2 + 40);
    }

    [Fact]
    public async Task FrozenHubPrint_GeneratesFivePlainPreprintedAndBilingualPdfSamples()
    {
        await using var db = await SeedSquareLogoTenantAsync();
        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        var pdf = new PdfService(db, null!, fonts, new SettingsService(db), null!, NullLogger<PdfService>.Instance, null!);

        foreach (var sample in new[]
        {
            (Format: "A4", Layout: "full", Name: "FrozenHub-A4-plain-approved.pdf"),
            (Format: "A4", Layout: "body", Name: "FrozenHub-A4-preprinted-approved.pdf"),
            (Format: "A4", Layout: "full", Name: "FrozenHub-A4-bilingual-approved.pdf"),
            (Format: "A5", Layout: "full", Name: "FrozenHub-A5-plain-approved.pdf"),
            (Format: "A5", Layout: "body", Name: "FrozenHub-A5-preprinted-approved.pdf")
        })
        {
            var bytes = await pdf.GenerateInvoicePdfAsync(CreateSampleInvoice(), sample.Format, sample.Layout);
            await File.WriteAllBytesAsync(Path.Combine(AppContext.BaseDirectory, sample.Name), bytes);

            using var document = PdfDocument.Open(bytes);
            var page = document.GetPage(1);
            Assert.Contains("FH-QA-2026", page.Text);
            Assert.Contains("21.00", page.Text);
            Assert.DoesNotContain("Starplus", page.Text, StringComparison.OrdinalIgnoreCase);

            if (sample.Layout == "body")
            {
                Assert.Empty(page.GetImages());
                Assert.DoesNotContain("FROZENHUB", page.Text);
            }
            else
            {
                Assert.Contains("FROZENHUB", page.Text);
                Assert.Contains("FOODSTUFF TRADING - L.L.C - S.P.C", page.Text);
                Assert.Contains("Abu Dhabi, Musaffah 17", page.Text);
                Assert.DoesNotContain("frozenhubfoods@gmail.com", page.Text, StringComparison.OrdinalIgnoreCase);
                Assert.DoesNotContain("+971 55 552 8878", page.Text, StringComparison.OrdinalIgnoreCase);
                Assert.DoesNotContain("International Transport", page.Text, StringComparison.OrdinalIgnoreCase);
                var logo = Assert.Single(page.GetImages());
                Assert.InRange(logo.Bounds.Height, sample.Format == "A4" ? 40f : 25f, sample.Format == "A4" ? 62f : 52f);
                Assert.InRange(logo.Bounds.Centroid.X, page.Width / 2 - 22, page.Width / 2 + 22);
            }
        }
    }

    [Theory]
    [InlineData(1)]
    [InlineData(6)]
    [InlineData(7)]
    [InlineData(20)]
    [InlineData(40)]
    public async Task FrozenHubA4FullPrint_GeneratesInvoicesAcrossItemTableAndPaginationSizes(int itemCount)
    {
        await using var db = await SeedSquareLogoTenantAsync();
        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        var pdf = new PdfService(db, null!, fonts, new SettingsService(db), null!, NullLogger<PdfService>.Instance, null!);
        var invoice = CreateSampleInvoice();
        invoice.Subtotal = itemCount * 35m;
        invoice.VatTotal = itemCount * 1.75m;
        invoice.GrandTotal = itemCount * 36.75m;
        invoice.Items = Enumerable.Range(1, itemCount).Select(index => new SaleItemDto
        {
            ProductId = index,
            ProductName = $"Synthetic frozen product {index:00} - extended description for invoice layout testing",
            Qty = 1,
            UnitType = "CTN",
            UnitPrice = 35m,
            LineTotal = 36.75m,
            VatAmount = 1.75m
        }).ToList();

        var bytes = await pdf.GenerateInvoicePdfAsync(invoice, "A4", "full");
        using var document = PdfDocument.Open(bytes);

        Assert.True(document.NumberOfPages >= 1);
        Assert.Contains("FROZENHUB", document.GetPage(1).Text);
    }

    [Fact]
    public async Task FrozenHubA4FullPrint_GeneratesReportedThreeLineInvoiceShapeWithoutChangingStoredTotals()
    {
        await using var db = await SeedSquareLogoTenantAsync(includeArabicName: false);
        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        var pdf = new PdfService(db, null!, fonts, new SettingsService(db), null!, NullLogger<PdfService>.Instance, null!);
        var invoice = new SaleDto
        {
            Id = 1637, OwnerId = TenantId, InvoiceNo = "FH-QA-1791254857",
            InvoiceDate = new DateTime(2026, 10, 24), CustomerName = "Synthetic Customer 19",
            Subtotal = 768m, Discount = 0.40m, VatTotal = 38.40m, GrandTotal = 806m,
            RoundOff = 0m,
            Items =
            [
                new SaleItemDto { ProductId = 1, ProductName = "Synthetic frozen product A", Qty = 2, UnitType = "CRTN", UnitPrice = 124m, LineTotal = 260.40m, VatAmount = 12.40m },
                new SaleItemDto { ProductId = 2, ProductName = "Synthetic frozen product B", Qty = 1, UnitType = "CRTN", UnitPrice = 365m, LineTotal = 383.25m, VatAmount = 18.25m },
                new SaleItemDto { ProductId = 3, ProductName = "Synthetic frozen product C", Qty = 1, UnitType = "CRTN", UnitPrice = 155m, LineTotal = 162.75m, VatAmount = 7.75m }
            ]
        };

        var bytes = await pdf.GenerateInvoicePdfAsync(invoice, "A4", "full");
        await File.WriteAllBytesAsync(Path.Combine(AppContext.BaseDirectory, "FrozenHub-A4-reported-shape-approved.pdf"), bytes);
        using var document = PdfDocument.Open(bytes);
        var page = document.GetPage(1);
        var normalizedText = string.Concat(document.GetPages().SelectMany(pdfPage => pdfPage.Text.Where(character => !char.IsWhiteSpace(character))));

        Assert.Contains("FH-QA-1791254857", normalizedText);
        Assert.Contains("CustomerName", normalizedText);
        Assert.Contains("806.00", normalizedText);
        Assert.Contains("38.40", normalizedText);
        Assert.Contains("260.40", normalizedText);
        Assert.Contains("383.25", normalizedText);
        Assert.Contains("162.75", normalizedText);
        Assert.Single(page.GetImages());
    }

    [Fact]
    public async Task FrozenHubA4FullPrint_GeneratesWhenArabicLegalNameIsUnconfigured()
    {
        await using var db = await SeedSquareLogoTenantAsync(includeArabicName: false);
        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        var pdf = new PdfService(db, null!, fonts, new SettingsService(db), null!, NullLogger<PdfService>.Instance, null!);

        var bytes = await pdf.GenerateInvoicePdfAsync(CreateSampleInvoice(), "A4", "full");
        using var document = PdfDocument.Open(bytes);

        Assert.Contains("FROZENHUB", document.GetPage(1).Text);
        Assert.Contains("FH-QA-2026", document.GetPage(1).Text);
    }

    [Theory]
    [InlineData(80)]
    [InlineData(160)]
    [InlineData(300)]
    public async Task FrozenHubA4FullPrint_GeneratesWhenItemDescriptionHasNoBreaks(int descriptionLength)
    {
        await using var db = await SeedSquareLogoTenantAsync();
        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        var pdf = new PdfService(db, null!, fonts, new SettingsService(db), null!, NullLogger<PdfService>.Instance, null!);
        var invoice = CreateSampleInvoice();
        invoice.Items[0].ProductName = new string('X', descriptionLength);

        var bytes = await pdf.GenerateInvoicePdfAsync(invoice, "A4", "full");
        using var document = PdfDocument.Open(bytes);

        Assert.True(document.NumberOfPages >= 1);
    }

    private static SaleDto CreateSampleInvoice() => new()
    {
        Id = 1, OwnerId = TenantId, InvoiceNo = "FH-QA-2026", InvoiceDate = new DateTime(2026, 10, 30),
        CustomerName = "Synthetic customer", Subtotal = 20m, VatTotal = 1m, GrandTotal = 21m,
        Items = [new SaleItemDto { ProductId = 1, ProductName = "Synthetic frozen item", Qty = 1, UnitType = "CTN", UnitPrice = 20m, LineTotal = 21m, VatAmount = 1m }]
    };

    private static async Task<AppDbContext> SeedSquareLogoTenantAsync(bool includeArabicName = true)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.SetRequestTenantScope(null, true);
        db.Tenants.Add(new Tenant { Id = TenantId, Name = "FrozenHub QA", Subdomain = "frozenhub" });
        var logoPath = FindRepositoryRoot();
        var logoBytes = await File.ReadAllBytesAsync(Path.Combine(logoPath, "backend", "HexaBill.Api", "SeedLogos", "frozenhub-logo-client.png"));
        foreach (var pair in new Dictionary<string, string>
        {
            ["COMPANY_NAME_EN"] = "FROZENHUB FOODSTUFF TRADING - L.L.C - S.P.C",
            ["COMPANY_NAME_AR"] = includeArabicName ? "فروزن هب لتجارة المواد الغذائية - ذ.م.م - ش.ش.و" : "",
            ["COMPANY_PHONE"] = "+971 55 552 8878",
            ["COMPANY_EMAIL"] = "frozenhubfoods@gmail.com",
            ["COMPANY_ADDRESS"] = "Musaffah, Bldg 17, Al Nubalaa International Transport & General Contracting - Sole Proprietorship LLC, Abu Dhabi",
            ["COMPANY_TRN"] = "105607243000003",
            ["INVOICE_HEADER_STYLE"] = "BilingualMonochrome",
            ["INVOICE_HEADER_STYLE_LOCKED"] = "true",
            ["CURRENCY"] = "AED",
            ["LOGO_BASE64_DATA_URI"] = "data:image/png;base64," + Convert.ToBase64String(logoBytes)
        })
            db.Settings.Add(new Setting { TenantId = TenantId, OwnerId = TenantId, Key = pair.Key, Value = pair.Value });
        await db.SaveChangesAsync();
        return db;
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null && !File.Exists(Path.Combine(directory.FullName, "backend", "HexaBill.Api", "SeedLogos", "frozenhub-logo-client.png")))
            directory = directory.Parent;
        return directory?.FullName ?? throw new DirectoryNotFoundException("Could not locate the FrozenHub original logo from the test output directory.");
    }
}
