using System.Collections.Generic;
using System.Linq;
using HexaBill.Api.Models;
using HexaBill.Api.Models.Legacy;

namespace HexaBill.Api.Modules.Legacy
{
    /// <summary>
    /// Maps a read-only historical (Starplus) invoice onto the live <see cref="SaleDto"/> shape so the
    /// normal A4 invoice renderer prints it: same template, items, totals and footers. Nothing is
    /// persisted and no line is invented: a historical invoice without source lines is not printable.
    /// </summary>
    public static class LegacyInvoicePdfMapper
    {
        public static bool HasPrintableLines(LegacyInvoice invoice) =>
            invoice.Items != null && invoice.Items.Count > 0;

        public static SaleDto ToSaleDto(LegacyInvoice invoice, int tenantId)
        {
            return new SaleDto
            {
                // Historical convention: negative Id, LegacyInvoiceId carries the positive source id.
                Id = -invoice.Id,
                IsLegacy = true,
                LegacyInvoiceId = invoice.Id,
                LegacyIssuerName = invoice.LegacyIssuer,
                LegacyIssuerTrn = invoice.SourceLegalTaxId,
                OwnerId = tenantId,
                InvoiceNo = invoice.LegacyInvoiceNumber,
                InvoiceDate = invoice.InvoiceDate,
                CustomerId = invoice.DestinationCustomerId,
                CustomerName = invoice.CustomerName,
                Subtotal = invoice.Subtotal,
                VatTotal = invoice.VatTotal,
                Discount = invoice.Discount,
                RoundOff = invoice.RoundOff,
                GrandTotal = invoice.GrandTotal,
                PaidAmount = invoice.PaidAmount,
                Items = (invoice.Items ?? new List<LegacyInvoiceItem>())
                    .OrderBy(it => it.SourceItemId)
                    .Select(it => new SaleItemDto
                    {
                        Id = it.Id,
                        ProductId = it.DestinationProductId ?? 0,
                        ProductName = it.ProductName,
                        UnitType = string.IsNullOrWhiteSpace(it.UnitType) ? "PCS" : it.UnitType,
                        Qty = it.Quantity,
                        UnitPrice = it.UnitPrice,
                        Discount = it.Discount,
                        VatAmount = it.VatAmount,
                        LineTotal = it.LineTotal
                    })
                    .ToList()
            };
        }
    }
}
