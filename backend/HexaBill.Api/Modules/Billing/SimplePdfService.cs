using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using HexaBill.Api.Models;
using System.Text;
using HexaBill.Api.Modules.SuperAdmin;
using HexaBill.Api.Shared.Security;

namespace HexaBill.Api.Modules.Billing
{
    /// <summary>
    /// Simplified PDF Service with fallback for complex layouts that cause issues
    /// </summary>
    public class SimplePdfService
    {
        private readonly string _arabicFont;

        public SimplePdfService(IFontService fontService)
        {
            Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
            QuestPDF.Settings.License = LicenseType.Community;
            QuestPDF.Settings.CheckIfAllTextGlyphsAreAvailable = false;
            _arabicFont = fontService.GetArabicFontFamily();
            Console.WriteLine($"✅ SimplePdfService initialized with font: {_arabicFont}");
        }

        public byte[] GenerateSimpleInvoicePdf(SaleDto sale, InvoiceTemplateService.CompanySettings settings)
        {
            try
            {
                Console.WriteLine($"📄 Generating SIMPLE PDF for sale {sale.Id}");

                var document = Document.Create(container =>
                {
                    container.Page(page =>
                    {
                        page.Size(PageSizes.A4);
                        page.Margin(20, Unit.Millimetre);
                        page.PageColor(Colors.White);
                        page.DefaultTextStyle(x => x.FontSize(10).FontFamily("Calibri"));

                        page.Content().Column(column =>
                        {
                            column.Spacing(5);

                            // HEADER
                            column.Item().Text(settings.CompanyNameEn)
                                .FontSize(18)
                                .Bold()
                                .AlignCenter();

                            column.Item().Text(settings.CompanyNameAr)
                                .FontSize(14)
                                .AlignCenter();

                            column.Item().Text($"Tel: {settings.CompanyPhone}")
                                .FontSize(9)
                                .AlignCenter();

                            // TITLE
                            column.Item().PaddingVertical(5).Text("TAX INVOICE")
                                .FontSize(14)
                                .Bold()
                                .AlignCenter();

                            // INVOICE DETAILS
                            column.Item().Row(row =>
                            {
                                row.RelativeItem().Text($"Invoice #: {sale.InvoiceNo}").FontSize(9).Bold();
                                row.RelativeItem().AlignRight().Text($"Date: {sale.InvoiceDate:dd-MM-yyyy}").FontSize(9).Bold();
                            });

                            column.Item().Text($"Customer: {sale.CustomerName ?? "Cash Customer"}")
                                .FontSize(9).Bold();

                            // ITEMS TABLE - SIMPLIFIED
                            column.Item().Table(table =>
                            {
                                table.ColumnsDefinition(c =>
                                {
                                    c.RelativeColumn(1f);   // SL
                                    c.RelativeColumn(4f);   // Description
                                    c.RelativeColumn(1f);   // Qty
                                    c.RelativeColumn(1f);   // Unit
                                    c.RelativeColumn(1.5f); // Price
                                    c.RelativeColumn(1.5f); // VAT
                                    c.RelativeColumn(1.5f); // Total
                                });

                                // HEADER
                                table.Header(h =>
                                {
                                    h.Cell().BorderBottom(1f).BorderColor("#000000").Text("SL").Bold().FontSize(8);
                                    h.Cell().BorderBottom(1f).BorderColor("#000000").Text("Description").Bold().FontSize(8);
                                    h.Cell().BorderBottom(1f).BorderColor("#000000").Text("Qty").Bold().FontSize(8);
                                    h.Cell().BorderBottom(1f).BorderColor("#000000").Text("Unit").Bold().FontSize(8);
                                    h.Cell().BorderBottom(1f).BorderColor("#000000").AlignRight().Text("Price").Bold().FontSize(8);
                                    h.Cell().BorderBottom(1f).BorderColor("#000000").AlignRight().Text("VAT").Bold().FontSize(8);
                                    h.Cell().BorderBottom(1f).BorderColor("#000000").AlignRight().Text("Total").Bold().FontSize(8);
                                });

                                // ITEMS
                                int itemNo = 1;
                                foreach (var item in sale.Items ?? new List<SaleItemDto>())
                                {
                                    table.Cell().BorderBottom(0.5f).Text(itemNo.ToString()).FontSize(8);
                                    table.Cell().BorderBottom(0.5f).Text(item.ProductName ?? "").FontSize(8);
                                    table.Cell().BorderBottom(0.5f).Text(item.Qty.ToString("0.##")).FontSize(8);
                                    table.Cell().BorderBottom(0.5f).Text(item.UnitType ?? "CRTN").FontSize(8);
                                    table.Cell().BorderBottom(0.5f).AlignRight().Text(item.UnitPrice.ToString("0.00")).FontSize(8);
                                    table.Cell().BorderBottom(0.5f).AlignRight().Text(item.VatAmount.ToString("0.00")).FontSize(8);
                                    table.Cell().BorderBottom(0.5f).AlignRight().Text(item.LineTotal.ToString("0.00")).FontSize(8).Bold();
                                    itemNo++;
                                }

                                // TOTALS
                                table.Cell().ColumnSpan(6).BorderTop(1f).BorderColor("#000000").AlignRight()
                                    .Text("Subtotal:").Bold().FontSize(9);
                                table.Cell().BorderTop(1f).BorderColor("#000000").AlignRight()
                                    .Text(sale.Subtotal.ToString("0.00")).Bold().FontSize(9);

                                table.Cell().ColumnSpan(6).AlignRight().Text("VAT (5%):").Bold().FontSize(9);
                                table.Cell().AlignRight().Text(sale.VatTotal.ToString("0.00")).Bold().FontSize(9);

                                table.Cell().ColumnSpan(6).BorderTop(2f).BorderColor("#000000").AlignRight()
                                    .Text("TOTAL:").Bold().FontSize(10);
                                table.Cell().BorderTop(2f).BorderColor("#000000").AlignRight()
                                    .Text(sale.GrandTotal.ToString("0.00")).Bold().FontSize(10);
                            });

                            // FOOTER
                            column.Item().PaddingTop(10).Text("Received in good condition")
                                .FontSize(8)
                                .AlignCenter();

                            column.Item().PaddingTop(5).Row(row =>
                            {
                                row.RelativeItem().Text("Signature: _____________").FontSize(8);
                                row.RelativeItem().AlignRight().Text("Date: _____________").FontSize(8);
                            });
                        });
                    });
                });

                var pdfBytes = document.GeneratePdf();
                Console.WriteLine($"✅ Simple PDF generated: {pdfBytes.Length} bytes");
                return pdfBytes;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ SimplePdfService Error: {ex.GetType().Name}");
                Console.WriteLine($"   Message: {ex.Message}");
                Console.WriteLine($"   Stack: {ex.StackTrace}");
                throw;
            }
        }
    }
}
