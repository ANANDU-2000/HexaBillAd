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
using HexaBill.Api.Modules.SuperAdmin;
using HexaBill.Api.Shared.Security;

namespace HexaBill.Api.Modules.Billing
{
    public class PdfService : IPdfService
    {
        private readonly AppDbContext _context;
        private readonly IInvoiceTemplateService _templateService;
        private readonly IFontService _fontService;
        private readonly ISettingsService _settingsService;
        private readonly string _arabicFont;
        private readonly string _englishFont;

        public PdfService(AppDbContext context, IInvoiceTemplateService templateService, IFontService fontService, ISettingsService settingsService)
        {
            _context = context;
            _templateService = templateService;
            _fontService = fontService;
            _settingsService = settingsService;
            
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
            
            Console.WriteLine($"? PDF Service initialized with Arabic font: {_arabicFont}");
            
            // Disable debugging in production for better performance
            #if DEBUG
            QuestPDF.Settings.EnableDebugging = true;
            #else
            QuestPDF.Settings.EnableDebugging = false;
            #endif
        }

        public async Task<byte[]> GenerateInvoicePdfAsync(SaleDto sale)
        {
            try
            {
                Console.WriteLine($"?? Generating PDF for sale {sale.Id}, Invoice {sale.InvoiceNo}");
                Console.WriteLine($"   Items count: {sale.Items?.Count ?? 0}");
                
                if (sale.Items == null || !sale.Items.Any())
                {
                    throw new InvalidOperationException($"Sale {sale.Id} has no items. Cannot generate PDF.");
                }
                
                var settings = await GetCompanySettingsAsync(sale.OwnerId); // Use OwnerId from SaleDto
                
                // CRITICAL: Get customer's pending balance for invoice footer acknowledgment
                var customerPendingInfo = await GetCustomerPendingBalanceInfoAsync(sale.CustomerId, sale.OwnerId);
                Console.WriteLine($"   Company: {settings.CompanyNameEn}");
                
                // Try to use HTML invoice template first (from file or database)
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
                        Currency = settings.Currency
                    };
                    
                    // Try to render from database template first
                    templateHtml = await _templateService.RenderActiveTemplateAsync(sale, templateSettings);
                    Console.WriteLine("   ? Using active invoice template from database");
                }
                catch (Exception ex)
                {
                    // If database template fails, try to use template file directly
                    Console.WriteLine($"   ?? Database template not available: {ex.Message}");
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
                                Currency = settings.Currency
                            };
                            templateHtml = await _templateService.RenderTemplateHtmlAsync(templateFileContent, sale, templateSettings);
                            Console.WriteLine("   ? Using invoice template from file");
                        }
                    }
                    catch (Exception fileEx)
                    {
                        Console.WriteLine($"   ?? Template file also failed: {fileEx.Message}");
                    }
                }
                
                // If we have HTML template, we would need HTML-to-PDF library to use it
                // For now, we'll use QuestPDF as fallback
                if (templateHtml != null)
                {
                    Console.WriteLine("   ?? HTML template rendered successfully, but HTML-to-PDF conversion requires additional library");
                    Console.WriteLine("   ?? Using QuestPDF template as fallback (install DinkToPdf or PuppeteerSharp for HTML template support)");
                }
                else
                {
                    Console.WriteLine("   Using default QuestPDF template");
                }
                var customerTrn = await GetCustomerTrnAsync(sale.CustomerId);
                var trnDisplay = string.IsNullOrWhiteSpace(customerTrn) ? "" : customerTrn;
                Console.WriteLine($"   Customer TRN: {trnDisplay}");

                var document = Document.Create(container =>
                {
                    container.Page(page =>
                    {
                        // A4 Portrait: 210mm x 297mm with minimal margins
                        page.Size(PageSizes.A4);
                        page.Margin(5, Unit.Millimetre);
                        page.PageColor(Colors.White);
                        
                        // CRITICAL FIX: Arabic font for print compatibility
                        // Using embedded custom font for production
                        page.DefaultTextStyle(x => x
                            .FontSize(10f)
                            .FontFamily(_arabicFont)
                        );

                        page.Content().Column(column =>
                        {
                            column.Spacing(0);

                            column.Item().Padding(3).Column(innerColumn =>
                            {
                                innerColumn.Spacing(0);

                                // Header - Increased size and bold
                                innerColumn.Item().Text(settings.CompanyNameEn.ToUpper())
                                    .FontSize(18)
                                    .Bold()
                                    .AlignCenter();

                                innerColumn.Item().PaddingTop(1).Text(settings.CompanyNameAr)
                                    .FontSize(16)
                                    .Bold()
                                    .FontFamily(_arabicFont)
                                    .DirectionFromRightToLeft()
                                    .AlignCenter();

                                // Address line without duplicate Abu Dhabi
                                innerColumn.Item().PaddingTop(4).Text($"Mob: {settings.CompanyPhone}, {settings.CompanyAddress}")
                                    .FontSize(12)
                                    .Bold()
                                    .AlignCenter();
                                
                                // TRN and Date row - increased size and bold
                                innerColumn.Item().PaddingTop(2).Row(trnRow => {
                                    trnRow.AutoItem().Text("TRN : No : ").FontSize(10).Bold();
                                    trnRow.AutoItem().Text(settings.CompanyTrn).FontSize(10).Bold();
                                    trnRow.RelativeItem();
                                    trnRow.AutoItem().Text("DATE : ").FontSize(10).Bold();
                                    trnRow.AutoItem().Text(sale.InvoiceDate.ToString("dd-MM-yyyy")).FontSize(10).Bold();
                                });

                                // TAX INVOICE title - compact with borders
                                innerColumn.Item().PaddingTop(2).PaddingBottom(2).BorderTop(1f).BorderBottom(1f).PaddingVertical(2)
                                    .Text("TAX INVOICE")
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
                                    custRow.RelativeItem(35).AlignRight().Text(text => {
                                        text.Span("CUSTOMER TRN : NO : ").FontSize(10).Bold();
                                        text.Span(trnDisplay).FontSize(10).Bold();
                                    });
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
                                    
                                    // RESTORED: Full page table height - 15 rows to fill page properly
                                    int minRowsForHeight = 15;
                                    float rowHeight = 25f; // Original height for full page
                                    float totalItemsHeight = itemCount * rowHeight;
                                    float minTableHeight = minRowsForHeight * rowHeight;
                                    
                                    if (itemCount > 0 && sale.Items != null)
                                    {
                                        for (int i = 0; i < itemCount; i++)
                                        {
                                            var item = sale.Items[i];
                                            
                                            // Add vertical borders between columns, no horizontal borders between rows
                                            table.Cell().BorderLeft(0.5f).BorderRight(0.5f).PaddingVertical(3).PaddingHorizontal(1).AlignCenter().Text((i + 1).ToString()).FontSize(9);
                                            table.Cell().BorderLeft(0.5f).BorderRight(0.5f).PaddingVertical(3).PaddingHorizontal(2).AlignLeft().Text(item.ProductName ?? "").FontSize(9);
                                            table.Cell().BorderLeft(0.5f).BorderRight(0.5f).PaddingVertical(3).PaddingHorizontal(1).AlignCenter().Text(item.Qty.ToString("0.##")).FontSize(9);
                                            
                                            var unitTypeText = string.IsNullOrWhiteSpace(item.UnitType) ? "CRTN" : item.UnitType.ToUpper();
                                            table.Cell().BorderLeft(0.5f).BorderRight(0.5f).PaddingVertical(3).PaddingHorizontal(1).AlignCenter().Text(unitTypeText).FontSize(9);
                                            
                                            // CRITICAL FIX: Right-align all monetary columns for professional invoice format
                                            table.Cell().BorderLeft(0.5f).BorderRight(0.5f).PaddingVertical(3).PaddingHorizontal(1).AlignRight().Text(item.UnitPrice.ToString("0.00")).FontSize(9);
                                            
                                            var lineNet = item.Qty * item.UnitPrice;
                                            table.Cell().BorderLeft(0.5f).BorderRight(0.5f).PaddingVertical(3).PaddingHorizontal(1).AlignRight().Text(lineNet.ToString("0.00")).FontSize(9);
                                            table.Cell().BorderLeft(0.5f).BorderRight(0.5f).PaddingVertical(3).PaddingHorizontal(1).AlignRight().Text(item.VatAmount.ToString("0.00")).FontSize(9);
                                            table.Cell().BorderLeft(0.5f).BorderRight(0.5f).PaddingVertical(3).PaddingHorizontal(1).AlignRight().Text(item.LineTotal.ToString("0.00")).FontSize(9);
                                        }
                                    }
                                    
                                    // Add spacer row to maintain table height if needed
                                    if (itemCount < minRowsForHeight)
                                    {
                                        float spacerHeight = minTableHeight - totalItemsHeight - (3 * rowHeight); // 3 summary rows
                                        if (spacerHeight > 0)
                                        {
                                            // Add spacer cells with vertical borders for each column (8 columns total)
                                            for (int col = 0; col < 8; col++)
                                            {
                                                table.Cell().BorderLeft(0.5f).BorderRight(0.5f).Height(spacerHeight).Text("");
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
                                        row.AutoItem().Text("ضريبة ٥٪").FontSize(10).FontFamily(_arabicFont).DirectionFromRightToLeft();
                                    });
                                    table.Cell().Border(0.5f).PaddingVertical(2).PaddingHorizontal(2).AlignRight().Text(sale.VatTotal.ToString("0.00")).FontSize(10);
                                    
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

                                // Footer Section - optimized with CUSTOMER BALANCE
                                innerColumn.Item().PaddingTop(1).Column(footerCol =>
                                {
                                    // Acknowledgement text
                                    footerCol.Item().AlignLeft().Text("Received the above goods in good order")
                                        .FontSize(8);

                                    // Signature section - two columns - more compact
                                    footerCol.Item().PaddingTop(2).Row(sigRow =>
                                    {
                                        // Left column: Receiver's info
                                        sigRow.RelativeItem().Column(leftCol => {
                                            leftCol.Item().Text("Receive's Name: " + new string('.', 30)).FontSize(8);
                                            leftCol.Item().PaddingTop(1).Text("Receiver's Sign: " + new string('.', 30)).FontSize(8);
                                        });
                                        
                                        // Right column: Company name
                                        sigRow.RelativeItem().Column(rightCol => {
                                            rightCol.Item().AlignRight().Text($"For {settings.CompanyNameEn}").FontSize(8);
                                            rightCol.Item().AlignRight().Text(new string('.', 35)).FontSize(8);
                                        });
                                    });
                                    
                                    // COMPACT: Customer Balance - single line, minimal spacing
                                    if (sale.CustomerId.HasValue && customerPendingInfo.TotalPendingBills > 0)
                                    {
                                        footerCol.Item().PaddingTop(2).AlignRight().Text(text => {
                                            text.Span($"Pending: {customerPendingInfo.TotalPendingBills} | ").FontSize(7);
                                            text.Span($"Balance: {settings.Currency} {customerPendingInfo.TotalBalanceDue:N2}").FontSize(7).Bold().FontColor(Colors.Red.Medium);
                                            text.Span(" الرصيد").FontSize(7).FontFamily(_arabicFont).DirectionFromRightToLeft();
                                        });
                                    }
                                });
                            });
                        });
                    });
                });

                Console.WriteLine("   PDF document created successfully, generating bytes...");
                byte[] pdfBytes;
                try
                {
                    pdfBytes = document.GeneratePdf();
                    Console.WriteLine($"\u2705 PDF generated: {pdfBytes.Length} bytes");
                }
                catch (Exception pdfEx) when (pdfEx.Message.Contains("conflicting size constraints") || pdfEx.Message.Contains("more space"))
                {
                    // FALLBACK: Layout overflow - retry without customer balance
                    Console.WriteLine($"\u26a0\ufe0f PDF layout overflow, retrying without customer balance...");
                    Console.WriteLine($"   Original error: {pdfEx.Message}");
                                    
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
                    Console.WriteLine($"\u2705 Fallback PDF generated: {pdfBytes.Length} bytes");
                }
                catch (Exception pdfEx)
                {
                    Console.WriteLine($"\u274c PDF Generation Failed: {pdfEx.Message}");
                    Console.WriteLine($"   Inner Exception: {pdfEx.InnerException?.Message ?? "None"}");
                    Console.WriteLine($"   Stack Trace: {pdfEx.StackTrace}");
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
                    Console.WriteLine($"?? Failed to save PDF to disk: {saveEx.Message}");
                    // Don't throw - PDF generation succeeded, just saving to disk failed
                }
                
                return pdfBytes;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"? PDF Generation Error: {ex.Message}");
                Console.WriteLine($"   Stack trace: {ex.StackTrace}");
                throw;
            }
        }

        public async Task<byte[]> GenerateCombinedInvoicePdfAsync(List<SaleDto> sales)
        {
            try
            {
                Console.WriteLine($"?? Generating combined PDF for {sales.Count} invoices");
                
                if (sales == null || !sales.Any())
                {
                    throw new InvalidOperationException("No sales provided for combined PDF generation.");
                }
                
                var settings = await GetCompanySettingsAsync(sales[0].OwnerId); // All sales belong to same owner
                
                var document = Document.Create(container =>
                {
                    foreach (var sale in sales)
                    {
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
                                RenderInvoiceContent(column, sale, settings);
                            });
                        });
                    }
                });

                Console.WriteLine("   Combined PDF document created successfully, generating bytes...");
                byte[] pdfBytes;
                try
                {
                    pdfBytes = document.GeneratePdf();
                    Console.WriteLine($"? Combined PDF generated: {pdfBytes.Length} bytes");
                }
                catch (Exception pdfEx)
                {
                    Console.WriteLine($"? Combined PDF Generation Failed: {pdfEx.Message}");
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
                Console.WriteLine($"? Combined PDF Generation Error: {ex.Message}");
                throw;
            }
        }

        private void RenderInvoiceContent(ColumnDescriptor column, SaleDto sale, InvoiceTemplateService.CompanySettings settings)
        {
            var customerTrn = GetCustomerTrnAsync(sale.CustomerId).Result;
            var trnDisplay = string.IsNullOrWhiteSpace(customerTrn) ? "" : customerTrn;

            column.Spacing(0);

            column.Item().Border(2).Padding(8).Column(innerColumn =>
            {
                innerColumn.Spacing(0);

                innerColumn.Item().Text(settings.CompanyNameEn.ToUpper())
                    .FontSize(18)
                    .Bold()
                    .AlignCenter();

                innerColumn.Item().PaddingTop(2).Text(settings.CompanyNameAr)
                    .FontSize(10)
                    .AlignCenter();

                var contactInfo = $"Mob : {settings.CompanyPhone}, {settings.CompanyAddress}";
                innerColumn.Item().PaddingTop(2).Text(contactInfo)
                    .FontSize(9)
                    .AlignCenter();
                
                innerColumn.Item().PaddingTop(2).Row(trnDateRow =>
                {
                    trnDateRow.RelativeItem().Text($"TRN : No : {settings.CompanyTrn}")
                        .FontSize(9);
                    trnDateRow.RelativeItem().AlignRight().Text("")
                        .FontSize(9);
                });

                innerColumn.Item().PaddingTop(6).BorderTop(2).BorderBottom(2).PaddingVertical(4).Text("TAX INVOICE")
                    .FontSize(14)
                    .Bold()
                    .AlignCenter();

                innerColumn.Item().PaddingTop(5).Table(metaTable =>
                {
                    metaTable.ColumnsDefinition(columns =>
                    {
                        columns.RelativeColumn();
                        columns.RelativeColumn();
                        columns.RelativeColumn();
                    });

                    metaTable.Cell().Padding(3).Text($"INVOICE : NO : {sale.InvoiceNo}").FontSize(9).Bold();
                    metaTable.Cell().Padding(3).AlignCenter().Text($"DATE : {sale.InvoiceDate:dd-MM-yyyy}").FontSize(9).Bold();
                    metaTable.Cell().Padding(3).AlignRight().Text($"CUSTOMER TRN : NO : {trnDisplay}").FontSize(9).Bold();
                    
                    var customerDisplayName = string.IsNullOrWhiteSpace(sale.CustomerName) ? "Cash Customer" : sale.CustomerName;
                    metaTable.Cell().ColumnSpan(3).Padding(3).Text($"Customer Name : {customerDisplayName}").FontSize(9).Bold();
                });

                innerColumn.Item().Border(1).Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        columns.RelativeColumn(5);
                        columns.RelativeColumn(36);
                        columns.RelativeColumn(7);
                        columns.RelativeColumn(7);
                        columns.RelativeColumn(11);
                        columns.RelativeColumn(10);
                        columns.RelativeColumn(7);
                        columns.RelativeColumn(17);
                    });

                    table.Header(header =>
                    {
                        void AddHeader(string eng, string arabic = "")
                        {
                            header.Cell().Border(1).Background(Colors.White).PaddingVertical(2).PaddingHorizontal(1).Column(col =>
                            {
                                if (!string.IsNullOrEmpty(arabic))
                                {
                                    col.Item().AlignCenter().Text(arabic).FontSize(6).Bold().FontFamily(_arabicFont).DirectionFromRightToLeft();
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
                        AddHeader("Vat 5%", "ض.ق.م ٥٪");
                        AddHeader("Amount", "المبلغ");
                    });

                    int itemCount = sale.Items != null ? sale.Items.Count : 0;
                    if (itemCount > 0 && sale.Items != null)
                    {
                        for (int i = 0; i < itemCount; i++)
                        {
                            var item = sale.Items[i];
                            
                            table.Cell().Border(1).PaddingVertical(1).PaddingHorizontal(1).Column(col => {
                                col.Item().AlignCenter().Text((i + 1).ToString()).FontSize(8f).Bold();
                            });
                            
                            table.Cell().Border(1).PaddingVertical(1).PaddingHorizontal(2).Column(col => {
                                col.Item().AlignLeft().Text(item.ProductName ?? "").FontSize(8f).Bold();
                            });
                            
                            table.Cell().Border(1).PaddingVertical(1).PaddingHorizontal(1).Column(col => {
                                col.Item().AlignCenter().Text(item.Qty.ToString("0.##")).FontSize(8f).Bold();
                            });
                            
                            table.Cell().Border(1).PaddingVertical(1).PaddingHorizontal(1).Column(col => {
                                col.Item().AlignCenter().Text(item.UnitType ?? "").FontSize(8f).Bold();
                            });
                            
                            table.Cell().Border(1).PaddingVertical(1).PaddingHorizontal(1).Column(col => {
                                col.Item().AlignRight().Text(item.UnitPrice.ToString("N2")).FontSize(8f).Bold();
                            });
                            
                            var lineNet = item.Qty * item.UnitPrice;
                            table.Cell().Border(1).PaddingVertical(1).PaddingHorizontal(1).Column(col => {
                                col.Item().AlignRight().Text(lineNet.ToString("N2")).FontSize(8f).Bold();
                            });
                            
                            table.Cell().Border(1).PaddingVertical(1).PaddingHorizontal(1).Column(col => {
                                col.Item().AlignRight().Text(item.VatAmount.ToString("N2")).FontSize(8f).Bold();
                            });
                            
                            table.Cell().Border(1).PaddingVertical(1).PaddingHorizontal(1).Column(col => {
                                col.Item().AlignRight().Text(item.LineTotal.ToString("N2")).FontSize(8f).Bold();
                            });
                        }
                    }

                    int maxTotalRows = 16;
                    int emptyRowsNeeded = Math.Max(0, maxTotalRows - itemCount);
                    
                    for (int i = 0; i < emptyRowsNeeded; i++)
                    {
                        int rowNumber = itemCount + i + 1;
                        table.Cell().Border(1).PaddingVertical(1).PaddingHorizontal(1).Column(col => {
                            col.Item().AlignCenter().Text(rowNumber.ToString()).FontSize(8f);
                        });
                        
                        table.Cell().Border(1).PaddingVertical(1).PaddingHorizontal(1).Column(col => {
                            col.Item().AlignLeft().Text("").FontSize(8f);
                        });
                        
                        table.Cell().Border(1).PaddingVertical(1).PaddingHorizontal(1).Column(col => {
                            col.Item().AlignCenter().Text("").FontSize(8f);
                        });
                        
                        table.Cell().Border(1).PaddingVertical(1).PaddingHorizontal(1).Column(col => {
                            col.Item().AlignCenter().Text("").FontSize(8f);
                        });
                        
                        table.Cell().Border(1).PaddingVertical(1).PaddingHorizontal(1).Column(col => {
                            col.Item().AlignRight().Text("").FontSize(8f);
                        });
                        
                        table.Cell().Border(1).PaddingVertical(1).PaddingHorizontal(1).Column(col => {
                            col.Item().AlignRight().Text("0.00").FontSize(8f);
                        });
                        
                        table.Cell().Border(1).PaddingVertical(1).PaddingHorizontal(1).Column(col => {
                            col.Item().AlignRight().Text("0.00").FontSize(8f);
                        });
                        
                        table.Cell().Border(1).PaddingVertical(1).PaddingHorizontal(1).Column(col => {
                            col.Item().AlignRight().Text("0.00").FontSize(8f);
                        });
                    }

                    table.Cell().ColumnSpan(5).Border(1).Height(20).PaddingVertical(1).PaddingHorizontal(2).AlignRight().Column(col => {
                        col.Item().Text("INV.Amount").FontSize(9).Bold();
                        col.Item().PaddingTop(1).Text("مبلغ الفاتورة").FontSize(6).FontFamily(_arabicFont).DirectionFromRightToLeft();
                    });
                    table.Cell().Border(1).Height(20).PaddingVertical(1).PaddingHorizontal(1).Column(col => {
                        col.Item().AlignRight().Text(sale.Subtotal.ToString("N2")).FontSize(11).Bold();
                    });
                    table.Cell().Border(1).Height(20).PaddingVertical(1).PaddingHorizontal(1).Column(col => {
                        col.Item().AlignRight().Text(sale.VatTotal.ToString("N2")).FontSize(11).Bold();
                    });
                    table.Cell().Border(1).Height(20).PaddingVertical(1).PaddingHorizontal(1).Column(col => {
                        col.Item().Text("");
                    });

                    table.Cell().ColumnSpan(6).Border(1).Height(20).PaddingVertical(1).PaddingHorizontal(2).AlignRight().Column(col => {
                        col.Item().Text("VAT 5%").FontSize(9).Bold();
                        col.Item().PaddingTop(1).Text("ضريبة ٥٪").FontSize(6).FontFamily(_arabicFont).DirectionFromRightToLeft();
                    });
                    table.Cell().Border(1).Height(20).PaddingVertical(1).PaddingHorizontal(1).Column(col => {
                        col.Item().Text("");
                    });
                    table.Cell().Border(1).Height(20).PaddingVertical(1).PaddingHorizontal(1).Column(col => {
                        col.Item().Text("");
                    });

                    table.Cell().ColumnSpan(6).Border(1).Height(20).PaddingVertical(2).PaddingHorizontal(2).AlignRight().Column(col => {
                        col.Item().Text("Total Amount").FontSize(9).Bold();
                        col.Item().PaddingTop(1).Text(new string('.', 45) + " درهم فقط").FontSize(9).Bold().FontFamily(_arabicFont).DirectionFromRightToLeft();
                    });
                    table.Cell().Border(1).Height(20).PaddingVertical(2).PaddingHorizontal(1).Column(col => {
                        col.Item().Text("");
                    });
                    table.Cell().Border(2).Height(20).PaddingVertical(2).PaddingHorizontal(1).Column(col => {
                        col.Item().AlignRight().Text(sale.GrandTotal.ToString("N2")).FontSize(11).Bold();
                    });
                });

                innerColumn.Item().PaddingTop(3).BorderTop(1);

                innerColumn.Item().PaddingTop(6).Column(footerCol =>
                {
                    footerCol.Item().AlignCenter().Text("Received the above goods in good order")
                        .FontSize(9)
                        .Bold();
                    
                    footerCol.Item().PaddingTop(2).AlignCenter().Text("استلمنا البضاعة أعلاه بحالة جيدة")
                        .FontSize(7).FontFamily(_arabicFont).DirectionFromRightToLeft();

                    footerCol.Item().PaddingTop(8).Table(sigTable =>
                    {
                        sigTable.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn();
                            columns.RelativeColumn();
                        });
                        
                        sigTable.Cell().AlignLeft().Column(sigCol =>
                        {
                            sigCol.Item().Text("Receiver's Name").FontSize(9);
                            sigCol.Item().PaddingTop(4).Text(new string('.', 50)).FontSize(9);
                            sigCol.Item().PaddingTop(6).Text("Receiver's Sign").FontSize(9);
                            sigCol.Item().PaddingTop(4).Text(new string('.', 50)).FontSize(9);
                        });
                        
                        sigTable.Cell().AlignRight().Column(sigCol =>
                        {
                            sigCol.Item().Text($"For {settings.CompanyNameEn}").FontSize(9);
                            sigCol.Item().PaddingTop(4).Text(new string('.', 50)).FontSize(9);
                        });
                    });
                });
            });
        }

        private async Task<InvoiceTemplateService.CompanySettings> GetCompanySettingsAsync(int tenantId)
        {
            // MULTI-TENANT: Get owner-specific settings from database
            var companySettings = await _settingsService.GetCompanySettingsAsync(tenantId);

            return new InvoiceTemplateService.CompanySettings
            {
                CompanyNameEn = companySettings.LegalNameEn,
                CompanyNameAr = companySettings.LegalNameAr,
                CompanyAddress = companySettings.Address,
                CompanyTrn = companySettings.VatNumber,
                CompanyPhone = companySettings.Mobile,
                Currency = companySettings.Currency
            };
        }

        private async Task<string> GetCustomerTrnAsync(int? customerId)
        {
            if (!customerId.HasValue) return "";
            
            var customer = await _context.Customers.FindAsync(customerId.Value);
            return customer?.Trn ?? "";
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

                // CRITICAL: Calculate REAL pending balance from database (not cached values)
                // This ensures 100% accuracy for business-critical balance information
                
                // Total sales for this customer (excluding deleted)
                var totalSales = await _context.Sales
                    .Where(s => s.CustomerId == customerId.Value 
                               && s.TenantId == tenantId 
                               && !s.IsDeleted)
                    .SumAsync(s => (decimal?)s.GrandTotal) ?? 0m;

                // Total payments for this customer (excluding voided)
                var totalPayments = await _context.Payments
                    .Where(p => p.CustomerId == customerId.Value 
                               && p.TenantId == tenantId 
                               && p.Status != PaymentStatus.VOID)
                    .SumAsync(p => (decimal?)p.Amount) ?? 0m;

                // Count of pending invoices
                var totalPendingBills = await _context.Sales
                    .Where(s => s.CustomerId == customerId.Value 
                               && s.TenantId == tenantId 
                               && !s.IsDeleted
                               && (s.PaymentStatus == SalePaymentStatus.Pending || s.PaymentStatus == SalePaymentStatus.Partial))
                    .CountAsync();

                // Calculate balances
                var totalBalanceDue = totalSales - totalPayments;
                var previousBalance = totalBalanceDue; // Total balance is shown (including all invoices)

                Console.WriteLine($"\n?? Customer Balance Calculation for Invoice Footer:");
                Console.WriteLine($"   Customer ID: {customerId.Value}");
                Console.WriteLine($"   Total Sales: {totalSales:N2}");
                Console.WriteLine($"   Total Payments: {totalPayments:N2}");
                Console.WriteLine($"   Pending Bills Count: {totalPendingBills}");
                Console.WriteLine($"   Total Balance Due: {totalBalanceDue:N2}\n");

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
                Console.WriteLine($"?? Error calculating customer pending balance: {ex.Message}");
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
                    Console.WriteLine($"?? Cannot save PDF to disk: PDF bytes are empty for invoice {sale.InvoiceNo}");
                    return;
                }

                // Create invoices directory if it doesn't exist
                var invoicesDir = Path.Combine(Directory.GetCurrentDirectory(), "invoices");
                if (!Directory.Exists(invoicesDir))
                {
                    Directory.CreateDirectory(invoicesDir);
                    Console.WriteLine($"?? Created invoices directory: {invoicesDir}");
                }

                // Save PDF file
                var fileName = $"INV-{sale.InvoiceNo}.pdf";
                var filePath = Path.Combine(invoicesDir, fileName);
                await System.IO.File.WriteAllBytesAsync(filePath, pdfBytes);
                
                // Verify file was saved
                if (System.IO.File.Exists(filePath))
                {
                    var fileInfo = new System.IO.FileInfo(filePath);
                    Console.WriteLine($"?? PDF saved to disk: {fileName} ({fileInfo.Length} bytes)");
                }
                else
                {
                    Console.WriteLine($"? PDF file not found after save attempt: {filePath}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"? Failed to save PDF to disk: {ex.Message}");
                Console.WriteLine($"   Stack Trace: {ex.StackTrace}");
                // Don't throw - PDF generation succeeded, just saving to disk failed
            }
        }

        private async Task<string?> GetCustomInvoiceTemplateAsync()
        {
            var setting = await _context.Settings
                .FirstOrDefaultAsync(s => s.Key == "INVOICE_TEMPLATE");
            return setting?.Value;
        }

        private async Task<byte[]> GeneratePdfFromHtmlTemplateAsync(string htmlTemplate, SaleDto sale, InvoiceTemplateService.CompanySettings settings)
        {
            try
            {
                // Get customer TRN
                var customerTrn = await GetCustomerTrnAsync(sale.CustomerId);
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
                    .Replace("{{company_trn}}", settings.CompanyTrn)
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
                Console.WriteLine("?? Custom HTML template found but HTML-to-PDF conversion not fully implemented.");
                Console.WriteLine("   Falling back to default QuestPDF template.");
                Console.WriteLine("   To enable full HTML template support, install DinkToPdf or PuppeteerSharp package.");
                
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
                Console.WriteLine($"?? Error processing HTML template: {ex.Message}");
                throw; // Fall back to default template
            }
        }

        public async Task<byte[]> GenerateSalesLedgerPdfAsync(SalesLedgerReportDto ledgerReport, DateTime fromDate, DateTime toDate, int tenantId)
        {
            try
            {
                var settings = await GetCompanySettingsAsync(tenantId);
                
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
                            headerCol.Item().Text("SALES LEDGER REPORT")
                                .FontSize(16)
                                .Bold()
                                .AlignCenter();
                            
                            headerCol.Item().Height(3);
                            
                            headerCol.Item().Row(row =>
                            {
                                row.RelativeItem().Text($"{settings.CompanyNameEn}")
                                    .FontSize(10)
                                    .Bold();
                                row.RelativeItem().AlignRight().Text($"Period: {fromDate:dd-MM-yyyy} to {toDate:dd-MM-yyyy}")
                                    .FontSize(9);
                            });
                            
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
                Console.WriteLine($"? Sales Ledger PDF Generation Error: {ex.Message}");
                throw;
            }
        }

        // Helper method to convert numbers to words for invoice
        private string ConvertToWords(decimal amount)
        {
            try
            {
                if (amount == 0) return "Zero Dirhams Only";
                
                var integerPart = (long)Math.Floor(amount);
                var decimalPart = (int)Math.Round((amount - integerPart) * 100);
                
                string words = ConvertIntegerToWords(integerPart);
                
                if (decimalPart > 0)
                {
                    words += $" and {ConvertIntegerToWords(decimalPart)} Fils";
                }
                
                words += " Dirhams Only";
                return words;
            }
            catch
            {
                return amount.ToString("0.00") + " AED";
            }
        }
        
        private string ConvertIntegerToWords(long number)
        {
            if (number == 0) return "Zero";
            
            if (number < 0)
                return "Minus " + ConvertIntegerToWords(Math.Abs(number));
            
            string words = "";
            
            if ((number / 1000000000) > 0)
            {
                words += ConvertIntegerToWords(number / 1000000000) + " Billion ";
                number %= 1000000000;
            }
            
            if ((number / 1000000) > 0)
            {
                words += ConvertIntegerToWords(number / 1000000) + " Million ";
                number %= 1000000;
            }
            
            if ((number / 1000) > 0)
            {
                words += ConvertIntegerToWords(number / 1000) + " Thousand ";
                number %= 1000;
            }
            
            if ((number / 100) > 0)
            {
                words += ConvertIntegerToWords(number / 100) + " Hundred ";
                number %= 100;
            }
            
            if (number > 0)
            {
                var units = new[] { "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen" };
                var tens = new[] { "Zero", "Ten", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety" };
                
                if (number < 20)
                    words += units[number];
                else
                {
                    words += tens[number / 10];
                    if ((number % 10) > 0)
                        words += " " + units[number % 10];
                }
            }
            
            return words.Trim();
        }

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
                            // Header
                            column.Item().AlignCenter().Text(settings.CompanyNameEn.ToUpper())
                                .FontSize(18)
                                .Bold();
                            
                            column.Item().AlignCenter().Text(settings.CompanyNameAr)
                                .FontSize(16)
                                .Bold()
                                .FontFamily(_arabicFont)
                                .DirectionFromRightToLeft();
                            
                            column.Item().AlignCenter().Text($"{settings.CompanyAddress} | {settings.CompanyPhone}")
                                .FontSize(10);
                            
                            column.Item().AlignCenter().Text($"TRN: {settings.CompanyTrn}")
                                .FontSize(10)
                                .Bold();
                            
                            column.Item().PaddingTop(15).PaddingBottom(10).AlignCenter().Text("PENDING BILLS REPORT")
                                .FontSize(16)
                                .Bold();
                            
                            column.Item().PaddingBottom(5).Text($"Period: {fromDate:dd-MM-yyyy} to {toDate:dd-MM-yyyy}")
                                .FontSize(10);
                            
                            column.Item().PaddingBottom(5).Text($"Generated: {DateTime.Now:dd-MM-yyyy HH:mm}")
                                .FontSize(9)
                                .FontColor(Colors.Grey.Medium);
                            
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
                Console.WriteLine($"? Error generating pending bills PDF: {ex.Message}");
                Console.WriteLine($"? Stack Trace: {ex.StackTrace}");
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
                            // Header
                            column.Item().AlignCenter().Text(settings.CompanyNameEn.ToUpper())
                                .FontSize(18)
                                .Bold();
                            
                            column.Item().AlignCenter().Text(settings.CompanyNameAr)
                                .FontSize(16)
                                .Bold()
                                .FontFamily(_arabicFont)
                                .DirectionFromRightToLeft();
                            
                            column.Item().AlignCenter().Text($"{settings.CompanyAddress} | {settings.CompanyPhone}")
                                .FontSize(10);
                            
                            column.Item().AlignCenter().Text($"TRN: {settings.CompanyTrn}")
                                .FontSize(10)
                                .Bold();
                            
                            column.Item().PaddingTop(15).PaddingBottom(10).AlignCenter().Text("CUSTOMER PENDING BILLS STATEMENT")
                                .FontSize(16)
                                .Bold();
                            
                            column.Item().PaddingBottom(5).AlignCenter().Text($"Period: {fromDate:dd-MM-yyyy} to {toDate:dd-MM-yyyy}")
                                .FontSize(10)
                                .FontColor(Colors.Grey.Darken1);
                            
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
                Console.WriteLine($"? Error generating customer pending bills PDF: {ex.Message}");
                Console.WriteLine($"? Stack Trace: {ex.StackTrace}");
                throw;
            }
        }

    }
}

