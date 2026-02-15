/*
Purpose: Invoice template service for managing dynamic invoice templates
Author: AI Assistant
Date: 2024
*/
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using System.Text;

namespace HexaBill.Api.Modules.Billing
{
    public interface IInvoiceTemplateService
    {
        Task<List<InvoiceTemplateDto>> GetTemplatesAsync();
        Task<InvoiceTemplateDto?> GetTemplateByIdAsync(int id);
        Task<InvoiceTemplateDto?> GetActiveTemplateAsync();
        Task<InvoiceTemplateDto> CreateTemplateAsync(CreateInvoiceTemplateRequest request, int userId);
        Task<InvoiceTemplateDto?> UpdateTemplateAsync(int id, UpdateInvoiceTemplateRequest request, int userId);
        Task<bool> ActivateTemplateAsync(int id, int userId);
        Task<bool> DeleteTemplateAsync(int id);
        Task<string> RenderTemplateAsync(int templateId, SaleDto sale, InvoiceTemplateService.CompanySettings settings);
        Task<string> RenderActiveTemplateAsync(SaleDto sale, InvoiceTemplateService.CompanySettings settings);
        Task<string> RenderTemplateHtmlAsync(string htmlTemplate, SaleDto sale, InvoiceTemplateService.CompanySettings settings);
    }

    public class InvoiceTemplateService : IInvoiceTemplateService
    {
        private readonly AppDbContext _context;

        public InvoiceTemplateService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<InvoiceTemplateDto>> GetTemplatesAsync()
        {
            return await _context.InvoiceTemplates
                .Include(t => t.CreatedByUser)
                .OrderByDescending(t => t.CreatedAt)
                .Select(t => new InvoiceTemplateDto
                {
                    Id = t.Id,
                    Name = t.Name,
                    Version = t.Version,
                    CreatedBy = t.CreatedBy,
                    CreatedByName = t.CreatedByUser.Name,
                    CreatedAt = t.CreatedAt,
                    UpdatedAt = t.UpdatedAt,
                    IsActive = t.IsActive,
                    Description = t.Description
                })
                .ToListAsync();
        }

        public async Task<InvoiceTemplateDto?> GetTemplateByIdAsync(int id)
        {
            var template = await _context.InvoiceTemplates
                .Include(t => t.CreatedByUser)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (template == null) return null;

            return new InvoiceTemplateDto
            {
                Id = template.Id,
                Name = template.Name,
                Version = template.Version,
                CreatedBy = template.CreatedBy,
                CreatedByName = template.CreatedByUser.Name,
                CreatedAt = template.CreatedAt,
                UpdatedAt = template.UpdatedAt,
                IsActive = template.IsActive,
                Description = template.Description,
                HtmlCode = template.HtmlCode,
                CssCode = template.CssCode
            };
        }

        public async Task<InvoiceTemplateDto?> GetActiveTemplateAsync()
        {
            var template = await _context.InvoiceTemplates
                .Include(t => t.CreatedByUser)
                .FirstOrDefaultAsync(t => t.IsActive);

            if (template == null) return null;

            return new InvoiceTemplateDto
            {
                Id = template.Id,
                Name = template.Name,
                Version = template.Version,
                CreatedBy = template.CreatedBy,
                CreatedByName = template.CreatedByUser.Name,
                CreatedAt = template.CreatedAt,
                UpdatedAt = template.UpdatedAt,
                IsActive = template.IsActive,
                Description = template.Description,
                HtmlCode = template.HtmlCode,
                CssCode = template.CssCode
            };
        }

        public async Task<InvoiceTemplateDto> CreateTemplateAsync(CreateInvoiceTemplateRequest request, int userId)
        {
            // Deactivate all other templates if this one should be active
            if (request.IsActive)
            {
                await _context.InvoiceTemplates
                    .Where(t => t.IsActive)
                    .ExecuteUpdateAsync(t => t.SetProperty(x => x.IsActive, false));
            }

            var template = new InvoiceTemplate
            {
                Name = request.Name,
                Version = request.Version ?? "1.0",
                HtmlCode = request.HtmlCode,
                CssCode = request.CssCode,
                IsActive = request.IsActive,
                Description = request.Description,
                CreatedBy = userId,
                CreatedAt = DateTime.UtcNow
            };

            _context.InvoiceTemplates.Add(template);
            await _context.SaveChangesAsync();

            await _context.Entry(template).Reference(t => t.CreatedByUser).LoadAsync();

            return new InvoiceTemplateDto
            {
                Id = template.Id,
                Name = template.Name,
                Version = template.Version,
                CreatedBy = template.CreatedBy,
                CreatedByName = template.CreatedByUser.Name,
                CreatedAt = template.CreatedAt,
                UpdatedAt = template.UpdatedAt,
                IsActive = template.IsActive,
                Description = template.Description,
                HtmlCode = template.HtmlCode,
                CssCode = template.CssCode
            };
        }

        public async Task<InvoiceTemplateDto?> UpdateTemplateAsync(int id, UpdateInvoiceTemplateRequest request, int userId)
        {
            var template = await _context.InvoiceTemplates.FindAsync(id);
            if (template == null) return null;

            // Deactivate all other templates if this one should be active
            if (request.IsActive.HasValue && request.IsActive.Value && !template.IsActive)
            {
                await _context.InvoiceTemplates
                    .Where(t => t.IsActive && t.Id != id)
                    .ExecuteUpdateAsync(t => t.SetProperty(x => x.IsActive, false));
            }

            if (!string.IsNullOrEmpty(request.Name))
                template.Name = request.Name;
            if (!string.IsNullOrEmpty(request.Version))
                template.Version = request.Version;
            if (!string.IsNullOrEmpty(request.HtmlCode))
                template.HtmlCode = request.HtmlCode;
            if (request.CssCode != null)
                template.CssCode = request.CssCode;
            if (request.IsActive.HasValue)
                template.IsActive = request.IsActive.Value;
            if (request.Description != null)
                template.Description = request.Description;

            template.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            await _context.Entry(template).Reference(t => t.CreatedByUser).LoadAsync();

            return new InvoiceTemplateDto
            {
                Id = template.Id,
                Name = template.Name,
                Version = template.Version,
                CreatedBy = template.CreatedBy,
                CreatedByName = template.CreatedByUser.Name,
                CreatedAt = template.CreatedAt,
                UpdatedAt = template.UpdatedAt,
                IsActive = template.IsActive,
                Description = template.Description,
                HtmlCode = template.HtmlCode,
                CssCode = template.CssCode
            };
        }

        public async Task<bool> ActivateTemplateAsync(int id, int userId)
        {
            var template = await _context.InvoiceTemplates.FindAsync(id);
            if (template == null) return false;

            // Deactivate all other templates
            await _context.InvoiceTemplates
                .Where(t => t.IsActive && t.Id != id)
                .ExecuteUpdateAsync(t => t.SetProperty(x => x.IsActive, false));

            template.IsActive = true;
            template.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteTemplateAsync(int id)
        {
            var template = await _context.InvoiceTemplates.FindAsync(id);
            if (template == null) return false;

            // Don't allow deleting the active template
            if (template.IsActive)
                throw new InvalidOperationException("Cannot delete the active template. Please activate another template first.");

            _context.InvoiceTemplates.Remove(template);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<string> RenderTemplateAsync(int templateId, SaleDto sale, CompanySettings settings)
        {
            var template = await _context.InvoiceTemplates.FindAsync(templateId);
            if (template == null)
                throw new InvalidOperationException($"Template {templateId} not found");

            return await RenderTemplateHtmlAsync(template.HtmlCode, sale, settings);
        }

        public async Task<string> RenderActiveTemplateAsync(SaleDto sale, CompanySettings settings)
        {
            var template = await _context.InvoiceTemplates.FirstOrDefaultAsync(t => t.IsActive);
            if (template == null)
            {
                // Fallback to default template
                var defaultTemplatePath = Path.Combine(Directory.GetCurrentDirectory(), "Templates", "invoice-template-hd.html");
                if (File.Exists(defaultTemplatePath))
                {
                    var defaultHtml = await File.ReadAllTextAsync(defaultTemplatePath);
                    return await RenderTemplateHtmlAsync(defaultHtml, sale, settings);
                }
                throw new InvalidOperationException("No active template found and default template not available");
            }

            return await RenderTemplateHtmlAsync(template.HtmlCode, sale, settings);
        }

        public async Task<string> RenderTemplateHtmlAsync(string htmlTemplate, SaleDto sale, CompanySettings settings)
        {
            // Get customer TRN
            var customerTrn = await GetCustomerTrnAsync(sale.CustomerId);
            var trnDisplay = string.IsNullOrWhiteSpace(customerTrn) ? "" : customerTrn;

            // Replace company placeholders
            var processedHtml = htmlTemplate
                .Replace("{{company_name_en}}", settings.CompanyNameEn ?? "")
                .Replace("{{company_name_ar}}", settings.CompanyNameAr ?? "")
                .Replace("{{company_address}}", settings.CompanyAddress ?? "")
                .Replace("{{company_phone}}", settings.CompanyPhone ?? "")
                .Replace("{{company_trn}}", settings.CompanyTrn ?? "")
                .Replace("{{currency}}", settings.Currency ?? "AED");

            // Replace invoice placeholders
            var amountInWords = ConvertToWords(sale.GrandTotal);
            processedHtml = processedHtml
                .Replace("{{invoice_no}}", sale.InvoiceNo)
                .Replace("{{date}}", sale.InvoiceDate.ToString("dd-MM-yyyy"))
                .Replace("{{customer_name}}", sale.CustomerName ?? "Cash Customer")
                .Replace("{{customer_trn}}", trnDisplay)
                .Replace("{{subtotal}}", sale.Subtotal.ToString("N2"))
                .Replace("{{vat_amount}}", sale.VatTotal.ToString("N2"))
                .Replace("{{grand_total}}", sale.GrandTotal.ToString("N2"))
                .Replace("{{amount_in_words}}", amountInWords);

            // Generate items rows HTML - Column order: SL.No, Description, Unit (numeric qty), Qty (unit type), Unit Price, Total, Amount (with VAT shown)
            var itemsRowsHtml = new System.Text.StringBuilder();
            int itemIndex = 1;
            foreach (var item in sale.Items ?? new List<SaleItemDto>())
            {
                var lineTotal = item.UnitPrice * item.Qty;
                // Combined Amount column: Shows LineTotal with VAT breakdown below
                itemsRowsHtml.AppendLine($@"
                <tr>
                    <td class=""center"">{itemIndex}</td>
                    <td>{System.Net.WebUtility.HtmlEncode(item.ProductName ?? "")}</td>
                    <td class=""center"">{item.Qty.ToString("0.##")}</td>
                    <td class=""center"">{System.Net.WebUtility.HtmlEncode(item.UnitType ?? "")}</td>
                    <td class=""right"">{item.UnitPrice.ToString("N2")}</td>
                    <td class=""right"">{lineTotal.ToString("N2")}</td>
                    <td class=""right""><strong>{item.LineTotal.ToString("N2")}</strong><br/><span style=""font-size:7pt;color:#666;"">(+{item.VatAmount.ToString("N2")} VAT)</span></td>
                </tr>");
                itemIndex++;
            }

            // Fill remaining rows - up to 15 total rows
            int filledRows = sale.Items?.Count ?? 0;
            int maxTotalRows = 15;
            int emptyRowsNeeded = Math.Max(0, maxTotalRows - filledRows);
            
            for (int i = 0; i < emptyRowsNeeded; i++)
            {
                int rowNumber = filledRows + i + 1;
                itemsRowsHtml.AppendLine($@"
                <tr>
                    <td class=""center"">{rowNumber}</td>
                    <td>&nbsp;</td>
                    <td class=""center""></td>
                    <td class=""center""></td>
                    <td class=""right"">0.00</td>
                    <td class=""right"">0.00</td>
                    <td class=""right"">0.00</td>
                </tr>");
            }

            processedHtml = processedHtml.Replace("{{items}}", itemsRowsHtml.ToString());

            return processedHtml;
        }

        private async Task<string> GetCustomerTrnAsync(int? customerId)
        {
            if (!customerId.HasValue) return "";
            
            var customer = await _context.Customers.FindAsync(customerId.Value);
            return customer?.Trn ?? "";
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

        // Nested class for company settings
        public class CompanySettings
        {
            public string CompanyNameEn { get; set; } = "";
            public string CompanyNameAr { get; set; } = "";
            public string CompanyAddress { get; set; } = "";
            public string CompanyPhone { get; set; } = "";
            public string CompanyTrn { get; set; } = "";
            public string Currency { get; set; } = "AED";
        }
    }
}

