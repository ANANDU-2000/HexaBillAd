using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Models.Legacy;
using HexaBill.Api.Modules.Customers;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;

namespace HexaBill.Tests;

/// <summary>
/// FROZENHUB-PRINT-FINAL (2026-11): header order, no duplicate left title, bank block order + validation,
/// ledger-based customer balance footer (opening receivable vs historical invoices, never both), amount-in-words,
/// and tenant isolation for FrozenHub 1 (tenant 20 shape) and FrozenHub 2 (tenant 23 shape).
/// Synthetic data only. The IBAN is the published ISO 13616 example (not a real account).
/// PDFs are written to print-final/ under the test output directory for visual inspection.
/// </summary>
public class FrozenHubPrintFinalTests
{
    private const int Fh1 = 20;
    private const int Fh2 = 23;
    private const string ExampleIban = "AE070331234567890123456";
    private const string Fh1Phone = "+971 55 529 8878";
    private const string Fh2Phone = "+971 50 286 8906";

    // ---------- Header ----------

    [Theory]
    [InlineData("A4")]
    [InlineData("A5")]
    public async Task Header_LeftBlock_IsMobPoBoxEmailAddressTrn_InOrder_WithoutDuplicateTitle(string format)
    {
        await using var db = await SeedAsync();
        var bytes = await Pdf(db).GenerateInvoicePdfAsync(Sale(Fh1, 3), format, "full");
        await SaveAsync(bytes, $"fh1-header-{format}.pdf");
        using var doc = PdfDocument.Open(bytes);
        var page = doc.GetPage(1);
        var text = Squash(page.Text);

        Assert.Contains(Squash($"Mob: {Fh1Phone}"), text);
        Assert.Contains("P.O.Box:SYN-1234", text);
        Assert.Contains("Email:invoices@example.invalid", text);
        Assert.Contains("AbuDhabi,Musaffah17,UAE", text);
        Assert.Contains("100000000000003", text);

        double Y(string word) => page.GetWords().First(w => w.Text.StartsWith(word, StringComparison.Ordinal)).BoundingBox.Bottom;
        // PDF y grows upwards: earlier lines have larger y.
        Assert.True(Y("Mob:") > Y("P.O.") && Y("P.O.") > Y("Email:") && Y("Email:") > Y("Abu"),
            "left header order must be Mob, P.O. Box, Email, Address");

        // No standalone English FROZENHUB title anywhere in the header band; the logo identifies the company.
        var headerFloor = Y("Abu") - 40;
        Assert.DoesNotContain(page.GetWords(), w => w.BoundingBox.Bottom > headerFloor && w.Text.Contains("FROZENHUB", StringComparison.Ordinal));
        // The legal name still prints on the authorised-signatory line.
        Assert.Contains("ForFROZENHUBFOODSTUFFTRADING", text);
        // Login/company email is not used when an invoice contact email is configured.
        Assert.DoesNotContain("login-owner@example.invalid", text);
    }

    [Fact]
    public async Task Header_NoLogo_KeepsEnglishCompanyName()
    {
        await using var db = await SeedAsync();
        var logo = await db.Settings.SingleAsync(s => s.TenantId == Fh1 && s.Key == "LOGO_BASE64_DATA_URI");
        logo.Value = "";
        await db.SaveChangesAsync();
        var bytes = await Pdf(db).GenerateInvoicePdfAsync(Sale(Fh1, 1), "A4", "full");
        using var doc = PdfDocument.Open(bytes);
        var header = doc.GetPage(1).GetWords().Where(w => w.BoundingBox.Bottom > doc.GetPage(1).Height - 120);
        Assert.Contains(header, w => w.Text == "FROZENHUB");
    }

    [Fact]
    public async Task Header_InvalidLogoFallsBackToEnglishCompanyName()
    {
        await using var db = await SeedAsync();
        var logo = await db.Settings.SingleAsync(s => s.TenantId == Fh1 && s.Key == "LOGO_BASE64_DATA_URI");
        logo.Value = "data:image/png;base64," + Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("invalid image bytes"));
        await db.SaveChangesAsync();

        var bytes = await Pdf(db).GenerateInvoicePdfAsync(Sale(Fh1, 1), "A4", "full");
        using var doc = PdfDocument.Open(bytes);
        var header = doc.GetPage(1).GetWords().Where(w => w.BoundingBox.Bottom > doc.GetPage(1).Height - 120);
        Assert.Contains(header, w => w.Text == "FROZENHUB");
    }

    [Fact]
    public async Task Header_EmptyOptionalFieldsAreOmitted_AndAddressUsesFrozenHubFallback()
    {
        await using var db = await SeedAsync();
        var optionalKeys = new[]
        {
            "COMPANY_PHONE", "COMPANY_EMAIL", "COMPANY_TRN", "CORPORATE_TAX_TRN",
            "INVOICE_PO_BOX", "INVOICE_PRINT_EMAIL"
        };
        foreach (var setting in await db.Settings.Where(s => s.TenantId == Fh1 && optionalKeys.Contains(s.Key)).ToListAsync())
            setting.Value = "";
        db.Settings.Add(new Setting
        {
            TenantId = Fh1, OwnerId = Fh1, Key = "INVOICE_PRINT_ADDRESS", Value = ""
        });
        await db.SaveChangesAsync();

        var bytes = await Pdf(db).GenerateInvoicePdfAsync(Sale(Fh1, 1), "A4", "full");
        await SaveAsync(bytes, "fh1-header-empty-settings-A4.pdf");
        using var doc = PdfDocument.Open(bytes);
        var text = Squash(doc.GetPage(1).Text);
        Assert.DoesNotContain("Mob:", text);
        Assert.DoesNotContain("P.O.Box:", text);
        Assert.DoesNotContain("Email:", text);
        Assert.DoesNotContain("VATTRN:Tobeprovided", text);
        Assert.DoesNotContain("CTReg.No.", text);
        Assert.Contains("INVOICE", text);
        Assert.DoesNotContain("TAXINVOICE", text);
        Assert.Contains("AbuDhabi,Musaffah17,UAE", text);
    }

    [Fact]
    public async Task Header_CompanyEmailIsFallbackWhenInvoiceEmailIsEmpty()
    {
        await using var db = await SeedAsync();
        db.Settings.Single(s => s.TenantId == Fh1 && s.Key == "INVOICE_PRINT_EMAIL").Value = "";
        db.Settings.Single(s => s.TenantId == Fh1 && s.Key == "COMPANY_EMAIL").Value = "company-contact@example.invalid";
        await db.SaveChangesAsync();

        var text = Squash(Text(await Pdf(db).GenerateInvoicePdfAsync(Sale(Fh1, 1), "A4", "full")));
        Assert.Contains("Email:company-contact@example.invalid", text);
        Assert.DoesNotContain("login-owner@example.invalid", text);
    }

    [Fact]
    public async Task Header_LogoIsCentredAndSmallerThanBefore()
    {
        await using var db = await SeedAsync();
        using var doc = PdfDocument.Open(await Pdf(db).GenerateInvoicePdfAsync(Sale(Fh1, 1), "A4", "full"));
        var page = doc.GetPage(1);
        var logo = Assert.Single(page.GetImages());
        Assert.InRange(logo.Bounds.Height, 30, 55.5);
        Assert.InRange(logo.Bounds.Centroid.X, page.Width / 2 - 6, page.Width / 2 + 6);
        using var sourceLogo = Image.Load(Logo());
        var expectedAspect = sourceLogo.Width / (double)sourceLogo.Height;
        Assert.InRange(logo.Bounds.Width / logo.Bounds.Height, expectedAspect - 0.08, expectedAspect + 0.08);
    }

    [Fact]
    public async Task TwoTenants_SameLayout_EachPrintsOnlyItsOwnPhone()
    {
        await using var db = await SeedAsync();
        var a = Squash(Text(await Pdf(db).GenerateInvoicePdfAsync(Sale(Fh1, 2), "A4", "full")));
        var b = Squash(Text(await Pdf(db).GenerateInvoicePdfAsync(Sale(Fh2, 2), "A4", "full")));
        await SaveAsync(await Pdf(db).GenerateInvoicePdfAsync(Sale(Fh2, 2), "A4", "full"), "fh2-A4.pdf");
        Assert.Contains(Squash(Fh1Phone), a);
        Assert.DoesNotContain(Squash(Fh2Phone), a);
        Assert.Contains(Squash(Fh2Phone), b);
        Assert.DoesNotContain(Squash(Fh1Phone), b);
        foreach (var t in new[] { a, b })
        {
            Assert.Contains("BankName:ADCBIslamic", t);
            Assert.Contains("AccountName:FROZENHUBFOODSTUFFTRADINGLLCSPC", t);
            Assert.Contains("IBAN:AE070331234567890123456", t);
        }
    }

    [Fact]
    public async Task Header_FrozenHub2A5_UsesFullContactPolicyAndItsOwnPhone()
    {
        await using var db = await SeedAsync();
        var bytes = await Pdf(db).GenerateInvoicePdfAsync(Sale(Fh2, 2), "A5", "full");
        await SaveAsync(bytes, "fh2-header-A5.pdf");
        using var doc = PdfDocument.Open(bytes);
        var page = doc.GetPage(1);
        var text = Squash(page.Text);

        Assert.Contains(Squash($"Mob: {Fh2Phone}"), text);
        Assert.DoesNotContain(Squash(Fh1Phone), text);
        Assert.Contains("P.O.Box:SYN-1234", text);
        Assert.Contains("Email:invoices@example.invalid", text);
        Assert.Contains("AbuDhabi,Musaffah17,UAE", text);
        Assert.Contains("100000000000003", text);
        double headerFloor = page.GetWords().First(w => w.Text.StartsWith("Abu", StringComparison.Ordinal)).BoundingBox.Bottom - 40;
        Assert.DoesNotContain(page.GetWords(), w => w.BoundingBox.Bottom > headerFloor && w.Text.Contains("FROZENHUB", StringComparison.Ordinal));
    }

    // ---------- Bank ----------

    [Theory]
    [InlineData("A4")]
    [InlineData("A5")]
    public async Task Bank_PrintsBankNameThenAccountNameThenIban_AndNoAccountNumberLine(string format)
    {
        await using var db = await SeedAsync();
        using var doc = PdfDocument.Open(await Pdf(db).GenerateInvoicePdfAsync(Sale(Fh1, 2), format, "full"));
        var text = Squash(string.Concat(doc.GetPages().Select(p => p.Text)));
        var iBank = text.IndexOf("BankName:ADCBIslamic", StringComparison.Ordinal);
        var iAcct = text.IndexOf("AccountName:FROZENHUB", StringComparison.Ordinal);
        var iIban = text.IndexOf("IBAN:AE07", StringComparison.Ordinal);
        Assert.True(iBank >= 0 && iAcct > iBank && iIban > iAcct, $"bank order wrong: {iBank},{iAcct},{iIban}");
        Assert.DoesNotContain("AccountNumber", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("A/CNo", text, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("80mm")]
    [InlineData("58mm")]
    public async Task Bank_NotForcedOntoThermalReceipts(string format)
    {
        await using var db = await SeedAsync();
        var t = Squash(Text(await Pdf(db).GenerateInvoicePdfAsync(Sale(Fh1, 2), format, "full")));
        Assert.DoesNotContain("ADCBIslamic", t);
    }

    [Fact]
    public async Task Settings_PartialBankDetails_AreRejected_AndTenantUntouched()
    {
        await using var db = await SeedAsync(bank: false);
        var service = new SettingsService(db);
        var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.UpdateOwnerSettingsBulkAsync(Fh1,
            new Dictionary<string, string> { ["INVOICE_BANK_NAME"] = "ADCB Islamic" }));
        Assert.Contains("all be filled", ex.Message);
        Assert.False(await db.Settings.AnyAsync(s => s.TenantId == Fh1 && s.Key == "INVOICE_BANK_NAME" && s.Value == "ADCB Islamic"));
    }

    [Fact]
    public async Task Settings_InvalidIban_IsRejected_ValidIbanSaves_PerTenantOnly()
    {
        await using var db = await SeedAsync(bank: false);
        var service = new SettingsService(db);
        var typo = ExampleIban[..^1] + "7";
        await Assert.ThrowsAsync<ArgumentException>(() => service.UpdateOwnerSettingsBulkAsync(Fh1, BankSettings(typo)));
        await service.UpdateOwnerSettingsBulkAsync(Fh1, BankSettings("AE07 0331 2345 6789 0123 456"));

        var fh1 = await service.GetCompanySettingsAsync(Fh1);
        var fh2 = await service.GetCompanySettingsAsync(Fh2);
        Assert.Equal("ADCB Islamic", fh1.InvoiceBankName);
        Assert.Equal("", fh2.InvoiceBankName); // FrozenHub 2 is never written by a FrozenHub 1 save
        Assert.Equal(Fh1Phone, fh1.Mobile);
        Assert.Equal(Fh2Phone, fh2.Mobile);
    }

    [Theory]
    [InlineData(ExampleIban, true)]
    [InlineData("AE07 0331 2345 6789 0123 456", true)]
    [InlineData("GB82WEST12345698765432", true)]
    [InlineData("AE070331234567890123457", false)]
    [InlineData("AE07033123456789012345", false)]
    [InlineData("AE07033123456789012345X", false)]
    [InlineData("", false)]
    public void Iban_Mod97(string iban, bool valid) => Assert.Equal(valid, SettingsService.IsValidIban(iban));

    [Fact]
    public async Task Bank_IncompleteStoredConfig_PrintsNoBlockAndNoPlaceholder()
    {
        await using var db = await SeedAsync(bank: false);
        db.Settings.Add(new Setting { TenantId = Fh1, OwnerId = Fh1, Key = "INVOICE_BANK_NAME", Value = "ADCB Islamic" });
        await db.SaveChangesAsync();
        var t = Squash(Text(await Pdf(db).GenerateInvoicePdfAsync(Sale(Fh1, 1), "A4", "full")));
        Assert.DoesNotContain("BankDetails", t);
        Assert.DoesNotContain("IBAN", t);
    }

    // ---------- Footer balance (Customer Ledger) ----------

    [Fact]
    public async Task Footer_ZeroBalanceCustomer_ShowsZeroNotHidden()
    {
        await using var db = await SeedAsync();
        await SeedCustomerAsync(db, 131, "ISHAKALI RESTAURANT (SYNTHETIC)");
        await AddSaleAsync(db, 131, "7000", 806m, 806m, SalePaymentStatus.Paid);
        var sale = Sale(Fh1, 3, customerId: 131, grandTotal: 806m, paid: 806m);
        var bytes = await Pdf(db).GenerateInvoicePdfAsync(sale, "A4", "full");
        await SaveAsync(bytes, "fh1-zero-balance-131.pdf");
        var t = Squash(Text(bytes));
        Assert.Contains("BillTotal:AED806.00", t);
        Assert.Contains("BillPaid:AED806.00", t);
        Assert.Contains("BillDue:AED0.00", t);
        Assert.Contains("PendingBills:0", t);
        Assert.Contains("CustomerBalance:AED0.00", t);
        Assert.Contains("Asof:", t);
        Assert.Contains("(UAE)", t);
    }

    [Fact]
    public async Task Footer_OpeningReceivableOnly_IsIncluded()
    {
        await using var db = await SeedAsync();
        await SeedCustomerAsync(db, 143, "ABAYAN MANDI (SYNTHETIC)");
        db.LegacyOpeningReceivables.Add(new LegacyOpeningReceivable
        {
            Id = 1, TenantId = Fh1, SourceCustomerId = 900, DestinationCustomerId = 143, OpeningBalance = 1611.99m,
            ReconciledInvoicesCount = 2, CutoffDate = new DateTime(2026, 10, 31, 23, 59, 59, DateTimeKind.Utc), ApprovedAt = DateTime.UtcNow
        });
        await AddSaleAsync(db, 143, "7010", 500m, 0m, SalePaymentStatus.Pending);
        await db.SaveChangesAsync();

        var bytes = await Pdf(db).GenerateInvoicePdfAsync(Sale(Fh1, 2, customerId: 143, grandTotal: 500m, paid: 0m), "A4", "full");
        await SaveAsync(bytes, "fh1-opening-receivable-143.pdf");
        var t = Squash(Text(bytes));
        Assert.Contains("CustomerBalance:AED2,111.99", t);
        Assert.Contains("PendingBills:1", t);
        Assert.Contains("BillDue:AED500.00", t);
        Assert.Equal(2111.99m, await LedgerClosingAsync(db, 143));
    }

    [Fact]
    public async Task Footer_HistoricalInvoicesAndOpeningReceivable_AreNotDoubleCounted()
    {
        await using var db = await SeedAsync();
        await SeedCustomerAsync(db, 136, "CHAWARMA AALMASHI (SYNTHETIC)");
        // Opening receivable 8,954 is the SAME debt as the seven historical invoices below - must not be added twice.
        db.LegacyOpeningReceivables.Add(new LegacyOpeningReceivable
        {
            Id = 2, TenantId = Fh1, SourceCustomerId = 901, DestinationCustomerId = 136, OpeningBalance = 8954m,
            ReconciledInvoicesCount = 7, CutoffDate = new DateTime(2026, 10, 31, 23, 59, 59, DateTimeKind.Utc), ApprovedAt = DateTime.UtcNow
        });
        var amounts = new[] { 1279m, 1279m, 1279m, 1279m, 1279m, 1279m, 1280m }; // = 8,954
        for (var i = 0; i < amounts.Length; i++)
            db.LegacyInvoices.Add(new LegacyInvoice
            {
                Id = 600 + i, TenantId = Fh1, SourceInvoiceId = 4400 + i, SourceSystem = "Starplus", LegacyInvoiceNumber = $"{4400 + i}",
                LegacyIssuer = "Synthetic historical issuer", InvoiceDate = new DateTime(2026, 4, 1 + i, 0, 0, 0, DateTimeKind.Utc),
                DestinationCustomerId = 136, GrandTotal = amounts[i], TotalAmount = amounts[i], PaidAmount = 0m,
                OutstandingCalculated = amounts[i], Status = "Pending"
            });
        await AddSaleAsync(db, 136, "7020", 806m, 0m, SalePaymentStatus.Pending);
        await db.SaveChangesAsync();

        var bytes = await Pdf(db).GenerateInvoicePdfAsync(Sale(Fh1, 3, customerId: 136, grandTotal: 806m, paid: 0m), "A4", "full");
        await SaveAsync(bytes, "fh1-historical-136.pdf");
        var t = Squash(Text(bytes));
        Assert.Contains("CustomerBalance:AED9,760.00", t); // 8,954 + 806, not 17,908 + 806
        Assert.Contains("PendingBills:8", t);
        Assert.Equal(9760m, await LedgerClosingAsync(db, 136));
    }

    [Fact]
    public async Task Footer_PendingChequeDoesNotReduceBalance_ClearedPartialDoes()
    {
        await using var db = await SeedAsync();
        await SeedCustomerAsync(db, 150, "PARTIAL PAYER (SYNTHETIC)");
        var saleId = await AddSaleAsync(db, 150, "7030", 1000m, 300m, SalePaymentStatus.Partial);
        db.Payments.Add(new Payment { TenantId = Fh1, OwnerId = Fh1, CustomerId = 150, SaleId = saleId, Amount = 300m, Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED, PaymentDate = new DateTime(2026, 10, 25, 8, 0, 0, DateTimeKind.Utc), CreatedBy = 1, CreatedAt = DateTime.UtcNow });
        db.Payments.Add(new Payment { TenantId = Fh1, OwnerId = Fh1, CustomerId = 150, SaleId = saleId, Amount = 200m, Mode = PaymentMode.CHEQUE, Status = PaymentStatus.PENDING, PaymentDate = new DateTime(2026, 10, 26, 8, 0, 0, DateTimeKind.Utc), CreatedBy = 1, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var t = Squash(Text(await Pdf(db).GenerateInvoicePdfAsync(Sale(Fh1, 2, customerId: 150, grandTotal: 1000m, paid: 300m), "A5", "full")));
        Assert.Contains("BillPaid:AED300.00", t);
        Assert.Contains("BillDue:AED700.00", t);
        Assert.Contains("CustomerBalance:AED700.00", t); // 1000 - 300 cleared; the 200 pending cheque is not deducted
        Assert.Contains("Unclearedcheques(notyetdeducted):AED200.00", t);
        Assert.Contains("PendingBills:1", t);
        // The Customer Ledger credits the pending cheque (500); the invoice footer deliberately does not.
        Assert.Equal(500m, await LedgerClosingAsync(db, 150));
    }

    [Fact]
    public async Task Footer_CrossTenantCustomerId_PrintsNoBalance()
    {
        await using var db = await SeedAsync();
        await SeedCustomerAsync(db, 136, "FH1 ONLY CUSTOMER");
        await AddSaleAsync(db, 136, "7040", 999m, 0m, SalePaymentStatus.Pending);
        // A FrozenHub 2 invoice that (wrongly) references a FrozenHub 1 customer id must not leak FH1's balance.
        var t = Squash(Text(await Pdf(db).GenerateInvoicePdfAsync(Sale(Fh2, 1, customerId: 136, grandTotal: 50m, paid: 0m), "A4", "full")));
        Assert.DoesNotContain("CustomerBalance", t);
        Assert.DoesNotContain("999.00", t);
    }

    [Fact]
    public async Task AmountInWords_IsNotTruncated()
    {
        await using var db = await SeedAsync();
        var sale = Sale(Fh1, 2, grandTotal: 777777.77m, paid: 0m);
        var t = Squash(Text(await Pdf(db).GenerateInvoicePdfAsync(sale, "A4", "full")));
        Assert.DoesNotContain("...", t.Replace(".............", ""));
        Assert.Contains("SevenHundredSeventySevenThousand", t, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Fils", t, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("A4", 1)]
    [InlineData("A4", 40)]
    [InlineData("A5", 1)]
    [InlineData("A5", 30)]
    public async Task ShortAndLongInvoices_KeepFooterTogetherOnLastPage(string format, int items)
    {
        await using var db = await SeedAsync();
        await SeedCustomerAsync(db, 160, "LONG INVOICE CUSTOMER (SYNTHETIC)");
        await AddSaleAsync(db, 160, "SYN-7000", 1500m, 0m, SalePaymentStatus.Pending);
        var bytes = await Pdf(db).GenerateInvoicePdfAsync(Sale(Fh1, items, customerId: 160, grandTotal: 1500m, paid: 0m), format, "full");
        await SaveAsync(bytes, $"fh1-{format}-{items}-items.pdf");
        using var doc = PdfDocument.Open(bytes);
        var pages = doc.GetPages().Select(p => Squash(p.Text)).ToList();
        var last = pages[^1];
        foreach (var marker in new[] { "Receiver'sName", "Receiver'sSign", "ForFROZENHUB", "CustomerBalance:", "Asof:" })
        {
            Assert.Contains(marker, last);
            for (var i = 0; i < pages.Count - 1; i++) Assert.DoesNotContain(marker, pages[i]);
        }
        for (var i = 1; i <= items; i++) Assert.Contains($"item{i:00}", string.Concat(pages));
        Assert.Contains("CustomerBalance:AED1,500.00", last);
        Assert.Contains("PendingBills:1", last);
        if (items == 1) Assert.Single(pages);
    }

    // ---------- helpers ----------

    private static Dictionary<string, string> BankSettings(string iban) => new()
    {
        ["INVOICE_BANK_NAME"] = "ADCB Islamic",
        ["INVOICE_BANK_ACCOUNT_NAME"] = "FROZENHUB FOODSTUFF TRADING LLC SPC",
        ["INVOICE_BANK_IBAN"] = iban
    };

    private static async Task<decimal> LedgerClosingAsync(AppDbContext db, int customerId)
    {
        var ledger = await new CustomerService(db).GetCustomerLedgerAsync(customerId, Fh1);
        return ledger[^1].Balance;
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
        var dir = Path.Combine(AppContext.BaseDirectory, "print-final");
        Directory.CreateDirectory(dir);
        await File.WriteAllBytesAsync(Path.Combine(dir, name), bytes);
    }

    private static SaleDto Sale(int tenant, int items, int? customerId = null, decimal? grandTotal = null, decimal paid = 0m)
    {
        var lines = Enumerable.Range(1, items).Select(i => new SaleItemDto
        {
            ProductId = i, ProductName = $"SYNTHETIC FROZEN CHICKEN item{i:00} 1300GM", Qty = 1, UnitType = "CRTN",
            UnitPrice = 100m, LineTotal = 105m, VatAmount = 5m
        }).ToList();
        var total = grandTotal ?? 105m * items;
        return new SaleDto
        {
            Id = 9000 + items, OwnerId = tenant, CustomerId = customerId, InvoiceNo = "SYN-7000",
            InvoiceDate = new DateTime(2026, 10, 24), CustomerName = "Synthetic Restaurant",
            Subtotal = Math.Round(total / 1.05m, 2), VatTotal = total - Math.Round(total / 1.05m, 2), GrandTotal = total,
            PaidAmount = paid, Items = lines
        };
    }

    private static async Task SeedCustomerAsync(AppDbContext db, int id, string name)
    {
        db.Customers.Add(new Customer { Id = id, TenantId = Fh1, OwnerId = Fh1, Name = name, CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc) });
        await db.SaveChangesAsync();
    }

    private static async Task<int> AddSaleAsync(AppDbContext db, int customerId, string no, decimal total, decimal paid, SalePaymentStatus status)
    {
        var sale = new Sale
        {
            TenantId = Fh1, OwnerId = Fh1, CustomerId = customerId, InvoiceNo = no, InvoiceDate = new DateTime(2026, 10, 24, 8, 0, 0, DateTimeKind.Utc),
            GrandTotal = total, TotalAmount = total, PaidAmount = paid, PaymentStatus = status, CreatedBy = 1, CreatedAt = DateTime.UtcNow
        };
        db.Sales.Add(sale);
        await db.SaveChangesAsync();
        if (status == SalePaymentStatus.Paid && paid > 0)
            db.Payments.Add(new Payment { TenantId = Fh1, OwnerId = Fh1, CustomerId = customerId, SaleId = sale.Id, Amount = paid, Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED, PaymentDate = new DateTime(2026, 10, 24, 9, 0, 0, DateTimeKind.Utc), CreatedBy = 1, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
        return sale.Id;
    }

    private static byte[] Logo()
    {
        // Prefer the repository's tenant-authorised FrozenHub black-and-white asset so evidence PDFs show the real emblem.
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir != null; dir = dir.Parent)
        {
            var asset = Path.Combine(dir.FullName, "backend", "HexaBill.Api", "SeedLogos", "frozenhub-logo-bw.png");
            if (File.Exists(asset)) return File.ReadAllBytes(asset);
        }
        using var logo = new Image<Rgba32>(720, 279, new Rgba32(0, 0, 0));
        using var ms = new MemoryStream();
        logo.SaveAsPng(ms);
        return ms.ToArray();
    }

    private static async Task<AppDbContext> SeedAsync(bool bank = true)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.SetRequestTenantScope(null, true);
        var logo = "data:image/png;base64," + Convert.ToBase64String(Logo());
        foreach (var (tenant, phone, sub) in new[] { (Fh1, Fh1Phone, "frozenhub"), (Fh2, Fh2Phone, "frozenhub2") })
        {
            db.Tenants.Add(new Tenant { Id = tenant, Name = $"Synthetic {sub}", Subdomain = sub });
            var values = new Dictionary<string, string>
            {
                ["COMPANY_NAME_EN"] = "FROZENHUB FOODSTUFF TRADING - L.L.C - S.P.C",
                ["COMPANY_NAME_AR"] = "فروزن هب لتجارة المواد الغذائية - ذ.م.م - ش.ش.و",
                ["COMPANY_PHONE"] = phone,
                ["COMPANY_EMAIL"] = "login-owner@example.invalid",
                ["COMPANY_ADDRESS"] = "Synthetic long premises address, Plot 1, Synthetic Contractor Yard, Abu Dhabi",
                ["COMPANY_TRN"] = "100000000000003",
                ["INVOICE_HEADER_STYLE"] = "BilingualMonochrome",
                ["INVOICE_HEADER_STYLE_LOCKED"] = "true",
                ["INVOICE_PO_BOX"] = "SYN-1234",
                ["INVOICE_PRINT_EMAIL"] = "invoices@example.invalid",
                ["CURRENCY"] = "AED",
                ["LOGO_BASE64_DATA_URI"] = logo
            };
            if (bank)
                foreach (var pair in BankSettings(ExampleIban)) values[pair.Key] = pair.Value;
            foreach (var pair in values)
                db.Settings.Add(new Setting { TenantId = tenant, OwnerId = tenant, Key = pair.Key, Value = pair.Value });
        }
        await db.SaveChangesAsync();
        return db;
    }
}
