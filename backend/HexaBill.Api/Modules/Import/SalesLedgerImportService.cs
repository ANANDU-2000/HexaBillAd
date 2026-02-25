/*
 * Sales Ledger Import - Parse Excel/CSV from old app (ZAYOGA-style) and create customers, sales, payments.
 */
using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using OfficeOpenXml;
using HexaBill.Api.Data;
using HexaBill.Api.Models;

namespace HexaBill.Api.Modules.Import
{
    public class SalesLedgerParseResult
    {
        public List<string> Headers { get; set; } = new();
        public List<List<string>> Rows { get; set; } = new();
        public string? Error { get; set; }
    }

    public class SalesLedgerApplyRequest
    {
        public Dictionary<string, int> ColumnMapping { get; set; } = new(); // e.g. { "invoiceNo": 1, "customerName": 2 }
        public List<List<string>> Rows { get; set; } = new();
        public bool SkipDuplicates { get; set; } = true;
    }

    public class SalesLedgerApplyResult
    {
        public int CustomersCreated { get; set; }
        public int SalesCreated { get; set; }
        public int PaymentsCreated { get; set; }
        public int Skipped { get; set; }
        public List<string> Errors { get; set; } = new();
    }

    public interface ISalesLedgerImportService
    {
        Task<SalesLedgerParseResult> ParseFileAsync(Stream fileStream, string fileName, int maxRows = 500);
        Task<SalesLedgerApplyResult> ApplyImportAsync(int tenantId, int userId, SalesLedgerApplyRequest request);
    }

    public class SalesLedgerImportService : ISalesLedgerImportService
    {
        private readonly AppDbContext _context;

        public SalesLedgerImportService(AppDbContext context)
        {
            _context = context;
            ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        }

        public async Task<SalesLedgerParseResult> ParseFileAsync(Stream fileStream, string fileName, int maxRows = 500)
        {
            var result = new SalesLedgerParseResult();
            var ext = Path.GetExtension(fileName).ToLowerInvariant();

            try
            {
                if (ext == ".csv")
                {
                    await ParseCsvAsync(fileStream, result, maxRows);
                }
                else if (ext == ".xlsx" || ext == ".xls")
                {
                    ParseExcel(fileStream, result, maxRows);
                }
                else
                {
                    result.Error = "Unsupported file type. Use .csv, .xlsx or .xls.";
                }
            }
            catch (Exception ex)
            {
                result.Error = ex.Message;
            }

            return await Task.FromResult(result);
        }

        private static async Task ParseCsvAsync(Stream stream, SalesLedgerParseResult result, int maxRows)
        {
            using var reader = new StreamReader(stream, Encoding.UTF8);
            var firstLine = await reader.ReadLineAsync();
            if (string.IsNullOrWhiteSpace(firstLine))
            {
                result.Error = "File is empty.";
                return;
            }
            var headers = ParseCsvLine(firstLine);
            result.Headers = headers;
            var count = 0;
            while (count < maxRows && await reader.ReadLineAsync() is { } line)
            {
                result.Rows.Add(ParseCsvLine(line));
                count++;
            }
        }

        private static List<string> ParseCsvLine(string line)
        {
            var list = new List<string>();
            var sb = new StringBuilder();
            var inQuotes = false;
            for (var i = 0; i < line.Length; i++)
            {
                var c = line[i];
                if (c == '"')
                {
                    inQuotes = !inQuotes;
                    continue;
                }
                if (inQuotes)
                {
                    sb.Append(c);
                    continue;
                }
                if (c == '\t' || c == ',')
                {
                    list.Add(sb.ToString().Trim());
                    sb.Clear();
                    continue;
                }
                sb.Append(c);
            }
            list.Add(sb.ToString().Trim());
            return list;
        }

        private void ParseExcel(Stream stream, SalesLedgerParseResult result, int maxRows)
        {
            using var package = new ExcelPackage(stream);
            var sheet = package.Workbook.Worksheets.FirstOrDefault(w => w.Dimension != null) ?? package.Workbook.Worksheets[0];
            if (sheet?.Dimension == null)
            {
                result.Error = "Excel sheet is empty.";
                return;
            }
            var cols = sheet.Dimension.End.Column;
            for (var c = 1; c <= cols; c++)
                result.Headers.Add(sheet.Cells[1, c].GetValue<string>() ?? $"Col{c}");
            var startRow = 2;
            for (var r = startRow; r < startRow + maxRows && r <= sheet.Dimension.End.Row; r++)
            {
                var row = new List<string>();
                for (var c = 1; c <= cols; c++)
                    row.Add(sheet.Cells[r, c].GetValue<string>()?.Trim() ?? "");
                result.Rows.Add(row);
            }
        }

        public async Task<SalesLedgerApplyResult> ApplyImportAsync(int tenantId, int userId, SalesLedgerApplyRequest request)
        {
            var res = new SalesLedgerApplyResult();
            var map = request.ColumnMapping;
            if (!map.TryGetValue("invoiceNo", out var invCol) || !map.TryGetValue("customerName", out var custCol))
            {
                res.Errors.Add("Column mapping must include invoiceNo and customerName.");
                return res;
            }
            map.TryGetValue("paymentType", out var payTypeCol);
            map.TryGetValue("paymentDate", out var payDateCol);
            map.TryGetValue("netSales", out var netSalesCol);
            map.TryGetValue("vat", out var vatCol);
            map.TryGetValue("sales", out var salesCol);
            map.TryGetValue("discount", out var discountCol);
            map.TryGetValue("cost", out var costCol);

            var placeholderProduct = await GetOrCreatePlaceholderProductAsync(tenantId);
            if (placeholderProduct == null)
            {
                res.Errors.Add("Could not create placeholder product for ledger items.");
                return res;
            }

            var existingInvoices = await _context.Sales
                .Where(s => s.TenantId == tenantId && !s.IsDeleted)
                .Select(s => s.InvoiceNo)
                .ToHashSetAsync();

            await using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                foreach (var row in request.Rows)
                {
                    var invoiceNo = GetCell(row, invCol);
                    var customerName = GetCell(row, custCol);
                    if (string.IsNullOrWhiteSpace(invoiceNo) || string.IsNullOrWhiteSpace(customerName))
                    {
                        res.Skipped++;
                        continue;
                    }
                    if (request.SkipDuplicates && existingInvoices.Contains(invoiceNo.Trim()))
                    {
                        res.Skipped++;
                        continue;
                    }

                    var (customer, customerCreated) = await GetOrCreateCustomerAsync(tenantId, customerName.Trim());
                    if (customer == null)
                    {
                        res.Errors.Add($"Row: could not get/create customer '{customerName}'.");
                        throw new InvalidOperationException($"Row: could not get/create customer '{customerName}'.");
                    }
                    if (customerCreated) res.CustomersCreated++;

                    var paymentType = payTypeCol >= 0 ? GetCell(row, payTypeCol).ToUpperInvariant() : "CREDIT";
                    var payDateStr = payDateCol >= 0 ? GetCell(row, payDateCol) : null;
                    var netSales = ParseDecimal(GetCell(row, netSalesCol >= 0 ? netSalesCol : -1)) ?? ParseDecimal(GetCell(row, salesCol >= 0 ? salesCol : -1)) ?? 0;
                    var vatAmount = ParseDecimal(GetCell(row, vatCol >= 0 ? vatCol : -1)) ?? 0;
                    var discountAmount = ParseDecimal(GetCell(row, discountCol >= 0 ? discountCol : -1)) ?? 0;
                    var subtotal = netSales - vatAmount;
                    if (subtotal < 0) subtotal = 0;
                    var grandTotal = netSales;

                    DateTime invoiceDate;
                    if (!string.IsNullOrWhiteSpace(payDateStr) && DateTime.TryParse(payDateStr, CultureInfo.InvariantCulture, DateTimeStyles.None, out var pd))
                        invoiceDate = pd.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(pd, DateTimeKind.Utc) : pd.ToUniversalTime();
                    else
                        invoiceDate = DateTime.UtcNow.Date;

                    var sale = new Sale
                    {
                        TenantId = tenantId,
                        OwnerId = tenantId,
                        InvoiceNo = invoiceNo.Trim(),
                        InvoiceDate = invoiceDate,
                        CustomerId = customer.Id,
                        Subtotal = subtotal,
                        VatTotal = vatAmount,
                        Discount = discountAmount,
                        GrandTotal = grandTotal,
                        TotalAmount = grandTotal,
                        PaidAmount = 0,
                        PaymentStatus = SalePaymentStatus.Pending,
                        IsFinalized = true,
                        CreatedBy = userId,
                        CreatedAt = DateTime.UtcNow
                    };
                    var isCash = paymentType.Contains("CASH") && !paymentType.Contains("CREDIT");
                    if (isCash)
                    {
                        sale.PaidAmount = grandTotal;
                        sale.PaymentStatus = SalePaymentStatus.Paid;
                        sale.LastPaymentDate = invoiceDate;
                    }

                    _context.Sales.Add(sale);
                    await _context.SaveChangesAsync();

                    var saleItem = new SaleItem
                    {
                        SaleId = sale.Id,
                        ProductId = placeholderProduct.Id,
                        UnitType = "PCS",
                        Qty = 1,
                        UnitPrice = grandTotal,
                        Discount = 0,
                        VatAmount = vatAmount,
                        LineTotal = grandTotal
                    };
                    _context.SaleItems.Add(saleItem);

                    if (isCash)
                    {
                        var payment = new Payment
                        {
                            TenantId = tenantId,
                            SaleId = sale.Id,
                            CustomerId = customer.Id,
                            Amount = grandTotal,
                            Mode = PaymentMode.CASH,
                            Status = PaymentStatus.CLEARED,
                            PaymentDate = invoiceDate,
                            CreatedBy = userId,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow,
                            RowVersion = Array.Empty<byte>()
                        };
                        _context.Payments.Add(payment);
                        res.PaymentsCreated++;
                    }

                    await _context.SaveChangesAsync();

                    customer.Balance += sale.GrandTotal;
                    if (sale.PaidAmount > 0)
                        customer.Balance -= sale.PaidAmount;
                    await _context.SaveChangesAsync();

                    existingInvoices.Add(sale.InvoiceNo);
                    res.SalesCreated++;
                }

                await transaction.CommitAsync();
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                res.CustomersCreated = 0;
                res.SalesCreated = 0;
                res.PaymentsCreated = 0;
                res.Errors.Add($"Import failed (rolled back): {ex.Message}");
            }

            return res;
        }

        private static string GetCell(List<string> row, int colIndex)
        {
            if (colIndex < 0 || colIndex >= row.Count) return "";
            return row[colIndex] ?? "";
        }

        private static decimal? ParseDecimal(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            value = value.Trim().Replace(",", "");
            if (decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var d))
                return d;
            return null;
        }

        private async Task<Product?> GetOrCreatePlaceholderProductAsync(int tenantId)
        {
            var existing = await _context.Products
                .FirstOrDefaultAsync(p => p.TenantId == tenantId && p.Sku == "LEDGER-IMPORT");
            if (existing != null) return existing;
            var now = DateTime.UtcNow;
            var p = new Product
            {
                TenantId = tenantId,
                OwnerId = tenantId,
                Sku = "LEDGER-IMPORT",
                NameEn = "Imported Ledger Item",
                StockQty = 0,
                ReorderLevel = 0,
                UnitType = "PCS",
                ConversionToBase = 1,
                SellPrice = 0,
                CostPrice = 0,
                CreatedAt = now,
                UpdatedAt = now
            };
            _context.Products.Add(p);
            await _context.SaveChangesAsync();
            return p;
        }

        private async Task<(Customer? Customer, bool Created)> GetOrCreateCustomerAsync(int tenantId, string name)
        {
            var existing = await _context.Customers
                .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Name == name);
            if (existing != null) return (existing, false);
            var cust = new Customer
            {
                TenantId = tenantId,
                OwnerId = tenantId,
                Name = name,
                Balance = 0,
                CustomerType = CustomerType.Credit,
                CreatedAt = DateTime.UtcNow
            };
            _context.Customers.Add(cust);
            await _context.SaveChangesAsync();
            return (cust, true);
        }
    }
}
