/*
Purpose: Generate printable barcode label PDFs (Code128) for products
*/
using HexaBill.Api.Models;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.PixelFormats;
using ZXing;
using ZXing.Common;
using ImgSharp = SixLabors.ImageSharp.Image;

namespace HexaBill.Api.Modules.Inventory
{
    public interface IProductBarcodeLabelService
    {
        byte[] GenerateLabelsPdf(IReadOnlyList<ProductDto> products);
    }

    public class ProductBarcodeLabelService : IProductBarcodeLabelService
    {
        public byte[] GenerateLabelsPdf(IReadOnlyList<ProductDto> products)
        {
            QuestPDF.Settings.License = LicenseType.Community;

            var withBarcode = products
                .Where(p => !string.IsNullOrWhiteSpace(p.Barcode))
                .ToList();

            if (withBarcode.Count == 0)
                throw new InvalidOperationException("No products with barcodes to print.");

            var doc = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(12, Unit.Millimetre);
                    page.DefaultTextStyle(x => x.FontSize(9));

                    page.Header().Text("Product barcode labels").SemiBold().FontSize(12);
                    page.Content().Column(col =>
                    {
                        col.Spacing(8);
                        col.Item().Table(table =>
                        {
                            table.ColumnsDefinition(c =>
                            {
                                c.RelativeColumn();
                                c.RelativeColumn();
                            });

                            foreach (var product in withBarcode)
                            {
                                var png = RenderCode128Png(product.Barcode!);
                                table.Cell().Border(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(6).Column(cell =>
                                {
                                    var name = product.NameEn ?? "";
                                    if (name.Length > 60) name = name[..57] + "...";
                                    cell.Item().Text(name).SemiBold().FontSize(9);
                                    cell.Item().Text($"SKU: {product.Sku}").FontSize(8).FontColor(Colors.Grey.Darken1);
                                    cell.Item().PaddingTop(4).AlignCenter().Height(42).Image(png).FitArea();
                                    cell.Item().AlignCenter().Text(product.Barcode).FontSize(8).FontFamily("Courier New");
                                });
                            }
                        });
                    });
                });
            });

            return doc.GeneratePdf();
        }

        private static byte[] RenderCode128Png(string content)
        {
            var writer = new BarcodeWriterPixelData
            {
                Format = BarcodeFormat.CODE_128,
                Options = new EncodingOptions
                {
                    Height = 80,
                    Width = 280,
                    Margin = 2,
                    PureBarcode = true
                }
            };

            var pixelData = writer.Write(content);
            using var image = ImgSharp.LoadPixelData<Rgb24>(pixelData.Pixels, pixelData.Width, pixelData.Height);
            using var ms = new MemoryStream();
            image.Save(ms, new PngEncoder());
            return ms.ToArray();
        }
    }
}
