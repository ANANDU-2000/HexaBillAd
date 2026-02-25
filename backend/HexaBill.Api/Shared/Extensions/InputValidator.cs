/*
Purpose: Input validation and sanitization helper
Author: AI Assistant
Date: 2025
*/
using System.Text.RegularExpressions;

namespace HexaBill.Api.Shared.Extensions
{
    public static class InputValidator
    {
        public static bool ValidatePrice(decimal price, decimal min = 0, decimal max = 1000000)
        {
            return price >= min && price <= max;
        }

        public static bool ValidateQuantity(decimal qty, decimal min = 0, decimal max = 100000)
        {
            return qty >= min && qty <= max;
        }

        public static string SanitizeString(string? input, int maxLength = 1000)
        {
            if (string.IsNullOrWhiteSpace(input)) return string.Empty;
            
            // Remove HTML tags and script tags
            var sanitized = Regex.Replace(input, "<.*?>", string.Empty);
            sanitized = Regex.Replace(sanitized, @"<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>", string.Empty, RegexOptions.IgnoreCase);
            
            // Limit length
            if (sanitized.Length > maxLength)
                sanitized = sanitized.Substring(0, maxLength);
            
            return sanitized.Trim();
        }

        public static bool ValidateInvoiceNumber(string? invoiceNo)
        {
            if (string.IsNullOrWhiteSpace(invoiceNo)) return false;
            // Allow alphanumeric with dashes and underscores, max 50 chars
            return Regex.IsMatch(invoiceNo.Trim(), @"^[A-Z0-9_-]+$", RegexOptions.IgnoreCase) 
                && invoiceNo.Trim().Length <= 50;
        }

        public static bool ValidateSKU(string? sku)
        {
            if (string.IsNullOrWhiteSpace(sku)) return false;
            // Allow alphanumeric with dashes, underscores, dots, max 100 chars
            return Regex.IsMatch(sku.Trim(), @"^[A-Z0-9._-]+$", RegexOptions.IgnoreCase) 
                && sku.Trim().Length <= 100;
        }

        public static bool ValidateEmail(string? email)
        {
            if (string.IsNullOrWhiteSpace(email)) return false;
            var emailRegex = new Regex(@"^[^\s@]+@[^\s@]+\.[^\s@]+$");
            return emailRegex.IsMatch(email.Trim());
        }

        public static bool ValidatePhone(string? phone)
        {
            if (string.IsNullOrWhiteSpace(phone)) return true; // Phone is optional
            var phoneRegex = new Regex(@"^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$");
            return phoneRegex.IsMatch(phone.Trim());
        }
    }
}

