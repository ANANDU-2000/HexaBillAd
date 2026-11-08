using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;

namespace HexaBill.Tests;

/// <summary>
/// P0-PRINT-007 (client voice notes, 2026-11-02, compared against Starplus invoice 6989):
/// larger and taller product rows, bank details below both signature areas, P.O. Box after the mobile number,
/// original amounts unchanged. Renders the live FrozenHub path (subdomains frozenhub / frozenhub2 force the
/// approved bilingual header). Synthetic data; the IBAN is the ISO 13616 example, not a real account.
/// PDFs are written to print-p7/ under the test output directory for visual inspection.
/// </summary>
[Collection("HttpIntegration")]
public class FrozenHubPrintReadabilityTests
{
    private const int Fh1 = 20;
    private const int Fh2 = 23;
    private const string Fh1Phone = "971555298878";
    private const string Fh2Phone = "+971 502868906";
    private const string ExampleIban = "AE070331234567890123456";

    // Lines and totals of invoice 7013 (2026-11-02, KHAN DARBAR RESTAURANT) as printed by the live system.
    private static readonly (string Name, string Unit, decimal Qty, decimal Price, decimal Vat, decimal Amount)[] Invoice7013 =
    {
        ("FROZEN CHICKEN 1200GM QUALIKO", "CRTN", 1m, 124.00m, 6.20m, 130.20m),
        ("MUTTON 6 WAY CUT-AUS", "KG", 22.35m, 36.00m, 40.23m, 844.83m),
        ("CKN BREAST ARAURA 12KG", "CRTN", 0.5m, 182.00m, 4.55m, 95.55m),
        ("FROZEN CREAM DORRY(HAMOOR)", "CRTN", 1m, 106.00m, 5.30m, 111.30m),
        ("SHEEP FEET EVERYDAY", "KG", 10m, 28.00m, 14.00m, 294.00m),
    };

    [Theory]
    [InlineData("A4")]
    [InlineData("A5")]
    public async Task BankDetails_PrintBelowBothSignatureAreas_AndAboveBalanceFooter(string format)
    {
        await using var db = await SeedAsync();
        var bytes = await Pdf(db).GenerateInvoicePdfAsync(await Sale7013Async(db, Fh1), format, "full");
        await SaveAsync(bytes, $"fh1-7013-{format}.pdf");
        using var doc = PdfDocument.Open(bytes);
        var page = doc.GetPage(doc.NumberOfPages);
        var words = page.GetWords().ToList();

        double Top(string text) => words.First(w => w.Text == text).BoundingBox.Top;
        // PDF y grows upward: "below" means a smaller y.
        var receiverSign = words.Where(w => w.Text == "Sign").Max(w => w.BoundingBox.Top);
        var companySign = words.First(w => w.Text == "For").BoundingBox.Top;
        var bankHeading = words.First(w => w.Text == "Bank" && words.Any(d => d.Text == "Details" && Math.Abs(d.BoundingBox.Bottom - w.BoundingBox.Bottom) < 1)).BoundingBox.Top;
        var footer = Top("Bills:");

        // PDF-2 (invoice 7043 regression, owner 2026-11-03 evening): on A4 AND A5 the bank block is below both signature
        // areas and above the balance footer — never a column inside the signature row.
        Assert.True(bankHeading < receiverSign, $"bank ({bankHeading}) must be below Receiver's Sign ({receiverSign})");
        Assert.True(bankHeading < companySign, $"bank ({bankHeading}) must be below the company signature ({companySign})");
        Assert.True(footer < bankHeading, $"balance footer ({footer}) must stay below the bank block ({bankHeading})");

        var text = Squash(string.Concat(doc.GetPages().Select(p => p.Text)));
        var iBank = text.IndexOf("BankName:ADCBIslamic", StringComparison.Ordinal);
        var iAcct = text.IndexOf("AccountName:FROZENHUBFOODSTUFFTRADINGLLCSPC", StringComparison.Ordinal);
        var iIban = text.IndexOf("IBAN:AE070331234567890123456", StringComparison.Ordinal);
        Assert.True(iBank >= 0 && iAcct > iBank && iIban > iAcct, $"bank order: {iBank},{iAcct},{iIban}");
        Assert.DoesNotContain("AccountNumber", text, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task A4_ProductRows_AreCompact_BilingualOwnerSpec()
    {
        await using var db = await SeedAsync();
        var bytes = await Pdf(db).GenerateInvoicePdfAsync(await Sale7013Async(db, Fh1), "A4", "full");
        using var doc = PdfDocument.Open(bytes);
        var words = doc.GetPage(1).GetWords().ToList();

        var description = words.First(w => w.Text == "QUALIKO");
        var price = words.First(w => w.Text == "124.00");
        // PDF-1 (owner 2026-11-03 evening; invoice 7043 printed at 7pt): description 10.5pt, numbers 10pt, like invoice 7028.
        Assert.Equal(10.5f, PdfService.FrozenHubA4ItemDescriptionFontSize);
        Assert.Equal(10f, PdfService.FrozenHubA4ItemNumberFontSize);
        Assert.Equal(5f, PdfService.FrozenHubA4ItemCellPadding);
        Assert.InRange(description.Letters.Max(l => l.PointSize), 10.2, 10.8);
        Assert.InRange(price.Letters.Max(l => l.PointSize), 9.7, 10.3);

        // Row pitch: baseline distance between consecutive one-line product rows (10.5pt text + 2 x 5pt padding).
        var rows = new[] { "QUALIKO", "6", "ARAURA", "DORRY(HAMOOR)", "EVERYDAY" }
            .Select(t => words.First(w => w.Text == t && w.BoundingBox.Left < 300).BoundingBox.Bottom).ToList();
        for (var i = 1; i < rows.Count; i++)
            Assert.True(rows[i - 1] - rows[i] >= 18 && rows[i - 1] - rows[i] <= 30, $"row pitch {rows[i - 1] - rows[i]:0.0}pt between rows {i} and {i + 1}");
    }

    [Fact]
    public async Task A4_InvoiceAmounts_AreExactlyTheStoredValues()
    {
        await using var db = await SeedAsync();
        var text = Squash(Text(await Pdf(db).GenerateInvoicePdfAsync(await Sale7013Async(db, Fh1), "A4", "full")));
        foreach (var amount in new[] { "1405.60", "0.88", "70.28", "1475.00", "844.83", "22.35" })
            Assert.Contains(amount, text);
    }

    [Fact]
    public async Task A4_LongProductName_WrapsCompletely_AndNeverOverlapsTheUnitColumn()
    {
        await using var db = await SeedAsync();
        const string longName = "FROZEN WHOLE CHICKEN GRILLER GRADE A HALAL 1300GM X 10 PCS PER CARTON BRAZIL SADIA EXPORT PACK";
        var sale = await Sale7013Async(db, Fh1);
        sale.Items[0].ProductName = longName;
        var bytes = await Pdf(db).GenerateInvoicePdfAsync(sale, "A4", "full");
        await SaveAsync(bytes, "fh1-long-name-A4.pdf");
        using var doc = PdfDocument.Open(bytes);
        var words = doc.GetPage(1).GetWords().ToList();
        var unitLeft = words.Where(w => w.Text == "CRTN").Min(w => w.BoundingBox.Left);
        var descriptionLeft = words.First(w => w.Text == "FROZEN").BoundingBox.Left;
        // Every token of the name is printed inside the Description column (wrapped, not truncated, not spilling).
        foreach (var token in longName.Split(' ', StringSplitOptions.RemoveEmptyEntries).Distinct())
            Assert.True(words.Any(w => w.Text == token && w.BoundingBox.Left >= descriptionLeft - 1 && w.BoundingBox.Right < unitLeft),
                $"'{token}' missing from the Description column (unit column starts at {unitLeft:0})");
        // The wrapped name takes more than one line.
        var lines = words.Where(w => w.BoundingBox.Left >= descriptionLeft - 1 && w.BoundingBox.Right < unitLeft && longName.Contains(w.Text))
            .Select(w => Math.Round(w.BoundingBox.Bottom)).Distinct().Count();
        Assert.True(lines >= 2, $"expected the long name to wrap, found {lines} line(s)");
    }

    [Theory]
    [InlineData(Fh1, Fh1Phone, Fh2Phone)]
    [InlineData(Fh2, Fh2Phone, Fh1Phone)]
    public async Task Header_PoBoxFollowsMobile_AndEachTenantPrintsOnlyItsOwnPhone(int tenant, string own, string other)
    {
        await using var db = await SeedAsync();
        var text = Squash(Text(await Pdf(db).GenerateInvoicePdfAsync(await Sale7013Async(db, tenant), "A4", "full")));
        var iMob = text.IndexOf("Mob:" + Squash(own), StringComparison.Ordinal);
        var iPo = text.IndexOf("P.O.Box:8316", StringComparison.Ordinal);
        var iEmail = text.IndexOf("Email:", StringComparison.Ordinal);
        Assert.True(iMob >= 0 && iPo > iMob && iEmail > iPo, $"header order Mob {iMob} < P.O. Box {iPo} < Email {iEmail}");
        Assert.DoesNotContain(Squash(other), text);
    }

    [Fact]
    public async Task A4_Header_MobilePoBoxAndTrn_AreEnlarged()
    {
        await using var db = await SeedAsync();
        using var doc = PdfDocument.Open(await Pdf(db).GenerateInvoicePdfAsync(await Sale7013Async(db, Fh1), "A4", "full"));
        var words = doc.GetPage(1).GetWords().ToList();
        double Size(string text) => words.First(w => w.Text == text).Letters.Max(l => l.PointSize);
        Assert.InRange(Size("8316"), PdfService.FrozenHubA4InvoiceHeaderDetailSize - 0.3, PdfService.FrozenHubA4InvoiceHeaderDetailSize + 0.3);
        Assert.InRange(Size(Fh1Phone), PdfService.FrozenHubA4InvoiceHeaderDetailSize - 0.3, PdfService.FrozenHubA4InvoiceHeaderDetailSize + 0.3);
        Assert.True(words.Where(w => w.Text.Contains("105607243000003")).All(w => w.Letters.Max(l => l.PointSize) >= PdfService.FrozenHubA4InvoiceHeaderDetailSize - 0.3),
            "TRN must print at the enlarged header size on both sides");
    }

    [Theory]
    [InlineData("A4", 1)]
    [InlineData("A4", 10)]
    [InlineData("A4", 20)]
    [InlineData("A4", 30)]
    [InlineData("A5", 1)]
    [InlineData("A5", 10)]
    [InlineData("A5", 20)]
    public async Task ItemCountMatrix_RendersEveryRow_WholeFooterOnLastPage(string format, int items)
    {
        await using var db = await SeedAsync();
        var sale = await Sale7013Async(db, Fh2);
        sale.Items = Enumerable.Range(1, items).Select(i => new SaleItemDto
        {
            ProductId = i, ProductName = $"FROZEN PRODUCT row{i:00} 1300GM", Qty = 1, UnitType = "CRTN", UnitPrice = 100m, VatAmount = 5m, LineTotal = 105m
        }).ToList();
        sale.Subtotal = 100m * items; sale.VatTotal = 5m * items; sale.Discount = 0; sale.GrandTotal = 105m * items;
        var bytes = await Pdf(db).GenerateInvoicePdfAsync(sale, format, "full");
        await SaveAsync(bytes, $"fh2-{format}-{items:00}-items.pdf");
        using var doc = PdfDocument.Open(bytes);
        var pages = doc.GetPages().Select(p => Squash(p.Text)).ToList();
        var all = string.Concat(pages);
        for (var i = 1; i <= items; i++) Assert.Contains($"row{i:00}", all);
        var last = pages[^1];
        foreach (var marker in new[] { "Receiver'sName", "Receiver'sSign", "BankDetails", "IBAN:", "Bills:" })
        {
            Assert.Contains(marker, last);
            for (var i = 0; i < pages.Count - 1; i++) Assert.DoesNotContain(marker, pages[i]);
        }
        Assert.Contains((105m * items).ToString("0.00"), all);
    }

    [Fact]
    public async Task Evidence_Invoice7010Replica_BothTenants()
    {
        await using var db = await SeedAsync();
        foreach (var tenant in new[] { Fh1, Fh2 })
        {
            var sale = await Sale7013Async(db, tenant);
            sale.InvoiceNo = "7010"; sale.CustomerName = "ISHAKALI RESTAURANT";
            sale.Items = new List<SaleItemDto>
            {
                new() { ProductId = 1, ProductName = "FROZEN CHICKEN SEARA 1300GM", UnitType = "CRTN", Qty = 3, UnitPrice = 126m, VatAmount = 18.90m, LineTotal = 396.90m },
                new() { ProductId = 2, ProductName = "BEEF CUBE CARABAO 18KG", UnitType = "CRTN", Qty = 1, UnitPrice = 370m, VatAmount = 18.50m, LineTotal = 388.50m },
            };
            sale.Subtotal = 748m; sale.VatTotal = 37.40m; sale.Discount = 0; sale.RoundOff = -0.40m; sale.GrandTotal = 785m;
            foreach (var format in new[] { "A4", "A5" })
            {
                var bytes = await Pdf(db).GenerateInvoicePdfAsync(sale, format, "full");
                await SaveAsync(bytes, $"tenant{tenant}-7010-{format}.pdf");
                Assert.Contains("785.00", Text(bytes));
            }
        }
    }

    [Fact]
    public async Task Evidence_Invoice7028And7043_LiveLines()
    {
        // Lines and totals of FrozenHub invoices 7028 (morning, correct) and 7043 (evening, regressed) copied from the live
        // database on 2026-11-03. Rendered for PNG inspection; amounts must print exactly as stored.
        await using var db = await SeedAsync();
        var s7028 = await Sale7013Async(db, Fh1);
        s7028.InvoiceNo = "7028"; s7028.InvoiceDate = new DateTime(2026, 11, 3, 12, 0, 0, DateTimeKind.Utc);
        s7028.Items = new List<SaleItemDto>
        {
            new() { ProductId = 1, ProductName = "AL ARMAN BEEF VEAL LEG 18KG", UnitType = "CRTN", Qty = 1m, UnitPrice = 435m, VatAmount = 21.75m, LineTotal = 456.75m },
            new() { ProductId = 2, ProductName = "BEEF BRISKET", UnitType = "CRTN", Qty = 0.5m, UnitPrice = 210m, VatAmount = 5.25m, LineTotal = 110.25m },
            new() { ProductId = 3, ProductName = "FROZEN BRAZIL BEEF TRIPE", UnitType = "KG", Qty = 10m, UnitPrice = 22m, VatAmount = 11m, LineTotal = 231m },
            new() { ProductId = 4, ProductName = "CKN BREAST AROURA 12KG", UnitType = "CRTN", Qty = 0.5m, UnitPrice = 182m, VatAmount = 4.55m, LineTotal = 95.55m },
            new() { ProductId = 5, ProductName = "MUTTON 6 WAY CUT-AUS", UnitType = "KG", Qty = 16.4m, UnitPrice = 36m, VatAmount = 29.52m, LineTotal = 619.92m },
        };
        s7028.Subtotal = 1441.40m; s7028.Discount = 3.47m; s7028.VatTotal = 72.07m; s7028.RoundOff = 0m; s7028.GrandTotal = 1510.00m;
        var s7043 = await Sale7013Async(db, Fh1);
        s7043.InvoiceNo = "7043"; s7043.InvoiceDate = new DateTime(2026, 11, 3, 12, 0, 0, DateTimeKind.Utc);
        s7043.Items = new List<SaleItemDto>
        {
            new() { ProductId = 1, ProductName = "FROZEN CHICKEN 1200GM QUALIKO", UnitType = "CRTN", Qty = 4m, UnitPrice = 124m, VatAmount = 24.80m, LineTotal = 520.80m },
        };
        s7043.Subtotal = 496m; s7043.Discount = 0m; s7043.VatTotal = 24.80m; s7043.RoundOff = 0.20m; s7043.GrandTotal = 521.00m;
        foreach (var (sale, total) in new[] { (s7028, "1510.00"), (s7043, "521.00") })
        {
            var bytes = await Pdf(db).GenerateInvoicePdfAsync(sale, "A4", "full");
            await SaveAsync(bytes, $"fh1-{sale.InvoiceNo}-A4.pdf");
            using var doc = PdfDocument.Open(bytes);
            Assert.Equal(1, doc.NumberOfPages);
            var text = Squash(Text(bytes));
            Assert.Contains(total, text);
            Assert.True(text.IndexOf("Receiver'sSign", StringComparison.Ordinal) < text.IndexOf("BankDetails", StringComparison.Ordinal));
        }
    }

    // ---------- helpers ----------

    private static async Task<SaleDto> Sale7013Async(AppDbContext db, int tenant)
    {
        var customerId = tenant * 1000 + 1;
        if (!await db.Customers.AnyAsync(c => c.Id == customerId))
        {
            db.Customers.Add(new Customer { Id = customerId, TenantId = tenant, OwnerId = tenant, Name = "KHAN DARBAR RESTAURANT", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
            db.Sales.Add(new Sale
            {
                TenantId = tenant, OwnerId = tenant, CustomerId = customerId, InvoiceNo = "7013",
                InvoiceDate = new DateTime(2026, 11, 2, 12, 0, 0, DateTimeKind.Utc), GrandTotal = 1475m, TotalAmount = 1475m,
                PaidAmount = 0, PaymentStatus = SalePaymentStatus.Pending, CreatedBy = 1, CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }
        return new SaleDto
        {
            Id = 7013, OwnerId = tenant, CustomerId = customerId, InvoiceNo = "7013",
            InvoiceDate = new DateTime(2026, 11, 2, 12, 0, 0, DateTimeKind.Utc), CustomerName = "KHAN DARBAR RESTAURANT",
            Subtotal = 1405.60m, Discount = 0.88m, VatTotal = 70.28m, GrandTotal = 1475.00m, PaidAmount = 0m,
            Items = Invoice7013.Select((l, i) => new SaleItemDto
            {
                ProductId = i + 1, ProductName = l.Name, UnitType = l.Unit, Qty = l.Qty, UnitPrice = l.Price, VatAmount = l.Vat, LineTotal = l.Amount
            }).ToList()
        };
    }

    [Fact]
    public async Task A4_DateSitsOnTheInvoiceLine_AndPrintsOnlyOnce()
    {
        await using var db = await SeedAsync();
        var bytes = await Pdf(db).GenerateInvoicePdfAsync(await Sale7013Async(db, Fh1), "A4", "full");
        using var doc = PdfDocument.Open(bytes);
        var words = doc.GetPage(1).GetWords().ToList();

        var dates = words.Where(w => w.Text.StartsWith("DATE", StringComparison.Ordinal)).ToList();
        Assert.Single(dates);
        // Anchor on the invoice number (the "TAX INVOICE" title is a different line above the meta row).
        var invoiceNo = words.First(w => w.Text == "7013");
        Assert.True(Math.Abs(dates[0].BoundingBox.Bottom - invoiceNo.BoundingBox.Bottom) < 4,
            $"DATE baseline {dates[0].BoundingBox.Bottom:0.0} should match the invoice number line {invoiceNo.BoundingBox.Bottom:0.0}");
    }

    [Fact]
    public async Task A4_TenItems_FitOnOnePage_WithTheWholeFooter_AtFullSize()
    {
        // Owner spec (2026-11-03): 1-10 items fit on page 1 without shrinking the 10.5pt product text.
        await using var db = await SeedAsync();
        var sale = await Sale7013Async(db, Fh1);
        sale.Items = Enumerable.Range(1, 10).Select(i => new SaleItemDto
        {
            ProductId = i, ProductName = $"FROZEN PRODUCT row{i:00} 1300GM", Qty = 1, UnitType = "CRTN", UnitPrice = 100m, VatAmount = 5m, LineTotal = 105m
        }).ToList();
        sale.Subtotal = 1000m; sale.VatTotal = 50m; sale.Discount = 0; sale.GrandTotal = 1050m;
        var bytes = await Pdf(db).GenerateInvoicePdfAsync(sale, "A4", "full");
        await SaveAsync(bytes, "fh1-A4-10-items.pdf");
        using var doc = PdfDocument.Open(bytes);
        Assert.Equal(1, doc.NumberOfPages);
        var row = doc.GetPage(1).GetWords().First(w => w.Text == "row10");
        Assert.InRange(row.Letters.Max(l => l.PointSize), 10.2, 10.8);
        var text = Squash(Text(bytes));
        for (var i = 1; i <= 10; i++) Assert.Contains($"row{i:00}", text);
        Assert.Contains("Receiver'sName", text);
        Assert.Contains("BankDetails", text);
        Assert.Contains("Bills:", text);
    }

    [Theory]
    [InlineData(5)]
    [InlineData(10)]
    [InlineData(20)]
    public async Task A4_FooterOrder_SignaturesThenBankThenCustomerBalance(int items)
    {
        // PDF-2 lock (invoice 7043): Receiver's Sign < Bank Details < Customer Balance in reading order, on the same page.
        await using var db = await SeedAsync();
        var sale = await Sale7013Async(db, Fh1);
        if (items != 5)
        {
            sale.Items = Enumerable.Range(1, items).Select(i => new SaleItemDto
            {
                ProductId = i, ProductName = $"FROZEN PRODUCT row{i:00} 1300GM", Qty = 1, UnitType = "CRTN", UnitPrice = 100m, VatAmount = 5m, LineTotal = 105m
            }).ToList();
            sale.Subtotal = 100m * items; sale.VatTotal = 5m * items; sale.Discount = 0; sale.GrandTotal = 105m * items;
        }
        var bytes = await Pdf(db).GenerateInvoicePdfAsync(sale, "A4", "full");
        using var doc = PdfDocument.Open(bytes);
        var last = doc.GetPage(doc.NumberOfPages);
        var text = Squash(last.Text);
        var iName = text.IndexOf("Receiver'sName", StringComparison.Ordinal);
        var iSign = text.IndexOf("Receiver'sSign", StringComparison.Ordinal);
        var iBank = text.IndexOf("BankDetails", StringComparison.Ordinal);
        var iBalance = text.IndexOf("CustomerBalance", StringComparison.Ordinal);
        Assert.True(iName >= 0 && iSign > iName && iBank > iSign && iBalance > iBank, $"order name={iName} sign={iSign} bank={iBank} balance={iBalance}");
        // Geometry: the bank heading is below every signature label (PDF y grows upward).
        var words = last.GetWords().ToList();
        var lowestSignature = words.Where(w => w.Text == "Sign" || w.Text == "For").Min(w => w.BoundingBox.Bottom);
        var bankTop = words.First(w => w.Text == "Bank" && words.Any(d => d.Text == "Details" && Math.Abs(d.BoundingBox.Bottom - w.BoundingBox.Bottom) < 1)).BoundingBox.Top;
        Assert.True(bankTop < lowestSignature, $"bank top {bankTop:0.0} must be below the signature labels ({lowestSignature:0.0})");
    }

    private static PdfService Pdf(AppDbContext db)
    {
        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        return new PdfService(db, null!, fonts, new SettingsService(db), null!, NullLogger<PdfService>.Instance, null!);
    }

    private static string Text(byte[] bytes)
    {
        using var doc = PdfDocument.Open(bytes);
        return string.Concat(doc.GetPages().Select(p => p.Text));
    }

    private static string Squash(string s) => new(s.Where(c => !char.IsWhiteSpace(c)).ToArray());

    private static async Task SaveAsync(byte[] bytes, string name)
    {
        var dir = Path.Combine(AppContext.BaseDirectory, "print-p7");
        Directory.CreateDirectory(dir);
        await File.WriteAllBytesAsync(Path.Combine(dir, name), bytes);
    }

    private static byte[] Logo()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir != null; dir = dir.Parent)
        {
            var asset = Path.Combine(dir.FullName, "backend", "HexaBill.Api", "SeedLogos", "frozenhub-logo-bw.png");
            if (File.Exists(asset)) return File.ReadAllBytes(asset);
        }
        throw new FileNotFoundException("frozenhub-logo-bw.png");
    }

    private static async Task<AppDbContext> SeedAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.SetRequestTenantScope(null, true);
        var logo = "data:image/png;base64," + Convert.ToBase64String(Logo());
        db.Users.Add(new User { Id = 1, TenantId = Fh1, OwnerId = Fh1, Name = "Owner", Email = "o@example.invalid", PasswordHash = "x", Role = UserRole.Owner, CreatedAt = DateTime.UtcNow });
        foreach (var (tenant, phone, sub, email) in new[] { (Fh1, Fh1Phone, "frozenhub", "frozenhubfoods@gmail.com"), (Fh2, Fh2Phone, "frozenhub2", "frozenhub2@hexabill.company") })
        {
            db.Tenants.Add(new Tenant { Id = tenant, Name = $"Synthetic {sub}", Subdomain = sub });
            var values = new Dictionary<string, string>
            {
                ["COMPANY_NAME_EN"] = "FROZENHUB FOODSTUFF TRADING - L.L.C - S.P.C",
                ["COMPANY_NAME_AR"] = "فروزن هب لتجارة المواد الغذائية - ذ.م.م - ش.ش.و",
                ["COMPANY_PHONE"] = phone,
                ["COMPANY_EMAIL"] = email,
                ["COMPANY_ADDRESS"] = "Musaffah, Bldg 17, Al Nubalaa International Transport & General Contracting - Sole Proprietorship LLC, Abu Dhabi",
                ["COMPANY_TRN"] = "105607243000003",
                ["INVOICE_HEADER_STYLE"] = tenant == Fh1 ? "Legacy" : "BilingualMonochrome", // live values; the FrozenHub subdomain forces the approved header
                ["INVOICE_PO_BOX"] = "8316",
                ["INVOICE_BANK_NAME"] = "ADCB Islamic",
                ["INVOICE_BANK_ACCOUNT_NAME"] = "FROZENHUB FOODSTUFF TRADING LLC SPC",
                ["INVOICE_BANK_IBAN"] = ExampleIban,
                ["VAT_PERCENT"] = "5",
                ["CURRENCY"] = "AED",
                ["LOGO_BASE64_DATA_URI"] = logo
            };
            foreach (var pair in values)
                db.Settings.Add(new Setting { TenantId = tenant, OwnerId = tenant, Key = pair.Key, Value = pair.Value });
        }
        await db.SaveChangesAsync();
        return db;
    }
}
