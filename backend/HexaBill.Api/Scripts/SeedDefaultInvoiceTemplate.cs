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
                htmlCode = GetDefaultTemplateHtml();
            }

            // Get first admin/owner user per tenant for CreatedBy
            var adminUser = await context.Users.FirstOrDefaultAsync(u => u.Role == UserRole.Admin || u.Role == UserRole.Owner);
            if (adminUser == null)
            {
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

            // Seed default template per tenant (multi-tenant isolation)
            var tenantIds = await context.Tenants.Select(t => t.Id).ToListAsync();
            if (tenantIds.Count == 0)
            {
                // No tenants yet - create one template with null TenantId for backward compatibility (will be assigned on first tenant creation)
                var defaultTemplate = new InvoiceTemplate
                {
                    TenantId = null,
                    Name = "HD Invoice Template (HexaBill Format)",
                    Version = "1.0",
                    HtmlCode = htmlCode,
                    CssCode = null,
                    IsActive = true,
                    Description = "Pixel-perfect invoice template matching HexaBill format with bilingual support (Arabic/English)",
                    CreatedBy = adminUser.Id,
                    CreatedAt = DateTime.UtcNow
                };
                context.InvoiceTemplates.Add(defaultTemplate);
            }
            else
            {
                foreach (var tenantId in tenantIds)
                {
                    var ownerOrAdmin = await context.Users.FirstOrDefaultAsync(u => (u.TenantId == tenantId || u.OwnerId == tenantId) && (u.Role == UserRole.Owner || u.Role == UserRole.Admin));
                    var createdBy = ownerOrAdmin?.Id ?? adminUser.Id;

                    var defaultTemplate = new InvoiceTemplate
                    {
                        TenantId = tenantId,
                        Name = "HD Invoice Template (HexaBill Format)",
                        Version = "1.0",
                        HtmlCode = htmlCode,
                        CssCode = null,
                        IsActive = true,
                        Description = "Pixel-perfect invoice template matching HexaBill format with bilingual support (Arabic/English)",
                        CreatedBy = createdBy,
                        CreatedAt = DateTime.UtcNow
                    };
                    context.InvoiceTemplates.Add(defaultTemplate);
                }
            }
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

