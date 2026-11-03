using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Models.Legacy;
using HexaBill.Api.Modules.Legacy;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.PixelFormats;
using UglyToad.PdfPig;

namespace HexaBill.Tests;

/// <summary>
/// Historical (Starplus) invoice PDFs must use the same A4 invoice renderer as normal invoices,
/// while keeping the ORIGINAL issuer's legal name and TRN. FrozenHub logo, bank, address and
/// header policy must never print on a historical invoice. Synthetic data only.
/// </summary>
public class LegacyHistoricalInvoicePdfTests
{
    private const int Fh1 = 20;
    private const string IssuerName = "SYNTHETIC STARPLUS TRADING";
    private const string IssuerTrn = "100000000000999";
    private const string FrozenHubIban = "AE070331234567890123456";
    private const string ItemName = "SYNTHETIC FROZEN CHICKEN item01 1300GM";

    [Fact]
    public void Mapper_CarriesOriginalIssuerLinesAndTotals_WithNegativeLegacyId()
    {
        var inv = LegacyInvoice(id: 2559, number: "6971", lines: 2);

        var sale = LegacyInvoicePdfMapper.ToSaleDto(inv, Fh1);

        Assert.True(sale.IsLegacy);
        Assert.Equal(-2559, sale.Id);
        Assert.Equal(2559, sale.LegacyInvoiceId);
        Assert.Equal(Fh1, sale.OwnerId);
        Assert.Equal("6971", sale.InvoiceNo);
        Assert.Equal(IssuerName, sale.LegacyIssuerName);
        Assert.Equal(IssuerTrn, sale.LegacyIssuerTrn);
        Assert.Equal(inv.GrandTotal, sale.GrandTotal);
        Assert.Equal(inv.Subtotal, sale.Subtotal);
        Assert.Equal(inv.VatTotal, sale.VatTotal);
        Assert.Equal(2, sale.Items.Count);
        Assert.Equal(ItemName, sale.Items[0].ProductName);
        Assert.Equal(117.60m, sale.Items[0].LineTotal);
    }

    [Fact]
    public void Mapper_NoSourceLines_IsNotPrintable_AndNeverInventsLines()
    {
        var inv = LegacyInvoice(id: 2600, number: "7001", lines: 0);

        Assert.False(LegacyInvoicePdfMapper.HasPrintableLines(inv));
        var sale = LegacyInvoicePdfMapper.ToSaleDto(inv, Fh1);
        Assert.Empty(sale.Items);
    }

    [Fact]
    public async Task HistoricalPdf_UsesOriginalIssuer_AndNoFrozenHubIdentityOrBank()
    {
        await using var db = await SeedAsync();
        var sale = LegacyInvoicePdfMapper.ToSaleDto(LegacyInvoice(id: 2559, number: "6971", lines: 1), Fh1);

        var bytes = await Pdf(db).GenerateInvoicePdfAsync(sale, "A4", "full");

        using var doc = PdfDocument.Open(bytes);
        Assert.Equal(1, doc.NumberOfPages);
        var page = doc.GetPage(1);
        var text = Squash(page.Text);
        var upper = text.ToUpperInvariant();

        // Original legal identity and the normal A4 line items/totals are printed.
        Assert.Contains(Squash(IssuerName), text);
        Assert.Contains(IssuerTrn, text);
        Assert.Contains(Squash(ItemName), text);
        Assert.Contains("118.00", page.Text);

        // Nothing from the FrozenHub operating identity or its bank appears on a historical bill.
        Assert.DoesNotContain("FROZENHUB", upper);
        Assert.DoesNotContain(FrozenHubIban, text);
        Assert.DoesNotContain("ADCBIslamic", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Mob:", text);
    }

    // ---------- helpers (synthetic data only) ----------

    private static LegacyInvoice LegacyInvoice(int id, string number, int lines)
    {
        var items = Enumerable.Range(1, lines).Select(i => new LegacyInvoiceItem
        {
            Id = id * 10 + i,
            TenantId = Fh1,
            LegacyInvoiceId = id,
            SourceItemId = i,
            ProductName = ItemName.Replace("item01", $"item{i:00}"),
            UnitType = "CRTN",
            Quantity = 1m,
            UnitPrice = 112m,
            VatAmount = 5.60m,
            LineTotal = 117.60m
        }).ToList();

        return new LegacyInvoice
        {
            Id = id,
            TenantId = Fh1,
            SourceInvoiceId = id,
            LegacyInvoiceNumber = number,
            LegacyIssuer = IssuerName,
            SourceLegalTaxId = IssuerTrn,
            InvoiceDate = new DateTime(2026, 10, 30),
            CustomerName = "SYNTHETIC RESTAURANT",
            Status = "Pending",
            Subtotal = 112m,
            VatTotal = 5.60m,
            RoundOff = 0.40m,
            GrandTotal = 118m,
            TotalAmount = 118m,
            PaidAmount = 0m,
            OutstandingCalculated = 118m,
            ItemCount = lines,
            MigrationRunId = "synthetic-test",
            Items = items
        };
    }

    private static async Task<AppDbContext> SeedAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.SetRequestTenantScope(null, true);
        db.Tenants.Add(new Tenant { Id = Fh1, Name = "Synthetic frozenhub", Subdomain = "frozenhub" });

        var values = new Dictionary<string, string>
        {
            ["COMPANY_NAME_EN"] = "FROZENHUB FOODSTUFF TRADING - L.L.C - S.P.C",
            ["COMPANY_NAME_AR"] = "فروزن هب لتجارة المواد الغذائية - ذ.م.م - ش.ش.و",
            ["COMPANY_PHONE"] = "+971 00 000 0000",
            ["COMPANY_EMAIL"] = "login-owner@example.invalid",
            ["COMPANY_ADDRESS"] = "Synthetic premises address, Abu Dhabi",
            ["COMPANY_TRN"] = "100000000000003",
            ["INVOICE_HEADER_STYLE"] = "BilingualMonochrome",
            ["INVOICE_HEADER_STYLE_LOCKED"] = "true",
            ["INVOICE_PO_BOX"] = "SYN-1234",
            ["INVOICE_PRINT_EMAIL"] = "invoices@example.invalid",
            ["CURRENCY"] = "AED",
            ["INVOICE_BANK_NAME"] = "ADCB Islamic",
            ["INVOICE_BANK_ACCOUNT_NAME"] = "FROZENHUB FOODSTUFF TRADING LLC SPC",
            ["INVOICE_BANK_IBAN"] = FrozenHubIban,
            ["LOGO_BASE64_DATA_URI"] = "data:image/png;base64," + Convert.ToBase64String(SmallPng())
        };
        foreach (var pair in values)
            db.Settings.Add(new Setting { TenantId = Fh1, OwnerId = Fh1, Key = pair.Key, Value = pair.Value });

        await db.SaveChangesAsync();
        return db;
    }

    private static byte[] SmallPng()
    {
        using var image = new Image<Rgba32>(40, 20, new Rgba32(200, 30, 30, 255));
        using var ms = new MemoryStream();
        image.Save(ms, new PngEncoder());
        return ms.ToArray();
    }

    private static PdfService Pdf(AppDbContext db)
    {
        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        return new PdfService(db, null!, fonts, new SettingsService(db), null!, NullLogger<PdfService>.Instance, null!);
    }

    private static string Squash(string s) => new(s.Where(c => !char.IsWhiteSpace(c)).ToArray());
}
