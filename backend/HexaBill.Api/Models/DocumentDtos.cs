/*
Purpose: DTOs for Quotation and Agreement APIs
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class QuotationItemDto
    {
        public int Id { get; set; }
        public int? ProductId { get; set; }
        public string Description { get; set; } = string.Empty;
        public string? DescriptionSubtitle { get; set; }
        public string UnitLabel { get; set; } = "Pcs";
        public decimal Qty { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal VatRate { get; set; }
        public decimal VatAmount { get; set; }
        public decimal LineTotal { get; set; }
        public int SortOrder { get; set; }
    }

    public class QuotationDto
    {
        public int Id { get; set; }
        public string QuoteNo { get; set; } = string.Empty;
        public DateTime QuoteDate { get; set; }
        public string? CustomerName { get; set; }
        public string? CustomerAddress { get; set; }
        public string? CustomerPhone { get; set; }
        public string? CustomerEmail { get; set; }
        public int? CustomerId { get; set; }
        public decimal Subtotal { get; set; }
        public decimal VatTotal { get; set; }
        public decimal Discount { get; set; }
        public decimal GrandTotal { get; set; }
        public string Status { get; set; } = "Draft";
        public string? Notes { get; set; }
        public string Salutation { get; set; } = QuotationDefaults.Salutation;
        public string IntroLine { get; set; } = QuotationDefaults.IntroLine;
        public string ClosingLine { get; set; } = QuotationDefaults.ClosingLine;
        public DateTime CreatedAt { get; set; }
        public List<QuotationItemDto> Items { get; set; } = new();
    }

    public static class QuotationDefaults
    {
        public const string Salutation = "Dear Sir/Mam,";
        public const string IntroLine = "Thank you for your valuable inquiry. We are pleased to quote as below:";
        public const string ClosingLine = "We hope you find our offer to be in line with your requirement.";
    }

    public class QuotationItemRequest
    {
        public int? ProductId { get; set; }
        [Required]
        [MaxLength(500)]
        public string Description { get; set; } = string.Empty;
        [MaxLength(500)]
        public string? DescriptionSubtitle { get; set; }
        [MaxLength(50)]
        public string UnitLabel { get; set; } = "Pcs";
        [Range(0.0001, 999999)]
        public decimal Qty { get; set; }
        [Range(0, 999999999)]
        public decimal UnitPrice { get; set; }
        /// <summary>Percent e.g. 5 for 5%. Server may override from settings if 0.</summary>
        public decimal? VatRate { get; set; }
    }

    public class CreateQuotationRequest
    {
        public DateTime? QuoteDate { get; set; }
        [MaxLength(200)]
        public string? CustomerName { get; set; }
        [MaxLength(500)]
        public string? CustomerAddress { get; set; }
        [MaxLength(50)]
        public string? CustomerPhone { get; set; }
        [MaxLength(100)]
        public string? CustomerEmail { get; set; }
        public int? CustomerId { get; set; }
        public decimal Discount { get; set; }
        [MaxLength(20)]
        public string Status { get; set; } = "Draft";
        public string? Notes { get; set; }
        [MaxLength(200)]
        public string? Salutation { get; set; }
        [MaxLength(500)]
        public string? IntroLine { get; set; }
        [MaxLength(500)]
        public string? ClosingLine { get; set; }
        [Required]
        [MinLength(1)]
        public List<QuotationItemRequest> Items { get; set; } = new();
    }

    public class UpdateQuotationRequest : CreateQuotationRequest { }

    public class AgreementDto
    {
        public int Id { get; set; }
        public string AgreementNo { get; set; } = string.Empty;
        public DateTime AgreementDate { get; set; }
        public string? SecondPartyName { get; set; }
        public string? SecondPartyLicense { get; set; }
        public string? SecondPartyAddress { get; set; }
        public string? SecondPartyMobile { get; set; }
        public string TemplateVersion { get; set; } = "v1";
        public string Status { get; set; } = "Draft";
        public string? Notes { get; set; }
        public DateTime CreatedAt { get; set; }

        public string FirstPartyName { get; set; } = string.Empty;
        public string FirstPartyLicense { get; set; } = "CN-4937175";
        public string FirstPartyAddress { get; set; } = string.Empty;
        public string FirstPartyMobile { get; set; } = string.Empty;
        public string FirstPartyEmail { get; set; } = string.Empty;
        public string FirstPartyWebsite { get; set; } = string.Empty;
        public string FirstPartyPhones { get; set; } = string.Empty;
        public string FooterAddress { get; set; } = string.Empty;
        public string WhereasText { get; set; } = string.Empty;
        public List<string> Clauses { get; set; } = new();
    }

    public class CreateAgreementRequest
    {
        public DateTime? AgreementDate { get; set; }
        [MaxLength(200)]
        public string? SecondPartyName { get; set; }
        [MaxLength(100)]
        public string? SecondPartyLicense { get; set; }
        [MaxLength(500)]
        public string? SecondPartyAddress { get; set; }
        [MaxLength(50)]
        public string? SecondPartyMobile { get; set; }
        [MaxLength(20)]
        public string Status { get; set; } = "Draft";
        public string? Notes { get; set; }
    }

    public class UpdateAgreementRequest : CreateAgreementRequest { }

    public class SalaryCertificateDto
    {
        public int Id { get; set; }
        public string CertificateNo { get; set; } = string.Empty;
        public DateTime CertificateDate { get; set; }
        public string? Recipient { get; set; }
        public string? EmployeeName { get; set; }
        public string? PassportNumber { get; set; }
        public string? EmployeeNationality { get; set; }
        public DateTime? JoiningDate { get; set; }
        public string? Designation { get; set; }
        public decimal? MonthlySalary { get; set; }
        public string? MonthlySalaryWords { get; set; }
        public string? EmployeePhone { get; set; }
        public string SignatoryName { get; set; } = "Sudheesh Thampi";
        public string SignatoryTitle { get; set; } = "Manager";
        public string Status { get; set; } = "Draft";
        public string? Notes { get; set; }
        public DateTime CreatedAt { get; set; }

        // Fixed company block for preview/PDF (Zayoga template)
        public string CompanyName { get; set; } = string.Empty;
        public string CompanyPhone { get; set; } = string.Empty;
        public string CompanyEmail { get; set; } = string.Empty;
        public string CompanyWebsite { get; set; } = string.Empty;
        public string FooterAddress { get; set; } = string.Empty;
        public string SubjectLine { get; set; } = "Sub: SALARY CERTIFICATE";
        public string BodyText { get; set; } = string.Empty;
    }

    public class CreateSalaryCertificateRequest
    {
        public DateTime? CertificateDate { get; set; }
        [MaxLength(200)]
        public string? Recipient { get; set; }
        [MaxLength(200)]
        public string? EmployeeName { get; set; }
        [MaxLength(50)]
        public string? PassportNumber { get; set; }
        [MaxLength(100)]
        public string? EmployeeNationality { get; set; }
        public DateTime? JoiningDate { get; set; }
        [MaxLength(200)]
        public string? Designation { get; set; }
        public decimal? MonthlySalary { get; set; }
        [MaxLength(200)]
        public string? MonthlySalaryWords { get; set; }
        [MaxLength(50)]
        public string? EmployeePhone { get; set; }
        [MaxLength(200)]
        public string? SignatoryName { get; set; }
        [MaxLength(100)]
        public string? SignatoryTitle { get; set; }
        [MaxLength(20)]
        public string Status { get; set; } = "Draft";
        public string? Notes { get; set; }
    }

    public class UpdateSalaryCertificateRequest : CreateSalaryCertificateRequest { }
}
