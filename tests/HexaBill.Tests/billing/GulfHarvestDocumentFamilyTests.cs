using HexaBill.Api.Core.Tenancy;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Products;
using HexaBill.Api.Modules.Reports;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;

namespace HexaBill.Tests;

/// <summary>
/// Renders every PdfService-backed Gulf Harvest document family for visual/isolation proof.
/// </summary>
public class GulfHarvestDocumentFamilyTests
{
    private const int TenantId = 2206;
    private const string CtTrn = "200000000000099";

    [Fact]
    public async Task AllPdfFamilies_UseGulfHarvestIdentity_NoForeignClientNames()
    {
        await using var db = await SeedAsync();
        var fonts = new FontService(NullLogger<FontService>.Instance);
        fonts.RegisterFonts();
        var settings = new SettingsService(db);
        var pdf = new PdfService(db, null!, fonts, settings, null!, NullLogger<PdfService>.Instance, null!);

        var sale = MakeSale(1, "GH-F1");
        var sale2 = MakeSale(2, "GH-F2");
        var from = new DateTime(2026, 10, 1);
        var to = new DateTime(2026, 10, 6);

        var outputs = new Dictionary<string, byte[]>
        {
            ["01-sales-invoice-A4"] = await pdf.GenerateInvoicePdfAsync(sale, "A4", "full"),
            ["01b-sales-invoice-A5"] = await pdf.GenerateInvoicePdfAsync(sale, "A5", "full"),
            ["01c-sales-invoice-80mm"] = await pdf.GenerateInvoicePdfAsync(sale, "80mm", "full"),
            ["01d-sales-invoice-58mm"] = await pdf.GenerateInvoicePdfAsync(sale, "58mm", "full"),
            ["02-combined-invoices"] = await pdf.GenerateCombinedInvoicePdfAsync([sale, sale2]),
            ["03-delivery-note"] = await pdf.GenerateDeliveryNotePdfAsync(sale, "A4", "full"),
            ["04-payment-receipt"] = await pdf.GeneratePaymentReceiptPdfAsync(new PaymentReceiptDetailDto
            {
                CompanyName = "GULF HARVEST GENERAL TRADING - L.L.C - S.P.C",
                CompanyNameAr = "جلف هارفيست للتجارة العامة - ذ.م.م - ش.ش.و",
                CompanyTrn = "",
                CorporateTaxTrn = CtTrn,
                CompanyPhone = "+971563306130",
                CompanyEmail = "gulfharvest@hexabill.company",
                CompanyAddress = "Abu Dhabi, UAE",
                BilingualMonochromeHeader = true,
                ReceiptNumber = "REC-GH-1",
                AmountReceived = 105,
                AmountPaid = 105,
                PaymentMethod = "CASH",
                ReceiptDate = new DateTime(2026, 10, 4),
                ReceivedFrom = "Synthetic customer",
                Invoices = [new PaymentReceiptInvoiceLineDto { InvoiceNo = "GH-F1", InvoiceDate = sale.InvoiceDate, InvoiceTotal = 105, AmountApplied = 105 }]
            }),
            ["07-customer-pending-bills"] = await pdf.GenerateCustomerPendingBillsPdfAsync(
                [new OutstandingInvoiceDto { InvoiceNo = "GH-F1", InvoiceDate = sale.InvoiceDate, GrandTotal = 105, PaidAmount = 0, BalanceAmount = 105, PaymentStatus = "Unpaid" }],
                new CustomerDto { Id = 1, Name = "Synthetic customer", Balance = 105 },
                to, from, to, TenantId),
            ["09-sales-ledger"] = await pdf.GenerateSalesLedgerPdfAsync(new SalesLedgerReportDto
            {
                Entries =
                [
                    new SalesLedgerEntryDto
                    {
                        Date = sale.InvoiceDate, Type = "Sale", InvoiceNo = "GH-F1", CustomerName = "Synthetic",
                        GrandTotal = 105, PaidAmount = 0, RealPending = 105, Status = "Unpaid"
                    }
                ],
                Summary = new SalesLedgerSummary { TotalSales = 105, TotalPayments = 0 }
            }, from, to, TenantId),
            ["10-pending-bills-report"] = await pdf.GeneratePendingBillsPdfAsync(
                [new PendingBillDto { InvoiceNo = "GH-F1", CustomerName = "Synthetic", InvoiceDate = sale.InvoiceDate, GrandTotal = 105, PaidAmount = 0, BalanceAmount = 105, PaymentStatus = "Unpaid" }],
                from, to, TenantId),
            ["11-profit-loss"] = await pdf.GenerateProfitLossPdfAsync(new ProfitReportDto
            {
                TotalSales = 105, CostOfGoodsSold = 40, GrossProfit = 65, GrossProfitMargin = 61.9m,
                TotalExpenses = 10, NetProfit = 55, NetProfitMargin = 52.4m, EstimatedCostLineCount = 1
            }, from, to, TenantId),
            ["12-worksheet"] = await pdf.GenerateWorksheetPdfAsync(new WorksheetReportDto
            {
                TotalSales = 105, TotalPurchases = 20, TotalExpenses = 10, TotalReceived = 50, PendingAmount = 55
            }, from, to, TenantId),
            ["13-expenses-register"] = await pdf.GenerateExpensesRegisterPdfAsync(
                [new ExpenseDto { Id = 1, Date = from, CategoryName = "Fuel", Amount = 10, Note = "Test" }],
                from, to, TenantId),
            ["14-quotation"] = await pdf.GenerateQuotationPdfAsync(new QuotationDto
            {
                Id = 1, QuoteNo = "Q-GH-1", QuoteDate = from, CustomerName = "Synthetic",
                Subtotal = 100, VatTotal = 5, GrandTotal = 105,
                Items = [new QuotationItemDto { Description = "Item", Qty = 1, UnitPrice = 100, LineTotal = 100, VatAmount = 5 }]
            }, TenantId),
            ["15-agreement"] = await pdf.GenerateAgreementPdfAsync(new AgreementDto
            {
                Id = 1, AgreementNo = "A-GH-1", AgreementDate = from, SecondPartyName = "Synthetic",
                FirstPartyName = "GULF HARVEST GENERAL TRADING - L.L.C - S.P.C",
                FirstPartyLicense = "",
                WhereasText = "The parties agree to trade under Gulf Harvest terms.",
                Clauses = ["Clause 1: Synthetic."]
            }, TenantId),
            ["16-salary-certificate"] = await pdf.GenerateSalaryCertificatePdfAsync(new SalaryCertificateDto
            {
                Id = 1, CertificateNo = "SC-GH-1", CertificateDate = from, EmployeeName = "Employee",
                Designation = "Staff", EmployeeNationality = "India", MonthlySalary = 3000,
                CompanyName = "GULF HARVEST GENERAL TRADING - L.L.C - S.P.C",
                SignatoryName = "Authorized Signatory", SignatoryTitle = "Manager",
                BodyText = "This is to certify employment for salary purposes."
            }, TenantId),
            ["17-vat-management"] = await pdf.GenerateVatManagementReportPdfAsync(new VatReturn201Dto
            {
                PeriodLabel = "Q3-2026", PeriodStart = from, PeriodEnd = to, Status = "Draft",
                StandardOutputVat = 5m, RecoverableInputVat = 2m, NetVatPayable = 3m,
                Warnings = ["Synthetic review warning"],
                OutputLines = [new VatReturnOutputLineDto { Reference = "GH-VAT-1", Date = from, NetAmount = 100m, VatAmount = 5m }],
                InputLines = [new VatReturnInputLineDto { Reference = "GH-PUR-1", Date = from, NetAmount = 40m, VatAmount = 2m, ClaimableVat = 2m }]
            }, TenantId),
            ["17-barcode-labels"] = new ProductBarcodeLabelService().GenerateLabelsPdf(
            [
                new ProductDto { Id = 1, NameEn = "Synthetic GH item", Sku = "GH-SKU-1", Barcode = "6281000000001" }
            ]),
        };

        foreach (var (name, bytes) in outputs)
        {
            Assert.True(bytes.Length > 500, name);
            SaveEvidence($"gh-family-{name}.pdf", bytes);
            var latin = System.Text.Encoding.Latin1.GetString(bytes);
            Assert.DoesNotContain("Starplus", latin, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("ZAYOGA", latin, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("FROZENHUB", latin, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("Crystal Freeze", latin, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("Sudheesh", latin, StringComparison.OrdinalIgnoreCase);
        }

        var company = await settings.GetCompanySettingsAsync(TenantId);
        Assert.Equal(CtTrn, company.CorporateTaxTrn);
        Assert.True(string.IsNullOrEmpty(company.VatNumber) || SampleVatTrn.IsSample(company.VatNumber));
        Assert.NotEqual(company.CorporateTaxTrn, company.VatNumber);
    }

    private static SaleDto MakeSale(int id, string invoiceNo) => new()
    {
        Id = id,
        OwnerId = TenantId,
        InvoiceNo = invoiceNo,
        InvoiceDate = new DateTime(2026, 10, 3),
        CustomerName = "Synthetic customer",
        Subtotal = 100,
        VatTotal = 5,
        GrandTotal = 105,
        Items =
        [
            new SaleItemDto
            {
                ProductId = 1, ProductName = "Synthetic item", Qty = 1, UnitType = "PCS",
                UnitPrice = 100, LineTotal = 100, VatAmount = 5
            }
        ]
    };

    private static async Task<AppDbContext> SeedAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.SetRequestTenantScope(null, true);
        using var logo = new Image<Rgba32>(80, 40, new Rgba32(10, 10, 10));
        using var ms = new MemoryStream();
        logo.SaveAsPng(ms);
        foreach (var pair in new Dictionary<string, string>
        {
            ["COMPANY_NAME_EN"] = "GULF HARVEST GENERAL TRADING - L.L.C - S.P.C",
            ["COMPANY_NAME_AR"] = "جلف هارفيست للتجارة العامة - ذ.م.م - ش.ش.و",
            ["COMPANY_TRN"] = "",
            ["CORPORATE_TAX_TRN"] = CtTrn,
            ["COMPANY_PHONE"] = "+971563306130",
            ["COMPANY_EMAIL"] = "gulfharvest@hexabill.company",
            ["COMPANY_ADDRESS"] = "Abu Dhabi, UAE",
            ["INVOICE_HEADER_STYLE"] = "BilingualMonochrome",
            ["CURRENCY"] = "AED",
            ["LOGO_BASE64_DATA_URI"] = "data:image/png;base64," + Convert.ToBase64String(ms.ToArray())
        })
            db.Settings.Add(new Setting { TenantId = TenantId, OwnerId = TenantId, Key = pair.Key, Value = pair.Value });
        await db.SaveChangesAsync();
        return db;
    }

    private static void SaveEvidence(string filename, byte[] bytes)
    {
        var output = Environment.GetEnvironmentVariable("HEXABILL_PDF_EVIDENCE_DIR");
        if (string.IsNullOrWhiteSpace(output)) return;
        Directory.CreateDirectory(output);
        File.WriteAllBytes(Path.Combine(output, filename), bytes);
    }
}
