const fs = require('fs');
const path = require('path');

const filePath = path.resolve('backend/HexaBill.Api/Modules/Sales/SaleService.cs');
let content = fs.readFileSync(filePath, 'utf8');

const regex = /(public\s+async\s+Task<SaleDto\?>\s+GetSaleByIdAsync\s*\([^)]*\)\s*\{)/;

const match = content.match(regex);
if (!match) {
    console.error('Regex match not found');
    process.exit(1);
}

const replacement = `$1
            // Tenant 20 (FrozenHub 1) Starplus continuity: Handle legacy negative or direct IDs
            if (tenantId == 20 && id < 0)
            {
                var legId = -id;
                var legacy = await _context.LegacyInvoices.AsNoTracking()
                    .Include(li => li.Items)
                    .Include(li => li.Payments)
                    .FirstOrDefaultAsync(li => li.Id == legId && li.TenantId == tenantId);
                if (legacy != null)
                {
                    return new SaleDto
                    {
                        Id = -legacy.Id,
                        ExternalReference = legacy.ExternalReference ?? $"starplus-inv-{legacy.LegacyInvoiceNumber}",
                        OwnerId = legacy.TenantId,
                        InvoiceNo = legacy.LegacyInvoiceNumber,
                        InvoiceDate = legacy.InvoiceDate,
                        CustomerId = legacy.DestinationCustomerId,
                        CustomerName = legacy.CustomerName,
                        Subtotal = legacy.Subtotal,
                        VatTotal = legacy.VatTotal,
                        Discount = legacy.Discount,
                        RoundOff = legacy.RoundOff,
                        GrandTotal = legacy.GrandTotal,
                        PaidAmount = legacy.PaidAmount,
                        PaymentStatus = legacy.OutstandingCalculated <= SalePaymentHelpers.SettlementToleranceAed ? "PAID" : (legacy.PaidAmount > 0 ? "PARTIAL" : "PENDING"),
                        Notes = legacy.Notes ?? "Historical Starplus invoice",
                        IsLocked = true,
                        Items = legacy.Items.Select(i => new SaleItemDto
                        {
                            Id = i.Id,
                            ProductId = i.DestinationProductId ?? 0,
                            ProductName = i.ProductName,
                            UnitType = i.UnitType,
                            Qty = i.Quantity,
                            UnitPrice = i.UnitPrice,
                            Discount = i.Discount,
                            VatAmount = i.VatAmount,
                            LineTotal = i.LineTotal
                        }).ToList(),
                        Payments = legacy.Payments.Select(p => new SalePaymentLineDto
                        {
                            Method = p.Mode,
                            Amount = p.Amount,
                            Status = p.Status
                        }).ToList()
                    };
                }
            }`;

content = content.replace(regex, replacement);
fs.writeFileSync(filePath, content, 'utf8');
console.log('SaleService.cs successfully patched with regex!');
