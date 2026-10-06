using System.Text;
using HexaBill.Api.Core.Tenancy;
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
/// Header proofs for frozenhub1 / frozenhub2 / gulfharvest synthetic fixtures (A4, A5, 80mm, 58mm, receipt).
/// Empty TRN → INVOICE; sample TRN → SAMPLE INVOICE. Zayogya covered by ZayogyaRegressionSnapshotTests.
/// </summary>
public class TenantHeaderParityTests
{
    public static TheoryData<string, string?, string> Tenants()
    {
        var data = new TheoryData<string, string?, string>
        {
            { "frozenhub1", null, "INVOICE" },
            { "frozenhub1", SampleVatTrn.FrozenHub1, "SAMPLE INVOICE" },
            { "frozenhub2", SampleVatTrn.FrozenHub2, "SAMPLE INVOICE" },
            { "gulfharvest", null, "INVOICE" },
            { "gulfharvest", SampleVatTrn.GulfHarvest, "SAMPLE INVOICE" }
        };
        return data;
    }

    [Theory]
    [MemberData(nameof(Tenants))]
    public async Task Formats_RenderDocumentTitle_ForSyntheticTenant(string slug, string? trn, string expectedTitle)
    {
        Assert.Equal(expectedTitle, SampleVatTrn.DocumentTitle(trn));

        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.SetRequestTenantScope(null, true);
        var tenantId = slug.GetHashCode(StringComparison.Ordinal) & 0x7fffffff;
        if (tenantId == 0) tenantId = 11;

        using var logo = new Image<Rgba32>(80, 40, new Rgba32(20, 20, 20));
        using var ms = new MemoryStream();
        logo.SaveAsPng(ms);
        var logoUri = "data:image/png;base64," + Convert.ToBase64String(ms.ToArray());

        foreach (var pair in new Dictionary<string, string>
        {
            ["COMPANY_NAME_EN"] = $"Synthetic {slug}",
            ["COMPANY_NAME_AR"] = "شركة تجريبية",
            ["COMPANY_TRN"] = trn ?? "",
            ["COMPANY_PHONE"] = "+971 500000000",
            ["COMPANY_EMAIL"] = $"{slug}@hexabill.company",
            ["COMPANY_ADDRESS"] = "Synthetic address, Abu Dhabi",
            ["INVOICE_HEADER_STYLE"] = "BilingualMonochrome",
            ["LOGO_BASE64_DATA_URI"] = logoUri
        })
        {
            db.Settings.Add(new Setting { TenantId = tenantId, OwnerId = tenantId, Key = pair.Key, Value = pair.Value });
        }
        await db.SaveChangesAsync();

        var settings = new SettingsService(db);
        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        var pdf = new PdfService(db, null!, fonts, settings, null!, NullLogger<PdfService>.Instance, null!);
        var sale = new SaleDto
        {
            Id = 1, OwnerId = tenantId, InvoiceNo = $"{slug.ToUpperInvariant()}-H1",
            InvoiceDate = new DateTime(2026, 10, 4), CustomerName = "Synthetic customer",
            Subtotal = 100, VatTotal = 5, GrandTotal = 105,
            Items = [new SaleItemDto { ProductId = 1, ProductName = "Item", Qty = 1, UnitType = "PCS", UnitPrice = 100, LineTotal = 100, VatAmount = 5 }]
        };

        // Grayscale / logo placement proof (BilingualMonochrome uses MonochromeLogo).
        var monoLogo = PdfService.MonochromeLogo(ms.ToArray());
        Assert.NotNull(monoLogo);
        using (var mono = Image.Load<Rgba32>(monoLogo!))
        {
            var pixel = mono[0, 0];
            Assert.Equal(pixel.R, pixel.G);
            Assert.Equal(pixel.G, pixel.B);
            SaveEvidence($"{slug}-logo-grayscale.png", monoLogo!);
        }

        // Arabic name must be present in settings used by the PDF path.
        var company = await settings.GetCompanySettingsAsync(tenantId);
        Assert.Equal(trn ?? "", company.VatNumber);
        Assert.Equal("شركة تجريبية", company.LegalNameAr);
        Assert.True(company.BilingualMonochromeHeader);

        byte[]? a4Bytes = null;
        foreach (var format in new[] { "A4", "A5", "80mm", "58mm" })
        {
            var bytes = await pdf.GenerateInvoicePdfAsync(sale, format, "full");
            Assert.True(bytes.Length > 800, $"{slug} {format}");
            SaveEvidence($"{slug}-{expectedTitle.Replace(' ', '-')}-{format}.pdf", bytes);
            if (format == "A4")
            {
                a4Bytes = bytes;
                SaveEvidence($"{slug}-{expectedTitle.Replace(' ', '-')}-A4-arabic-bilingual.pdf", bytes);
            }
        }

        // Empty vs sample TRN must change the rendered A4 document (title/TRN line).
        if (trn is null)
        {
            db.Settings.Single(s => s.Key == "COMPANY_TRN").Value = SampleVatTrn.UnitFixture;
            await db.SaveChangesAsync();
            var sampleA4 = await pdf.GenerateInvoicePdfAsync(sale, "A4", "full");
            Assert.False(a4Bytes!.SequenceEqual(sampleA4), $"{slug}: empty-TRN PDF must differ from sample-TRN PDF");
            SaveEvidence($"{slug}-SAMPLE-INVOICE-A4-diffcheck.pdf", sampleA4);
        }

        var receipt = await pdf.GeneratePaymentReceiptPdfAsync(new PaymentReceiptDetailDto
        {
            CompanyName = $"Synthetic {slug}", CompanyNameAr = "شركة تجريبية",
            CompanyTrn = SampleVatTrn.DocumentTrnDisplay(trn) ?? "",
            CompanyPhone = "+971 500000000", CompanyEmail = $"{slug}@hexabill.company",
            CompanyLogoDataUri = logoUri, BilingualMonochromeHeader = true,
            ReceiptNumber = "REC-H1", AmountReceived = 105, AmountPaid = 105,
            PaymentMethod = "CASH", ReceiptDate = new DateTime(2026, 10, 4), ReceivedFrom = "Synthetic customer",
            Invoices = [new PaymentReceiptInvoiceLineDto { InvoiceNo = sale.InvoiceNo, InvoiceDate = sale.InvoiceDate, InvoiceTotal = 105, AmountApplied = 105 }]
        });
        Assert.True(receipt.Length > 800);
        SaveEvidence($"{slug}-receipt.pdf", receipt);
    }

    [Fact]
    public async Task GulfHarvest_Header_PrintsCtSeparateFromVat_AndPendingVatLine()
    {
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.SetRequestTenantScope(null, true);
        const int tenantId = 22;
        const string ctTrn = "200000000000001";
        using var logo = new Image<Rgba32>(80, 40, new Rgba32(20, 20, 20));
        using var ms = new MemoryStream();
        logo.SaveAsPng(ms);
        foreach (var pair in new Dictionary<string, string>
        {
            ["COMPANY_NAME_EN"] = "GULF HARVEST GENERAL TRADING - L.L.C - S.P.C",
            ["COMPANY_NAME_AR"] = "جلف هارفيست للتجارة العامة - ذ.م.م - ش.ش.و",
            ["COMPANY_TRN"] = "",
            ["CORPORATE_TAX_TRN"] = ctTrn,
            ["COMPANY_PHONE"] = "+971563306130",
            ["COMPANY_EMAIL"] = "gulfharvest@hexabill.company",
            ["COMPANY_ADDRESS"] = "Abu Dhabi, UAE",
            ["INVOICE_HEADER_STYLE"] = "BilingualMonochrome",
            ["LOGO_BASE64_DATA_URI"] = "data:image/png;base64," + Convert.ToBase64String(ms.ToArray())
        })
            db.Settings.Add(new Setting { TenantId = tenantId, OwnerId = tenantId, Key = pair.Key, Value = pair.Value });
        await db.SaveChangesAsync();

        var company = await new SettingsService(db).GetCompanySettingsAsync(tenantId);
        Assert.Equal(ctTrn, company.CorporateTaxTrn);
        Assert.True(string.IsNullOrEmpty(company.VatNumber));
        Assert.NotEqual(company.CorporateTaxTrn, company.VatNumber);
        Assert.Equal("INVOICE", SampleVatTrn.DocumentTitle(company.VatNumber));

        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        var pdf = new PdfService(db, null!, fonts, new SettingsService(db), null!, NullLogger<PdfService>.Instance, null!);
        var sale = new SaleDto
        {
            Id = 1, OwnerId = tenantId, InvoiceNo = "GH-CT-1",
            InvoiceDate = new DateTime(2026, 10, 3), CustomerName = "Synthetic customer",
            Subtotal = 458, VatTotal = 22.90m, RoundOff = 0.10m, GrandTotal = 481,
            Items = [new SaleItemDto { ProductId = 1, ProductName = "Item", Qty = 1, UnitType = "KG", UnitPrice = 458, LineTotal = 458, VatAmount = 22.90m }]
        };
        var bytes = await pdf.GenerateInvoicePdfAsync(sale, "A4", "full");
        Assert.True(bytes.Length > 800);
        SaveEvidence("gulfharvest-CT-VAT-pending-A4.pdf", bytes);
        var extracted = ExtractPdfText(bytes);
        SaveEvidence("gulfharvest-CT-VAT-pending-A4.txt", Encoding.UTF8.GetBytes(extracted));
        Assert.Contains("CT Reg. No.:", extracted, StringComparison.Ordinal);
        Assert.Contains(ctTrn, extracted, StringComparison.Ordinal);
        Assert.Contains("VAT TRN:", extracted, StringComparison.Ordinal);
        Assert.Contains("To be provided", extracted, StringComparison.OrdinalIgnoreCase);
        // CT and VAT must not be joined on one header line with " | "
        Assert.DoesNotContain($"CT Reg. No.: {ctTrn} |", extracted, StringComparison.Ordinal);
        Assert.DoesNotContain(" | VAT TRN:", extracted, StringComparison.Ordinal);
        Assert.Contains("INVOICE", extracted, StringComparison.Ordinal);
        Assert.DoesNotContain("TAX INVOICE", extracted, StringComparison.Ordinal);
        Assert.Equal("INVOICE", SampleVatTrn.DocumentTitle(company.VatNumber));
        Assert.DoesNotContain("Starplus", extracted, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("ZAYOGA", extracted, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("FROZENHUB", extracted, StringComparison.OrdinalIgnoreCase);
    }

    private static string ExtractPdfText(byte[] bytes)
    {
        using var doc = PdfDocument.Open(bytes);
        var sb = new StringBuilder();
        foreach (var page in doc.GetPages())
            sb.AppendLine(page.Text);
        return sb.ToString();
    }

    private static void SaveEvidence(string filename, byte[] bytes)
    {
        var output = Environment.GetEnvironmentVariable("HEXABILL_PDF_EVIDENCE_DIR");
        if (string.IsNullOrWhiteSpace(output)) return;
        Directory.CreateDirectory(output);
        File.WriteAllBytes(Path.Combine(output, filename), bytes);
    }
}
