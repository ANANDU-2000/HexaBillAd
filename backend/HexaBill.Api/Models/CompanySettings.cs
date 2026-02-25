/*
 * Company Settings Configuration Model
 * Purpose: Centralize company details for multi-tenant invoicing
 * Author: AI Assistant
 * Date: 2024-12-24
 * 
 * USAGE: Configure via appsettings.json or environment variables
 * IMPORTANT: Never hardcode these values in business logic
 */

namespace HexaBill.Api.Models
{
    /// <summary>
    /// Company settings for invoice generation and branding
    /// These values are loaded from appsettings.json or environment variables
    /// </summary>
    public class CompanySettings
    {
        /// <summary>
        /// Legal company name in English (as registered)
        /// Example: "HexaBill"
        /// </summary>
        public string LegalNameEn { get; set; } = "HexaBill";
        
        /// <summary>
        /// Legal company name in Arabic (as registered)
        /// Example: "فروزن ماجيك لتجارة العامة - ذ.م.م - ش.ش.و"
        /// </summary>
        public string LegalNameAr { get; set; } = "هيكسابيل";
        
        /// <summary>
        /// VAT Registration Number (TRN)
        /// Example: "105274438800003"
        /// </summary>
        public string VatNumber { get; set; } = "105274438800003";
        
        /// <summary>
        /// Registered business address
        /// Example: "Abu Dhabi, United Arab Emirates"
        /// </summary>
        public string Address { get; set; } = "Abu Dhabi, United Arab Emirates";
        
        /// <summary>
        /// Contact mobile number
        /// Example: "+971 56 955 22 52"
        /// </summary>
        public string Mobile { get; set; } = "+971 56 955 22 52";
        
        /// <summary>
        /// VAT effective date (for legal compliance)
        /// Example: "01-01-2026"
        /// </summary>
        public string VatEffectiveDate { get; set; } = "01-01-2026";
        
        /// <summary>
        /// VAT legal disclaimer text for invoices
        /// Example: "VAT registered under Federal Decree-Law No. 8 of 2017, UAE"
        /// </summary>
        public string VatLegalText { get; set; } = "VAT registered under Federal Decree-Law No. 8 of 2017, UAE";
        
        /// <summary>
        /// Currency code
        /// Example: "AED"
        /// </summary>
        public string Currency { get; set; } = "AED";
        
        /// <summary>
        /// VAT percentage (typically 5% in UAE)
        /// Example: 5.0
        /// </summary>
        public decimal VatPercent { get; set; } = 5.0m;
        
        /// <summary>
        /// Invoice number prefix
        /// Example: "HB" for HexaBill
        /// </summary>
        public string InvoicePrefix { get; set; } = "HB";
        
        /// <summary>
        /// Company logo URL or file path (optional)
        /// Example: "/uploads/logo.png"
        /// </summary>
        public string? LogoPath { get; set; }
    }
}
