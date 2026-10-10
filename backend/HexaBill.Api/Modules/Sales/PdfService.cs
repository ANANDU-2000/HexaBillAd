/*Purpose: PDF service for generating invoices using QuestPDF
Author: AI Assistant
Date: 2024
*/
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using System.IO;
using SixLabors.ImageSharp.Processing;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Hosting;

namespace HexaBill.Api.Modules.Sales
{
    public class PdfService : IPdfService
    {
        private readonly AppDbContext _context;
        private readonly IInvoiceTemplateService _templateService;
        private readonly IFontService _fontService;
        private readonly ISettingsService _settingsService;
        private readonly IStorageService _storageService;
        private readonly ILogger<PdfService> _logger;
        private readonly IWebHostEnvironment _env;
        private readonly string _arabicFont;
        private readonly string _englishFont;

        public PdfService(AppDbContext context, IInvoiceTemplateService templateService, IFontService fontService, ISettingsService settingsService, IStorageService storageService, ILogger<PdfService> logger, IWebHostEnvironment env)
        {
            _context = context;
            _templateService = templateService;
            _fontService = fontService;
            _settingsService = settingsService;
            _storageService = storageService;
            _logger = logger;
            _env = env;
            
            QuestPDF.Settings.License = LicenseType.Community;
            
            // CRITICAL FIX FOR ARABIC PRINTING:
            // 1. Disable glyph checking - allows Arabic with fallback fonts
            // 2. Force font embedding in PDF output
            // 3. Register custom Arabic fonts from Fonts folder
            QuestPDF.Settings.CheckIfAllTextGlyphsAreAvailable = false;
            
            // Enable font embedding for print compatibility
            QuestPDF.Settings.EnableCaching = true;
            
            // Register custom fonts for Arabic support
            _fontService.RegisterFonts();
            _arabicFont = _fontService.GetArabicFontFamily();
            _englishFont = _fontService.GetEnglishFontFamily();
            
            _logger.LogInformation("PDF Service initialized with Arabic font: {Font}", _arabicFont);
            
            // Disable debugging in production for better performance
            #if DEBUG
            QuestPDF.Settings.EnableDebugging = true;
            #else
            QuestPDF.Settings.EnableDebugging = false;
            #endif
        }

        public Task<byte[]> GeneratePaymentReceiptPdfAsync(PaymentReceiptDetailDto receipt)
        {
            if (receipt == null || receipt.Invoices.Count == 0 || receipt.AmountReceived <= 0)
                throw new ArgumentException("A valid receipt is required.");
            var document = Document.Create(container => container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(18, Unit.Millimetre);
                page.DefaultTextStyle(style => style.FontFamily(_englishFont).FontSize(10));
                page.Header().Column(column =>
                {
                    if (receipt.BilingualMonochromeHeader)
                    {
                        byte[]? logo = null;
                        if (!string.IsNullOrEmpty(receipt.CompanyLogoDataUri))
                        {
                            var parts = receipt.CompanyLogoDataUri.Split(',', 2);
                            if (parts.Length == 2) logo = Convert.FromBase64String(parts[1]);
                        }
                        RenderCompanyHeader(column.Item(), new InvoiceTemplateService.CompanySettings {
                            CompanyNameEn = receipt.CompanyName, CompanyNameAr = receipt.CompanyNameAr ?? "",
                            CompanyTrn = receipt.CompanyTrn ?? "", CorporateTaxTrn = receipt.CorporateTaxTrn ?? "",
                            CompanyAddress = receipt.CompanyAddress ?? "",
                            CompanyPhone = receipt.CompanyPhone ?? "", CompanyEmail = receipt.CompanyEmail ?? "",
                            LogoImageBytes = logo
                        }, 14);
                    }
                    else
                    {
                    column.Item().Text(receipt.CompanyName).Bold().FontSize(16);
                    if (!string.IsNullOrWhiteSpace(receipt.CompanyNameAr))
                        column.Item().AlignRight().Text(receipt.CompanyNameAr).FontFamily(_arabicFont);
                    if (!string.IsNullOrWhiteSpace(receipt.CompanyAddress)) column.Item().Text(receipt.CompanyAddress);
                    if (!string.IsNullOrWhiteSpace(receipt.CompanyPhone)) column.Item().Text(receipt.CompanyPhone);
                    var receiptTrn = HexaBill.Api.Core.Tenancy.SampleVatTrn.DocumentTrnDisplay(receipt.CompanyTrn);
                    if (!string.IsNullOrWhiteSpace(receiptTrn)) column.Item().Text($"TRN: {receiptTrn}");
                    }
                    column.Item().PaddingTop(12).Text("PAYMENT RECEIPT").Bold().FontSize(14);
                    column.Item().Text("Proof of payment — not a tax invoice").FontSize(9);
                    column.Item().Text($"Receipt: {receipt.ReceiptNumber}");
                });
                page.Content().PaddingTop(12).Column(column =>
                {
                    column.Item().Text($"Payment date: {receipt.ReceiptDate.ToString("dd-MM-yyyy", System.Globalization.CultureInfo.InvariantCulture)}");
                    if (receipt.ReceiptEndDate.HasValue && receipt.ReceiptEndDate.Value != receipt.ReceiptDate)
                        column.Item().Text($"Payments through: {receipt.ReceiptEndDate.Value.ToString("dd-MM-yyyy", System.Globalization.CultureInfo.InvariantCulture)}");
                    column.Item().Text($"Received from: {receipt.ReceivedFrom}");
                    if (!string.IsNullOrWhiteSpace(receipt.CustomerTrn)) column.Item().Text($"Customer TRN: {receipt.CustomerTrn}");
                    column.Item().Text($"Method: {receipt.PaymentMethod}");
                    if (!string.IsNullOrWhiteSpace(receipt.Reference)) column.Item().Text($"Reference: {receipt.Reference}");
                    if (receipt.LegacyReconstruction)
                        column.Item().PaddingTop(6).Text("Legacy receipt reconstructed from available records. Original company and invoice details were not saved.").FontSize(9);
                    if (receipt.PaymentChangedSinceSnapshot)
                        column.Item().PaddingTop(6).Text("Saved receipt copy. The payment was changed afterward; review the ledger for its current details.").FontSize(9);
                    column.Item().PaddingTop(12).Table(table =>
                    {
                        table.ColumnsDefinition(cols => { cols.RelativeColumn(2); cols.RelativeColumn(); cols.RelativeColumn(); cols.RelativeColumn(); });
                        table.Header(header =>
                        {
                            foreach (var title in new[] { "Invoice", "Date", "Invoice total", "Amount applied" })
                                header.Cell().BorderBottom(1).Padding(5).Text(title).Bold();
                        });
                        foreach (var line in receipt.Invoices)
                        {
                            table.Cell().BorderBottom(0.5f).Padding(5).Text(line.InvoiceNo);
                            table.Cell().BorderBottom(0.5f).Padding(5).Text($"{line.InvoiceDate.ToString("dd-MM-yyyy", System.Globalization.CultureInfo.InvariantCulture)}");
                            table.Cell().BorderBottom(0.5f).Padding(5).AlignRight().Text($"{line.InvoiceTotal.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)} {receipt.Currency}");
                            table.Cell().BorderBottom(0.5f).Padding(5).AlignRight().Text($"{line.AmountApplied.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)} {receipt.Currency}");
                        }
                    });
                    column.Item().PaddingTop(12).AlignRight().Text($"CASH RECEIVED: {receipt.AmountReceived.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)} {receipt.Currency}").Bold().FontSize(13);
                    if (receipt.SettlementAdjustmentAmount is > 0)
                    {
                        column.Item().AlignRight().Text($"Settlement adjustment: {receipt.SettlementAdjustmentAmount.Value.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)} {receipt.Currency}").FontSize(10);
                        if (!string.IsNullOrWhiteSpace(receipt.SettlementAdjustmentReason))
                            column.Item().AlignRight().Text($"Reason: {receipt.SettlementAdjustmentReason}").FontSize(9);
                        column.Item().AlignRight().Text($"Total applied to invoice(s): {receipt.AmountPaid.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)} {receipt.Currency}").Bold().FontSize(11);
                    }
                    else if (receipt.AmountPaid > receipt.AmountReceived)
                    {
                        column.Item().AlignRight().Text($"Total applied: {receipt.AmountPaid.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)} {receipt.Currency}").FontSize(10);
                    }
                    if (!string.IsNullOrWhiteSpace(receipt.AmountInWords)) column.Item().PaddingTop(4).Text(receipt.AmountInWords).FontSize(9);
                });
                page.Footer().AlignCenter().Text(text => { text.CurrentPageNumber(); text.Span(" / "); text.TotalPages(); });
            }));
            return Task.FromResult(document.GeneratePdf());
        }

        public async Task<byte[]> GenerateInvoicePdfAsync(SaleDto sale, string format = "A4", string? layout = null)
        {
            var formatNormalized = (format ?? "A4").Trim();
            if (string.IsNullOrEmpty(formatNormalized) || !new[] { "A4", "A5", "80mm", "58mm" }.Contains(formatNormalized, StringComparer.OrdinalIgnoreCase))
                formatNormalized = "A4";

            try
            {
                _logger.LogDebug("Generating PDF for sale {SaleId}, Invoice {InvoiceNo}, format {Format}, layout {Layout}, Items count: {Count}", sale.Id, sale.InvoiceNo, formatNormalized, layout ?? "(default)", sale.Items?.Count ?? 0);
                
                if (sale.Items == null || !sale.Items.Any())
                {
                    throw new InvalidOperationException($"Sale {sale.Id} has no items. Cannot generate PDF.");
                }
                
                var settings = await GetCompanySettingsAsync(sale.OwnerId); // Use OwnerId from SaleDto
                ApplyInvoiceLayoutOverride(settings, layout);
                
                // CRITICAL: Get customer's pending balance for invoice footer acknowledgment (A4 only)
                var customerPendingInfo = await GetCustomerPendingBalanceInfoAsync(sale.CustomerId, sale.OwnerId);
                _logger.LogDebug("Company: {CompanyName}, LetterheadOnly={LetterheadOnly}", settings.CompanyNameEn, settings.LetterheadOnlyPrint);
                
                var customerTrn = await GetCustomerTrnAsync(sale.CustomerId, sale.OwnerId);
                var trnDisplay = string.IsNullOrWhiteSpace(customerTrn) ? "" : customerTrn;
                _logger.LogDebug("Customer TRN: {Trn}", trnDisplay);

                // A5, 80mm, 58mm: use QuestPDF layouts directly (no HTML template path)
                if (formatNormalized.Equals("A5", StringComparison.OrdinalIgnoreCase))
                {
                    return await Task.FromResult(GenerateInvoicePdfA5(sale, settings, trnDisplay));
                }
                if (formatNormalized.Equals("80mm", StringComparison.OrdinalIgnoreCase))
                {
                    return await Task.FromResult(GenerateInvoicePdf80mm(sale, settings, trnDisplay));
                }
                if (formatNormalized.Equals("58mm", StringComparison.OrdinalIgnoreCase))
                {
                    return await Task.FromResult(GenerateInvoicePdf58mm(sale, settings, trnDisplay));
                }

                // A4: try HTML template (for preview/other use), then build QuestPDF A4
                string? templateHtml = null;
                try
                {
                    var templateSettings = new InvoiceTemplateService.CompanySettings
                    {
                        CompanyNameEn = settings.CompanyNameEn,
                        CompanyNameAr = settings.CompanyNameAr,
                        CompanyAddress = settings.CompanyAddress,
                        CompanyPhone = settings.CompanyPhone,
                        CompanyTrn = settings.CompanyTrn,
                        Currency = settings.Currency,
                        LogoImageBytes = settings.LogoImageBytes
                    };
                    
                    templateHtml = await _templateService.RenderActiveTemplateAsync(sale.OwnerId, sale, templateSettings);
                    _logger.LogDebug("Using active invoice template from database");
                }
                catch (Exception ex)
                {
                    _logger.LogDebug("Database template not available: {Message}", ex.Message);
                    try
                    {
                        var templatePath = Path.Combine(Directory.GetCurrentDirectory(), "Templates", "invoice-template.html");
                        if (File.Exists(templatePath))
                        {
                            var templateFileContent = await File.ReadAllTextAsync(templatePath);
                            var templateSettings = new InvoiceTemplateService.CompanySettings
                            {
                                CompanyNameEn = settings.CompanyNameEn,
                                CompanyNameAr = settings.CompanyNameAr,
                                CompanyAddress = settings.CompanyAddress,
                                CompanyPhone = settings.CompanyPhone,
                                CompanyTrn = settings.CompanyTrn,
                                Currency = settings.Currency,
                                LogoImageBytes = settings.LogoImageBytes
                            };
                            templateHtml = await _templateService.RenderTemplateHtmlAsync(templateFileContent, sale, templateSettings);
                            _logger.LogDebug("Using invoice template from file");
                        }
                    }
                    catch (Exception fileEx)
                    {
                        _logger.LogDebug("Template file also failed: {Message}", fileEx.Message);
                    }
                }

                var document = Document.Create(container =>
                {
                    container.Page(page =>
                    {
                        // A4 Portrait: 210mm x 297mm
                        page.Size(PageSizes.A4);
                        ApplyDocumentPageMargins(page, settings, 5f);
                        page.PageColor(Colors.White);
                        
                        // CRITICAL FIX: Arabic font for print compatibility
                        // Using embedded custom font for production
                        page.DefaultTextStyle(x => x
                            .FontSize(10f)
                            .FontFamily(_arabicFont)
                        );

                        var useOrangeLetterhead = !settings.BilingualMonochromeHeader && !settings.LetterheadOnlyPrint && IsZayogaBrand(settings);
                        RenderFullPageLetterheadChrome(page, settings);
                        // Body print: overlay stamp on letterhead paper. Full Zayoga: stamp near sign-off (avoids blank page).
                        if (!useOrangeLetterhead)
                            RenderStampSignatureFooter(page, settings);

                        page.Content().Column(column =>
                        {
                            column.Spacing(0);

                            column.Item().Padding(3).Column(innerColumn =>
                            {
                                innerColumn.Spacing(0);

                                // Invoice header: orange letterhead is page chrome; generic tenants keep content branding.
                                var hasLogo = !settings.LetterheadOnlyPrint && !useOrangeLetterhead && settings.LogoImageBytes != null && settings.LogoImageBytes.Length > 0;
                                var invoiceDateStr = FormatInvoiceDate(sale.InvoiceDate, settings);

                                if (settings.BilingualMonochromeHeader)
                                {
                                    RenderCompanyHeader(innerColumn.Item(), settings, 14, a4Letterhead: true, dateLine: $"DATE: {invoiceDateStr}");
                                }
                                else if (!settings.LetterheadOnlyPrint && !useOrangeLetterhead)
                                {
                                // Row 1: Logo | Company block (name EN, AR, address) | Date
                                innerColumn.Item().Row(headerRow =>
                                {
                                    if (hasLogo)
                                        headerRow.ConstantItem(130).AlignLeft().AlignMiddle()
                                            .Width(120).Height(56).Image(settings.LogoImageBytes!).FitArea();
                                    headerRow.RelativeItem().AlignCenter().Column(nameCol =>
                                    {
                                        nameCol.Item().Text(settings.CompanyNameEn.ToUpper())
                                            .FontSize(18)
                                            .Bold()
                                            .AlignCenter();
                                        nameCol.Item().PaddingTop(1).Text(settings.CompanyNameAr)
                                            .FontSize(16)
                                            .Bold()
                                            .FontFamily(_arabicFont)
                                            .DirectionFromRightToLeft()
                                            .AlignCenter();
                                        nameCol.Item().PaddingTop(2).Text($"Mob: {settings.CompanyPhone}, {settings.CompanyAddress}")
                                            .FontSize(12)
                                            .Bold()
                                            .AlignCenter();
                                    });
                                    headerRow.ConstantItem(80).AlignRight().AlignMiddle()
                                        .Text($"DATE: {invoiceDateStr}").FontSize(10).Bold();
                                });

                                // Row 2: TRN full width (omit when missing; SAMPLE-prefix when sample)
                                var companyTrnLine = HexaBill.Api.Core.Tenancy.SampleVatTrn.DocumentTrnDisplay(settings.CompanyTrn);
                                if (!string.IsNullOrEmpty(companyTrnLine))
                                {
                                    innerColumn.Item().PaddingTop(2).Row(trnRow =>
                                    {
                                        trnRow.AutoItem().Text("TRN : No : ").FontSize(10).Bold();
                                        trnRow.AutoItem().Text(companyTrnLine).FontSize(10).Bold();
                                    });
                                }
                                }
                                else
                                {
                                    innerColumn.Item().AlignRight().Text($"DATE: {invoiceDateStr}").FontSize(10).Bold();
                                }

                                // TAX INVOICE title - compact with borders
                                innerColumn.Item().PaddingTop(2).PaddingBottom(2).BorderTop(1f).BorderBottom(1f).PaddingVertical(2)
                                    .Text(HexaBill.Api.Core.Tenancy.SampleVatTrn.DocumentTitle(settings.CompanyTrn))
                                    .FontSize(12)
                                    .Bold()
                                    .AlignCenter();

                                // Customer Info - Invoice No and Customer Name on separate lines (left), TRN inline (right)
                                innerColumn.Item().PaddingTop(1).PaddingBottom(1).Row(custRow => {
                                    custRow.RelativeItem(65).Column(col => {
                                        col.Item().Text(text => {
                                            text.Span("INVOICE : NO : ").FontSize(10).Bold();
                                            text.Span(sale.InvoiceNo ?? "").FontSize(10).Bold();
                                        });
                                        col.Item().Text(text => {
                                            text.Span("Customer Name : ").FontSize(10).Bold();
                                            text.Span(string.IsNullOrWhiteSpace(sale.CustomerName) ? "Cash Customer" : sale.CustomerName).FontSize(10).Bold();
                                        });
                                    });
                                    // Unregistered customers: no empty "CUSTOMER TRN" label.
                                    if (!string.IsNullOrWhiteSpace(trnDisplay))
                                        custRow.RelativeItem(35).AlignRight().Text(text => {
                                            text.Span("CUSTOMER TRN : NO : ").FontSize(10).Bold();
                                            text.Span(trnDisplay).FontSize(10).Bold();
                                        });
                                    else
                                        custRow.RelativeItem(35);
                                });

                                innerColumn.Item().Border(0.5f).Table(table =>
                                {
                                    // Column widths matching RAFCO 11: balanced equal widths
                                    table.ColumnsDefinition(columns =>
                                    {
                                        columns.RelativeColumn(6);   // SL.No
                                        columns.RelativeColumn(35);  // Description
                                        columns.RelativeColumn(8);   // Unit
                                        columns.RelativeColumn(8);   // Qty
                                        columns.RelativeColumn(12);  // Unit Price
                                        columns.RelativeColumn(11);  // Total
                                        columns.RelativeColumn(9);   // VAT 5%
                                        columns.RelativeColumn(11);  // Amount
                                    });

                                    table.Header(header =>
                                    {
                                        void AddHeader(string arabic, string eng)
                                        {
                                            header.Cell().Border(0.5f).PaddingVertical(3).PaddingHorizontal(2).Column(col =>
                                            {
                                                if (!string.IsNullOrEmpty(arabic))
                                                {
                                                    col.Item().AlignCenter()
                                                        .Text(arabic)
                                                        .FontSize(9)
                                                        .FontFamily(_arabicFont)
                                                        .DirectionFromRightToLeft();
                                                }
                                                col.Item().AlignCenter().Text(eng).FontSize(9);
                                            });
                                        }

                                        AddHeader("ر.م", "SL.No");
                                        AddHeader("الوصف", "Description");
                                        AddHeader("الوحدة", "Unit");
                                        AddHeader("الكمية", "Qty");
                                        AddHeader("سعر الوحدة", "Unit Price");
                                        AddHeader("الإجمالي", "Total");
                                        AddHeader("ض.ق.م ٥٪", "Vat:5%");
                                        AddHeader("المبلغ", "Amount");
                                    });

                                    int itemCount = sale.Items != null ? sale.Items.Count : 0;

                                    if (itemCount > 0 && sale.Items != null)
                                    {
                                        for (int i = 0; i < itemCount; i++)
                                        {
                                            var item = sale.Items[i];
                                            
                                            // Add vertical borders between columns, no horizontal borders between rows
                                            table.Cell().BorderLeft(0.5f).BorderRight(0.5f).PaddingVertical(3).PaddingHorizontal(1).AlignCenter().Text((i + 1).ToString()).FontSize(9);
                                            table.Cell().BorderLeft(0.5f).BorderRight(0.5f).PaddingVertical(3).PaddingHorizontal(2).AlignLeft().Text(item.ProductName ?? "").FontSize(9);
                                            var unitTypeText = string.IsNullOrWhiteSpace(item.UnitType) ? "CRTN" : item.UnitType.ToUpper();
                                            table.Cell().BorderLeft(0.5f).BorderRight(0.5f).PaddingVertical(3).PaddingHorizontal(1).AlignCenter().Text(unitTypeText).FontSize(9);
                                            table.Cell().BorderLeft(0.5f).BorderRight(0.5f).PaddingVertical(3).PaddingHorizontal(1).AlignCenter().Text(item.Qty.ToString("0.##")).FontSize(9);
                                            
                                            // CRITICAL FIX: Right-align all monetary columns for professional invoice format
                                            table.Cell().BorderLeft(0.5f).BorderRight(0.5f).PaddingVertical(3).PaddingHorizontal(1).AlignRight().Text(item.UnitPrice.ToString("0.00")).FontSize(9);
                                            
                                            var lineNet = item.Qty * item.UnitPrice;
                                            table.Cell().BorderLeft(0.5f).BorderRight(0.5f).PaddingVertical(3).PaddingHorizontal(1).AlignRight().Text(lineNet.ToString("0.00")).FontSize(9);
                                            table.Cell().BorderLeft(0.5f).BorderRight(0.5f).PaddingVertical(3).PaddingHorizontal(1).AlignRight().Text(item.VatAmount.ToString("0.00")).FontSize(9);
                                            table.Cell().BorderLeft(0.5f).BorderRight(0.5f).PaddingVertical(3).PaddingHorizontal(1).AlignRight().Text(item.LineTotal.ToString("0.00")).FontSize(9);
                                        }
                                    }

                                    // Cosmetic table fill for full/download only â€” never in body/print (letterhead margins
                                    // already reserve space; filler + stamp clearance was forcing a blank page 2).
                                    if (!settings.LetterheadOnlyPrint)
                                    {
                                        int minRowsForHeight = useOrangeLetterhead ? 5 : 7;
                                        float rowHeight = 18f;
                                        float totalItemsHeight = itemCount * rowHeight;
                                        float minTableHeight = minRowsForHeight * rowHeight;
                                        if (itemCount < minRowsForHeight)
                                        {
                                            float spacerHeight = Math.Min(90f, minTableHeight - totalItemsHeight - (3 * rowHeight));
                                            if (spacerHeight > 0)
                                            {
                                                for (int col = 0; col < 8; col++)
                                                {
                                                    table.Cell().BorderLeft(0.5f).BorderRight(0.5f).Height(spacerHeight).Text("");
                                                }
                                            }
                                        }
                                    }

                                    // Summary rows - ALL totals in rightmost Amount column
                                    // Row 1: INV. Amount (Subtotal)
                                    table.Cell().ColumnSpan(7).Border(0.5f).PaddingVertical(2).PaddingHorizontal(2).Row(row => {
                                        row.AutoItem().Text("INV.Amount").FontSize(10);
                                        row.RelativeItem();
                                        row.AutoItem().Text("مبلغ الفاتورة").FontSize(10).FontFamily(_arabicFont).DirectionFromRightToLeft();
                                    });
                                    table.Cell().Border(0.5f).PaddingVertical(2).PaddingHorizontal(2).AlignRight().Text(sale.Subtotal.ToString("0.00")).FontSize(10);
                                    
                                    // Row 2: VAT 5%
                                    table.Cell().ColumnSpan(7).Border(0.5f).PaddingVertical(2).PaddingHorizontal(2).Row(row => {
                                        row.AutoItem().Text("VAT 5%").FontSize(10);
                                        row.RelativeItem();
                                        row.AutoItem().Text("ضريبة القيمة المضافة").FontSize(9).FontFamily(_arabicFont).DirectionFromRightToLeft();
                                    });
                                    table.Cell().Border(0.5f).PaddingVertical(2).PaddingHorizontal(2).AlignRight().Text(sale.VatTotal.ToString("0.00")).FontSize(10);
                                    
                                    // Row 2.5: Round Off (only when non-zero)
                                    if (sale.RoundOff != 0)
                                    {
                                        table.Cell().ColumnSpan(7).Border(0.5f).PaddingVertical(2).PaddingHorizontal(2).Row(row => {
                                            row.AutoItem().Text("Round Off").FontSize(10);
                                            row.RelativeItem();
                                            row.AutoItem().Text("تقريب").FontSize(10).FontFamily(_arabicFont).DirectionFromRightToLeft();
                                        });
                                        var roundOffText = sale.RoundOff > 0 ? "+" + sale.RoundOff.ToString("0.00") : sale.RoundOff.ToString("0.00");
                                        table.Cell().Border(0.5f).PaddingVertical(2).PaddingHorizontal(2).AlignRight().Text(roundOffText).FontSize(10);
                                    }
                                    
                                    // Row 3: Total Amount
                                    var amountInWords = ConvertToWords(sale.GrandTotal);
                                    // Shorten amount in words if too long
                                    if (amountInWords.Length > 80)
                                    {
                                        amountInWords = amountInWords.Substring(0, 77) + "...";
                                    }
                                    
                                    table.Cell().ColumnSpan(7).Border(0.5f).PaddingVertical(2).PaddingHorizontal(2).Text(text => {
                                        text.Span("Total Amount ").FontSize(10);
                                        text.Span("............. ").FontSize(8);
                                        text.Span(amountInWords).FontSize(8).Italic();
                                        text.Span(" ............. ").FontSize(8);
                                        text.Span(" درهم فقط").FontSize(10).FontFamily(_arabicFont).DirectionFromRightToLeft();
                                    });
                                    table.Cell().Border(0.5f).PaddingVertical(2).PaddingHorizontal(2).AlignRight().Text(sale.GrandTotal.ToString("0.00")).FontSize(10);
                                });

                                // Pin signature / Pending near A4 page bottom after short tables
                                innerColumn.Item().ExtendVertical().AlignBottom().PaddingTop(1).Column(footerCol =>
                                {
                                    // Acknowledgement text
                                    footerCol.Item().AlignLeft().Text("Received the above goods in good order")
                                        .FontSize(8);

                                    // Signature section - two columns - more compact
                                    footerCol.Item().PaddingTop(2).Row(sigRow =>
                                    {
                                        // Left column: Receiver's info
                                        sigRow.RelativeItem().Column(leftCol => {
                                            leftCol.Item().Text("Receiver's Name: " + new string('.', 30)).FontSize(8);
                                            leftCol.Item().PaddingTop(1).Text("Receiver's Sign: " + new string('.', 30)).FontSize(8);
                                        });
                                        
                                        // Right column: Company name (skipped when letterhead-only — stamp/sig fills this zone)
                                        sigRow.RelativeItem().Column(rightCol => {
                                            if (!settings.LetterheadOnlyPrint && !useOrangeLetterhead)
                                            {
                                                rightCol.Item().AlignRight().Text($"For {settings.CompanyNameEn}").FontSize(8);
                                                rightCol.Item().AlignRight().Text(new string('.', 35)).FontSize(8);
                                            }
                                            else if (useOrangeLetterhead)
                                            {
                                                rightCol.Item().AlignRight().Height(8);
                                                RenderStampNearSignatory(rightCol, settings);
                                            }
                                            else
                                            {
                                                rightCol.Item().Height(24);
                                            }
                                        });
                                    });
                                    
                                    // Edit Reason - show if invoice was edited
                                    if (!string.IsNullOrWhiteSpace(sale.EditReason))
                                    {
                                        footerCol.Item().PaddingTop(1).BorderTop(0.5f).PaddingTop(1).Text(text => {
                                            text.Span("Edit Reason: ").FontSize(7).Bold();
                                            text.Span(sale.EditReason).FontSize(7).FontColor(Colors.Orange.Medium);
                                        });
                                    }
                                    
                                    // Pending / Balance — centered black (reference style; never red)
                                    if (sale.CustomerId.HasValue && customerPendingInfo.TotalPendingBills > 0)
                                    {
                                        footerCol.Item().PaddingTop(4).LineHorizontal(0.5f).LineColor(Colors.Black);
                                        footerCol.Item().PaddingTop(3).AlignCenter()
                                            .Text($"Pending: {customerPendingInfo.TotalPendingBills} | Balance: {settings.Currency} {customerPendingInfo.TotalBalanceDue:N2}")
                                            .FontSize(8).Bold().FontColor(Colors.Black);
                                    }
                                });
                            });
                        });
                    });
                });

                _logger.LogInformation("   PDF document created successfully, generating bytes...");
                byte[] pdfBytes;
                try
                {
                    pdfBytes = document.GeneratePdf();
                    _logger.LogInformation($"\u2705 PDF generated: {pdfBytes.Length} bytes");
                }
                catch (Exception pdfEx) when (!settings.BilingualMonochromeHeader && (pdfEx.Message.Contains("conflicting size constraints") || pdfEx.Message.Contains("more space")))
                {
                    // FALLBACK: Layout overflow - retry without customer balance
                    _logger.LogInformation($"\u26a0\ufe0f PDF layout overflow, retrying without customer balance...");
                    _logger.LogInformation($"   Original error: {pdfEx.Message}");
                                    
                    // Generate simpler PDF without customer balance section
                    var fallbackDoc = Document.Create(container =>
                    {
                        container.Page(page =>
                        {
                            page.Size(PageSizes.A4);
                            page.Margin(5, Unit.Millimetre);
                            page.PageColor(Colors.White);
                            page.DefaultTextStyle(x => x.FontSize(10f).FontFamily(_arabicFont));
                            page.Content().Column(col =>
                            {
                                col.Item().Text($"{settings.CompanyNameEn}").FontSize(16).Bold().AlignCenter();
                                col.Item().Text($"Invoice: {sale.InvoiceNo} | Date: {sale.InvoiceDate:dd-MM-yyyy}").FontSize(10).AlignCenter();
                                col.Item().Text($"Customer: {sale.CustomerName ?? "Cash"}").FontSize(10);
                                col.Item().PaddingTop(10).Table(tbl =>
                                {
                                    tbl.ColumnsDefinition(c => { c.RelativeColumn(5); c.RelativeColumn(30); c.RelativeColumn(10); c.RelativeColumn(15); c.RelativeColumn(15); c.RelativeColumn(15); });
                                    tbl.Header(h => { h.Cell().Text("#"); h.Cell().Text("Product"); h.Cell().Text("Qty"); h.Cell().Text("Price"); h.Cell().Text("VAT"); h.Cell().Text("Total"); });
                                    if (sale.Items != null)
                                    {
                                        for (int i = 0; i < sale.Items.Count; i++)
                                        {
                                            var it = sale.Items[i];
                                            tbl.Cell().Text((i + 1).ToString());
                                            tbl.Cell().Text(it.ProductName ?? "");
                                            tbl.Cell().Text(it.Qty.ToString("0.##"));
                                            tbl.Cell().Text(it.UnitPrice.ToString("0.00"));
                                            tbl.Cell().Text(it.VatAmount.ToString("0.00"));
                                            tbl.Cell().Text(it.LineTotal.ToString("0.00"));
                                        }
                                    }
                                });
                                col.Item().PaddingTop(10).AlignRight().Text($"Subtotal: {sale.Subtotal:N2}");
                                col.Item().AlignRight().Text($"VAT: {sale.VatTotal:N2}");
                                col.Item().AlignRight().Text($"TOTAL: {sale.GrandTotal:N2}").Bold();
                            });
                        });
                    });
                    pdfBytes = fallbackDoc.GeneratePdf();
                    _logger.LogInformation($"\u2705 Fallback PDF generated: {pdfBytes.Length} bytes");
                }
                catch (Exception pdfEx)
                {
                    _logger.LogError(pdfEx, "PDF Generation Failed: {Message}", pdfEx.Message);
                    _logger.LogError("Inner Exception: {Message}", pdfEx.InnerException?.Message ?? "None");
                    _logger.LogError("Stack Trace: {StackTrace}", pdfEx.StackTrace);
                    throw new InvalidOperationException($"Failed to generate PDF: {pdfEx.Message}", pdfEx);
                }
                
                if (pdfBytes == null || pdfBytes.Length == 0)
                {
                    throw new InvalidOperationException("PDF generation returned empty bytes");
                }
                
                // Save PDF to disk for backup
                try
                {
                    await SavePdfToDiskAsync(sale, pdfBytes);
                }
                catch (Exception saveEx)
                {
                    _logger.LogInformation($"?? Failed to save PDF to disk: {saveEx.Message}");
                    // Don't throw - PDF generation succeeded, just saving to disk failed
                }
                
                return pdfBytes;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "PDF Generation Error: {Message}", ex.Message);
                _logger.LogError("Stack trace: {StackTrace}", ex.StackTrace);
                throw;
            }
        }

        public async Task<byte[]> GenerateDeliveryNotePdfAsync(SaleDto sale, string format = "A4", string? layout = null)
        {
            var formatNormalized = (format ?? "A4").Trim();
            if (!new[] { "A4", "A5" }.Contains(formatNormalized, StringComparer.OrdinalIgnoreCase))
                formatNormalized = "A4";

            try
            {
                if (sale.Items == null || !sale.Items.Any())
                    throw new InvalidOperationException($"Sale {sale.Id} has no items. Cannot generate delivery note.");

                var settings = await GetCompanySettingsAsync(sale.OwnerId);
                ApplyPrintLayout(settings, layout);
                var customerTrn = await GetCustomerTrnAsync(sale.CustomerId, sale.OwnerId);
                var trnDisplay = string.IsNullOrWhiteSpace(customerTrn) ? "" : customerTrn;
                var isA5 = formatNormalized.Equals("A5", StringComparison.OrdinalIgnoreCase);

                var document = Document.Create(container =>
                {
                    container.Page(page =>
                    {
                        if (isA5)
                        {
                            page.Size(148, 210, Unit.Millimetre);
                            ApplyDocumentPageMargins(page, settings, 4f);
                            page.DefaultTextStyle(x => x.FontSize(8f).FontFamily(_arabicFont));
                        }
                        else
                        {
                            page.Size(PageSizes.A4);
                            ApplyDocumentPageMargins(page, settings, 5f);
                            page.DefaultTextStyle(x => x.FontSize(10f).FontFamily(_arabicFont));
                        }
                        page.PageColor(Colors.White);
                        var useOrangeLetterhead = !settings.BilingualMonochromeHeader && !settings.LetterheadOnlyPrint && IsZayogaBrand(settings);
                        RenderFullPageLetterheadChrome(page, settings, compact: isA5);
                        if (!useOrangeLetterhead)
                            RenderStampSignatureFooter(page, settings);

                        page.Content().Column(column =>
                        {
                            column.Item().Padding(3).Column(innerColumn =>
                            {
                                var hasLogo = !settings.LetterheadOnlyPrint && !useOrangeLetterhead && settings.LogoImageBytes != null && settings.LogoImageBytes.Length > 0;
                                var invoiceDateStr = FormatInvoiceDate(sale.InvoiceDate, settings);
                                var titleSize = isA5 ? 10f : 12f;
                                var bodySize = isA5 ? 8f : 9f;

                                if (!settings.LetterheadOnlyPrint && !useOrangeLetterhead)
                                {
                                innerColumn.Item().Row(headerRow =>
                                {
                                    if (hasLogo)
                                        headerRow.ConstantItem(isA5 ? 90 : 130).AlignLeft().AlignMiddle()
                                            .Width(isA5 ? 80 : 120).Height(isA5 ? 40 : 56).Image(settings.LogoImageBytes!).FitArea();
                                    headerRow.RelativeItem().AlignCenter().Column(nameCol =>
                                    {
                                        nameCol.Item().Text(settings.CompanyNameEn.ToUpper()).FontSize(isA5 ? 12 : 18).Bold().AlignCenter();
                                        nameCol.Item().PaddingTop(1).Text(settings.CompanyNameAr).FontSize(isA5 ? 10 : 16).Bold()
                                            .FontFamily(_arabicFont).DirectionFromRightToLeft().AlignCenter();
                                        nameCol.Item().PaddingTop(2).Text($"Mob: {settings.CompanyPhone}, {settings.CompanyAddress}")
                                            .FontSize(isA5 ? 8 : 12).Bold().AlignCenter();
                                    });
                                    headerRow.ConstantItem(isA5 ? 60 : 80).AlignRight().AlignMiddle()
                                        .Text($"DATE: {invoiceDateStr}").FontSize(bodySize).Bold();
                                });
                                }
                                else
                                {
                                    innerColumn.Item().AlignRight().Text($"DATE: {invoiceDateStr}").FontSize(bodySize).Bold();
                                }

                                innerColumn.Item().PaddingTop(2).BorderTop(1f).BorderBottom(1f).PaddingVertical(2)
                                    .Text("DELIVERY NOTE").FontSize(titleSize).Bold().AlignCenter();

                                innerColumn.Item().PaddingTop(4).Row(custRow =>
                                {
                                    custRow.RelativeItem().Column(col =>
                                    {
                                        col.Item().Text(text =>
                                        {
                                            text.Span("Invoice Ref : ").FontSize(bodySize).Bold();
                                            text.Span(sale.InvoiceNo ?? "").FontSize(bodySize).Bold();
                                        });
                                        col.Item().Text(text =>
                                        {
                                            text.Span("Customer : ").FontSize(bodySize).Bold();
                                            text.Span(string.IsNullOrWhiteSpace(sale.CustomerName) ? "Cash Customer" : sale.CustomerName).FontSize(bodySize);
                                        });
                                    });
                                    if (!string.IsNullOrWhiteSpace(trnDisplay))
                                    {
                                        custRow.RelativeItem().AlignRight().Text(text =>
                                        {
                                            text.Span("Customer TRN : ").FontSize(bodySize).Bold();
                                            text.Span(trnDisplay).FontSize(bodySize);
                                        });
                                    }
                                });

                                innerColumn.Item().PaddingTop(4).Border(0.5f).Table(table =>
                                {
                                    table.ColumnsDefinition(columns =>
                                    {
                                        columns.RelativeColumn(8);
                                        columns.RelativeColumn(52);
                                        columns.RelativeColumn(15);
                                        columns.RelativeColumn(15);
                                    });

                                    void AddHeader(string eng)
                                    {
                                        table.Cell().Border(0.5f).PaddingVertical(3).PaddingHorizontal(2)
                                            .AlignCenter().Text(eng).FontSize(bodySize).Bold();
                                    }

                                    AddHeader("SL.No");
                                    AddHeader("Description");
                                    AddHeader("Unit");
                                    AddHeader("Qty");

                                    for (int i = 0; i < sale.Items.Count; i++)
                                    {
                                        var item = sale.Items[i];
                                        table.Cell().BorderLeft(0.5f).BorderRight(0.5f).PaddingVertical(3).PaddingHorizontal(1)
                                            .AlignCenter().Text((i + 1).ToString()).FontSize(bodySize);
                                        table.Cell().BorderLeft(0.5f).BorderRight(0.5f).PaddingVertical(3).PaddingHorizontal(2)
                                            .AlignLeft().Text(item.ProductName ?? "").FontSize(bodySize);
                                        var unitTypeText = string.IsNullOrWhiteSpace(item.UnitType) ? "CRTN" : item.UnitType.ToUpper();
                                        table.Cell().BorderLeft(0.5f).BorderRight(0.5f).PaddingVertical(3).PaddingHorizontal(1)
                                            .AlignCenter().Text(unitTypeText).FontSize(bodySize);
                                        table.Cell().BorderLeft(0.5f).BorderRight(0.5f).PaddingVertical(3).PaddingHorizontal(1)
                                            .AlignCenter().Text(item.Qty.ToString("0.##")).FontSize(bodySize);
                                    }
                                });

                                innerColumn.Item().PaddingTop(8).Column(footerCol =>
                                {
                                    footerCol.Item().AlignLeft().Text("Received the above goods in good order.").FontSize(bodySize);
                                    footerCol.Item().PaddingTop(6).Row(sigRow =>
                                    {
                                        sigRow.RelativeItem().Column(leftCol =>
                                        {
                                            leftCol.Item().Text("Receiver's Name: " + new string('.', 28)).FontSize(bodySize);
                                            leftCol.Item().PaddingTop(4).Text("Receiver's Sign: " + new string('.', 28)).FontSize(bodySize);
                                        });
                                        sigRow.RelativeItem().Column(rightCol =>
                                        {
                                            if (!settings.LetterheadOnlyPrint && !useOrangeLetterhead)
                                            {
                                                rightCol.Item().AlignRight().Text($"For {settings.CompanyNameEn}").FontSize(bodySize);
                                                rightCol.Item().AlignRight().Text(new string('.', 30)).FontSize(bodySize);
                                            }
                                            else if (useOrangeLetterhead)
                                            {
                                                rightCol.Item().AlignRight().Height(6);
                                                RenderStampNearSignatory(rightCol, settings);
                                            }
                                            else
                                            {
                                                rightCol.Item().Height(20);
                                            }
                                        });
                                    });
                                });
                            });
                        });
                    });
                });

                return document.GeneratePdf();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Delivery note PDF generation error: {Message}", ex.Message);
                throw;
            }
        }

        /// <summary>A5 (148x210mm) compact invoice - letterhead-only + stamp/sign when enabled.</summary>
        private byte[] GenerateInvoicePdfA5(SaleDto sale, InvoiceTemplateService.CompanySettings settings, string trnDisplay)
        {
            var invoiceDateStr = FormatInvoiceDate(sale.InvoiceDate, settings);
            var letterheadOnly = settings.LetterheadOnlyPrint;
            var useOrangeLetterhead = !settings.BilingualMonochromeHeader && !letterheadOnly && IsZayogaBrand(settings);
            var document = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(148, 210, Unit.Millimetre);
                    ApplyDocumentPageMargins(page, settings, 4f);
                    page.PageColor(Colors.White);
                    page.DefaultTextStyle(x => x.FontSize(8f).FontFamily(_arabicFont));

                    RenderFullPageLetterheadChrome(page, settings, compact: true);
                    if (!useOrangeLetterhead)
                        RenderStampSignatureFooter(page, settings);

                    page.Content().Column(column =>
                    {
                        column.Spacing(0);
                        column.Item().PaddingVertical(2).Column(inner =>
                        {
                            inner.Spacing(0);
                            if (settings.BilingualMonochromeHeader)
                                RenderCompanyHeader(inner.Item(), settings, 10);
                            else if (!letterheadOnly && !useOrangeLetterhead)
                            {
                                inner.Item().AlignCenter().Column(c =>
                                {
                                    c.Item().Text(settings.CompanyNameEn.ToUpper()).FontSize(11).Bold().AlignCenter();
                                    if (!string.IsNullOrEmpty(settings.CompanyNameAr))
                                        c.Item().Text(settings.CompanyNameAr).FontSize(9).Bold().FontFamily(_arabicFont).DirectionFromRightToLeft().AlignCenter();
                                    c.Item().Text(string.IsNullOrEmpty(HexaBill.Api.Core.Tenancy.SampleVatTrn.DocumentTrnDisplay(settings.CompanyTrn)) ? "" : $"TRN: {HexaBill.Api.Core.Tenancy.SampleVatTrn.DocumentTrnDisplay(settings.CompanyTrn)}").FontSize(7);
                                    c.Item().Text($"Mob: {settings.CompanyPhone} | {settings.CompanyAddress}").FontSize(6);
                                });
                            }
                            else
                            {
                                inner.Item().AlignRight().Text($"Date: {invoiceDateStr}").FontSize(7);
                            }
                            inner.Item().PaddingVertical(1).BorderTop(0.5f).BorderBottom(0.5f)
                                .Text(HexaBill.Api.Core.Tenancy.SampleVatTrn.DocumentTitle(settings.CompanyTrn)).FontSize(9).Bold().AlignCenter();
                            inner.Item().PaddingTop(1).Row(r =>
                            {
                                r.RelativeItem().Text($"Inv: {sale.InvoiceNo} | Date: {invoiceDateStr}").FontSize(7);
                                r.RelativeItem().AlignRight().Text($"Cust TRN: {trnDisplay}").FontSize(7);
                            });
                            inner.Item().Text($"Customer: {sale.CustomerName ?? "Cash Customer"}").FontSize(7);

                            // Items table - 5 columns to prevent overflow: # | Item | Qty | Total | VAT
                            inner.Item().PaddingTop(2).Border(0.5f).Table(table =>
                            {
                                table.ColumnsDefinition(c =>
                                {
                                    c.ConstantColumn(16);     // #
                                    c.RelativeColumn(4);      // Item
                                    c.ConstantColumn(24);     // Qty
                                    c.ConstantColumn(38);     // Total
                                    c.ConstantColumn(32);     // VAT 5%
                                });
                                table.Header(h =>
                                {
                                    h.Cell().Border(0.5f).Padding(2).AlignCenter().Text("#").FontSize(6);
                                    h.Cell().Border(0.5f).Padding(2).AlignLeft().Text("Item").FontSize(6);
                                    h.Cell().Border(0.5f).Padding(2).AlignCenter().Text("Qty").FontSize(6);
                                    h.Cell().Border(0.5f).Padding(2).AlignRight().Text("Total").FontSize(6);
                                    h.Cell().Border(0.5f).Padding(2).AlignRight().Text("VAT 5%").FontSize(6);
                                });
                                if (sale.Items != null)
                                {
                                    for (int i = 0; i < sale.Items.Count; i++)
                                    {
                                        var item = sale.Items[i];
                                        table.Cell().Border(0.5f).Padding(2).AlignCenter().Text((i + 1).ToString()).FontSize(6);
                                        table.Cell().Border(0.5f).Padding(2).AlignLeft().Text(item.ProductName ?? "").FontSize(6);
                                        table.Cell().Border(0.5f).Padding(2).AlignCenter().Text(item.Qty.ToString("0.##")).FontSize(6);
                                        table.Cell().Border(0.5f).Padding(2).AlignRight().Text(item.LineTotal.ToString("0.00")).FontSize(6);
                                        table.Cell().Border(0.5f).Padding(2).AlignRight().Text(item.VatAmount.ToString("0.00")).FontSize(6);
                                    }
                                }
                                table.Cell().ColumnSpan(4).Border(0.5f).Padding(2).AlignRight().Text("Subtotal").FontSize(6);
                                table.Cell().Border(0.5f).Padding(2).AlignRight().Text(sale.Subtotal.ToString("0.00")).FontSize(6);
                                table.Cell().ColumnSpan(4).Border(0.5f).Padding(2).AlignRight().Text("VAT 5%").FontSize(6);
                                table.Cell().Border(0.5f).Padding(2).AlignRight().Text(sale.VatTotal.ToString("0.00")).FontSize(6);
                                if (sale.RoundOff != 0)
                                {
                                    table.Cell().ColumnSpan(4).Border(0.5f).Padding(2).AlignRight().Text("Round Off").FontSize(6);
                                    table.Cell().Border(0.5f).Padding(2).AlignRight().Text(sale.RoundOff.ToString("0.00")).FontSize(6);
                                }
                                table.Cell().ColumnSpan(4).Border(0.5f).Padding(2).AlignRight().Text("Total (" + (settings.Currency ?? "AED") + ")").FontSize(7).Bold();
                                table.Cell().Border(0.5f).Padding(2).AlignRight().Text(sale.GrandTotal.ToString("0.00")).FontSize(7).Bold();
                            });
                            if (useOrangeLetterhead)
                                RenderStampNearSignatory(inner, settings);
                            else if (!letterheadOnly)
                                inner.Item().PaddingTop(2).AlignCenter().Text("Thank you").FontSize(6);
                            else if (HasStampOrSignature(settings))
                                inner.Item().Height(28);
                        });
                    });
                });
            });
            return document.GeneratePdf();
        }

        /// <summary>80mm thermal receipt - single table (items + summary), proper alignment, no excess white space.</summary>
        private byte[] GenerateInvoicePdf80mm(SaleDto sale, InvoiceTemplateService.CompanySettings settings, string trnDisplay)
        {
            var invoiceDateStr = FormatInvoiceDate(sale.InvoiceDate, settings);
            var document = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.ContinuousSize(80, Unit.Millimetre); // Fit-to-content height, no excess white space
                    page.Margin(2, Unit.Millimetre);
                    page.PageColor(Colors.White);
                    page.DefaultTextStyle(x => x.FontSize(7f).FontFamily(_englishFont));

                    page.Content().Column(column =>
                    {
                        column.Spacing(0);
                        if (settings.BilingualMonochromeHeader)
                            RenderCompanyHeader(column.Item(), settings, 9);
                        else
                        {
                            column.Item().AlignCenter().Text(settings.CompanyNameEn).FontSize(9).Bold();
                            column.Item().AlignCenter().Text(string.IsNullOrEmpty(HexaBill.Api.Core.Tenancy.SampleVatTrn.DocumentTrnDisplay(settings.CompanyTrn)) ? "" : $"TRN: {HexaBill.Api.Core.Tenancy.SampleVatTrn.DocumentTrnDisplay(settings.CompanyTrn)}").FontSize(6);
                            column.Item().AlignCenter().Text(settings.CompanyAddress ?? "").FontSize(5);
                        }
                        column.Item().AlignCenter().Text(HexaBill.Api.Core.Tenancy.SampleVatTrn.DocumentTitle(settings.CompanyTrn)).FontSize(8).Bold();
                        column.Item().AlignCenter().Text($"#{sale.InvoiceNo} | {invoiceDateStr}").FontSize(6);
                        column.Item().Text($"Customer: {sale.CustomerName ?? "Cash"}").FontSize(6);
                        if (!string.IsNullOrEmpty(trnDisplay))
                            column.Item().Text($"Cust TRN: {trnDisplay}").FontSize(5);
                        column.Item().PaddingVertical(0.5f).LineHorizontal(0.5f);

                        // Items table
                        column.Item().Table(t =>
                        {
                            t.ColumnsDefinition(c =>
                            {
                                c.RelativeColumn(3);       // Item
                                c.ConstantColumn(22);     // Qty
                                c.ConstantColumn(44);     // Total
                            });
                            t.Header(h =>
                            {
                                h.Cell().BorderBottom(0.5f).PaddingVertical(0.5f).PaddingHorizontal(0.5f).Text("Item").FontSize(6).Bold();
                                h.Cell().BorderBottom(0.5f).PaddingVertical(0.5f).PaddingHorizontal(0.5f).AlignRight().Text("Qty").FontSize(6).Bold();
                                h.Cell().BorderBottom(0.5f).PaddingVertical(0.5f).PaddingHorizontal(0.5f).AlignRight().Text("Total").FontSize(6).Bold();
                            });
                            if (sale.Items != null)
                                foreach (var item in sale.Items)
                                {
                                    t.Cell().BorderBottom(0.2f).PaddingVertical(0.5f).PaddingHorizontal(0.5f).Text(item.ProductName ?? "").FontSize(6);
                                    t.Cell().BorderBottom(0.2f).PaddingVertical(0.5f).PaddingHorizontal(0.5f).AlignRight().Text(item.Qty.ToString("0.##")).FontSize(6);
                                    t.Cell().BorderBottom(0.2f).PaddingVertical(0.5f).PaddingHorizontal(0.5f).AlignRight().Text(item.LineTotal.ToString("0.00")).FontSize(6);
                                }
                        });
                        column.Item().PaddingTop(0.5f).LineHorizontal(0.5f);
                        // Compact summary: label:value together, right-aligned - no gap
                        column.Item().Column(sumCol =>
                        {
                            sumCol.Item().AlignRight().Text($"Subtotal: {sale.Subtotal.ToString("0.00")}").FontSize(6);
                            sumCol.Item().AlignRight().Text($"VAT 5%: {sale.VatTotal.ToString("0.00")}").FontSize(6);
                            if (sale.RoundOff != 0)
                                sumCol.Item().AlignRight().Text($"Round Off: {sale.RoundOff.ToString("0.00")}").FontSize(6);
                            sumCol.Item().AlignRight().Text($"TOTAL ({settings.Currency ?? "AED"}): {sale.GrandTotal.ToString("0.00")}").FontSize(7).Bold();
                        });
                        column.Item().PaddingTop(0.5f).AlignCenter().Text("Thank you").FontSize(5);
                    });
                });
            });
            return document.GeneratePdf();
        }

        /// <summary>58mm thermal receipt - single table (items + summary), proper alignment, compact.</summary>
        private byte[] GenerateInvoicePdf58mm(SaleDto sale, InvoiceTemplateService.CompanySettings settings, string trnDisplay)
        {
            var invoiceDateStr = FormatInvoiceDate(sale.InvoiceDate, settings);
            var document = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.ContinuousSize(58, Unit.Millimetre); // Fit-to-content height, no excess white space
                    page.Margin(1.5f, Unit.Millimetre);
                    page.PageColor(Colors.White);
                    page.DefaultTextStyle(x => x.FontSize(5f).FontFamily(_englishFont));

                    page.Content().Column(column =>
                    {
                        column.Spacing(0);
                        if (settings.BilingualMonochromeHeader)
                            RenderCompanyHeader(column.Item(), settings, 7);
                        else
                        {
                            column.Item().AlignCenter().Text(settings.CompanyNameEn).FontSize(7).Bold();
                            column.Item().AlignCenter().Text(string.IsNullOrEmpty(HexaBill.Api.Core.Tenancy.SampleVatTrn.DocumentTrnDisplay(settings.CompanyTrn)) ? "" : $"TRN:{HexaBill.Api.Core.Tenancy.SampleVatTrn.DocumentTrnDisplay(settings.CompanyTrn)}").FontSize(5);
                        }
                        column.Item().AlignCenter().Text("TAX INV").FontSize(6).Bold();
                        column.Item().AlignCenter().Text($"{sale.InvoiceNo} {invoiceDateStr}").FontSize(5);
                        column.Item().Text($"Cust:{sale.CustomerName ?? "Cash"}").FontSize(5);
                        if (!string.IsNullOrEmpty(trnDisplay))
                            column.Item().Text($"TRN:{trnDisplay}").FontSize(4);
                        column.Item().PaddingVertical(0.5f).LineHorizontal(0.5f);

                        // Items table
                        column.Item().Table(t =>
                        {
                            t.ColumnsDefinition(c =>
                            {
                                c.RelativeColumn(3);       // Item
                                c.ConstantColumn(18);     // Qty
                                c.ConstantColumn(36);     // Total
                            });
                            t.Header(h =>
                            {
                                h.Cell().BorderBottom(0.5f).PaddingVertical(0.5f).PaddingHorizontal(0.5f).Text("Item").FontSize(5).Bold();
                                h.Cell().BorderBottom(0.5f).PaddingVertical(0.5f).PaddingHorizontal(0.5f).AlignRight().Text("Qty").FontSize(5).Bold();
                                h.Cell().BorderBottom(0.5f).PaddingVertical(0.5f).PaddingHorizontal(0.5f).AlignRight().Text("Total").FontSize(5).Bold();
                            });
                            if (sale.Items != null)
                                foreach (var item in sale.Items)
                                {
                                    t.Cell().BorderBottom(0.2f).PaddingVertical(0.5f).PaddingHorizontal(0.5f).Text(item.ProductName ?? "").FontSize(5);
                                    t.Cell().BorderBottom(0.2f).PaddingVertical(0.5f).PaddingHorizontal(0.5f).AlignRight().Text(item.Qty.ToString("0.##")).FontSize(5);
                                    t.Cell().BorderBottom(0.2f).PaddingVertical(0.5f).PaddingHorizontal(0.5f).AlignRight().Text(item.LineTotal.ToString("0.00")).FontSize(5);
                                }
                        });
                        column.Item().PaddingTop(0.5f).LineHorizontal(0.5f);
                        // Compact summary: label:value together, right-aligned - no gap
                        column.Item().Column(sumCol =>
                        {
                            sumCol.Item().AlignRight().Text($"Sub: {sale.Subtotal.ToString("0.00")}").FontSize(5);
                            sumCol.Item().AlignRight().Text($"VAT5%: {sale.VatTotal.ToString("0.00")}").FontSize(5);
                            if (sale.RoundOff != 0)
                                sumCol.Item().AlignRight().Text($"Rnd: {sale.RoundOff.ToString("0.00")}").FontSize(5);
                            sumCol.Item().AlignRight().Text($"TOTAL: {sale.GrandTotal.ToString("0.00")} " + (settings.Currency ?? "AED")).FontSize(6).Bold();
                        });
                        column.Item().PaddingTop(0.5f).AlignCenter().Text("Thank you").FontSize(4);
                    });
                });
            });
            return document.GeneratePdf();
        }

        public async Task<byte[]> GenerateCombinedInvoicePdfAsync(List<SaleDto> sales)
        {
            try
            {
                _logger.LogInformation($"?? Generating combined PDF for {sales.Count} invoices");
                
                if (sales == null || !sales.Any())
                {
                    throw new InvalidOperationException("No sales provided for combined PDF generation.");
                }
                
                if (sales.Any(s => s.OwnerId != sales[0].OwnerId))
                    throw new InvalidOperationException("Invoices from different workspaces cannot be combined.");
                var settings = await GetCompanySettingsAsync(sales[0].OwnerId);
                
                // PROD-10: Pre-fetch all customer TRNs to avoid blocking .Result calls in synchronous context
                var customerTrnMap = new Dictionary<int?, string>();
                foreach (var sale in sales)
                {
                    if (sale.CustomerId.HasValue && !customerTrnMap.ContainsKey(sale.CustomerId))
                    {
                        var customerTrn = await GetCustomerTrnAsync(sale.CustomerId, sale.OwnerId);
                        customerTrnMap[sale.CustomerId] = customerTrn ?? "";
                    }
                }
                
                var document = Document.Create(container =>
                {
                    foreach (var sale in sales)
                    {
                        var customerTrn = sale.CustomerId.HasValue && customerTrnMap.TryGetValue(sale.CustomerId, out var trn) ? trn : null;
                        
                        container.Page(page =>
                        {
                            page.Size(PageSizes.A4);
                            page.Margin(10, Unit.Millimetre);
                            page.PageColor(Colors.White);
                            page.DefaultTextStyle(x => x.FontSize(11f));

                            page.Footer().Column(footerCol =>
                            {
                                footerCol.Item().AlignRight().PaddingRight(10).PaddingBottom(5).Text(text =>
                                {
                                    text.Span("Page ").FontSize(8).FontColor(Colors.Grey.Darken1);
                                    text.CurrentPageNumber().FontSize(8).FontColor(Colors.Grey.Darken1);
                                    text.Span(" of ").FontSize(8).FontColor(Colors.Grey.Darken1);
                                    text.TotalPages().FontSize(8).FontColor(Colors.Grey.Darken1);
                                });
                            });

                            page.Content().Column(column =>
                            {
                                RenderInvoiceContent(column, sale, settings, customerTrn);
                            });
                        });
                    }
                });

                _logger.LogInformation("   Combined PDF document created successfully, generating bytes...");
                byte[] pdfBytes;
                try
                {
                    pdfBytes = document.GeneratePdf();
                    _logger.LogInformation($"? Combined PDF generated: {pdfBytes.Length} bytes");
                }
                catch (Exception pdfEx)
                {
                    _logger.LogError(pdfEx, "Combined PDF Generation Failed: {Message}", pdfEx.Message);
                    throw new InvalidOperationException($"Failed to generate combined PDF: {pdfEx.Message}", pdfEx);
                }
                
                if (pdfBytes == null || pdfBytes.Length == 0)
                {
                    throw new InvalidOperationException("Combined PDF generation returned empty bytes");
                }
                
                return pdfBytes;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Combined PDF Generation Error: {Message}", ex.Message);
                throw;
            }
        }

        internal static byte[]? MonochromeLogo(byte[]? bytes)
        {
            if (bytes == null || bytes.Length == 0) return null;
            using var image = SixLabors.ImageSharp.Image.Load(bytes);
            image.Mutate(x => x.Grayscale());
            using var output = new MemoryStream();
            SixLabors.ImageSharp.ImageExtensions.SaveAsPng(image, output);
            return output.ToArray();
        }

        /// <summary>
        /// Honest VAT line for bilingual headers. Never prints Corporate Tax as VAT.
        /// Empty → "To be provided"; sample → SAMPLE prefix; real → digits.
        /// </summary>
        private static string VatTrnLineForHeader(string? vatTrn)
        {
            if (string.IsNullOrWhiteSpace(vatTrn))
                return "VAT TRN: To be provided";
            var display = HexaBill.Api.Core.Tenancy.SampleVatTrn.DocumentTrnDisplay(vatTrn);
            if (string.IsNullOrEmpty(display))
                return "VAT TRN: To be provided";
            return $"VAT TRN: {display}";
        }

        /// <summary>
        /// Bilingual monochrome letterhead: English left (~35%), logo center (~30%), RTL Arabic right (~35%).
        /// CT Reg and VAT TRN are separate lines (never joined with "|"). Logo column has no TRN.
        /// </summary>
        /// <param name="a4Letterhead">True for A4/A5 full invoice headers (larger logo/type). False for thermal/compact.</param>
        /// <param name="dateLine">When set, DATE is drawn lower-right under the three columns (A4 bilingual).</param>
        private void RenderCompanyHeader(
            IContainer container,
            InvoiceTemplateService.CompanySettings settings,
            float fontSize,
            bool a4Letterhead = false,
            string? dateLine = null)
        {
            container.DefaultTextStyle(x => x.FontColor(Colors.Black)).Column(column =>
            {
                column.Spacing(1);
                var logo = MonochromeLogo(settings.LogoImageBytes);
                var nameSize = a4Letterhead ? 15.5f : Math.Max(8f, fontSize);
                var detailSize = a4Letterhead ? 8f : Math.Max(5f, fontSize - 3f);
                var taxSize = a4Letterhead ? 7.5f : Math.Max(5f, detailSize - 0.5f);
                var logoW = a4Letterhead ? 140f : (fontSize <= 9 ? 40f : 72f);
                var logoH = a4Letterhead ? 100f : (fontSize <= 9 ? 22f : 40f);
                var logoColW = a4Letterhead ? 148f : (fontSize <= 9 ? 52f : 88f);
                var (title, subtitle) = SplitCompanyNameLines(settings.CompanyNameEn);
                if (string.IsNullOrWhiteSpace(title))
                    title = settings.CompanyNameEn ?? "";

                column.Item().Row(row =>
                {
                    row.RelativeItem(35).AlignLeft().Column(en =>
                    {
                        en.Spacing(1);
                        en.Item().Text(title.ToUpperInvariant()).FontFamily(_englishFont).FontSize(nameSize).Bold();
                        if (!string.IsNullOrWhiteSpace(subtitle))
                            en.Item().Text(subtitle.ToUpperInvariant()).FontFamily(_englishFont).FontSize(a4Letterhead ? 8.5f : detailSize).SemiBold();
                        if (!string.IsNullOrWhiteSpace(settings.CompanyPhone))
                            en.Item().PaddingTop(1).Text($"Mob: {settings.CompanyPhone}").FontFamily(_englishFont).FontSize(detailSize);
                        if (!string.IsNullOrWhiteSpace(settings.CompanyEmail))
                            en.Item().Text(settings.CompanyEmail).FontFamily(_englishFont).FontSize(detailSize);
                        if (!string.IsNullOrWhiteSpace(settings.CompanyAddress))
                            en.Item().Text(settings.CompanyAddress).FontFamily(_englishFont).FontSize(detailSize);
                        // CT and VAT on separate lines — never "CT | VAT" on one wrapping row.
                        if (!string.IsNullOrWhiteSpace(settings.CorporateTaxTrn))
                            en.Item().PaddingTop(2).Text($"CT Reg. No.: {settings.CorporateTaxTrn.Trim()}")
                                .FontFamily(_englishFont).FontSize(taxSize);
                        en.Item().PaddingTop(2).Text(VatTrnLineForHeader(settings.CompanyTrn))
                            .FontFamily(_englishFont).FontSize(taxSize);
                    });

                    row.ConstantItem(logoColW).AlignCenter().AlignMiddle().Column(c =>
                    {
                        if (logo != null)
                            c.Item().AlignCenter().Width(logoW).Height(logoH).Image(logo).FitArea();
                        else
                            c.Item().Height(4);
                    });

                    row.RelativeItem(35).AlignRight().Column(ar =>
                    {
                        ar.Spacing(1);
                        if (!string.IsNullOrWhiteSpace(settings.CompanyNameAr))
                            ar.Item().AlignRight().Text(settings.CompanyNameAr).FontFamily(_arabicFont)
                                .FontSize(a4Letterhead ? 14f : nameSize).Bold().DirectionFromRightToLeft();
                        if (!string.IsNullOrWhiteSpace(settings.CompanyPhone))
                            ar.Item().PaddingTop(1).AlignRight().Text(settings.CompanyPhone).FontFamily(_arabicFont)
                                .FontSize(detailSize).DirectionFromRightToLeft();
                        if (!string.IsNullOrWhiteSpace(settings.CompanyEmail) && a4Letterhead)
                            ar.Item().AlignRight().Text(settings.CompanyEmail).FontFamily(_arabicFont)
                                .FontSize(detailSize).DirectionFromRightToLeft();
                        if (!string.IsNullOrWhiteSpace(settings.CompanyAddress))
                            ar.Item().AlignRight().Text(settings.CompanyAddress).FontFamily(_arabicFont)
                                .FontSize(detailSize).DirectionFromRightToLeft();
                    });
                });

                if (!string.IsNullOrWhiteSpace(dateLine))
                    column.Item().PaddingTop(2).AlignRight().Text(dateLine).FontFamily(_englishFont).FontSize(a4Letterhead ? 8f : 7f);

                column.Item().PaddingTop(2).LineHorizontal(0.8f).LineColor(Colors.Black);
            });
        }

        private void RenderInvoiceContent(ColumnDescriptor column, SaleDto sale, InvoiceTemplateService.CompanySettings settings, string? customerTrn = null)
        {
            var trnDisplay = string.IsNullOrWhiteSpace(customerTrn) ? "" : customerTrn;
            column.Spacing(0);

            // Bilingual letterhead is taller; avoid outer Border (blocks table page-break) so combined PDF can paginate.
            if (settings.BilingualMonochromeHeader)
                column.Item().Padding(4).Column(innerColumn => RenderInvoiceContentBody(innerColumn, sale, settings, trnDisplay));
            else
                column.Item().Border(2).Padding(8).Column(innerColumn => RenderInvoiceContentBody(innerColumn, sale, settings, trnDisplay));
        }

        private void RenderInvoiceContentBody(ColumnDescriptor innerColumn, SaleDto sale, InvoiceTemplateService.CompanySettings settings, string trnDisplay)
        {
                innerColumn.Spacing(0);

                if (settings.BilingualMonochromeHeader)
                {
                    RenderCompanyHeader(
                        innerColumn.Item(),
                        settings,
                        14,
                        a4Letterhead: true,
                        dateLine: $"DATE: {FormatInvoiceDate(sale.InvoiceDate, settings)}");
                }
                else
                {
                // Starplus-style header: 3 columns when logo present, else centred text
                var hasLogo = settings.LogoImageBytes != null && settings.LogoImageBytes.Length > 0;
if (hasLogo)
                    {
                        innerColumn.Item().Row(headerRow =>
                        {
                            headerRow.ConstantItem(140).AlignCenter().AlignMiddle().Column(col =>
                            {
                                col.Item().Width(160).Height(80).Image(settings.LogoImageBytes!).FitArea();
                            });
                        headerRow.RelativeItem().AlignCenter().AlignMiddle().Column(col =>
                        {
                            col.Item().Text(settings.CompanyNameEn.ToUpper()).FontSize(16).Bold().AlignCenter();
                            col.Item().PaddingTop(1).Text(settings.CompanyNameAr).FontSize(10).AlignCenter();
                            var contactInfo = $"Mob : {settings.CompanyPhone}, {settings.CompanyAddress}";
                            col.Item().PaddingTop(1).Text(contactInfo).FontSize(9).AlignCenter();
                        });
                        headerRow.ConstantItem(140).AlignRight().AlignMiddle().Column(col =>
                        {
                            col.Item().Text(string.IsNullOrEmpty(HexaBill.Api.Core.Tenancy.SampleVatTrn.DocumentTrnDisplay(settings.CompanyTrn)) ? "" : $"TRN : No : {HexaBill.Api.Core.Tenancy.SampleVatTrn.DocumentTrnDisplay(settings.CompanyTrn)}").FontSize(9);
                            col.Item().PaddingTop(2).AlignRight().Text($"DATE : {FormatInvoiceDate(sale.InvoiceDate, settings)}").FontSize(9);
                        });
                    });
                }
                else
                {
                    innerColumn.Item().Text(settings.CompanyNameEn.ToUpper())
                        .FontSize(18).Bold().AlignCenter();
                    innerColumn.Item().PaddingTop(2).Text(settings.CompanyNameAr)
                        .FontSize(10).AlignCenter();
                    var contactInfo = $"Mob : {settings.CompanyPhone}, {settings.CompanyAddress}";
                    innerColumn.Item().PaddingTop(2).Text(contactInfo).FontSize(9).AlignCenter();
                    innerColumn.Item().PaddingTop(2).Row(trnDateRow =>
                    {
                        trnDateRow.RelativeItem().Text(string.IsNullOrEmpty(HexaBill.Api.Core.Tenancy.SampleVatTrn.DocumentTrnDisplay(settings.CompanyTrn)) ? "" : $"TRN : No : {HexaBill.Api.Core.Tenancy.SampleVatTrn.DocumentTrnDisplay(settings.CompanyTrn)}").FontSize(9);
                        trnDateRow.RelativeItem().AlignRight().Text($"DATE : {FormatInvoiceDate(sale.InvoiceDate, settings)}").FontSize(9);
                    });
                }

                }

                innerColumn.Item().PaddingTop(4).BorderTop(1).BorderBottom(1).PaddingVertical(3)
                    .Text(HexaBill.Api.Core.Tenancy.SampleVatTrn.DocumentTitle(settings.CompanyTrn))
                    .FontSize(settings.BilingualMonochromeHeader ? 11.5f : 14)
                    .Bold()
                    .AlignCenter();

                // Meta: invoice + customer TRN on one baseline; DATE already in letterhead for bilingual.
                if (settings.BilingualMonochromeHeader)
                {
                    innerColumn.Item().PaddingTop(4).Row(meta =>
                    {
                        meta.RelativeItem().AlignLeft().Text($"INVOICE : NO : {sale.InvoiceNo}").FontSize(8.5f).Bold();
                        // Omit the customer TRN label for unregistered customers instead of printing an empty value.
                        if (!string.IsNullOrWhiteSpace(trnDisplay))
                            meta.RelativeItem().AlignRight().Text($"CUSTOMER TRN : NO : {trnDisplay}").FontSize(8.5f).Bold();
                        else
                            meta.RelativeItem();
                    });
                    var customerDisplayName = string.IsNullOrWhiteSpace(sale.CustomerName) ? "Cash Customer" : sale.CustomerName;
                    innerColumn.Item().PaddingTop(2).AlignLeft().Text($"Customer Name : {customerDisplayName}").FontSize(8.5f).Bold();
                }
                else
                {
                    innerColumn.Item().PaddingTop(5).Table(metaTable =>
                    {
                        metaTable.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn();
                            columns.RelativeColumn();
                            columns.RelativeColumn();
                        });

                        metaTable.Cell().Padding(3).Text($"INVOICE : NO : {sale.InvoiceNo}").FontSize(9).Bold();
                        metaTable.Cell().Padding(3).AlignCenter().Text($"DATE : {FormatInvoiceDate(sale.InvoiceDate, settings)}").FontSize(9).Bold();
                        metaTable.Cell().Padding(3).AlignRight().Text($"CUSTOMER TRN : NO : {trnDisplay}").FontSize(9).Bold();

                        var customerDisplayName = string.IsNullOrWhiteSpace(sale.CustomerName) ? "Cash Customer" : sale.CustomerName;
                        metaTable.Cell().ColumnSpan(3).Padding(3).Text($"Customer Name : {customerDisplayName}").FontSize(9).Bold();
                    });
                }

                innerColumn.Item().PaddingTop(3).Border(1).Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        columns.RelativeColumn(6);
                        columns.RelativeColumn(35);
                        columns.RelativeColumn(8);
                        columns.RelativeColumn(8);
                        columns.RelativeColumn(12);
                        columns.RelativeColumn(11);
                        columns.RelativeColumn(9);
                        columns.RelativeColumn(11);
                    });

                    table.Header(header =>
                    {
                        void AddHeader(string eng, string arabic = "")
                        {
                            header.Cell().Border(1).Background(Colors.White).PaddingVertical(2).PaddingHorizontal(1).Column(col =>
                            {
                                if (!string.IsNullOrEmpty(arabic))
                                {
                                    col.Item().AlignCenter().Text(arabic).FontSize(7).Bold().FontFamily(_arabicFont).DirectionFromRightToLeft();
                                }
                                col.Item().AlignCenter().Text(eng).FontSize(7.5f).Bold();
                            });
                        }

                        AddHeader("SL.No", "ر.م");
                        AddHeader("Description", "الوصف");
                        AddHeader("Unit", "الوحدة");
                        AddHeader("Qty", "الكمية");
                        AddHeader("Unit Price", "سعر الوحدة");
                        AddHeader("Total", "الإجمالي");
                        AddHeader("Vat:5%", "ض.ق.م ٥٪");
                        AddHeader("Amount", "المبلغ");
                    });

                    int itemCount = sale.Items != null ? sale.Items.Count : 0;
                    if (itemCount > 0 && sale.Items != null)
                    {
                        for (int i = 0; i < itemCount; i++)
                        {
                            var item = sale.Items[i];
                            var unitTypeText = string.IsNullOrWhiteSpace(item.UnitType) ? "CRTN" : item.UnitType.ToUpperInvariant();

                            table.Cell().Border(1).PaddingVertical(2).PaddingHorizontal(1).AlignCenter().Text((i + 1).ToString()).FontSize(8f);
                            table.Cell().Border(1).PaddingVertical(2).PaddingHorizontal(2).AlignLeft().Text(item.ProductName ?? "").FontSize(8f);
                            // Unit then Qty (headers order) — was swapped previously.
                            table.Cell().Border(1).PaddingVertical(2).PaddingHorizontal(1).AlignCenter().Text(unitTypeText).FontSize(8f);
                            table.Cell().Border(1).PaddingVertical(2).PaddingHorizontal(1).AlignCenter().Text(item.Qty.ToString("0.##")).FontSize(8f);
                            table.Cell().Border(1).PaddingVertical(2).PaddingHorizontal(1).AlignRight().Text(item.UnitPrice.ToString("N2")).FontSize(8f);
                            var lineNet = item.Qty * item.UnitPrice;
                            table.Cell().Border(1).PaddingVertical(2).PaddingHorizontal(1).AlignRight().Text(lineNet.ToString("N2")).FontSize(8f);
                            table.Cell().Border(1).PaddingVertical(2).PaddingHorizontal(1).AlignRight().Text(item.VatAmount.ToString("N2")).FontSize(8f);
                            table.Cell().Border(1).PaddingVertical(2).PaddingHorizontal(1).AlignRight().Text(item.LineTotal.ToString("N2")).FontSize(8f);
                        }
                    }

                    // Spacer row for short invoices — blank cells only (no fake 0.00 amounts).
                    int maxTotalRows = settings.BilingualMonochromeHeader ? 6 : 16;
                    int emptyRowsNeeded = Math.Max(0, maxTotalRows - itemCount);
                    for (int i = 0; i < emptyRowsNeeded; i++)
                    {
                        for (int c = 0; c < 8; c++)
                            table.Cell().BorderLeft(1).BorderRight(1).MinHeight(14).Text("");
                    }

                    table.Cell().ColumnSpan(7).Border(1).MinHeight(20).PaddingVertical(2).PaddingHorizontal(2).Row(row =>
                    {
                        row.AutoItem().Text("INV.Amount").FontSize(8).Bold();
                        row.RelativeItem();
                        row.AutoItem().Text("مبلغ الفاتورة").FontSize(7).FontFamily(_arabicFont).DirectionFromRightToLeft();
                    });
                    table.Cell().Border(1).MinHeight(20).PaddingVertical(2).PaddingHorizontal(1).AlignMiddle().AlignRight()
                        .Text(sale.Subtotal.ToString("N2")).FontSize(9).Bold();

                    table.Cell().ColumnSpan(7).Border(1).MinHeight(20).PaddingVertical(2).PaddingHorizontal(2).Row(row =>
                    {
                        row.AutoItem().Text("VAT 5%").FontSize(8).Bold();
                        row.RelativeItem();
                        row.AutoItem().Text("ضريبة القيمة المضافة").FontSize(7).FontFamily(_arabicFont).DirectionFromRightToLeft();
                    });
                    table.Cell().Border(1).MinHeight(20).PaddingVertical(2).PaddingHorizontal(1).AlignMiddle().AlignRight()
                        .Text(sale.VatTotal.ToString("N2")).FontSize(9).Bold();

                    if (sale.RoundOff != 0)
                    {
                        table.Cell().ColumnSpan(7).Border(1).MinHeight(18).PaddingVertical(2).PaddingHorizontal(2).Row(row =>
                        {
                            row.AutoItem().Text("Round Off").FontSize(8).Bold();
                            row.RelativeItem();
                            row.AutoItem().Text("تقريب").FontSize(7).FontFamily(_arabicFont).DirectionFromRightToLeft();
                        });
                        table.Cell().Border(1).MinHeight(18).PaddingVertical(2).PaddingHorizontal(1).AlignMiddle().AlignRight()
                            .Text((sale.RoundOff > 0 ? "+" : "") + sale.RoundOff.ToString("N2")).FontSize(9).Bold();
                    }

                    var amountInWordsBody = ConvertToWords(sale.GrandTotal);
                    if (amountInWordsBody.Length > 80)
                        amountInWordsBody = amountInWordsBody.Substring(0, 77) + "...";
                    table.Cell().ColumnSpan(7).Border(1).MinHeight(22).PaddingVertical(2).PaddingHorizontal(2).Text(text =>
                    {
                        text.Span("Total Amount ").FontSize(8).Bold();
                        text.Span("........ ").FontSize(7);
                        text.Span(amountInWordsBody).FontSize(7).Italic();
                        text.Span(" ........ ").FontSize(7);
                        text.Span("درهم فقط").FontSize(7).FontFamily(_arabicFont).DirectionFromRightToLeft();
                    });
                    table.Cell().Border(1).MinHeight(22).PaddingVertical(2).PaddingHorizontal(1).AlignMiddle().AlignRight()
                        .Text(sale.GrandTotal.ToString("N2")).FontSize(10).Bold();
                });

                innerColumn.Item().PaddingTop(4).Column(footerCol =>
                {
                    footerCol.Item().AlignLeft().Text("Received the above goods in good order").FontSize(7.5f);
                    footerCol.Item().PaddingTop(2).AlignLeft().Text("استلمنا البضاعة أعلاه بحالة جيدة")
                        .FontSize(7).FontFamily(_arabicFont).DirectionFromRightToLeft();

                    footerCol.Item().PaddingTop(10).Row(sigRow =>
                    {
                        sigRow.RelativeItem().AlignLeft().Column(sigCol =>
                        {
                            sigCol.Item().Text("Receiver's Name").FontSize(8);
                            sigCol.Item().PaddingTop(3).Text(new string('.', 40)).FontSize(8);
                            sigCol.Item().PaddingTop(10).Text("Receiver's Sign").FontSize(8);
                            sigCol.Item().PaddingTop(3).Text(new string('.', 40)).FontSize(8);
                        });
                        sigRow.RelativeItem().AlignRight().Column(sigCol =>
                        {
                            sigCol.Item().AlignRight().Text($"For {settings.CompanyNameEn}").FontSize(8);
                            sigCol.Item().PaddingTop(3).AlignRight().Text(new string('.', 40)).FontSize(8);
                        });
                    });
                });
        }

        private async Task<InvoiceTemplateService.CompanySettings> GetCompanySettingsAsync(int tenantId)
        {
            // DATA ISOLATION: Load company settings (and logo) for this tenant only. Invoice PDF uses sale.OwnerId so each tenant sees only their logo.
            var companySettings = await _settingsService.GetCompanySettingsAsync(tenantId);

            // Validate required settings are present
            if (string.IsNullOrWhiteSpace(companySettings.LegalNameEn))
            {
                _logger.LogWarning("Company LegalNameEn is empty for tenant {TenantId}", tenantId);
            }
            if (string.IsNullOrWhiteSpace(companySettings.VatNumber))
            {
                _logger.LogWarning("Company VatNumber is empty for tenant {TenantId}", tenantId);
            }

            var dto = new InvoiceTemplateService.CompanySettings
            {
                CompanyNameEn = companySettings.LegalNameEn ?? "Company Name",
                CompanyNameAr = companySettings.LegalNameAr ?? "",
                CompanyAddress = companySettings.Address ?? "",
                CompanyTrn = companySettings.VatNumber ?? "",
                CorporateTaxTrn = companySettings.CorporateTaxTrn ?? "",
                CompanyPhone = companySettings.Mobile ?? "",
                CompanyEmail = companySettings.Email,
                CompanyWebsite = companySettings.Website,
                BilingualMonochromeHeader = companySettings.BilingualMonochromeHeader,
                Currency = companySettings.Currency ?? "AED",
                VatPercent = companySettings.VatPercent,
                InvoicePrefix = companySettings.InvoicePrefix ?? "INV",
                VatEffectiveDate = companySettings.VatEffectiveDate ?? "",
                VatLegalText = companySettings.VatLegalText ?? "",
                LetterheadOnlyPrint = companySettings.LetterheadOnlyPrint,
                DocumentStampSignatureEnabled = companySettings.DocumentStampSignatureEnabled,
                PrintMarginTopMm = companySettings.LetterheadOnlyPrint ? companySettings.PrintMarginTopMm : 5f,
                PrintMarginBottomMm = companySettings.LetterheadOnlyPrint ? companySettings.PrintMarginBottomMm : 5f,
                StampWidthMm = companySettings.StampWidthMm,
                SignatureWidthMm = companySettings.SignatureWidthMm,
                StampAlignLeft = string.Equals(companySettings.StampAlign, "left", StringComparison.OrdinalIgnoreCase),
                StampOffsetRightMm = companySettings.StampOffsetRightMm,
                StampOffsetBottomMm = companySettings.StampOffsetBottomMm,
                SignatureOffsetRightMm = companySettings.SignatureOffsetRightMm,
                SignatureOffsetBottomMm = companySettings.SignatureOffsetBottomMm,
            };
            // Logo: read from storage using key stored in Settings (uploaded in Settings page). Per-tenant isolation via tenantId.
            if (!string.IsNullOrWhiteSpace(companySettings.LogoStorageKey))
            {
                try
                {
                    var logoBytes = await _storageService.ReadBytesAsync(companySettings.LogoStorageKey);
                    dto.LogoImageBytes = logoBytes;
                    _logger.LogInformation("Invoice PDF: logo loaded for tenant {TenantId}, {Bytes} bytes.", tenantId, logoBytes?.Length ?? 0);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Invoice PDF: logo load failed for tenant {TenantId}, key={Key}. Invoice will render with text-only header. On Render, set R2 storage (R2_ENDPOINT, R2_ACCESS_KEY, R2_SECRET_KEY) so logo persists across deploys.", tenantId, companySettings.LogoStorageKey);
                }
            }
            else if (!string.IsNullOrWhiteSpace(companySettings.LogoPath) && companySettings.LogoPath.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                    var uploadsPath = Path.Combine(webRoot, "uploads");
                    var relativePath = companySettings.LogoPath.TrimStart('/').Replace("uploads/", "", StringComparison.OrdinalIgnoreCase);
                    var fullPath = Path.Combine(uploadsPath, relativePath);
                    if (File.Exists(fullPath))
                    {
                        var logoBytes = await File.ReadAllBytesAsync(fullPath);
                        dto.LogoImageBytes = logoBytes;
                        _logger.LogInformation("Invoice PDF: logo loaded from legacy path for tenant {TenantId}, {Bytes} bytes.", tenantId, logoBytes.Length);
                    }
                    else
                        _logger.LogInformation("Invoice PDF: legacy logo file not found for tenant {TenantId} at {Path}. Header will be text-only.", tenantId, fullPath);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Invoice PDF: legacy logo load failed for tenant {TenantId}. Invoice will render with text-only header.", tenantId);
                }
            }
            else if (string.IsNullOrWhiteSpace(companySettings.LogoStorageKey) && string.IsNullOrWhiteSpace(companySettings.LogoPath))
            {
                _logger.LogInformation("Invoice PDF: no logo set for tenant {TenantId}. Header will be text-only.", tenantId);
            }
            else
            {
                _logger.LogInformation("Invoice PDF: logo not available for tenant {TenantId}. LogoStorageKey empty, LogoPath='{LogoPath}' (not a legacy /uploads/ path). Header will be text-only.", tenantId, companySettings.LogoPath ?? "");
            }

            // Fallback: logo from base64 in DB (survives container restarts)
            if (dto.LogoImageBytes == null || dto.LogoImageBytes.Length == 0)
            {
                var base64Setting = companySettings.LogoDataUri;
                if (!string.IsNullOrWhiteSpace(base64Setting) && base64Setting.Contains(",", StringComparison.Ordinal))
                {
                    var parts = base64Setting.Split(",", 2, StringSplitOptions.None);
                    if (parts.Length == 2)
                    {
                        try
                        {
                            dto.LogoImageBytes = Convert.FromBase64String(parts[1].Trim());
                            _logger.LogInformation("Invoice PDF: logo loaded from base64 DB fallback for tenant {TenantId}, {Bytes} bytes.", tenantId, dto.LogoImageBytes.Length);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Invoice PDF: base64 logo decode failed for tenant {TenantId}.", tenantId);
                        }
                    }
                }
            }

            if (dto.DocumentStampSignatureEnabled)
            {
                dto.StampImageBytes = await TryLoadAssetBytesAsync(tenantId, companySettings.StampStorageKey, "STAMP_BASE64_DATA_URI");
                dto.SignatureImageBytes = await TryLoadAssetBytesAsync(tenantId, companySettings.SignatureStorageKey, "SIGNATURE_BASE64_DATA_URI");
                var hasStamp = dto.StampImageBytes != null && dto.StampImageBytes.Length > 0;
                var hasSig = dto.SignatureImageBytes != null && dto.SignatureImageBytes.Length > 0;
                if (!hasStamp && !hasSig)
                {
                    _logger.LogWarning(
                        "PDF stamp/signature enabled for tenant {TenantId} but no image bytes loaded (stampKey={StampKey}, sigKey={SigKey}). Upload assets in Settings.",
                        tenantId,
                        companySettings.StampStorageKey ?? "(none)",
                        companySettings.SignatureStorageKey ?? "(none)");
                }
            }

            return dto;
        }

        private async Task<byte[]?> TryLoadAssetBytesAsync(int tenantId, string? storageKey, string base64SettingKey)
        {
            if (!string.IsNullOrWhiteSpace(storageKey))
            {
                try
                {
                    var bytes = await _storageService.ReadBytesAsync(storageKey);
                    if (bytes != null && bytes.Length > 0)
                        return bytes;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "PDF asset load failed for tenant {TenantId}, key={Key}", tenantId, storageKey);
                }
            }
            try
            {
                var base64Setting = await _settingsService.GetSettingValueAsync(tenantId, base64SettingKey);
                if (!string.IsNullOrWhiteSpace(base64Setting) && base64Setting.Contains(",", StringComparison.Ordinal))
                {
                    var parts = base64Setting.Split(",", 2, StringSplitOptions.None);
                    if (parts.Length == 2)
                        return Convert.FromBase64String(parts[1].Trim());
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "PDF asset base64 fallback failed for tenant {TenantId}, key={Key}", tenantId, base64SettingKey);
            }
            return null;
        }

        /// <summary>
        /// Unified print layout: layout=body â†’ body only + letterhead clearances;
        /// layout=full or null/missing â†’ full digital header/footer + tight margins.
        /// </summary>
        private static void ApplyPrintLayout(InvoiceTemplateService.CompanySettings settings, string? layout)
        {
            var layoutNorm = (layout ?? "full").Trim().ToLowerInvariant();
            if (layoutNorm != "body" && layoutNorm != "full")
                layoutNorm = "full";

            if (layoutNorm == "body")
            {
                settings.LetterheadOnlyPrint = true;
                settings.PrintMarginTopMm = Math.Max(settings.PrintMarginTopMm, 42f);
                settings.PrintMarginBottomMm = Math.Max(settings.PrintMarginBottomMm, 22f);
            }
            else
            {
                settings.LetterheadOnlyPrint = false;
                settings.PrintMarginTopMm = 5f;
                settings.PrintMarginBottomMm = 5f;
            }
        }

        /// <summary>Backward-compatible alias â€” prefers ApplyPrintLayout.</summary>
        private static void ApplyInvoiceLayoutOverride(InvoiceTemplateService.CompanySettings settings, string? layout)
            => ApplyPrintLayout(settings, layout);

        private static void ApplyDocumentPageMargins(PageDescriptor page, InvoiceTemplateService.CompanySettings settings, float fallbackMm = 5f)
        {
            // Full digital: tight margins only â€” never apply letterhead 42/52mm top.
            // Body/letterhead: reserve stamp clearance so overlay does not collide with content.
            var top = settings.LetterheadOnlyPrint ? Math.Max(settings.PrintMarginTopMm, 5f) : fallbackMm;
            float stampClearance = 0f;
            if (settings.LetterheadOnlyPrint && HasStampOrSignature(settings))
            {
                var stampH = settings.StampImageBytes != null && settings.StampImageBytes.Length > 0
                    ? CapStampMm(settings.StampWidthMm) : 0f;
                var sigH = settings.SignatureImageBytes != null && settings.SignatureImageBytes.Length > 0
                    ? Math.Max(CapStampMm(settings.SignatureWidthMm) * 0.55f, 10f) : 0f;
                stampClearance = Math.Max(
                    stampH + Math.Min(Math.Max(0f, settings.StampOffsetBottomMm), 18f),
                    sigH + Math.Min(Math.Max(0f, settings.SignatureOffsetBottomMm), 14f)) + 4f;
                // Ceiling matches CapStampMm (44) + modest offset so larger stamp is not clipped.
                stampClearance = Math.Min(Math.Max(stampClearance, 22f), 48f);
            }
            var bottom = settings.LetterheadOnlyPrint
                ? Math.Max(settings.PrintMarginBottomMm, stampClearance > 0 ? stampClearance : 5f)
                : fallbackMm;
            page.MarginTop(top, Unit.Millimetre);
            page.MarginBottom(bottom, Unit.Millimetre);
            page.MarginLeft(fallbackMm, Unit.Millimetre);
            page.MarginRight(fallbackMm, Unit.Millimetre);
        }

        private static bool HasStampOrSignature(InvoiceTemplateService.CompanySettings settings) =>
            settings.DocumentStampSignatureEnabled &&
            ((settings.StampImageBytes != null && settings.StampImageBytes.Length > 0)
             || (settings.SignatureImageBytes != null && settings.SignatureImageBytes.Length > 0));

        /// <summary>Cap digital stamp size â€” allow readable ~44mm without crushing A4 or forcing blank page 2.</summary>
        private static float CapStampMm(float mm) => Math.Min(Math.Max(mm, 8f), 44f);

        private static bool IsZayogaBrand(InvoiceTemplateService.CompanySettings? settings) =>
            settings != null &&
            (settings.CompanyNameEn ?? "").Contains("ZAYOGA", StringComparison.OrdinalIgnoreCase);

        private static (string Title, string Subtitle) SplitCompanyNameLines(string? name)
        {
            var n = (name ?? "").Trim();
            if (string.IsNullOrEmpty(n)) return ("", "");
            var soleIdx = n.IndexOf("SOLE", StringComparison.OrdinalIgnoreCase);
            if (soleIdx > 0)
                return (n[..soleIdx].Trim(), n[soleIdx..].Trim());
            var gtIdx = n.IndexOf("GENERAL TRADING", StringComparison.OrdinalIgnoreCase);
            if (gtIdx >= 0)
            {
                var end = gtIdx + "GENERAL TRADING".Length;
                return (n[..end].Trim(), n[end..].Trim());
            }
            return (n, "");
        }

        /// <summary>Zayoga orange bilingual letterhead header (full PDF only). Matches client stationery spirit.</summary>
        private void RenderOrangeLetterheadHeader(ColumnDescriptor col, InvoiceTemplateService.CompanySettings settings, bool compact = false)
        {
            var orange = Color.FromHex("#E67E22");
            var (title, subtitle) = SplitCompanyNameLines(settings.CompanyNameEn);
            if (string.IsNullOrWhiteSpace(title))
                title = settings.CompanyNameEn ?? "ZAYOGA";
            var titleSize = compact ? 8.5f : 10.5f;
            var subSize = compact ? 6.5f : 7.5f;
            var contactSize = compact ? 6f : 7f;
            var logoW = compact ? 52f : 70f;
            var logoH = compact ? 36f : 48f;
            var hasLogo = settings.LogoImageBytes != null && settings.LogoImageBytes.Length > 0;

            col.Item().Row(row =>
            {
                row.RelativeItem().Column(c =>
                {
                    c.Item().Text(title.ToUpperInvariant()).Bold().FontColor(orange).FontSize(titleSize);
                    if (!string.IsNullOrWhiteSpace(subtitle))
                        c.Item().Text(subtitle.ToUpperInvariant()).FontColor(orange).FontSize(subSize);
                    c.Item().PaddingTop(2).LineHorizontal(0.8f).LineColor(orange);
                    if (!string.IsNullOrWhiteSpace(settings.CompanyPhone))
                        c.Item().PaddingTop(3).Text($"Mob.: {settings.CompanyPhone}").FontColor(orange).FontSize(contactSize);
                    if (!string.IsNullOrWhiteSpace(settings.CompanyAddress))
                        c.Item().Text(settings.CompanyAddress).FontColor(orange).FontSize(contactSize);
                    if (!string.IsNullOrWhiteSpace(settings.CompanyWebsite))
                        c.Item().Text($"Web: {settings.CompanyWebsite}").FontColor(orange).FontSize(contactSize);
                    if (!string.IsNullOrWhiteSpace(settings.CompanyEmail))
                        c.Item().Text($"Email: {settings.CompanyEmail}").FontColor(orange).FontSize(contactSize);
                });

                row.ConstantItem(compact ? 70 : 90).AlignCenter().Column(c =>
                {
                    if (hasLogo)
                        c.Item().AlignCenter().Width(logoW).Height(logoH).Image(settings.LogoImageBytes!).FitArea();
                    else
                        c.Item().Height(compact ? 8 : 12);
                    if (!string.IsNullOrWhiteSpace(settings.CompanyTrn))
                        c.Item().PaddingTop(2).AlignCenter().Text(string.IsNullOrEmpty(HexaBill.Api.Core.Tenancy.SampleVatTrn.DocumentTrnDisplay(settings.CompanyTrn)) ? "" : $"TRN: {HexaBill.Api.Core.Tenancy.SampleVatTrn.DocumentTrnDisplay(settings.CompanyTrn)}")
                            .FontColor(orange).FontSize(contactSize);
                });

                row.RelativeItem().AlignRight().Column(c =>
                {
                    if (!string.IsNullOrWhiteSpace(settings.CompanyNameAr))
                    {
                        c.Item().AlignRight().Text(settings.CompanyNameAr).Bold().FontColor(orange)
                            .FontSize(compact ? 8.5f : 10f).FontFamily(_arabicFont).DirectionFromRightToLeft();
                    }
                    if (!string.IsNullOrWhiteSpace(settings.CompanyPhone))
                    {
                        c.Item().PaddingTop(2).AlignRight().Text(settings.CompanyPhone).FontColor(orange)
                            .FontSize(contactSize).FontFamily(_arabicFont).DirectionFromRightToLeft();
                    }
                    if (!string.IsNullOrWhiteSpace(settings.CompanyAddress))
                    {
                        c.Item().AlignRight().Text(settings.CompanyAddress).FontColor(orange)
                            .FontSize(contactSize).FontFamily(_arabicFont).DirectionFromRightToLeft();
                    }
                });
            });
            col.Item().PaddingTop(compact ? 2 : 4).LineHorizontal(1f).LineColor(orange);
        }

        /// <summary>Orange â€œFor ZAYOGAâ€ footer block for full digital PDFs.</summary>
        private static void RenderOrangeLetterheadFooter(ColumnDescriptor col, InvoiceTemplateService.CompanySettings settings)
        {
            var orange = Color.FromHex("#E67E22");
            var (_, subtitle) = SplitCompanyNameLines(settings.CompanyNameEn);
            var line2 = string.IsNullOrWhiteSpace(subtitle)
                ? "GENERAL TRADING SOLE PROPRIETORSHIP L.L.C"
                : subtitle.ToUpperInvariant();
            col.Item().LineHorizontal(1f).LineColor(orange);
            col.Item().PaddingTop(3).AlignRight().Column(c =>
            {
                c.Item().AlignRight().Text("For ZAYOGA").Bold().FontColor(orange).FontSize(10);
                c.Item().AlignRight().Text(line2).FontColor(orange).FontSize(7);
            });
        }

        /// <summary>Page header/footer chrome for full layout. Zayoga â†’ orange stationery; others unchanged (content branding).</summary>
        private void RenderFullPageLetterheadChrome(PageDescriptor page, InvoiceTemplateService.CompanySettings settings, bool compact = false)
        {
            if (settings.BilingualMonochromeHeader || settings.LetterheadOnlyPrint || !IsZayogaBrand(settings)) return;
            page.Header().Column(col => RenderOrangeLetterheadHeader(col, settings, compact));
            page.Footer().Column(col => RenderOrangeLetterheadFooter(col, settings));
        }

        /// <summary>Stamp/signature under signatory (avoids huge empty gap from page-bottom overlay).</summary>
        private static void RenderStampNearSignatory(ColumnDescriptor col, InvoiceTemplateService.CompanySettings settings)
        {
            if (!HasStampOrSignature(settings)) return;
            col.Item().PaddingTop(6).Row(row =>
            {
                if (settings.StampImageBytes != null && settings.StampImageBytes.Length > 0)
                {
                    var stampW = CapStampMm(settings.StampWidthMm);
                    row.ConstantItem(stampW + 4, Unit.Millimetre)
                        .Width(stampW, Unit.Millimetre)
                        .Height(stampW, Unit.Millimetre)
                        .Image(settings.StampImageBytes)
                        .FitArea();
                }
                if (settings.SignatureImageBytes != null && settings.SignatureImageBytes.Length > 0)
                {
                    var sigW = CapStampMm(settings.SignatureWidthMm);
                    row.ConstantItem(sigW + 4, Unit.Millimetre)
                        .AlignMiddle()
                        .Width(sigW, Unit.Millimetre)
                        .Height(sigW * 0.55f, Unit.Millimetre)
                        .Image(settings.SignatureImageBytes)
                        .FitArea();
                }
            });
        }

        /// <summary>
        /// Full-page foreground overlay: stamp + signature at bottom with independent mm offsets.
        /// Stamp width capped via CapStampMm. Prefer RenderStampNearSignatory for agreements/salary to avoid blank page 2.
        /// </summary>
        private static void RenderStampSignatureFooter(PageDescriptor page, InvoiceTemplateService.CompanySettings settings)
        {
            if (!HasStampOrSignature(settings)) return;

            var alignLeft = settings.StampAlignLeft;
            var stampBottom = Math.Min(Math.Max(0f, settings.StampOffsetBottomMm), 18f);
            var sigBottom = Math.Min(Math.Max(0f, settings.SignatureOffsetBottomMm), 14f);

            page.Foreground().Layers(layers =>
            {
                layers.PrimaryLayer();

                if (settings.StampImageBytes != null && settings.StampImageBytes.Length > 0)
                {
                    var stampW = CapStampMm(settings.StampWidthMm);
                    var layer = layers.Layer().AlignBottom();
                    layer = alignLeft ? layer.AlignLeft() : layer.AlignRight();
                    if (alignLeft)
                        layer = layer.PaddingLeft(Math.Max(0f, settings.StampOffsetRightMm), Unit.Millimetre);
                    else
                        layer = layer.PaddingRight(Math.Max(0f, settings.StampOffsetRightMm), Unit.Millimetre);
                    layer
                        .PaddingBottom(stampBottom, Unit.Millimetre)
                        .Width(stampW, Unit.Millimetre)
                        .Height(stampW, Unit.Millimetre)
                        .Image(settings.StampImageBytes)
                        .FitArea();
                }

                if (settings.SignatureImageBytes != null && settings.SignatureImageBytes.Length > 0)
                {
                    var sigW = CapStampMm(settings.SignatureWidthMm);
                    var sigH = Math.Max(sigW * 0.55f, 10f);
                    var layer = layers.Layer().AlignBottom();
                    layer = alignLeft ? layer.AlignLeft() : layer.AlignRight();
                    if (alignLeft)
                        layer = layer.PaddingLeft(Math.Max(0f, settings.SignatureOffsetRightMm), Unit.Millimetre);
                    else
                        layer = layer.PaddingRight(Math.Max(0f, settings.SignatureOffsetRightMm), Unit.Millimetre);
                    layer
                        .PaddingBottom(sigBottom, Unit.Millimetre)
                        .Width(sigW, Unit.Millimetre)
                        .Height(sigH, Unit.Millimetre)
                        .Image(settings.SignatureImageBytes)
                        .FitArea();
                }
            });
        }
        
        /// <summary>
        /// Format date according to company settings or default format
        /// </summary>
        private string FormatInvoiceDate(DateTime date, InvoiceTemplateService.CompanySettings? settings = null)
        {
            // Default format: dd-MM-yyyy (UAE standard)
            // Can be extended to use settings.DateFormat if added to CompanySettings
            return date.ToString("dd-MM-yyyy");
        }

        /// <summary>
        /// Shared report/document header. When BilingualMonochromeHeader: EN left / logo center / AR right.
        /// Legacy: logo left | company centre | date right.
        /// </summary>
        private void RenderCompanyHeader(ColumnDescriptor col, InvoiceTemplateService.CompanySettings settings, string? subtitle, string dateText)
        {
            if (settings.BilingualMonochromeHeader)
            {
                RenderCompanyHeader(col.Item(), settings, 11);
                col.Item().AlignRight().Text(dateText).FontSize(9);
            }
            else
            {
                var hasLogo = settings.LogoImageBytes != null && settings.LogoImageBytes.Length > 0;
                col.Item().Row(row =>
                {
                    if (hasLogo)
                        row.ConstantItem(80).AlignLeft().AlignMiddle().Width(80).Height(40).Image(settings.LogoImageBytes!).FitArea();
                    row.RelativeItem().AlignCenter().AlignMiddle().Column(centerCol =>
                    {
                        centerCol.Item().AlignCenter().Text(settings.CompanyNameEn ?? "Company").FontSize(10).Bold();
                        if (!string.IsNullOrWhiteSpace(settings.CompanyAddress))
                            centerCol.Item().AlignCenter().Text(settings.CompanyAddress).FontSize(8);
                        var trn = HexaBill.Api.Core.Tenancy.SampleVatTrn.DocumentTrnDisplay(settings.CompanyTrn);
                        if (!string.IsNullOrEmpty(trn))
                            centerCol.Item().AlignCenter().Text($"TRN: {trn}").FontSize(8);
                    });
                    row.ConstantItem(100).AlignRight().AlignMiddle().Text(dateText).FontSize(9);
                });
                col.Item().Height(3);
                col.Item().LineHorizontal(1).LineColor(Colors.Grey.Medium);
                col.Item().Height(2);
            }
            if (!string.IsNullOrWhiteSpace(subtitle))
                col.Item().Text(subtitle).FontSize(14).Bold().AlignCenter();
        }

        /// <summary>CRITICAL: Tenant-scoped to prevent cross-tenant data leakage.</summary>
        private async Task<string> GetCustomerTrnAsync(int? customerId, int tenantId)
        {
            if (!customerId.HasValue) return "";
            var customer = await _context.Customers
                .AsNoTracking()
                .Where(c => c.Id == customerId.Value && c.TenantId == tenantId)
                .Select(c => c.Trn)
                .FirstOrDefaultAsync();
            return customer ?? "";
        }

        /// <summary>
        /// CRITICAL: Get customer's pending balance info for invoice footer
        /// This is calculated in REAL-TIME from the database to ensure accuracy
        /// </summary>
        private async Task<CustomerPendingBalanceInfo> GetCustomerPendingBalanceInfoAsync(int? customerId, int tenantId)
        {
            if (!customerId.HasValue)
            {
                return new CustomerPendingBalanceInfo();
            }

            try
            {
                // VALIDATION: Get customer with owner check
                var customer = await _context.Customers
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.Id == customerId.Value && c.TenantId == tenantId);

                if (customer == null)
                {
                    return new CustomerPendingBalanceInfo();
                }

                // CRITICAL: Calculate REAL pending balance from database (matches CustomerService/BalanceService)
                // Formula: TotalSales - TotalPayments (cleared, excl refunds) - TotalSalesReturns + RefundsPaid
                var totalSales = await _context.Sales
                    .Where(s => s.CustomerId == customerId.Value 
                               && s.TenantId == tenantId 
                               && !s.IsDeleted)
                    .SumAsync(s => (decimal?)s.GrandTotal) ?? 0m;

                // Cleared payments only; exclude refund payments (SaleReturnId != null)
                var totalPayments = await _context.Payments
                    .Where(p => p.CustomerId == customerId.Value 
                               && p.TenantId == tenantId 
                               && p.Status == PaymentStatus.CLEARED 
                               && p.SaleReturnId == null)
                    .SumAsync(p => (decimal?)p.Amount) ?? 0m;

                var totalSalesReturns = await _context.SaleReturns
                    .Where(sr => sr.CustomerId == customerId.Value && sr.TenantId == tenantId)
                    .SumAsync(sr => (decimal?)sr.GrandTotal) ?? 0m;

                var refundsPaid = await _context.Payments
                    .Where(p => p.CustomerId == customerId.Value 
                               && p.TenantId == tenantId 
                               && p.SaleReturnId != null)
                    .SumAsync(p => (decimal?)p.Amount) ?? 0m;

                // Count of pending invoices
                var totalPendingBills = await _context.Sales
                    .Where(s => s.CustomerId == customerId.Value 
                               && s.TenantId == tenantId 
                               && !s.IsDeleted
                               && (s.PaymentStatus == SalePaymentStatus.Pending || s.PaymentStatus == SalePaymentStatus.Partial))
                    .CountAsync();

                // Pending balance = TotalSales - TotalPayments - TotalSalesReturns + RefundsPaid
                var totalBalanceDue = totalSales - totalPayments - totalSalesReturns + refundsPaid;

                _logger.LogInformation($"\n?? Customer Balance Calculation for Invoice Footer:");
                _logger.LogInformation($"   Customer ID: {customerId.Value}");
                _logger.LogInformation($"   Total Sales: {totalSales:N2}");
                _logger.LogInformation($"   Total Payments: {totalPayments:N2}");
                _logger.LogInformation($"   Returns: {totalSalesReturns:N2}, RefundsPaid: {refundsPaid:N2}");
                _logger.LogInformation($"   Pending Bills Count: {totalPendingBills}");
                _logger.LogInformation($"   Total Balance Due: {totalBalanceDue:N2}\n");

                return new CustomerPendingBalanceInfo
                {
                    CustomerId = customerId.Value,
                    CustomerName = customer.Name,
                    TotalPendingBills = totalPendingBills,
                    TotalSales = totalSales,
                    TotalPayments = totalPayments,
                    PreviousBalance = Math.Max(0, totalBalanceDue), // Show only if positive (owing)
                    TotalBalanceDue = Math.Max(0, totalBalanceDue)  // Never show negative
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calculating customer pending balance: {Message}", ex.Message);
                return new CustomerPendingBalanceInfo();
            }
        }

        /// <summary>
        /// DTO for customer pending balance information shown on invoice footer
        /// </summary>
        private class CustomerPendingBalanceInfo
        {
            public int CustomerId { get; set; }
            public string CustomerName { get; set; } = string.Empty;
            public int TotalPendingBills { get; set; }
            public decimal TotalSales { get; set; }
            public decimal TotalPayments { get; set; }
            public decimal PreviousBalance { get; set; }
            public decimal TotalBalanceDue { get; set; }
        }

        private async Task SavePdfToDiskAsync(SaleDto sale, byte[] pdfBytes)
        {
            try
            {
                if (pdfBytes == null || pdfBytes.Length == 0)
                {
                    _logger.LogInformation($"?? Cannot save PDF to disk: PDF bytes are empty for invoice {sale.InvoiceNo}");
                    return;
                }

                // Create invoices directory if it doesn't exist
                var invoicesDir = Path.Combine(Directory.GetCurrentDirectory(), "invoices");
                if (!Directory.Exists(invoicesDir))
                {
                    Directory.CreateDirectory(invoicesDir);
                    _logger.LogInformation($"?? Created invoices directory: {invoicesDir}");
                }

                // Save PDF file
                var fileName = $"INV-{sale.InvoiceNo}.pdf";
                var filePath = Path.Combine(invoicesDir, fileName);
                await System.IO.File.WriteAllBytesAsync(filePath, pdfBytes);
                
                // Verify file was saved
                if (System.IO.File.Exists(filePath))
                {
                    var fileInfo = new System.IO.FileInfo(filePath);
                    _logger.LogInformation($"?? PDF saved to disk: {fileName} ({fileInfo.Length} bytes)");
                }
                else
                {
                    _logger.LogInformation($"? PDF file not found after save attempt: {filePath}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save PDF to disk: {Message}", ex.Message);
                _logger.LogError("Stack Trace: {StackTrace}", ex.StackTrace);
                // Don't throw - PDF generation succeeded, just saving to disk failed
            }
        }

        /// <summary>CRITICAL: Tenant-scoped - must pass ownerId to prevent cross-tenant data leakage.</summary>
        private async Task<string?> GetCustomInvoiceTemplateAsync(int ownerId)
        {
            var setting = await _context.Settings
                .FirstOrDefaultAsync(s => s.Key == "INVOICE_TEMPLATE" && (s.OwnerId == ownerId || s.TenantId == ownerId));
            return setting?.Value;
        }

        private async Task<byte[]> GeneratePdfFromHtmlTemplateAsync(string htmlTemplate, SaleDto sale, InvoiceTemplateService.CompanySettings settings)
        {
            try
            {
                // Get customer TRN (tenant-scoped)
                var customerTrn = await GetCustomerTrnAsync(sale.CustomerId, sale.OwnerId);
                var trnDisplay = string.IsNullOrWhiteSpace(customerTrn) ? "" : customerTrn;

                // Replace template variables
                var processedHtml = htmlTemplate
                    .Replace("{{invoiceNo}}", sale.InvoiceNo)
                    .Replace("{{INVOICE_NO}}", sale.InvoiceNo)
                    .Replace("{{DATE}}", sale.InvoiceDate.ToString("dd-MM-yyyy"))
                    .Replace("{{date}}", sale.InvoiceDate.ToString("dd-MM-yyyy"))
                    .Replace("{{CUSTOMER_NAME}}", sale.CustomerName ?? "Cash Customer")
                    .Replace("{{customer_name}}", sale.CustomerName ?? "Cash Customer")
                    .Replace("{{CUSTOMER_TRN}}", trnDisplay)
                    .Replace("{{customer_trn}}", trnDisplay)
                    .Replace("{{company_name_en}}", settings.CompanyNameEn)
                    .Replace("{{company_name_ar}}", settings.CompanyNameAr)
                    .Replace("{{company_address}}", settings.CompanyAddress)
                    .Replace("{{company_phone}}", settings.CompanyPhone)
                    .Replace("{{company_trn}}", HexaBill.Api.Core.Tenancy.SampleVatTrn.DocumentTrnDisplay(settings.CompanyTrn) ?? "")
                    .Replace("{{currency}}", settings.Currency)
                    .Replace("{{SUBTOTAL}}", sale.Subtotal.ToString("N2"))
                    .Replace("{{subtotal}}", sale.Subtotal.ToString("N2"))
                    .Replace("{{VAT_TOTAL}}", sale.VatTotal.ToString("N2"))
                    .Replace("{{vat_total}}", sale.VatTotal.ToString("N2"))
                    .Replace("{{GRAND_TOTAL}}", sale.GrandTotal.ToString("N2"))
                    .Replace("{{grand_total}}", sale.GrandTotal.ToString("N2"));

                // Generate items rows HTML - Combined VAT and Amount in single column
                var itemsRowsHtml = "";
                int itemIndex = 1;
                foreach (var item in sale.Items)
                {
                    var lineNet = item.Qty * item.UnitPrice;
                    itemsRowsHtml += $@"
                <tr>
                    <td class=""text-center"">{itemIndex}</td>
                    <td style=""text-align:left; padding-left:4px;"">{item.ProductName ?? ""}</td>
                    <td class=""text-center"">{item.Qty.ToString("0.##")}</td>
                    <td class=""text-center"">{item.UnitType ?? ""}</td>
                    <td class=""text-right"">{item.UnitPrice.ToString("0.00")}</td>
                    <td class=""text-right"">{lineNet.ToString("0.00")}</td>
                    <td class=""text-right""><strong>{item.LineTotal.ToString("0.00")}</strong><br/><span style=""font-size:7pt;color:#666;"">(+{item.VatAmount.ToString("0.00")} VAT)</span></td>
                </tr>";
                    itemIndex++;
                }

                // Generate filler rows HTML (to make 16 total rows) - 7 columns to match
                int itemCount = sale.Items?.Count ?? 0;
                int targetRows = 16;
                int emptyRowsNeeded = Math.Max(0, targetRows - itemCount);
                var fillerRowsHtml = "";
                for (int i = 0; i < emptyRowsNeeded; i++)
                {
                    fillerRowsHtml += $@"
                <tr class=""empty-row"">
                    <td class=""text-center""></td>
                    <td style=""text-align:left;""></td>
                    <td class=""text-center""></td>
                    <td class=""text-center""></td>
                    <td class=""text-right""></td>
                    <td class=""text-right"">0.00</td>
                    <td class=""text-right"">0.00</td>
                </tr>";
                }

                // Replace items placeholder
                processedHtml = processedHtml.Replace("${ITEMS_ROWS}", itemsRowsHtml);
                processedHtml = processedHtml.Replace("{{#items}}", "").Replace("{{/items}}", "");
                processedHtml = processedHtml.Replace("{{items}}", itemsRowsHtml);
                
                // Replace filler rows placeholder
                processedHtml = processedHtml.Replace("{{#filler_rows}}", "").Replace("{{/filler_rows}}", "");
                processedHtml = processedHtml.Replace("{{filler_rows}}", fillerRowsHtml);

                // For now, use QuestPDF with HTML rendering, or fall back to default
                // TODO: Install a proper HTML-to-PDF library (e.g., DinkToPdf, PuppeteerSharp)
                // For now, we'll log a warning and use the default template
                _logger.LogInformation("?? Custom HTML template found but HTML-to-PDF conversion not fully implemented.");
                _logger.LogInformation("   Falling back to default QuestPDF template.");
                _logger.LogInformation("   To enable full HTML template support, install DinkToPdf or PuppeteerSharp package.");
                
                // Fall back to default template for now
                // In production, you would convert HTML to PDF here
                throw new NotImplementedException("HTML template support requires HTML-to-PDF library. Please use default template or install DinkToPdf/PuppeteerSharp.");
            }
            catch (NotImplementedException)
            {
                throw; // Re-throw to use fallback
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing HTML template: {Message}", ex.Message);
                throw; // Fall back to default template
            }
        }

        public async Task<byte[]> GenerateSalesLedgerPdfAsync(SalesLedgerReportDto ledgerReport, DateTime fromDate, DateTime toDate, int tenantId, string? filterNote = null)
        {
            try
            {
                var settings = await GetCompanySettingsAsync(tenantId);
                var headerSubtitle = $"Period: {fromDate:dd-MM-yyyy} to {toDate:dd-MM-yyyy}";
                if (!string.IsNullOrWhiteSpace(filterNote))
                    headerSubtitle = $"{headerSubtitle} | {filterNote}";
                
                var document = Document.Create(container =>
                {
                    container.Page(page =>
                    {
                        page.Size(PageSizes.A4.Landscape()); // Landscape for wide table
                        page.Margin(15, Unit.Millimetre);
                        page.PageColor(Colors.White);
                        page.DefaultTextStyle(x => x.FontSize(8));

                        // Header
                        page.Header().Column(headerCol =>
                        {
                            RenderCompanyHeader(headerCol, settings, "SALES LEDGER REPORT", headerSubtitle);
                            headerCol.Item().Height(5);
                        });

                        // Content
                        page.Content().PaddingVertical(5).Column(contentCol =>
                        {
                            // Summary Section
                            contentCol.Item().Table(summaryTable =>
                            {
                                summaryTable.ColumnsDefinition(columns =>
                                {
                                    columns.RelativeColumn(2.5f);
                                    columns.RelativeColumn(2.5f);
                                    columns.RelativeColumn(2.5f);
                                    columns.RelativeColumn(2.5f);
                                });

                                summaryTable.Cell().Border(1).Padding(4).Text("Total Sales").FontSize(9).Bold();
                                summaryTable.Cell().Border(1).Padding(4).Text("Total Payments").FontSize(9).Bold();
                            summaryTable.Cell().Border(1).Padding(4).Text("Total Real Pending").FontSize(9).Bold();
                            summaryTable.Cell().Border(1).Padding(4).Text("Total Real Got Payment").FontSize(9).Bold();

                                summaryTable.Cell().Border(1).Padding(4).AlignRight().Text(ledgerReport.Summary.TotalSales.ToString("N2")).FontSize(9);
                                summaryTable.Cell().Border(1).Padding(4).AlignRight().Text(ledgerReport.Summary.TotalPayments.ToString("N2")).FontSize(9);
                                summaryTable.Cell().Border(1).Padding(4).AlignRight().Text(ledgerReport.Summary.TotalDebit.ToString("N2")).FontSize(9);
                                summaryTable.Cell().Border(1).Padding(4).AlignRight().Text(ledgerReport.Summary.TotalCredit.ToString("N2")).FontSize(9);
                            });

                            contentCol.Item().Height(5);

                            // Ledger Table
                            contentCol.Item().Table(table =>
                            {
                                table.ColumnsDefinition(columns =>
                                {
                                    columns.RelativeColumn(1.2f);  // Date
                                    columns.RelativeColumn(0.8f);  // Type
                                    columns.RelativeColumn(1.2f);  // Invoice No
                                    columns.RelativeColumn(2f);    // Customer
                                    columns.RelativeColumn(1f);    // Payment Mode
                                    columns.RelativeColumn(1f);   // Real Pending
                                    columns.RelativeColumn(1f);   // Real Got Payment
                                    columns.RelativeColumn(0.8f);  // Status
                                    columns.RelativeColumn(1f);   // Plan Date
                                    columns.RelativeColumn(1.2f);  // Balance
                                });

                                // Header
                                table.Header(header =>
                                {
                                    header.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(3).Text("Date").FontSize(8).Bold();
                                    header.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(3).Text("Type").FontSize(8).Bold();
                                    header.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(3).Text("Invoice No").FontSize(8).Bold();
                                    header.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(3).Text("Customer").FontSize(8).Bold();
                                    header.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(3).Text("Payment Mode").FontSize(8).Bold();
                                    header.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(3).AlignRight().Text("Real Pending").FontSize(8).Bold();
                                    header.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(3).AlignRight().Text("Real Got Payment").FontSize(8).Bold();
                                    header.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(3).Text("Status").FontSize(8).Bold();
                                    header.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(3).Text("Plan Date").FontSize(8).Bold();
                                    header.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(3).AlignRight().Text("Balance").FontSize(8).Bold();
                                });

                                // Rows
                                foreach (var entry in ledgerReport.Entries)
                                {
                                    var rowBg = entry.Type == "Payment" ? Colors.Green.Lighten5 : Colors.White;
                                    
                                    table.Cell().Border(1).Background(rowBg).Padding(2).Text(entry.Date.ToString("dd-MM-yyyy")).FontSize(7);
                                    table.Cell().Border(1).Background(rowBg).Padding(2).Text(entry.Type).FontSize(7);
                                    table.Cell().Border(1).Background(rowBg).Padding(2).Text(entry.InvoiceNo).FontSize(7);
                                    table.Cell().Border(1).Background(rowBg).Padding(2).Text(entry.CustomerName ?? "Cash").FontSize(7);
                                    table.Cell().Border(1).Background(rowBg).Padding(2).Text(entry.PaymentMode ?? "-").FontSize(7);
                                    table.Cell().Border(1).Background(rowBg).Padding(2).AlignRight().Text(entry.RealPending > 0 ? entry.RealPending.ToString("N2") : "-").FontSize(7).FontColor(Colors.Red.Medium);
                                    table.Cell().Border(1).Background(rowBg).Padding(2).AlignRight().Text(entry.RealGotPayment > 0 ? entry.RealGotPayment.ToString("N2") : "-").FontSize(7).FontColor(Colors.Green.Medium);
                                    table.Cell().Border(1).Background(rowBg).Padding(2).Text(entry.Status).FontSize(7);
                                    table.Cell().Border(1).Background(rowBg).Padding(2).Text(entry.PlanDate?.ToString("dd-MM-yyyy") ?? "-").FontSize(7);
                                    table.Cell().Border(1).Background(rowBg).Padding(2).AlignRight().Text(entry.CustomerBalance.ToString("N2")).FontSize(7)
                                        .FontColor(entry.CustomerBalance < 0 ? Colors.Green.Medium : entry.CustomerBalance > 0 ? Colors.Red.Medium : Colors.Black);
                                }
                            });
                        });

                        // Footer
                        page.Footer().Column(footerCol =>
                        {
                            footerCol.Item().BorderTop(1).PaddingTop(3).Row(row =>
                            {
                                row.RelativeItem().Text($"Generated on {DateTime.Now:dd-MM-yyyy HH:mm}")
                                    .FontSize(7);
                                row.RelativeItem().AlignRight().Column(col =>
                                {
                                    col.Item().Text(text =>
                                    {
                                        text.Span("Page ").FontSize(7);
                                        text.CurrentPageNumber().FontSize(7).Bold();
                                        text.Span(" of ").FontSize(7);
                                        text.TotalPages().FontSize(7).Bold();
                                    });
                                });
                            });
                        });
                    });
                });

                return document.GeneratePdf();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Sales Ledger PDF Generation Error: {Message}", ex.Message);
                throw;
            }
        }

        // Gulf AED amount-in-words â€” shared helper
        private static string ConvertToWords(decimal amount) => HexaBill.Api.Core.Infrastructure.AmountToWords.Dirhams(amount);

        public async Task<byte[]> GeneratePendingBillsPdfAsync(List<PendingBillDto> pendingBills, DateTime fromDate, DateTime toDate, int tenantId)
        {
            try
            {
                var settings = await GetCompanySettingsAsync(tenantId);
                
                var document = Document.Create(container =>
                {
                    container.Page(page =>
                    {
                        page.Size(PageSizes.A4);
                        page.Margin(15, Unit.Millimetre);
                        page.PageColor(Colors.White);
                        
                        page.DefaultTextStyle(x => x.FontFamily(_englishFont).FontSize(10));

                        page.Content().Column(column =>
                        {
                            column.Item().Column(headerCol => RenderCompanyHeader(headerCol, settings, "PENDING BILLS REPORT", $"{fromDate:dd-MM-yyyy} to {toDate:dd-MM-yyyy}"));
                            column.Item().PaddingBottom(5).Text($"Generated: {DateTime.Now:dd-MM-yyyy HH:mm}").FontSize(9).FontColor(Colors.Grey.Medium);
                            // Table
                            column.Item().Table(table =>
                            {
                                table.ColumnsDefinition(columns =>
                                {
                                    columns.ConstantColumn(40); // Invoice No
                                    columns.RelativeColumn(2); // Customer
                                    columns.ConstantColumn(50); // Date
                                    columns.ConstantColumn(50); // Due Date
                                    columns.ConstantColumn(50); // Total
                                    columns.ConstantColumn(50); // Paid
                                    columns.ConstantColumn(50); // Balance
                                    columns.ConstantColumn(35); // Days Overdue
                                });
                                
                                // Header
                                table.Header(header =>
                                {
                                    header.Cell().Background(Colors.Blue.Darken2).Border(1).Padding(3).Text("Invoice").FontSize(8).Bold().FontColor(Colors.White);
                                    header.Cell().Background(Colors.Blue.Darken2).Border(1).Padding(3).Text("Customer").FontSize(8).Bold().FontColor(Colors.White);
                                    header.Cell().Background(Colors.Blue.Darken2).Border(1).Padding(3).Text("Invoice Date").FontSize(8).Bold().FontColor(Colors.White);
                                    header.Cell().Background(Colors.Blue.Darken2).Border(1).Padding(3).Text("Due Date").FontSize(8).Bold().FontColor(Colors.White);
                                    header.Cell().Background(Colors.Blue.Darken2).Border(1).Padding(3).AlignRight().Text("Total").FontSize(8).Bold().FontColor(Colors.White);
                                    header.Cell().Background(Colors.Blue.Darken2).Border(1).Padding(3).AlignRight().Text("Paid").FontSize(8).Bold().FontColor(Colors.White);
                                    header.Cell().Background(Colors.Blue.Darken2).Border(1).Padding(3).AlignRight().Text("Balance").FontSize(8).Bold().FontColor(Colors.White);
                                    header.Cell().Background(Colors.Blue.Darken2).Border(1).Padding(3).AlignCenter().Text("Overdue").FontSize(8).Bold().FontColor(Colors.White);
                                });
                                
                                // Rows
                                foreach (var bill in pendingBills)
                                {
                                    var rowBg = bill.DaysOverdue > 30 ? Colors.Red.Lighten4 
                                        : bill.DaysOverdue > 0 ? Colors.Orange.Lighten4 
                                        : Colors.White;
                                    
                                    table.Cell().Border(1).Background(rowBg).Padding(2).Text(bill.InvoiceNo ?? "-").FontSize(8);
                                    table.Cell().Border(1).Background(rowBg).Padding(2).Text(bill.CustomerName ?? "Cash Customer").FontSize(8);
                                    table.Cell().Border(1).Background(rowBg).Padding(2).Text(bill.InvoiceDate.ToString("dd-MM-yyyy")).FontSize(8);
                                    table.Cell().Border(1).Background(rowBg).Padding(2).Text(bill.DueDate?.ToString("dd-MM-yyyy") ?? "-").FontSize(8);
                                    table.Cell().Border(1).Background(rowBg).Padding(2).AlignRight().Text($"{bill.GrandTotal:N2}").FontSize(8);
                                    table.Cell().Border(1).Background(rowBg).Padding(2).AlignRight().Text($"{bill.PaidAmount:N2}").FontSize(8).FontColor(Colors.Green.Medium);
                                    table.Cell().Border(1).Background(rowBg).Padding(2).AlignRight().Text($"{bill.BalanceAmount:N2}").FontSize(8).Bold().FontColor(Colors.Red.Medium);
                                    table.Cell().Border(1).Background(rowBg).Padding(2).AlignCenter().Text(bill.DaysOverdue > 0 ? bill.DaysOverdue.ToString() : "-").FontSize(8).FontColor(bill.DaysOverdue > 30 ? Colors.Red.Darken1 : bill.DaysOverdue > 0 ? Colors.Orange.Darken1 : Colors.Grey.Medium);
                                }
                                
                                // Footer Totals
                                var totalGrand = pendingBills.Sum(b => b.GrandTotal);
                                var totalPaid = pendingBills.Sum(b => b.PaidAmount);
                                var totalBalance = pendingBills.Sum(b => b.BalanceAmount);
                                
                                table.Cell().ColumnSpan(4).Border(1).Background(Colors.Grey.Lighten3).Padding(3).AlignRight().Text("TOTAL:").FontSize(9).Bold();
                                table.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(3).AlignRight().Text($"{totalGrand:N2}").FontSize(9).Bold();
                                table.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(3).AlignRight().Text($"{totalPaid:N2}").FontSize(9).Bold().FontColor(Colors.Green.Medium);
                                table.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(3).AlignRight().Text($"{totalBalance:N2}").FontSize(9).Bold().FontColor(Colors.Red.Medium);
                                table.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(3).Text("");
                            });
                            
                            // Summary Stats
                            column.Item().PaddingTop(15).PaddingBottom(5).Row(row =>
                            {
                                row.RelativeItem().Text(text =>
                                {
                                    text.Span("Total Invoices: ").Bold();
                                    text.Span(pendingBills.Count.ToString());
                                });
                                
                                row.RelativeItem().Text(text =>
                                {
                                    text.Span("Overdue Invoices: ").Bold();
                                    text.Span(pendingBills.Count(b => b.DaysOverdue > 0).ToString()).FontColor(Colors.Red.Medium);
                                });
                                
                                row.RelativeItem().Text(text =>
                                {
                                    text.Span("Critical (>30 days): ").Bold();
                                    text.Span(pendingBills.Count(b => b.DaysOverdue > 30).ToString()).FontColor(Colors.Red.Darken1);
                                });
                            });
                        });
                        
                        page.Footer().AlignCenter().Text(x =>
                        {
                            x.CurrentPageNumber();
                            x.Span(" / ");
                            x.TotalPages();
                        });
                    });
                });
                
                return document.GeneratePdf();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating pending bills PDF: {Message}", ex.Message);
                _logger.LogInformation($"? Stack Trace: {ex.StackTrace}");
                throw;
            }
        }

        /// <summary>Monthly P&amp;L PDF for accountant (#58).</summary>
        public async Task<byte[]> GenerateProfitLossPdfAsync(ProfitReportDto report, DateTime fromDate, DateTime toDate, int tenantId)
        {
            try
            {
                var settings = await GetCompanySettingsAsync(tenantId);
                var currency = settings.Currency ?? "AED";
                var document = Document.Create(container =>
                {
                    container.Page(page =>
                    {
                        page.Size(PageSizes.A4);
                        page.Margin(15, Unit.Millimetre);
                        page.PageColor(Colors.White);
                        page.DefaultTextStyle(x => x.FontFamily(_englishFont).FontSize(10));
                        page.Content().Column(column =>
                        {
                            column.Item().Column(headerCol => RenderCompanyHeader(headerCol, settings, "Profit & Loss Statement", $"{fromDate:dd-MMM-yyyy} to {toDate:dd-MMM-yyyy}"));
                            column.Item().PaddingTop(6).Text("Estimate — not for filing").FontSize(9).Bold().FontColor(Colors.Grey.Darken2);
                            if (report.EstimatedCostLineCount > 0)
                                column.Item().PaddingTop(4).Text($"Estimated costs: {report.EstimatedCostLineCount} invoice lines have no saved historical cost. Current product costs are used and may change.").FontSize(9).FontColor(Colors.Orange.Darken3);
                            column.Item().PaddingTop(8).PaddingBottom(5).Text($"Generated: {DateTime.UtcNow:dd-MMM-yyyy HH:mm} UTC").FontSize(9).FontColor(Colors.Grey.Medium);
                            column.Item().PaddingTop(12).Table(table =>
                            {
                                table.ColumnsDefinition(columns => { columns.RelativeColumn(2); columns.ConstantColumn(90); });
                                table.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(4).Text("Total Sales").Bold();
                                table.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(4).AlignRight().Text($"{report.TotalSales:N2} {currency}");
                                table.Cell().Border(1).Padding(4).Text("Cost of Goods Sold");
                                table.Cell().Border(1).Padding(4).AlignRight().Text($"-{report.CostOfGoodsSold:N2} {currency}");
                                table.Cell().Border(1).Background(Colors.Green.Lighten4).Padding(4).Text("Gross Profit").Bold();
                                table.Cell().Border(1).Background(Colors.Green.Lighten4).Padding(4).AlignRight().Text($"{report.GrossProfit:N2} {currency}").Bold();
                                table.Cell().Border(1).Padding(4).Text($"Margin: {report.GrossProfitMargin:F1}%").FontSize(9).FontColor(Colors.Grey.Medium);
                                table.Cell().Border(1).Padding(4);
                                table.Cell().Border(1).Padding(4).Text("Total Expenses");
                                table.Cell().Border(1).Padding(4).AlignRight().Text($"-{report.TotalExpenses:N2} {currency}");
                                table.Cell().Border(1).Background(report.NetProfit >= 0 ? Colors.Green.Lighten3 : Colors.Red.Lighten3).Padding(6).Text("Net Profit / Loss").Bold().FontSize(12);
                                table.Cell().Border(1).Background(report.NetProfit >= 0 ? Colors.Green.Lighten3 : Colors.Red.Lighten3).Padding(6).AlignRight().Text($"{report.NetProfit:N2} {currency}").Bold().FontSize(12);
                                table.Cell().Border(1).Padding(4).Text($"Net Margin: {report.NetProfitMargin:F2}%").FontSize(9).FontColor(Colors.Grey.Medium);
                                table.Cell().Border(1).Padding(4);
                            });
                        });
                    });
                });
                return document.GeneratePdf();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating P&L PDF: {Message}", ex.Message);
                throw;
            }
        }

        public async Task<byte[]> GenerateWorksheetPdfAsync(WorksheetReportDto dto, DateTime fromDate, DateTime toDate, int tenantId)
        {
            try
            {
                var settings = await GetCompanySettingsAsync(tenantId);
                var currency = settings.Currency ?? "AED";
                var document = Document.Create(container =>
                {
                    container.Page(page =>
                    {
                        page.Size(PageSizes.A4);
                        page.Margin(15, Unit.Millimetre);
                        page.PageColor(Colors.White);
                        page.DefaultTextStyle(x => x.FontFamily(_englishFont).FontSize(10));
                        page.Content().Column(column =>
                        {
                            column.Item().Column(headerCol => RenderCompanyHeader(headerCol, settings, "Worksheet", $"{fromDate:dd-MMM-yyyy} to {toDate:dd-MMM-yyyy}"));
                            column.Item().PaddingTop(8).PaddingBottom(5).Text($"Generated: {DateTime.UtcNow:dd-MMM-yyyy HH:mm} UTC").FontSize(9).FontColor(Colors.Grey.Medium);
                            column.Item().PaddingTop(12).Table(table =>
                            {
                                table.ColumnsDefinition(columns => { columns.RelativeColumn(2); columns.ConstantColumn(90); });
                                table.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(4).Text("Total Sales").Bold();
                                table.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(4).AlignRight().Text($"{dto.TotalSales:N2} {currency}");
                                table.Cell().Border(1).Padding(4).Text("Total Purchases");
                                table.Cell().Border(1).Padding(4).AlignRight().Text($"{dto.TotalPurchases:N2} {currency}");
                                table.Cell().Border(1).Padding(4).Text("Total Expenses");
                                table.Cell().Border(1).Padding(4).AlignRight().Text($"{dto.TotalExpenses:N2} {currency}");
                                table.Cell().Border(1).Padding(4).Text("Total Received");
                                table.Cell().Border(1).Padding(4).AlignRight().Text($"{dto.TotalReceived:N2} {currency}");
                                table.Cell().Border(1).Background(Colors.Blue.Lighten4).Padding(4).Text("Pending Amount").Bold();
                                table.Cell().Border(1).Background(Colors.Blue.Lighten4).Padding(4).AlignRight().Text($"{dto.PendingAmount:N2} {currency}").Bold();
                            });
                        });
                    });
                });
                return document.GeneratePdf();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating Worksheet PDF: {Message}", ex.Message);
                throw;
            }
        }

        public async Task<byte[]> GenerateSummaryReportPdfAsync(SummaryReportDto summary, DateTime fromDate, DateTime toDate, int tenantId)
        {
            try
            {
                var settings = await GetCompanySettingsAsync(tenantId);
                var currency = settings.Currency ?? "AED";
                var document = Document.Create(container =>
                {
                    container.Page(page =>
                    {
                        page.Size(PageSizes.A4);
                        page.Margin(15, Unit.Millimetre);
                        page.PageColor(Colors.White);
                        page.DefaultTextStyle(x => x.FontFamily(_englishFont).FontSize(10));
                        page.Content().Column(column =>
                        {
                            column.Item().Column(headerCol => RenderCompanyHeader(headerCol, settings, "Report Summary", $"{fromDate:dd-MMM-yyyy} to {toDate:dd-MMM-yyyy}"));
                            if (summary.ProfitToday.HasValue)
                                column.Item().PaddingTop(6).Text("Profit figures are Estimate — not for filing").FontSize(9).Bold().FontColor(Colors.Grey.Darken2);
                            column.Item().PaddingTop(8).Table(table =>
                            {
                                table.ColumnsDefinition(columns => { columns.RelativeColumn(2); columns.ConstantColumn(100); });
                                void Row(string label, string value, bool emphasize = false)
                                {
                                    if (emphasize)
                                    {
                                        table.Cell().Border(1).Padding(4).Text(label).Bold();
                                        table.Cell().Border(1).Padding(4).AlignRight().Text(value).Bold();
                                    }
                                    else
                                    {
                                        table.Cell().Border(1).Padding(4).Text(label);
                                        table.Cell().Border(1).Padding(4).AlignRight().Text(value);
                                    }
                                }
                                Row("Sales (period)", $"{summary.SalesToday:N2} {currency}", true);
                                Row("Returns", $"{summary.ReturnsToday:N2} {currency}");
                                Row("Net sales", $"{summary.NetSalesToday:N2} {currency}", true);
                                Row("Purchases", $"{summary.PurchasesToday:N2} {currency}");
                                Row("Expenses", $"{summary.ExpensesToday:N2} {currency}");
                                Row("Cash collections", $"{summary.CashCollectionsTotal:N2} {currency}");
                                Row("Pending bills", $"{summary.PendingBillsAmount:N2} {currency} ({summary.PendingBills})");
                                Row("Net VAT (guidance)", $"{summary.NetVatPayablePeriod:N2} {currency}");
                                if (summary.ProfitToday.HasValue)
                                    Row("Profit estimate", $"{summary.ProfitToday.Value:N2} {currency}");
                            });
                        });
                    });
                });
                return document.GeneratePdf();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating summary report PDF: {Message}", ex.Message);
                throw;
            }
        }

        public async Task<byte[]> GenerateVatManagementReportPdfAsync(VatReturn201Dto report, int tenantId)
        {
            if (report == null) throw new ArgumentNullException(nameof(report));
            var settings = await GetCompanySettingsAsync(tenantId);
            var currency = settings.Currency ?? "AED";
            var frozen = string.Equals(report.Status, "Locked", StringComparison.OrdinalIgnoreCase)
                || string.Equals(report.Status, "Submitted", StringComparison.OrdinalIgnoreCase);
            var periodText = $"Period: {report.PeriodStart:dd-MMM-yyyy} to {report.PeriodEnd:dd-MMM-yyyy} | Status: {report.Status}";
            var gstZone = GetGulfStandardTimeZone();
            var generatedAtGst = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, gstZone);
            var trnDisplay = HexaBill.Api.Core.Tenancy.SampleVatTrn.IsRealVatTrn(report.VatTrn)
                ? $"TRN not verified: {report.VatTrn}"
                : HexaBill.Api.Core.Tenancy.SampleVatTrn.IsSample(report.VatTrn)
                    ? $"TRN not verified (sample TRN): {report.VatTrn}"
                    : string.IsNullOrWhiteSpace(report.VatTrn) ? "TRN not provided" : $"Invalid TRN format: {report.VatTrn}";
            var document = Document.Create(container => container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(15, Unit.Millimetre);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(style => style.FontFamily(_englishFont).FontSize(9));
                page.Header().Column(header =>
                {
                    header.Item().Column(column => RenderCompanyHeader(column, settings, "VAT MANAGEMENT REPORT", string.Empty));
                    header.Item().Text(periodText).FontSize(8);
                    if (!string.IsNullOrWhiteSpace(settings.CompanyAddress))
                        header.Item().Text($"Address: {settings.CompanyAddress}").FontSize(8);
                    if (!string.IsNullOrWhiteSpace(settings.CompanyPhone))
                        header.Item().Text($"Phone: {settings.CompanyPhone}").FontSize(8);
                    header.Item().PaddingTop(4).Text("Management report. Not an FTA filing.").Bold();
                    if (!frozen)
                        header.Item().PaddingTop(2).Background(Colors.Grey.Lighten3).Padding(4).Text("DRAFT — figures may change").Bold();
                    header.Item().Text(trnDisplay);
                    if (report.Warnings.Count > 0)
                        header.Item().PaddingTop(3).Text(string.Join("  •  ", report.Warnings)).FontSize(8);
                });
                page.Content().PaddingTop(8).Column(content =>
                {
                    content.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns => { columns.RelativeColumn(2); columns.ConstantColumn(115); });
                        void Row(string label, decimal amount, bool emphasize = false)
                        {
                            var labelCell = table.Cell().Border(1).Padding(5);
                            var amountCell = table.Cell().Border(1).Padding(5).AlignRight();
                            if (emphasize)
                            {
                                labelCell.Text(label).Bold();
                                amountCell.Text($"{amount:N2} {currency}").Bold();
                            }
                            else
                            {
                                labelCell.Text(label);
                                amountCell.Text($"{amount:N2} {currency}");
                            }
                        }
                        Row("Standard output VAT", report.StandardOutputVat);
                        Row("Recoverable input VAT", report.RecoverableInputVat);
                        Row(report.NetVatPayable < 0 ? "Net VAT refundable" : "Net VAT payable", report.NetVatPayable, true);
                    });
                    var outputRows = report.OutputLines.Select(line => (
                        line.Reference, line.Date.ToString("dd/MM/yyyy"), line.CustomerName,
                        line.NetAmount, line.VatAmount, line.NetAmount + line.VatAmount)).ToList();
                    RenderVatDetailTable(content.Item(), "Sales", outputRows, currency);

                    var purchaseRows = report.InputLines.Where(line => !string.Equals(line.Type, "Expense", StringComparison.OrdinalIgnoreCase))
                        .Select(line => (line.Reference, line.Date.ToString("dd/MM/yyyy"), line.SupplierName,
                            line.NetAmount, line.ClaimableVat, line.NetAmount + line.VatAmount)).ToList();
                    RenderVatDetailTable(content.Item(), "Purchases", purchaseRows, currency);

                    var expenseRows = report.InputLines.Where(line => string.Equals(line.Type, "Expense", StringComparison.OrdinalIgnoreCase))
                        .Select(line => (line.Reference, line.Date.ToString("dd/MM/yyyy"), line.CategoryName,
                            line.NetAmount, line.ClaimableVat, line.NetAmount + line.VatAmount)).ToList();
                    RenderVatDetailTable(content.Item(), "Expenses", expenseRows, currency);

                    var creditRows = report.CreditNoteLines.Select(line => (
                        line.Reference, line.Date.ToString("dd/MM/yyyy"), line.Side,
                        -line.NetAmount, -line.VatAmount, -(line.NetAmount + line.VatAmount))).ToList();
                    RenderVatDetailTable(content.Item(), "Credit notes", creditRows, currency);
                    content.Item().PaddingTop(4).Text("Amounts are shown as management summaries. Return-box fields are not an FTA mapping.").FontSize(8);
                });
                page.Footer().AlignCenter().DefaultTextStyle(style => style.FontSize(8)).Text(text =>
                {
                    text.Span($"{(frozen ? "Snapshot" : "Draft")} • {report.PeriodLabel} • Generated {generatedAtGst:dd-MMM-yyyy HH:mm} GST • Page ");
                    text.CurrentPageNumber();
                    text.Span(" of ");
                    text.TotalPages();
                });
            }));
            return document.GeneratePdf();
        }

        private static void RenderVatDetailTable(
            IContainer parent,
            string title,
            IReadOnlyCollection<(string Reference, string Date, string Party, decimal Taxable, decimal Vat, decimal Total)> rows,
            string currency)
        {
            parent.Column(section =>
            {
                section.Item().PaddingTop(11).PaddingBottom(3).Text(title).Bold().FontSize(11);
                section.Item().Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        columns.RelativeColumn(1.6f);
                        columns.RelativeColumn(1.0f);
                        columns.RelativeColumn(2.0f);
                        columns.RelativeColumn(1.15f);
                        columns.RelativeColumn(1.0f);
                        columns.RelativeColumn(1.15f);
                    });
                    table.Header(header =>
                    {
                        foreach (var heading in new[] { "Reference", "Date", "Party", "Taxable", "VAT", "Total" })
                            header.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(3).Text(heading).Bold().FontSize(8);
                    });
                    foreach (var row in rows)
                    {
                        table.Cell().Border(1).Padding(3).Text(row.Reference).FontSize(8);
                        table.Cell().Border(1).Padding(3).Text(row.Date).FontSize(8);
                        table.Cell().Border(1).Padding(3).Text(row.Party).FontSize(8);
                        table.Cell().Border(1).Padding(3).AlignRight().Text(row.Taxable.ToString("N2", System.Globalization.CultureInfo.InvariantCulture)).FontSize(8);
                        table.Cell().Border(1).Padding(3).AlignRight().Text(row.Vat.ToString("N2", System.Globalization.CultureInfo.InvariantCulture)).FontSize(8);
                        table.Cell().Border(1).Padding(3).AlignRight().Text(row.Total.ToString("N2", System.Globalization.CultureInfo.InvariantCulture)).FontSize(8);
                    }
                    var totalTaxable = rows.Sum(row => row.Taxable);
                    var totalVat = rows.Sum(row => row.Vat);
                    var totalGross = rows.Sum(row => row.Total);
                    table.Cell().ColumnSpan(3).Border(1).Background(Colors.Grey.Lighten4).Padding(3).Text("TOTAL").Bold().FontSize(8);
                    table.Cell().Border(1).Background(Colors.Grey.Lighten4).Padding(3).AlignRight().Text(totalTaxable.ToString("N2", System.Globalization.CultureInfo.InvariantCulture)).Bold().FontSize(8);
                    table.Cell().Border(1).Background(Colors.Grey.Lighten4).Padding(3).AlignRight().Text(totalVat.ToString("N2", System.Globalization.CultureInfo.InvariantCulture)).Bold().FontSize(8);
                    table.Cell().Border(1).Background(Colors.Grey.Lighten4).Padding(3).AlignRight().Text(totalGross.ToString("N2", System.Globalization.CultureInfo.InvariantCulture)).Bold().FontSize(8);
                });
                section.Item().AlignRight().Text($"Amounts in {currency}").FontSize(7).FontColor(Colors.Grey.Darken1);
            });
        }

        private static TimeZoneInfo GetGulfStandardTimeZone()
        {
            foreach (var id in new[] { "Asia/Dubai", "Arabian Standard Time" })
            {
                try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
                catch (TimeZoneNotFoundException) { }
                catch (InvalidTimeZoneException) { }
            }
            return TimeZoneInfo.CreateCustomTimeZone("GST", TimeSpan.FromHours(4), "GST", "GST");
        }

        public async Task<byte[]> GenerateExpensesRegisterPdfAsync(IReadOnlyList<ExpenseDto> expenses, DateTime fromDate, DateTime toDate, int tenantId)
        {
            try
            {
                var settings = await GetCompanySettingsAsync(tenantId);
                var currency = settings.Currency ?? "AED";
                var list = (expenses ?? Array.Empty<ExpenseDto>()).OrderBy(e => e.Date).ThenBy(e => e.Id).ToList();
                var totalNet = list.Sum(e => e.Amount);
                var totalVat = list.Sum(e => e.VatAmount ?? 0m);
                var totalClaimable = list.Sum(e => e.ClaimableVat ?? 0m);
                var totalGross = list.Sum(e =>
                {
                    if (e.TotalAmount.HasValue) return e.TotalAmount.Value;
                    return e.Amount + (e.VatAmount ?? 0m);
                });

                var document = Document.Create(container =>
                {
                    container.Page(page =>
                    {
                        page.Size(PageSizes.A4.Landscape());
                        page.Margin(12, Unit.Millimetre);
                        page.PageColor(Colors.White);
                        page.DefaultTextStyle(x => x.FontFamily(_englishFont).FontSize(8));

                        page.Header().Column(headerCol =>
                        {
                            RenderCompanyHeader(headerCol, settings, "EXPENSES REGISTER", $"Period: {fromDate:dd-MM-yyyy} to {toDate:dd-MM-yyyy}");
                            headerCol.Item().Height(4);
                        });

                        page.Content().Column(contentCol =>
                        {
                            contentCol.Item().PaddingBottom(4).Row(r =>
                            {
                                r.RelativeItem().Text($"Generated: {DateTime.UtcNow:dd-MMM-yyyy HH:mm} UTC").FontSize(8).FontColor(Colors.Grey.Medium);
                                r.RelativeItem().AlignRight().Text($"{list.Count} line(s) · Currency: {currency}").FontSize(8);
                            });

                            if (list.Count == 0)
                            {
                                contentCol.Item().PaddingVertical(20).AlignCenter().Text("No expenses in this period for the selected filters.").FontColor(Colors.Grey.Medium);
                            }
                            else
                            {
                                contentCol.Item().Table(table =>
                                {
                                    table.ColumnsDefinition(columns =>
                                    {
                                        columns.ConstantColumn(62);
                                        columns.RelativeColumn(1.4f);
                                        columns.ConstantColumn(52);
                                        columns.ConstantColumn(48);
                                        columns.ConstantColumn(44);
                                        columns.ConstantColumn(48);
                                        columns.ConstantColumn(48);
                                        columns.ConstantColumn(44);
                                        columns.ConstantColumn(28);
                                        columns.ConstantColumn(44);
                                        columns.RelativeColumn(1.2f);
                                    });

                                    table.Header(header =>
                                    {
                                        void H(string label) => header.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(3).Text(label).FontSize(7).Bold();
                                        H("Date");
                                        H("Category");
                                        H("Branch");
                                        H("Net");
                                        H("VAT");
                                        H("Claim. VAT");
                                        H("Total");
                                        H("Tax type");
                                        H("ITC");
                                        H("Status");
                                        H("Note");
                                    });

                                    foreach (var e in list)
                                    {
                                        var net = e.Amount;
                                        var vat = e.VatAmount;
                                        var claim = e.ClaimableVat;
                                        var gross = e.TotalAmount ?? (e.Amount + (e.VatAmount ?? 0m));
                                        var note = e.Note ?? "";
                                        if (note.Length > 80) note = note.Substring(0, 77) + "...";

                                        table.Cell().Border(1).Padding(2).Text(e.Date.ToString("dd-MM-yyyy")).FontSize(7);
                                        table.Cell().Border(1).Padding(2).Text(e.CategoryName ?? "").FontSize(7);
                                        table.Cell().Border(1).Padding(2).Text(e.BranchName ?? "").FontSize(7);
                                        table.Cell().Border(1).Padding(2).AlignRight().Text(net.ToString("N2")).FontSize(7);
                                        table.Cell().Border(1).Padding(2).AlignRight().Text(vat.HasValue ? vat.Value.ToString("N2") : "-").FontSize(7);
                                        table.Cell().Border(1).Padding(2).AlignRight().Text(claim.HasValue ? claim.Value.ToString("N2") : "-").FontSize(7);
                                        table.Cell().Border(1).Padding(2).AlignRight().Text(gross.ToString("N2")).FontSize(7);
                                        table.Cell().Border(1).Padding(2).Text(e.TaxType ?? "-").FontSize(7);
                                        table.Cell().Border(1).Padding(2).Text(e.IsTaxClaimable ? "Y" : "N").FontSize(7);
                                        table.Cell().Border(1).Padding(2).Text(e.Status ?? "").FontSize(7);
                                        table.Cell().Border(1).Padding(2).Text(note).FontSize(6);
                                    }

                                    table.Footer(footer =>
                                    {
                                        footer.Cell().ColumnSpan(3).Border(1).Background(Colors.Grey.Lighten4).Padding(3).Text("Totals").Bold().FontSize(8);
                                        footer.Cell().Border(1).Background(Colors.Grey.Lighten4).Padding(3).AlignRight().Text(totalNet.ToString("N2")).Bold().FontSize(8);
                                        footer.Cell().Border(1).Background(Colors.Grey.Lighten4).Padding(3).AlignRight().Text(totalVat.ToString("N2")).Bold().FontSize(8);
                                        footer.Cell().Border(1).Background(Colors.Grey.Lighten4).Padding(3).AlignRight().Text(totalClaimable.ToString("N2")).Bold().FontSize(8);
                                        footer.Cell().Border(1).Background(Colors.Grey.Lighten4).Padding(3).AlignRight().Text(totalGross.ToString("N2")).Bold().FontSize(8);
                                        footer.Cell().ColumnSpan(4).Border(1).Background(Colors.Grey.Lighten4).Padding(3).Text("").FontSize(8);
                                    });
                                });
                            }
                        });

                        page.Footer().AlignCenter().Text(x =>
                        {
                            x.Span("Page ").FontSize(7);
                            x.CurrentPageNumber().FontSize(7);
                            x.Span(" of ").FontSize(7);
                            x.TotalPages().FontSize(7);
                        });
                    });
                });

                return document.GeneratePdf();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Expenses register PDF error: {Message}", ex.Message);
                throw;
            }
        }

        public async Task<byte[]> GenerateCustomerPendingBillsPdfAsync(List<OutstandingInvoiceDto> outstandingInvoices, CustomerDto customer, DateTime asOfDate, DateTime fromDate, DateTime toDate, int tenantId)
        {
            try
            {
                var settings = await GetCompanySettingsAsync(tenantId);
                
                var document = Document.Create(container =>
                {
                    container.Page(page =>
                    {
                        page.Size(PageSizes.A4);
                        page.Margin(15, Unit.Millimetre);
                        page.PageColor(Colors.White);
                        
                        page.DefaultTextStyle(x => x.FontFamily(_englishFont).FontSize(10));

                        page.Content().Column(column =>
                        {
                            column.Item().Column(headerCol => RenderCompanyHeader(headerCol, settings, "CUSTOMER PENDING BILLS STATEMENT", $"{fromDate:dd-MM-yyyy} to {toDate:dd-MM-yyyy}"));
                            column.Item().PaddingBottom(5).AlignCenter().Text($"As of: {asOfDate:dd-MM-yyyy}").FontSize(10).FontColor(Colors.Grey.Darken1);
                            // Customer Info
                            column.Item().PaddingVertical(10).BorderTop(1).BorderBottom(1).BorderColor(Colors.Grey.Medium).Row(row =>
                            {
                                row.RelativeItem().Column(col =>
                                {
                                    col.Item().Text(text =>
                                    {
                                        text.Span("Customer: ").Bold();
                                        text.Span(customer.Name);
                                    });
                                    col.Item().Text(text =>
                                    {
                                        text.Span("Phone: ").Bold();
                                        text.Span(customer.Phone ?? "N/A");
                                    });
                                    col.Item().Text(text =>
                                    {
                                        text.Span("TRN: ").Bold();
                                        text.Span(customer.Trn ?? "N/A");
                                    });
                                });
                                
                                row.RelativeItem().Column(col =>
                                {
                                    col.Item().AlignRight().Text(text =>
                                    {
                                        text.Span("Statement Date: ").Bold();
                                        text.Span(asOfDate.ToString("dd-MM-yyyy"));
                                    });
                                    col.Item().AlignRight().Text(text =>
                                    {
                                        text.Span("Total Balance: ").Bold();
                                        text.Span($"{customer.Balance:N2} AED").FontColor(customer.Balance > 0 ? Colors.Red.Medium : Colors.Green.Medium);
                                    });
                                });
                            });
                            
                            // Table
                            column.Item().PaddingTop(10).Table(table =>
                            {
                                table.ColumnsDefinition(columns =>
                                {
                                    columns.ConstantColumn(50); // Invoice No
                                    columns.ConstantColumn(70); // Date
                                    columns.RelativeColumn(); // Description
                                    columns.ConstantColumn(70); // Total
                                    columns.ConstantColumn(70); // Paid
                                    columns.ConstantColumn(80); // Balance
                                    columns.ConstantColumn(50); // Days
                                });
                                
                                // Header
                                table.Header(header =>
                                {
                                    header.Cell().Background(Colors.Blue.Darken2).Border(1).Padding(3).Text("Invoice").FontSize(8).Bold().FontColor(Colors.White);
                                    header.Cell().Background(Colors.Blue.Darken2).Border(1).Padding(3).Text("Invoice Date").FontSize(8).Bold().FontColor(Colors.White);
                                    header.Cell().Background(Colors.Blue.Darken2).Border(1).Padding(3).Text("Description").FontSize(8).Bold().FontColor(Colors.White);
                                    header.Cell().Background(Colors.Blue.Darken2).Border(1).Padding(3).AlignRight().Text("Total").FontSize(8).Bold().FontColor(Colors.White);
                                    header.Cell().Background(Colors.Blue.Darken2).Border(1).Padding(3).AlignRight().Text("Paid").FontSize(8).Bold().FontColor(Colors.White);
                                    header.Cell().Background(Colors.Blue.Darken2).Border(1).Padding(3).AlignRight().Text("Balance").FontSize(8).Bold().FontColor(Colors.White);
                                    header.Cell().Background(Colors.Blue.Darken2).Border(1).Padding(3).AlignCenter().Text("Days").FontSize(8).Bold().FontColor(Colors.White);
                                });
                                
                                // Rows
                                foreach (var invoice in outstandingInvoices)
                                {
                                    var daysOverdue = invoice.DaysOverdue > 0 ? invoice.DaysOverdue : 0;
                                    var rowBg = daysOverdue > 30 ? Colors.Red.Lighten4 
                                        : daysOverdue > 0 ? Colors.Orange.Lighten4 
                                        : Colors.White;
                                    
                                    table.Cell().Border(1).Background(rowBg).Padding(2).Text(invoice.InvoiceNo ?? "-").FontSize(8);
                                    table.Cell().Border(1).Background(rowBg).Padding(2).Text(invoice.InvoiceDate.ToString("dd-MM-yyyy")).FontSize(8);
                                    table.Cell().Border(1).Background(rowBg).Padding(2).Text("Unpaid Invoice").FontSize(8);
                                    table.Cell().Border(1).Background(rowBg).Padding(2).AlignRight().Text($"{invoice.GrandTotal:N2}").FontSize(8);
                                    table.Cell().Border(1).Background(rowBg).Padding(2).AlignRight().Text($"{invoice.PaidAmount:N2}").FontSize(8).FontColor(Colors.Green.Medium);
                                    table.Cell().Border(1).Background(rowBg).Padding(2).AlignRight().Text($"{invoice.BalanceAmount:N2}").FontSize(8).Bold().FontColor(Colors.Red.Medium);
                                    table.Cell().Border(1).Background(rowBg).Padding(2).AlignCenter().Text(daysOverdue > 0 ? daysOverdue.ToString() : "-").FontSize(8).FontColor(daysOverdue > 30 ? Colors.Red.Darken1 : daysOverdue > 0 ? Colors.Orange.Darken1 : Colors.Grey.Medium);
                                }
                                
                                // Footer Totals
                                var totalGrand = outstandingInvoices.Sum(b => b.GrandTotal);
                                var totalPaid = outstandingInvoices.Sum(b => b.PaidAmount);
                                var totalBalance = outstandingInvoices.Sum(b => b.BalanceAmount);
                                
                                table.Cell().ColumnSpan(3).Border(1).Background(Colors.Grey.Lighten3).Padding(3).AlignRight().Text("TOTAL PENDING:").FontSize(9).Bold();
                                table.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(3).AlignRight().Text($"{totalGrand:N2}").FontSize(9).Bold();
                                table.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(3).AlignRight().Text($"{totalPaid:N2}").FontSize(9).Bold().FontColor(Colors.Green.Medium);
                                table.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(3).AlignRight().Text($"{totalBalance:N2}").FontSize(9).Bold().FontColor(Colors.Red.Medium);
                                table.Cell().Border(1).Background(Colors.Grey.Lighten3).Padding(3).Text("");
                            });
                            
                            // Summary
                            column.Item().PaddingTop(15).Row(row =>
                            {
                                row.RelativeItem().Text(text =>
                                {
                                    text.Span("Total Pending Invoices: ").Bold();
                                    text.Span(outstandingInvoices.Count.ToString());
                                });
                                
                                row.RelativeItem().AlignRight().Text(text =>
                                {
                                    text.Span("Amount to Collect: ").Bold();
                                    text.Span($"{outstandingInvoices.Sum(i => i.BalanceAmount):N2} AED").FontColor(Colors.Red.Medium).FontSize(12).Bold();
                                });
                            });
                            
                            // Footer note
                            column.Item().PaddingTop(20).BorderTop(1).BorderColor(Colors.Grey.Medium).PaddingTop(5).Text("Please settle all outstanding invoices at your earliest convenience.")
                                .FontSize(8)
                                .Italic()
                                .FontColor(Colors.Grey.Medium);
                        });
                        
                        page.Footer().AlignCenter().Text(x =>
                        {
                            x.Span("Page ");
                            x.CurrentPageNumber();
                            x.Span(" of ");
                            x.TotalPages();
                        });
                    });
                });
                
                return document.GeneratePdf();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating customer pending bills PDF: {Message}", ex.Message);
                _logger.LogInformation($"? Stack Trace: {ex.StackTrace}");
                throw;
            }
        }

        public async Task<byte[]> GenerateQuotationPdfAsync(QuotationDto quotation, int tenantId, string format = "A4", string? layout = null)
        {
            var fmt = NormalizePageFormat(format);
            var settings = await GetCompanySettingsAsync(tenantId);
            ApplyPrintLayout(settings, layout);
            if (string.IsNullOrWhiteSpace(settings.CompanyEmail))
            {
                try
                {
                    settings.CompanyEmail = await _settingsService.GetSettingValueAsync(tenantId, "COMPANY_EMAIL") ?? "";
                }
                catch { /* optional */ }
            }
            var salutation = string.IsNullOrWhiteSpace(quotation.Salutation) ? QuotationDefaults.Salutation : quotation.Salutation;
            var intro = string.IsNullOrWhiteSpace(quotation.IntroLine) ? QuotationDefaults.IntroLine : quotation.IntroLine;
            var closing = string.IsNullOrWhiteSpace(quotation.ClosingLine) ? QuotationDefaults.ClosingLine : quotation.ClosingLine;
            var letterheadOnly = settings.LetterheadOnlyPrint;
            var useOrangeLetterhead = !settings.BilingualMonochromeHeader && !letterheadOnly && IsZayogaBrand(settings);
            try
            {
                var document = Document.Create(container =>
                {
                    container.Page(page =>
                    {
                        page.Size(fmt == "A5" ? PageSizes.A5 : PageSizes.A4);
                        ApplyDocumentPageMargins(page, settings, fmt == "A5" ? 6f : 8f);
                        page.DefaultTextStyle(x => x.FontFamily(_englishFont).FontSize(fmt == "A5" ? 8 : 9));

                        if (useOrangeLetterhead)
                            RenderFullPageLetterheadChrome(page, settings, compact: fmt == "A5");
                        else if (!letterheadOnly)
                        {
                            page.Header().Row(row =>
                            {
                                var hasLogo = settings.LogoImageBytes != null && settings.LogoImageBytes.Length > 0;
                                if (hasLogo)
                                    row.ConstantItem(70).AlignMiddle().Width(64).Height(48).Image(settings.LogoImageBytes!).FitArea();
                                else
                                    row.ConstantItem(16);

                                row.RelativeItem().Column(col =>
                                {
                                    col.Item().AlignCenter().Text(settings.CompanyNameEn ?? "Company").Bold()
                                        .FontSize(fmt == "A5" ? 10 : 12);
                                    if (!string.IsNullOrWhiteSpace(settings.CompanyAddress))
                                        col.Item().AlignCenter().Text(settings.CompanyAddress).FontSize(7);
                                    var contactBits = new[] { settings.CompanyPhone, settings.CompanyEmail, string.IsNullOrWhiteSpace(settings.CompanyTrn) ? null : settings.CompanyTrn }
                                        .Where(s => !string.IsNullOrWhiteSpace(s));
                                    if (contactBits.Any())
                                        col.Item().AlignCenter().Text(string.Join("  |  ", contactBits!)).FontSize(7);
                                });

                                row.ConstantItem(16);
                            });
                        }

                        page.Content().PaddingTop(8).Column(col =>
                        {
                            col.Item().AlignRight().Text("Quotation").Bold().FontSize(fmt == "A5" ? 14 : 18);

                            col.Item().PaddingTop(10).Row(row =>
                            {
                                row.RelativeItem().Column(c =>
                                {
                                    c.Item().Text("To").Bold().FontSize(8);
                                    c.Item().Text(quotation.CustomerName ?? "").Bold();
                                    if (!string.IsNullOrWhiteSpace(quotation.CustomerAddress))
                                        c.Item().Text(quotation.CustomerAddress).FontSize(8);
                                });
                                row.ConstantItem(150).AlignRight().Column(c =>
                                {
                                    c.Item().Text($"Quotation#: {quotation.QuoteNo}").Bold();
                                    c.Item().Text($"Date: {quotation.QuoteDate:dd-MM-yyyy}");
                                });
                            });

                            col.Item().PaddingTop(12).Text(salutation).FontSize(9);
                            col.Item().PaddingTop(2).Text(intro).FontSize(8);

                            col.Item().PaddingTop(10).Table(table =>
                            {
                                table.ColumnsDefinition(columns =>
                                {
                                    columns.ConstantColumn(22);
                                    columns.RelativeColumn(3.2f);
                                    columns.ConstantColumn(48);
                                    columns.ConstantColumn(58);
                                    columns.ConstantColumn(58);
                                    columns.ConstantColumn(62);
                                });
                                table.Header(header =>
                                {
                                    void H(string t, bool right = false)
                                    {
                                        var cell = header.Cell().Background(Colors.Grey.Darken2).PaddingVertical(4).PaddingHorizontal(3);
                                        if (right) cell.AlignRight().Text(t).Bold().FontSize(8).FontColor(Colors.White);
                                        else cell.Text(t).Bold().FontSize(8).FontColor(Colors.White);
                                    }
                                    H("#");
                                    H("DESCRIPTION");
                                    H("QTY", true);
                                    H("PRICE", true);
                                    H("TAX", true);
                                    H("TOTAL", true);
                                });
                                var i = 1;
                                foreach (var item in quotation.Items.OrderBy(x => x.SortOrder))
                                {
                                    var desc = (item.Description ?? "").Trim();
                                    if (!string.IsNullOrEmpty(desc))
                                        desc = desc.ToUpperInvariant();
                                    table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3)
                                        .Text(i.ToString()).FontSize(8);
                                    table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3).Column(c =>
                                    {
                                        c.Item().Text(desc).Bold().FontSize(8);
                                        if (!string.IsNullOrWhiteSpace(item.DescriptionSubtitle))
                                            c.Item().Text(item.DescriptionSubtitle).FontSize(7).FontColor(Colors.Grey.Darken1);
                                    });
                                    table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3).AlignRight().Column(c =>
                                    {
                                        c.Item().AlignRight().Text($"{item.Qty:0.##}").FontSize(8).Bold();
                                        c.Item().AlignRight().Text(item.UnitLabel ?? "Pcs").FontSize(7).FontColor(Colors.Grey.Darken1);
                                    });
                                    table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3).AlignRight()
                                        .Text($"AED {item.UnitPrice:N2}").FontSize(8);
                                    table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3).AlignRight().Column(c =>
                                    {
                                        c.Item().AlignRight().Text($"AED {item.VatAmount:N2}").FontSize(8);
                                        c.Item().AlignRight().Text($"{item.VatRate:N2}%").FontSize(7).FontColor(Colors.Grey.Darken1);
                                    });
                                    table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3).AlignRight()
                                        .Text($"AED {item.LineTotal:N2}").FontSize(8).Bold();
                                    i++;
                                }
                            });

                            col.Item().PaddingTop(14).AlignRight().Width(210).Column(totals =>
                            {
                                totals.Item().Row(r =>
                                {
                                    r.RelativeItem().Text("SUBTOTAL");
                                    r.ConstantItem(90).AlignRight().Text($"AED {quotation.Subtotal:N2}");
                                });
                                totals.Item().Row(r =>
                                {
                                    r.RelativeItem().Text("TAX");
                                    r.ConstantItem(90).AlignRight().Text($"AED {quotation.VatTotal:N2}");
                                });
                                totals.Item().PaddingTop(4).BorderTop(1).BorderBottom(2).PaddingVertical(4).Row(r =>
                                {
                                    r.RelativeItem().Text("GRAND TOTAL").Bold();
                                    r.ConstantItem(90).AlignRight().Text($"AED {quotation.GrandTotal:N2}").Bold();
                                });
                            });

                            col.Item().PaddingTop(18).Text(closing).FontSize(8);

                            col.Item().PaddingTop(28).AlignRight().Width(160).Column(sig =>
                            {
                                if (!letterheadOnly && !useOrangeLetterhead)
                                {
                                    var hasLogoSig = settings.LogoImageBytes != null && settings.LogoImageBytes.Length > 0;
                                    if (hasLogoSig)
                                        sig.Item().AlignCenter().Width(72).Height(40).Image(settings.LogoImageBytes!).FitArea();
                                    else
                                        sig.Item().Height(28);
                                    sig.Item().PaddingTop(6).AlignCenter().Text("AUTHORIZED SIGNATURE").Bold().FontSize(8);
                                    if (!string.IsNullOrWhiteSpace(settings.CompanyNameEn))
                                        sig.Item().AlignCenter().Text(settings.CompanyNameEn).FontSize(7);
                                }
                                else
                                {
                                    sig.Item().Height(20);
                                    sig.Item().AlignCenter().Text("AUTHORIZED SIGNATURE").Bold().FontSize(8);
                                }
                                RenderStampNearSignatory(sig, settings);
                            });
                        });

                        if (!useOrangeLetterhead)
                        {
                            page.Footer().AlignRight().Text(x =>
                            {
                                x.Span("Page ");
                                x.CurrentPageNumber();
                                x.Span(" of ");
                                x.TotalPages();
                            });
                        }
                    });
                });
                return await Task.FromResult(document.GeneratePdf());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating quotation PDF {QuoteNo}", quotation.QuoteNo);
                throw;
            }
        }

        public async Task<byte[]> GenerateAgreementPdfAsync(AgreementDto agreement, int tenantId, string format = "A4", string? layout = null)
        {
            var fmt = NormalizePageFormat(format);
            InvoiceTemplateService.CompanySettings? settings = null;
            try { settings = await GetCompanySettingsAsync(tenantId); } catch { /* logo optional */ }
            try
            {
                if (settings != null)
                    ApplyPrintLayout(settings, layout);

                var blank = "________________";
                var secondName = string.IsNullOrWhiteSpace(agreement.SecondPartyName) ? blank : agreement.SecondPartyName!.Trim();
                var secondLicense = string.IsNullOrWhiteSpace(agreement.SecondPartyLicense) ? blank : agreement.SecondPartyLicense!.Trim();
                var secondAddress = string.IsNullOrWhiteSpace(agreement.SecondPartyAddress) ? blank : agreement.SecondPartyAddress!.Trim();
                var secondMobile = string.IsNullOrWhiteSpace(agreement.SecondPartyMobile) ? blank : agreement.SecondPartyMobile!.Trim();
                var whereas = string.IsNullOrWhiteSpace(agreement.WhereasText)
                    ? HexaBill.Api.Modules.Documents.AgreementTemplate.Whereas(secondName)
                    : agreement.WhereasText;
                var clauses = (agreement.Clauses != null && agreement.Clauses.Count > 0)
                    ? agreement.Clauses
                    : HexaBill.Api.Modules.Documents.AgreementTemplate.BuildClauses().ToList();
                var hasLogo = settings?.LogoImageBytes != null && settings.LogoImageBytes.Length > 0;
                var letterheadOnly = settings?.LetterheadOnlyPrint == true;
                var useOrangeLetterhead = settings != null && !letterheadOnly && IsZayogaBrand(settings);
                var bodyFont = fmt == "A5" ? 8.5f : 9.5f;
                var clauseFont = fmt == "A5" ? 8f : 9f;

                var document = Document.Create(container =>
                {
                    container.Page(page =>
                    {
                        page.Size(fmt == "A5" ? PageSizes.A5 : PageSizes.A4);
                        if (letterheadOnly && settings != null)
                        {
                            page.MarginTop(Math.Max(settings.PrintMarginTopMm, 42f), Unit.Millimetre);
                            page.MarginBottom(Math.Max(settings.PrintMarginBottomMm, 22f), Unit.Millimetre);
                            page.MarginLeft(12f, Unit.Millimetre);
                            page.MarginRight(12f, Unit.Millimetre);
                        }
                        else if (settings != null)
                            ApplyDocumentPageMargins(page, settings, fmt == "A5" ? 6f : 8f);
                        else
                            page.Margin(fmt == "A5" ? 28 : 48);
                        page.DefaultTextStyle(x => x.FontFamily(_englishFont).FontSize(bodyFont).LineHeight(1.5f));

                        if (settings != null && useOrangeLetterhead)
                            RenderFullPageLetterheadChrome(page, settings, compact: fmt == "A5");
                        else if (settings != null && !letterheadOnly && hasLogo)
                        {
                            page.Header().Column(col =>
                            {
                                col.Item().Row(row =>
                                {
                                    row.ConstantItem(56).AlignMiddle().Width(48).Height(40).Image(settings!.LogoImageBytes!).FitArea();
                                    row.RelativeItem().AlignMiddle().AlignCenter()
                                        .Text(agreement.FirstPartyName.ToUpperInvariant()).Bold()
                                        .FontSize(fmt == "A5" ? 10 : 12);
                                });
                            });
                        }

                        page.Content().PaddingTop(letterheadOnly ? 10 : 12).Column(col =>
                        {
                            // Title + date in content (not page.Header) so they do not repeat on page 2
                            col.Item().AlignCenter()
                                .Text(HexaBill.Api.Modules.Documents.AgreementTemplate.Title)
                                .Bold().FontSize(fmt == "A5" ? 11 : 13).Underline();
                            col.Item().PaddingTop(8).PaddingBottom(12).AlignCenter()
                                .Text($"DATE-{agreement.AgreementDate:dd/MM/yyyy}").FontSize(10).Underline();

                            col.Item().PaddingBottom(3).Text("First party:").Bold().FontSize(bodyFont);
                            col.Item().PaddingBottom(2).Text(agreement.FirstPartyName).LineHeight(1.5f);
                            col.Item().PaddingBottom(2).Text($"License number: {agreement.FirstPartyLicense}").LineHeight(1.5f);
                            col.Item().PaddingBottom(2).Text(agreement.FirstPartyAddress).LineHeight(1.5f);
                            col.Item().PaddingBottom(12).Text($"Mob: {agreement.FirstPartyMobile}").LineHeight(1.5f);

                            col.Item().PaddingTop(8).PaddingBottom(3).Text("Second Party").Bold().FontSize(bodyFont);
                            col.Item().PaddingBottom(2).Text($"Name: {secondName}").LineHeight(1.5f);
                            col.Item().PaddingBottom(2).Text($"License number: {secondLicense}").LineHeight(1.5f);
                            col.Item().PaddingBottom(2).Text(secondAddress).LineHeight(1.5f);
                            col.Item().PaddingBottom(14).Text($"Mob: {secondMobile}").LineHeight(1.5f);

                            col.Item().PaddingTop(10).PaddingBottom(12)
                                .Text(whereas).FontSize(clauseFont).LineHeight(1.55f);

                            for (var n = 0; n < clauses.Count; n++)
                            {
                                var clause = clauses[n];
                                var isSub = n >= 2;
                                col.Item().PaddingTop(isSub ? 6 : 10).PaddingBottom(5).PaddingLeft(isSub ? 14 : 0)
                                    .Text(isSub ? $"â– {clause}" : $"â€¢ {clause}")
                                    .FontSize(clauseFont).LineHeight(1.5f);
                            }

                            col.Item().PaddingTop(28).Row(row =>
                            {
                                row.RelativeItem().PaddingRight(16).Column(c =>
                                {
                                    c.Item().Text("First Party:").Bold();
                                    c.Item().PaddingTop(4).Text(agreement.FirstPartyName).FontSize(8).LineHeight(1.45f);
                                    c.Item().PaddingTop(28).Text("________________________");
                                    if (settings != null)
                                        RenderStampNearSignatory(c, settings);
                                });
                                row.RelativeItem().Column(c =>
                                {
                                    c.Item().Text("Second Party").Bold();
                                    c.Item().PaddingTop(4).Text(secondName).FontSize(8).LineHeight(1.45f);
                                    c.Item().PaddingTop(28).Text("________________________");
                                });
                            });
                        });

                        if (!letterheadOnly && !useOrangeLetterhead)
                        {
                            page.Footer().Column(col =>
                            {
                                col.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Medium);
                                col.Item().PaddingTop(6).AlignCenter().Text(agreement.FirstPartyName).Bold().FontSize(7);
                                if (!string.IsNullOrWhiteSpace(agreement.FooterAddress))
                                    col.Item().PaddingTop(2).AlignCenter().Text(agreement.FooterAddress).FontSize(7);
                                if (!string.IsNullOrWhiteSpace(agreement.FirstPartyPhones))
                                    col.Item().PaddingTop(2).AlignCenter().Text(agreement.FirstPartyPhones).FontSize(7);
                                var mailWeb = string.Join("  |  ", new[] { agreement.FirstPartyEmail, agreement.FirstPartyWebsite }
                                    .Where(s => !string.IsNullOrWhiteSpace(s)));
                                if (!string.IsNullOrWhiteSpace(mailWeb))
                                    col.Item().PaddingTop(2).AlignCenter().Text(mailWeb).FontSize(7);
                            });
                        }
                    });
                });
                return await Task.FromResult(document.GeneratePdf());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating agreement PDF {No}", agreement.AgreementNo);
                throw;
            }
        }

        public async Task<byte[]> GenerateSalaryCertificatePdfAsync(SalaryCertificateDto certificate, int tenantId, string format = "A4", string? layout = null)
        {
            var fmt = NormalizePageFormat(format);
            InvoiceTemplateService.CompanySettings? settings = null;
            try { settings = await GetCompanySettingsAsync(tenantId); } catch { /* logo optional */ }
            try
            {
                if (settings != null)
                    ApplyPrintLayout(settings, layout);

                var blank = "________________";
                string Blank(string? v) => string.IsNullOrWhiteSpace(v) ? blank : v.Trim();
                var employeeName = Blank(certificate.EmployeeName);
                var nationality = Blank(certificate.EmployeeNationality);
                var passport = Blank(certificate.PassportNumber);
                var joining = certificate.JoiningDate.HasValue
                    ? certificate.JoiningDate.Value.ToString("dd-MM-yyyy")
                    : blank;
                var designation = Blank(certificate.Designation);
                var salaryNum = certificate.MonthlySalary.HasValue
                    ? certificate.MonthlySalary.Value.ToString("0")
                    : blank;
                var salaryWordsRaw = HexaBill.Api.Modules.Documents.SalaryCertificateService.ResolveSalaryWords(
                    certificate.MonthlySalary, certificate.MonthlySalaryWords);
                var salaryWords = string.IsNullOrWhiteSpace(salaryWordsRaw) ? blank : salaryWordsRaw;
                var recipient = Blank(certificate.Recipient);
                // Always compose from fields so auto salary-words are never stuck as blanks in BodyText
                var body =
                    $"This is to certify that {employeeName} {nationality} nationality holding passport number {passport} " +
                    $"is working with us since {joining} as {designation} And drawing a monthly salary " +
                    $"{salaryNum}{{{salaryWords}}} inclusive of all allowances. Please note that this letter is only " +
                    "issued upon the request of the above-mentioned employee and does not in no way and under no " +
                    "circumstances constitute any financial responsibility guarantee and/or liability towards the " +
                    "payment of any loan amount(S) to you from our part.";
                var companyName = string.IsNullOrWhiteSpace(certificate.CompanyName)
                    ? HexaBill.Api.Modules.Documents.SalaryCertificateTemplate.CompanyName
                    : certificate.CompanyName;
                var signatoryName = string.IsNullOrWhiteSpace(certificate.SignatoryName)
                    ? HexaBill.Api.Modules.Documents.SalaryCertificateTemplate.DefaultSignatoryName
                    : certificate.SignatoryName;
                var signatoryTitle = string.IsNullOrWhiteSpace(certificate.SignatoryTitle)
                    ? HexaBill.Api.Modules.Documents.SalaryCertificateTemplate.DefaultSignatoryTitle
                    : certificate.SignatoryTitle;
                var hasLogo = settings?.LogoImageBytes != null && settings.LogoImageBytes.Length > 0;
                var letterheadOnly = settings?.LetterheadOnlyPrint == true;
                var useOrangeLetterhead = settings != null && !letterheadOnly && IsZayogaBrand(settings);
                var subject = string.IsNullOrWhiteSpace(certificate.SubjectLine)
                    ? HexaBill.Api.Modules.Documents.SalaryCertificateTemplate.SubjectLine
                    : certificate.SubjectLine;
                var metaFont = fmt == "A5" ? 9.5f : 10.5f;
                var bodyFont = fmt == "A5" ? 9.5f : 10.5f;

                var document = Document.Create(container =>
                {
                    container.Page(page =>
                    {
                        page.Size(fmt == "A5" ? PageSizes.A5 : PageSizes.A4);
                        if (letterheadOnly && settings != null)
                        {
                            page.MarginTop(Math.Max(settings.PrintMarginTopMm, 42f), Unit.Millimetre);
                            page.MarginBottom(Math.Max(settings.PrintMarginBottomMm, 22f), Unit.Millimetre);
                            page.MarginLeft(14f, Unit.Millimetre);
                            page.MarginRight(14f, Unit.Millimetre);
                        }
                        else if (settings != null)
                            ApplyDocumentPageMargins(page, settings, fmt == "A5" ? 6f : 8f);
                        else
                            page.Margin(fmt == "A5" ? 28 : 48);
                        page.DefaultTextStyle(x => x.FontFamily(_englishFont).FontSize(metaFont).LineHeight(1.5f));

                        if (settings != null && useOrangeLetterhead)
                            RenderFullPageLetterheadChrome(page, settings, compact: fmt == "A5");
                        else if (settings != null && !letterheadOnly)
                        {
                            page.Header().Column(col =>
                            {
                                col.Item().Row(row =>
                                {
                                    if (hasLogo)
                                        row.ConstantItem(56).AlignMiddle().Width(48).Height(40).Image(settings!.LogoImageBytes!).FitArea();
                                    else
                                        row.ConstantItem(8);
                                    row.RelativeItem().AlignMiddle().Column(c =>
                                    {
                                        c.Item().Text(companyName.ToUpperInvariant()).Bold()
                                            .FontSize(fmt == "A5" ? 9 : 11);
                                    });
                                    row.ConstantItem(120).AlignRight().Column(c =>
                                    {
                                        c.Item().Text(certificate.CompanyPhone ?? "").FontSize(7).LineHeight(1.4f);
                                        c.Item().Text(certificate.CompanyEmail ?? "").FontSize(7).LineHeight(1.4f);
                                        c.Item().Text(certificate.CompanyWebsite ?? "").FontSize(7).LineHeight(1.4f);
                                    });
                                });
                                col.Item().PaddingTop(8).LineHorizontal(1f).LineColor(Colors.Grey.Medium);
                            });
                        }

                        page.Content().PaddingTop(letterheadOnly ? 10 : 14).Column(col =>
                        {
                            col.Item().AlignCenter().PaddingBottom(14)
                                .Text(subject).Bold().FontSize(fmt == "A5" ? 11 : 13);
                            col.Item().PaddingBottom(10)
                                .Text($"DATE:{certificate.CertificateDate:dd/MM/yyyy}").FontSize(metaFont).LineHeight(1.55f);
                            col.Item().PaddingBottom(12)
                                .Text($"To; {recipient}").FontSize(metaFont).LineHeight(1.55f);
                            col.Item().PaddingBottom(14)
                                .Text("Dear Sir/Madam").FontSize(metaFont).LineHeight(1.55f);
                            col.Item().PaddingBottom(10)
                                .Text(body).FontSize(bodyFont).LineHeight(1.6f);

                            col.Item().PaddingTop(28).AlignLeft().Column(c =>
                            {
                                c.Item().Text("Yours faithfully").FontSize(metaFont).LineHeight(1.5f);
                                c.Item().PaddingTop(28).Text(signatoryName).Bold().FontSize(metaFont).LineHeight(1.5f);
                                c.Item().PaddingTop(6).Text(signatoryTitle).FontSize(metaFont).LineHeight(1.5f);
                                if (settings != null)
                                    RenderStampNearSignatory(c, settings);
                                else
                                    c.Item().PaddingTop(12).Text("________________________").FontSize(9);
                            });
                        });

                        if (!letterheadOnly && !useOrangeLetterhead)
                        {
                            page.Footer().Column(col =>
                            {
                                col.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Medium);
                                col.Item().PaddingTop(6).AlignCenter().Text(companyName).Bold().FontSize(7);
                                var footerAddr = string.IsNullOrWhiteSpace(certificate.FooterAddress)
                                    ? HexaBill.Api.Modules.Documents.SalaryCertificateTemplate.FooterAddress
                                    : certificate.FooterAddress;
                                col.Item().PaddingTop(2).AlignCenter().Text(footerAddr).FontSize(7);
                            });
                        }
                    });
                });
                return await Task.FromResult(document.GeneratePdf());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating salary certificate PDF {No}", certificate.CertificateNo);
                throw;
            }
        }

        private static string NormalizePageFormat(string? format)
        {
            var f = (format ?? "A4").Trim().ToUpperInvariant();
            return f == "A5" ? "A5" : "A4";
        }

    }
}

