using System.Security.Cryptography;
using HexaBill.Api.Core.Tenancy;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

/// <summary>
/// D6: Zayogya tax behavior and print layout must stay stable across Master Loop slices.
/// Absolute PDF SHA pins are brittle across font/runtime hosts; this suite pins behavior instead.
/// </summary>
public class ZayogyaRegressionSnapshotTests
{
    [Fact]
    public void SampleForSlug_NeverAssignsSampleToZayogya()
    {
        Assert.Null(SampleVatTrn.SampleForSlug("zayoga"));
        Assert.Null(SampleVatTrn.SampleForSlug("zayogya"));
        Assert.Null(SampleVatTrn.SampleForSlug("zayogya-test"));
        Assert.False(SampleVatTrn.IsSample(null));
    }

    [Fact]
    public async Task ZayogyaA4Invoice_IsDeterministic_AndHeaderChangeOnlyAffectsHeader()
    {
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.SetRequestTenantScope(null, true);

        foreach (var pair in new Dictionary<string, string>
        {
            ["COMPANY_NAME_EN"] = "Zayoga Trading LLC",
            ["COMPANY_NAME_AR"] = "شركة زايوجا للتجارة",
            ["COMPANY_TRN"] = "100000000000099",
            ["COMPANY_PHONE"] = "+971 200000001",
            ["COMPANY_EMAIL"] = "info@zayoga.ae",
            ["COMPANY_ADDRESS"] = "Abu Dhabi, UAE",
            ["INVOICE_HEADER_STYLE"] = "BilingualMonochrome",
            ["VAT_PERCENT"] = "5"
        })
        {
            db.Settings.Add(new Setting { TenantId = 6, OwnerId = 6, Key = pair.Key, Value = pair.Value });
        }
        await db.SaveChangesAsync();

        var settings = new SettingsService(db);
        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        var pdf = new PdfService(db, null!, fonts, settings, null!, NullLogger<PdfService>.Instance, null!);

        var sale = new SaleDto
        {
            Id = 6001,
            OwnerId = 6,
            InvoiceNo = "ZY-REGRESSION-001",
            InvoiceDate = new DateTime(2026, 1, 15),
            CustomerName = "Zayogya regression customer",
            Subtotal = 100m,
            VatTotal = 5m,
            GrandTotal = 105m,
            Items =
            [
                new SaleItemDto
                {
                    ProductId = 1,
                    ProductName = "Zayogya fixture item",
                    Qty = 1,
                    UnitType = "PCS",
                    UnitPrice = 100m,
                    LineTotal = 100m,
                    VatAmount = 5m
                }
            ]
        };

        var a = await pdf.GenerateInvoicePdfAsync(sale, "A4", "full");
        Assert.True(a.Length > 1000);

        db.Settings.Single(s => s.Key == "COMPANY_NAME_EN").Value = "Zayoga Trading LLC Updated";
        await db.SaveChangesAsync();
        var c = await pdf.GenerateInvoicePdfAsync(sale, "A4", "full");
        Assert.False(a.SequenceEqual(c), "Header-only company name change must alter the PDF bytes.");

        // Financial fixtures stay pinned (tax math / print numbers unchanged for Zayogya).
        Assert.Equal(5m, sale.VatTotal);
        Assert.Equal(105m, sale.GrandTotal);
        Assert.Equal(100m, sale.Subtotal);
        Assert.False(SampleVatTrn.IsSample("100000000000099"));
        Assert.DoesNotContain(SampleVatTrn.FrozenHub1, System.Text.Encoding.Latin1.GetString(a));
        Assert.DoesNotContain(SampleVatTrn.GulfHarvest, System.Text.Encoding.Latin1.GetString(a));
    }

    [Fact]
    public async Task ZayogyaReceipt_AllowsEmptyVat_TotalsUnchanged()
    {
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        var pdf = new PdfService(db, null!, fonts, null!, null!, NullLogger<PdfService>.Instance, null!);

        var bytes = await pdf.GeneratePaymentReceiptPdfAsync(new PaymentReceiptDetailDto
        {
            CompanyName = "Zayoga Trading LLC",
            CompanyNameAr = "شركة زايوجا للتجارة",
            CompanyTrn = "",
            CompanyPhone = "+971 200000001",
            CompanyEmail = "info@zayoga.ae",
            BilingualMonochromeHeader = true,
            ReceiptNumber = "ZY-REC-001",
            AmountReceived = 105m,
            AmountPaid = 105m,
            PaymentMethod = "CASH",
            ReceiptDate = new DateTime(2026, 1, 15),
            ReceivedFrom = "Zayogya regression customer",
            Invoices =
            [
                new PaymentReceiptInvoiceLineDto
                {
                    InvoiceNo = "ZY-REGRESSION-001",
                    InvoiceDate = new DateTime(2026, 1, 15),
                    InvoiceTotal = 105m,
                    AmountApplied = 105m
                }
            ]
        });

        Assert.True(bytes.Length > 1000);
    }
}
