using HexaBill.Api.Core.Tenancy;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using UglyToad.PdfPig;

namespace HexaBill.Tests;

/// <summary>
/// P0-VAT-002 (option B): sales imported from earlier records (ExternalReference with the exact, case-sensitive internal
/// prefix) always print "TAX INVOICE" with a real TRN, regardless of VAT_EFFECTIVE_DATE. Non-imported sales unchanged.
/// Synthetic data only. The internal marker must never appear in printed output.
/// </summary>
public class ImportedSaleTaxInvoiceTitleTests
{
    private const int TenantId = 89311;
    private const string Trn = "100000000000003";
    private const string VatEffective = "2026-11-01";
    private const string ImportedRef = "starplus:sale:SYN-000123";
    private static readonly DateTime PreVat = new(2025, 9, 1);
    private static readonly DateTime PostVat = new(2026, 11, 2);

    [Fact]
    public void Title_ImportedIgnoresEffectiveDate_NormalUnchanged()
    {
        Assert.Equal("TAX INVOICE", SampleVatTrn.DocumentTitle(Trn, PreVat, VatEffective, ImportedRef));
        Assert.Equal("INVOICE", SampleVatTrn.DocumentTitle(Trn, PreVat, VatEffective, null));
        Assert.Equal("INVOICE", SampleVatTrn.DocumentTitle(Trn, PreVat, VatEffective, "pos:123"));
        Assert.Equal("TAX INVOICE", SampleVatTrn.DocumentTitle(Trn, PostVat, VatEffective, null));
        // exact, case-sensitive prefix only
        Assert.Equal("INVOICE", SampleVatTrn.DocumentTitle(Trn, PreVat, VatEffective, "Starplus:x"));
        Assert.Equal("INVOICE", SampleVatTrn.DocumentTitle(Trn, PreVat, VatEffective, " starplus:x"));
        Assert.Equal("INVOICE", SampleVatTrn.DocumentTitle(Trn, PreVat, VatEffective, "x-starplus:x"));
        // empty VAT date: TRN rule unchanged for both
        foreach (var r in new[] { null, ImportedRef })
        {
            Assert.Equal("TAX INVOICE", SampleVatTrn.DocumentTitle(Trn, PreVat, "", r));
            Assert.Equal("INVOICE", SampleVatTrn.DocumentTitle("", PreVat, "", r));
            Assert.Equal("INVOICE", SampleVatTrn.DocumentTitle("", PostVat, VatEffective, r));
            Assert.NotEqual("TAX INVOICE", SampleVatTrn.DocumentTitle("105543085200001X", PostVat, VatEffective, r));
        }
    }

    public static TheoryData<string, string, bool, bool, string, bool> Cases()
    {
        var d = new TheoryData<string, string, bool, bool, string, bool>();
        foreach (var fmt in new[] { "A4", "A5", "80mm", "58mm" })
            foreach (var layout in new[] { "full", "body" })
            {
                d.Add(fmt, layout, true, false, VatEffective, true);   // imported, pre-VAT date -> TAX INVOICE
                d.Add(fmt, layout, false, false, VatEffective, false); // normal, same date -> INVOICE
                d.Add(fmt, layout, false, true, VatEffective, true);   // normal, 2026-11-02 -> TAX INVOICE
                d.Add(fmt, layout, true, false, "", true);             // empty VAT date: TRN rule
                d.Add(fmt, layout, false, false, "", true);
            }
        return d;
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public async Task PdfService_EveryFormat_TitleFollowsRule(string format, string layout, bool imported, bool postVat, string vatDate, bool expectTax)
    {
        await using var db = await SeedAsync(vatDate);
        var sale = CreateSale(imported, postVat ? PostVat : PreVat);
        var bytes = await CreatePdfService(db).GenerateInvoicePdfAsync(sale, format, layout);
        AssertTitle(bytes, expectTax);
    }

    [Theory]
    [InlineData(true, false, VatEffective, true)]
    [InlineData(false, false, VatEffective, false)]
    [InlineData(false, true, VatEffective, true)]
    [InlineData(true, false, "", true)]
    [InlineData(false, false, "", true)]
    public void SimplePdfService_TitleFollowsRule(bool imported, bool postVat, string vatDate, bool expectTax)
    {
        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        var settings = new InvoiceTemplateService.CompanySettings
        {
            CompanyNameEn = "SYNTHETIC TRADING L.L.C", CompanyTrn = Trn, VatEffectiveDate = vatDate, Currency = "AED"
        };
        var bytes = new SimplePdfService(fonts).GenerateSimpleInvoicePdf(CreateSale(imported, postVat ? PostVat : PreVat), settings);
        AssertTitle(bytes, expectTax);
    }

    private static void AssertTitle(byte[] bytes, bool expectTax)
    {
        using var document = PdfDocument.Open(bytes);
        var text = string.Concat(document.GetPages().SelectMany(p => p.Text.Where(c => !char.IsWhiteSpace(c))));
        if (expectTax) Assert.Contains("TAXINVOICE", text);
        else { Assert.DoesNotContain("TAXINVOICE", text); Assert.Contains("INVOICE", text); }
        Assert.DoesNotContain("starplus", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("SYN-000123", text);
    }

    private static PdfService CreatePdfService(AppDbContext db)
    {
        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        return new PdfService(db, null!, fonts, new SettingsService(db), null!, NullLogger<PdfService>.Instance, null!);
    }

    private static SaleDto CreateSale(bool imported, DateTime date) => new()
    {
        Id = 9311, OwnerId = TenantId, InvoiceNo = "SYN-VB-0001", InvoiceDate = date,
        ExternalReference = imported ? ImportedRef : null,
        CustomerName = "Synthetic Customer L.L.C", Subtotal = 100m, VatTotal = 5m, GrandTotal = 105m,
        Items = [new SaleItemDto { ProductId = 1, ProductName = "SYNTHETIC ITEM", Qty = 1, UnitType = "CTN", UnitPrice = 100m, LineTotal = 100m, VatAmount = 5m }]
    };

    private static async Task<AppDbContext> SeedAsync(string vatDate)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.SetRequestTenantScope(null, true);
        db.Tenants.Add(new Tenant { Id = TenantId, Name = "SYNTHETIC TRADING L.L.C", Subdomain = "synvatb" });
        var settings = new Dictionary<string, string>
        {
            ["COMPANY_NAME_EN"] = "SYNTHETIC TRADING L.L.C",
            ["COMPANY_TRN"] = Trn,
            ["VAT_EFFECTIVE_DATE"] = vatDate,
            ["CURRENCY"] = "AED",
        };
        foreach (var p in settings) db.Settings.Add(new Setting { TenantId = TenantId, OwnerId = TenantId, Key = p.Key, Value = p.Value });
        await db.SaveChangesAsync();
        return db;
    }
}
