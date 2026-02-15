/*
Purpose: Excel import service for bulk product import
Author: AI Assistant
Date: 2024
*/
using OfficeOpenXml;
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using System.Text.RegularExpressions;

namespace HexaBill.Api.Modules.Inventory
{
    public interface IExcelImportService
    {
        Task<ExcelImportResult> ImportProductsFromExcelAsync(Stream excelStream, string fileName, int userId);
    }

    public class ExcelImportResult
    {
        public int TotalRows { get; set; }
        public int Imported { get; set; }
        public int Updated { get; set; }
        public int Skipped { get; set; }
        public int Errors { get; set; }
        public List<string> ErrorMessages { get; set; } = new();
        public List<string> CreatedCategories { get; set; } = new();
        public List<string> CreatedBrands { get; set; } = new();
        public List<ImportedProductSummary> ImportedProducts { get; set; } = new();
    }

    public class ImportedProductSummary
    {
        public string Sku { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty; // "New", "Updated", "Skipped", "Error"
        public string? ErrorMessage { get; set; }
    }

    public class ExcelImportService : IExcelImportService
    {
        private readonly AppDbContext _context;

        public ExcelImportService(AppDbContext context)
        {
            _context = context;
            ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        }

        public async Task<ExcelImportResult> ImportProductsFromExcelAsync(Stream excelStream, string fileName, int userId)
        {
            var result = new ExcelImportResult();
            
            using var package = new ExcelPackage(excelStream);
            var workbook = package.Workbook;
            
            if (workbook.Worksheets.Count == 0)
            {
                result.Errors++;
                result.ErrorMessages.Add("Excel file has no worksheets");
                return result;
            }

            // Process all worksheets
            foreach (var worksheet in workbook.Worksheets)
            {
                if (worksheet.Dimension == null) continue;
                
                var sheetResult = await ProcessWorksheetAsync(worksheet, userId);
                result.TotalRows += sheetResult.TotalRows;
                result.Imported += sheetResult.Imported;
                result.Updated += sheetResult.Updated;
                result.Skipped += sheetResult.Skipped;
                result.Errors += sheetResult.Errors;
                result.ErrorMessages.AddRange(sheetResult.ErrorMessages);
                result.CreatedCategories.AddRange(sheetResult.CreatedCategories);
                result.CreatedBrands.AddRange(sheetResult.CreatedBrands);
                result.ImportedProducts.AddRange(sheetResult.ImportedProducts);
            }

            return result;
        }

        private async Task<ExcelImportResult> ProcessWorksheetAsync(ExcelWorksheet worksheet, int userId)
        {
            var result = new ExcelImportResult();
            var headers = new Dictionary<string, int>();
            
            // Find header row (usually row 1, but check first few rows)
            int headerRow = 1;
            for (int row = 1; row <= Math.Min(5, worksheet.Dimension.End.Row); row++)
            {
                var rowValues = new List<string>();
                for (int col = 1; col <= worksheet.Dimension.End.Column; col++)
                {
                    var cellValue = worksheet.Cells[row, col].Text?.Trim() ?? "";
                    if (!string.IsNullOrEmpty(cellValue))
                    {
                        rowValues.Add(cellValue);
                    }
                }
                
                // Check if this looks like a header row (has multiple text values)
                if (rowValues.Count >= 3)
                {
                    headerRow = row;
                    break;
                }
            }

            // Read headers and map column indices
            for (int col = 1; col <= worksheet.Dimension.End.Column; col++)
            {
                var headerText = worksheet.Cells[headerRow, col].Text?.Trim() ?? "";
                if (!string.IsNullOrEmpty(headerText))
                {
                    var normalizedHeader = NormalizeHeader(headerText);
                    if (!headers.ContainsKey(normalizedHeader))
                    {
                        headers[normalizedHeader] = col;
                    }
                }
            }

            // Process data rows
            for (int row = headerRow + 1; row <= worksheet.Dimension.End.Row; row++)
            {
                result.TotalRows++;
                
                try
                {
                    var productData = ExtractProductData(worksheet, row, headers);
                    
                    if (productData == null || string.IsNullOrWhiteSpace(productData.Name))
                    {
                        result.Skipped++;
                        result.ImportedProducts.Add(new ImportedProductSummary
                        {
                            Name = $"Row {row}",
                            Status = "Skipped",
                            ErrorMessage = "Empty or invalid product name"
                        });
                        continue;
                    }

                    // Validate required fields
                    if (string.IsNullOrWhiteSpace(productData.Sku))
                    {
                        productData.Sku = GenerateSkuFromName(productData.Name);
                    }

                    // Normalize and clean data
                    productData.Name = CleanText(productData.Name);
                    productData.Sku = CleanText(productData.Sku).ToUpper();
                    productData.Category = CleanText(productData.Category);
                    productData.Brand = CleanText(productData.Brand);
                    productData.Unit = NormalizeUnit(productData.Unit);
                    
                    // Validate prices
                    if (productData.Price < 0) productData.Price = 0;
                    if (productData.CostPrice < 0) productData.CostPrice = 0;
                    if (productData.TaxRate < 0 || productData.TaxRate > 100) productData.TaxRate = 5; // Default 5%

                    // UPSERT logic
                    var existingProduct = await _context.Products
                        .FirstOrDefaultAsync(p => p.Sku == productData.Sku || 
                                                 (p.NameEn == productData.Name && !string.IsNullOrEmpty(productData.Name)));

                    if (existingProduct != null)
                    {
                        // Update existing product
                        existingProduct.NameEn = productData.Name;
                        existingProduct.NameAr = productData.NameAr ?? existingProduct.NameAr;
                        existingProduct.SellPrice = productData.Price;
                        existingProduct.CostPrice = productData.CostPrice;
                        existingProduct.UnitType = productData.Unit;
                        existingProduct.DescriptionEn = productData.Description ?? existingProduct.DescriptionEn;
                        existingProduct.UpdatedAt = DateTime.UtcNow;
                        // Stock is NOT updated - stock is computed from transactions only
                        
                        result.Updated++;
                        result.ImportedProducts.Add(new ImportedProductSummary
                        {
                            Sku = existingProduct.Sku,
                            Name = existingProduct.NameEn,
                            Status = "Updated"
                        });
                    }
                    else
                    {
                        // Create new product
                        var newProduct = new Product
                        {
                            Sku = productData.Sku,
                            NameEn = productData.Name,
                            NameAr = productData.NameAr,
                            UnitType = productData.Unit,
                            ConversionToBase = GetConversionToBase(productData.Unit),
                            CostPrice = productData.CostPrice,
                            SellPrice = productData.Price,
                            StockQty = 0, // CRITICAL: Stock is computed from transactions only
                            ReorderLevel = 0, // Deprecated
                            DescriptionEn = productData.Description,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };

                        _context.Products.Add(newProduct);
                        result.Imported++;
                        result.ImportedProducts.Add(new ImportedProductSummary
                        {
                            Sku = newProduct.Sku,
                            Name = newProduct.NameEn,
                            Status = "New"
                        });
                    }

                    // Create audit log
                    var auditLog = new AuditLog
                    {
                        UserId = userId,
                        Action = existingProduct != null ? "Product Updated via Excel Import" : "Product Created via Excel Import",
                        Details = $"SKU: {productData.Sku}, Name: {productData.Name}",
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.AuditLogs.Add(auditLog);
                }
                catch (Exception ex)
                {
                    result.Errors++;
                    result.ErrorMessages.Add($"Row {row}: {ex.Message}");
                    result.ImportedProducts.Add(new ImportedProductSummary
                    {
                        Name = $"Row {row}",
                        Status = "Error",
                        ErrorMessage = ex.Message
                    });
                }
            }

            await _context.SaveChangesAsync();
            return result;
        }

        private ProductImportData? ExtractProductData(ExcelWorksheet worksheet, int row, Dictionary<string, int> headers)
        {
            var data = new ProductImportData();

            // Try to find columns by normalized header names
            var nameCol = FindColumn(headers, "name", "product", "item", "description");
            var skuCol = FindColumn(headers, "sku", "code", "barcode", "product code");
            var priceCol = FindColumn(headers, "price", "rate", "mrp", "sale price", "selling price");
            var costCol = FindColumn(headers, "cost", "cost price", "purchase price");
            var categoryCol = FindColumn(headers, "category", "cat", "type");
            var brandCol = FindColumn(headers, "brand", "manufacturer", "maker");
            var unitCol = FindColumn(headers, "unit", "size", "weight", "measure", "packing");
            var taxCol = FindColumn(headers, "tax", "gst", "vat", "percentage");
            var descCol = FindColumn(headers, "description", "notes", "remarks");

            if (nameCol.HasValue)
            {
                data.Name = worksheet.Cells[row, nameCol.Value].Text?.Trim() ?? "";
            }

            if (skuCol.HasValue)
            {
                data.Sku = worksheet.Cells[row, skuCol.Value].Text?.Trim() ?? "";
            }

            if (priceCol.HasValue)
            {
                var priceValue = worksheet.Cells[row, priceCol.Value].Value;
                data.Price = ConvertToDecimal(priceValue);
            }

            if (costCol.HasValue)
            {
                var costValue = worksheet.Cells[row, costCol.Value].Value;
                data.CostPrice = ConvertToDecimal(costValue);
            }

            if (categoryCol.HasValue)
            {
                data.Category = worksheet.Cells[row, categoryCol.Value].Text?.Trim() ?? "";
            }

            if (brandCol.HasValue)
            {
                data.Brand = worksheet.Cells[row, brandCol.Value].Text?.Trim() ?? "";
            }

            if (unitCol.HasValue)
            {
                data.Unit = worksheet.Cells[row, unitCol.Value].Text?.Trim() ?? "";
            }

            if (taxCol.HasValue)
            {
                var taxValue = worksheet.Cells[row, taxCol.Value].Value;
                data.TaxRate = ConvertToDecimal(taxValue);
            }

            if (descCol.HasValue)
            {
                data.Description = worksheet.Cells[row, descCol.Value].Text?.Trim() ?? "";
            }

            return string.IsNullOrWhiteSpace(data.Name) ? null : data;
        }

        private int? FindColumn(Dictionary<string, int> headers, params string[] searchTerms)
        {
            foreach (var term in searchTerms)
            {
                var normalized = NormalizeHeader(term);
                if (headers.ContainsKey(normalized))
                {
                    return headers[normalized];
                }
            }
            return null;
        }

        private string NormalizeHeader(string header)
        {
            if (string.IsNullOrWhiteSpace(header)) return "";
            
            var normalized = header.ToLower()
                .Replace("_", " ")
                .Replace("-", " ")
                .Trim();
            
            // Remove common prefixes/suffixes
            normalized = Regex.Replace(normalized, @"^(product|item|item\s+name|name\s+of\s+product)\s*", "", RegexOptions.IgnoreCase);
            normalized = normalized.Trim();
            
            return normalized;
        }

        private string CleanText(string? text)
        {
            if (string.IsNullOrWhiteSpace(text)) return "";
            
            return text.Trim()
                .Replace("\n", " ")
                .Replace("\r", " ")
                .Replace("\t", " ");
        }

        private string NormalizeUnit(string? unit)
        {
            if (string.IsNullOrWhiteSpace(unit)) return "PIECE";
            
            var normalized = unit.ToUpper().Trim();
            
            // Map common unit variations
            var unitMap = new Dictionary<string, string>
            {
                { "CARTON", "CRTN" },
                { "CARTONS", "CRTN" },
                { "CTN", "CRTN" },
                { "BOX", "CRTN" },
                { "BOXES", "CRTN" },
                { "KG", "KG" },
                { "KILOGRAM", "KG" },
                { "KILOGRAMS", "KG" },
                { "GRAM", "G" },
                { "GRAMS", "G" },
                { "PIECE", "PIECE" },
                { "PIECES", "PIECE" },
                { "PCS", "PIECE" },
                { "PC", "PIECE" },
                { "UNIT", "PIECE" },
                { "UNITS", "PIECE" }
            };

            return unitMap.ContainsKey(normalized) ? unitMap[normalized] : normalized;
        }

        private decimal GetConversionToBase(string unit)
        {
            // Default conversion factors
            return unit switch
            {
                "CRTN" => 12, // 1 carton = 12 pieces (example)
                "KG" => 1,
                "G" => 0.001m,
                "PIECE" => 1,
                _ => 1
            };
        }

        private decimal ConvertToDecimal(object? value)
        {
            if (value == null) return 0;
            
            if (value is decimal d) return d;
            if (value is double db) return (decimal)db;
            if (value is int i) return i;
            if (value is long l) return l;
            
            if (decimal.TryParse(value.ToString(), out decimal result))
            {
                return result;
            }
            
            return 0;
        }

        private string GenerateSkuFromName(string name)
        {
            // Generate SKU from name: take first 3 letters of each word, uppercase
            var words = name.Split(new[] { ' ', '-', '_' }, StringSplitOptions.RemoveEmptyEntries);
            var sku = string.Join("", words.Take(3).Select(w => w.Length >= 3 ? w.Substring(0, 3).ToUpper() : w.ToUpper()));
            
            // Add timestamp to ensure uniqueness
            return $"{sku}{DateTime.UtcNow:MMddHHmmss}".Substring(0, Math.Min(20, $"{sku}{DateTime.UtcNow:MMddHHmmss}".Length));
        }

        private class ProductImportData
        {
            public string Name { get; set; } = "";
            public string NameAr { get; set; } = "";
            public string Sku { get; set; } = "";
            public decimal Price { get; set; }
            public decimal CostPrice { get; set; }
            public string Category { get; set; } = "";
            public string Brand { get; set; } = "";
            public string Unit { get; set; } = "PIECE";
            public decimal TaxRate { get; set; } = 5;
            public string Description { get; set; } = "";
        }
    }
}

