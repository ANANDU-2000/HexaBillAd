using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Products;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using UglyToad.PdfPig;

namespace HexaBill.Tests;

/// <summary>
/// Reproduces the FrozenHub 1 production print configuration (read-only evidence, 2026-10-24): header style "Legacy",
/// no header lock, letterhead-only off with 52/35 mm stored margins, customer with TRN and a running balance, and the
/// two lines of sale 1632 that failed with QuestPDF "conflicting size constraints" at 06:48 UTC.
/// </summary>
public class ProductionShapedInvoicePdfTests
{
    private const int TenantId = 2320;
    private const int CustomerId = 128;

    public static TheoryData<bool, string, string, int> Matrix()
    {
        var data = new TheoryData<bool, string, string, int>();
        foreach (var approvedHeader in new[] { false, true })
            foreach (var format in new[] { "A4", "A5" })
                foreach (var layout in new[] { "full", "body" })
                    foreach (var items in new[] { 1, 2, 5, 20, 50 })
                        data.Add(approvedHeader, format, layout, items);
        return data;
    }

    [Theory]
    [MemberData(nameof(Matrix))]
    public async Task ProductionSettings_RenderEveryFormatLayoutAndItemCount(bool approvedHeader, string format, string layout, int itemCount)
    {
        // approvedHeader=false is today's production value ("Legacy"); true is the client-approved locked bilingual header.
        await using var db = await SeedProductionShapeAsync(approvedHeader);
        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        var pdf = new PdfService(db, null!, fonts, new SettingsService(db), null!, NullLogger<PdfService>.Instance, null!);
        var invoice = Sale1632Shape(itemCount);

        var bytes = await pdf.GenerateInvoicePdfAsync(invoice, format, layout);

        await File.WriteAllBytesAsync(Path.Combine(AppContext.BaseDirectory, $"Prod-{(approvedHeader ? "approved" : "legacy")}-{format}-{layout}-{itemCount}.pdf"), bytes);
        using var document = PdfDocument.Open(bytes);
        var text = string.Concat(document.GetPages().Select(p => p.Text));
        Assert.Contains(invoice.InvoiceNo, text);
        Assert.Contains(invoice.GrandTotal.ToString("0.00"), text);
        Assert.Contains("BEEF SLICE KAMIL 18KG", text);
        if (approvedHeader && layout == "full")
        {
            var first = document.GetPage(1).Text;
            Assert.Contains("Abu Dhabi, Musaffah 17", first);
            Assert.DoesNotContain("971555298878", first);
            Assert.DoesNotContain("frozenhubfoods@gmail.com", first, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("International Transport", first, StringComparison.OrdinalIgnoreCase);
        }
    }

    private static SaleDto Sale1632Shape(int itemCount)
    {
        // Sale 1632 lines: GIZZARD TURKEY 9KG 1 x 80 (VAT 4, line 84) and BEEF SLICE KAMIL 18KG 0.5 x 375 (VAT 9.38, line 196.88).
        var lines = new List<SaleItemDto>
        {
            new() { ProductId = 1, ProductName = "GIZZARD TURKEY 9KG", Qty = 1, UnitType = "CRTN", UnitPrice = 80m, LineTotal = 84m, VatAmount = 4m },
            new() { ProductId = 2, ProductName = "BEEF SLICE KAMIL 18KG", Qty = 0.5m, UnitType = "CRTN", UnitPrice = 375m, LineTotal = 196.88m, VatAmount = 9.38m }
        };
        for (var i = lines.Count; i < itemCount; i++)
            lines.Add(new SaleItemDto { ProductId = i + 1, ProductName = $"FROZEN PRODUCT {i + 1:00} LONG DESCRIPTION 18KG - منتج مجمد طويل", Qty = 2, UnitType = "CRTN", UnitPrice = 50m, LineTotal = 105m, VatAmount = 5m });
        lines = itemCount == 1 ? [lines[1]] : lines.Take(itemCount).ToList();
        var subtotal = lines.Sum(l => l.LineTotal - l.VatAmount);
        var vat = lines.Sum(l => l.VatAmount);
        return new SaleDto
        {
            Id = 1632, OwnerId = TenantId, CustomerId = CustomerId, InvoiceNo = "1791254853", InvoiceDate = new DateTime(2026, 10, 21, 12, 0, 0, DateTimeKind.Utc),
            CustomerName = "Synthetic customer with TRN 29", Subtotal = subtotal, VatTotal = vat, RoundOff = 0.12m,
            GrandTotal = subtotal + vat + 0.12m, Items = lines
        };
    }

    private static async Task<AppDbContext> SeedProductionShapeAsync(bool approvedHeader)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("ProdShapePdf_" + Guid.NewGuid()).Options);
        db.SetRequestTenantScope(null, true);
        var now = DateTime.UtcNow;
        db.Tenants.Add(new Tenant { Id = TenantId, Name = "FrozenHub Foodstuff Trading L.L.C - S.P.C", Subdomain = "frozenhub-prodshape" });
        db.Customers.Add(new Customer { Id = CustomerId, TenantId = TenantId, OwnerId = TenantId, Name = "Synthetic customer with TRN 29", Trn = "100000000000003", Balance = 720m, PendingBalance = 720m, CreatedAt = now, UpdatedAt = now });
        db.Sales.Add(new Sale { Id = 1631, TenantId = TenantId, OwnerId = TenantId, CustomerId = CustomerId, CreatedBy = 1, InvoiceNo = "1791254852", InvoiceDate = now, CreatedAt = now, GrandTotal = 720m, TotalAmount = 720m, PaymentStatus = SalePaymentStatus.Pending });
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root != null && !File.Exists(Path.Combine(root.FullName, "backend", "HexaBill.Api", "SeedLogos", "frozenhub-logo-client.png")))
            root = root.Parent;
        var logoBytes = await File.ReadAllBytesAsync(Path.Combine(root!.FullName, "backend", "HexaBill.Api", "SeedLogos", "frozenhub-logo-client.png"));
        foreach (var pair in new Dictionary<string, string>
        {
            ["COMPANY_NAME_EN"] = "FROZENHUB FOODSTUFF TRADING - L.L.C - S.P.C",
            ["COMPANY_NAME_AR"] = "فروزن هب لتجارة المواد الغذائية - ذ.م.م - ش.ش.و",
            ["COMPANY_PHONE"] = "971555298878",
            ["COMPANY_EMAIL"] = "frozenhubfoods@gmail.com",
            ["COMPANY_ADDRESS"] = "Musaffah, Bldg 17, Al Nubalaa International Transport & General Contracting - Sole Proprietorship LLC, Abu Dhabi",
            ["COMPANY_TRN"] = "105607243000003",
            ["COMPANY_LICENSE"] = "",
            ["INVOICE_HEADER_STYLE"] = approvedHeader ? "BilingualMonochrome" : "Legacy",
            ["INVOICE_HEADER_STYLE_LOCKED"] = approvedHeader ? "true" : "",
            ["INVOICE_TEMPLATE"] = "",
            ["Feature_LetterheadOnlyPrint"] = "false",
            ["PRINT_MARGIN_TOP_MM"] = "52",
            ["PRINT_MARGIN_BOTTOM_MM"] = "35",
            ["RETURN_POLICY_FOOTER"] = "",
            ["VAT_PERCENT"] = "5",
            ["INVOICE_PREFIX"] = "INV",
            ["LOGO_BASE64_DATA_URI"] = "data:image/png;base64," + Convert.ToBase64String(logoBytes)
        })
            db.Settings.Add(new Setting { TenantId = TenantId, OwnerId = TenantId, Key = pair.Key, Value = pair.Value });
        await db.SaveChangesAsync();
        return db;
    }
}
