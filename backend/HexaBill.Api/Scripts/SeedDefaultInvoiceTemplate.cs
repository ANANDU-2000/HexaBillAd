/*
Purpose: Seed default HD invoice template
Author: AI Assistant
Date: 2024
*/
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace HexaBill.Api.Scripts
{
    public static class SeedDefaultInvoiceTemplate
    {
        public static async Task SeedAsync(AppDbContext context)
        {
            // Check if any template exists
            if (await context.InvoiceTemplates.AnyAsync())
            {
                return; // Templates already exist
            }

            // Read default template HTML
            var templatePath = Path.Combine(Directory.GetCurrentDirectory(), "Templates", "invoice-template-hd.html");
            string htmlCode;
            
            if (File.Exists(templatePath))
            {
                htmlCode = await File.ReadAllTextAsync(templatePath);
            }
            else
            {
                // Fallback: use embedded template
                htmlCode = GetDefaultTemplateHtml();
            }

            // Get first admin user (or create system user)
            var adminUser = await context.Users.FirstOrDefaultAsync(u => u.Role == UserRole.Admin);
            if (adminUser == null)
            {
                // Create system user if no admin exists
                adminUser = new User
                {
                    Name = "System",
                    Email = "system@hexabill.com",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("system"),
                    Role = UserRole.Admin,
                    CreatedAt = DateTime.UtcNow
                };
                context.Users.Add(adminUser);
                await context.SaveChangesAsync();
            }

            // Create default template
            var defaultTemplate = new InvoiceTemplate
            {
                Name = "HD Invoice Template (HexaBill Format)",
                Version = "1.0",
                HtmlCode = htmlCode,
                CssCode = null, // CSS is embedded in HTML
                IsActive = true,
                Description = "Pixel-perfect invoice template matching HexaBill format with bilingual support (Arabic/English)",
                CreatedBy = adminUser.Id,
                CreatedAt = DateTime.UtcNow
            };

            context.InvoiceTemplates.Add(defaultTemplate);
            await context.SaveChangesAsync();
        }

        private static string GetDefaultTemplateHtml()
        {
            // Return minimal template if file doesn't exist
            return @"<!DOCTYPE html>
<html>
<head>
    <meta charset=""UTF-8"">
    <title>Tax Invoice</title>
    <style>
        @page { size: A4; margin: 10mm; }
        body { font-family: Arial, sans-serif; }
        .invoice-container { width: 210mm; padding: 5mm; }
    </style>
</head>
<body>
    <div class=""invoice-container"">
        <h1>{{company_name_en}}</h1>
        <p>Invoice: {{invoice_no}} | Date: {{date}}</p>
        <p>Customer: {{customer_name}}</p>
        <table>
            <thead>
                <tr>
                    <th>SL.No</th>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                {{items}}
            </tbody>
        </table>
        <p>Subtotal: {{subtotal}}</p>
        <p>VAT: {{vat_amount}}</p>
        <p>Grand Total: {{grand_total}}</p>
    </div>
</body>
</html>";
        }
    }
}

