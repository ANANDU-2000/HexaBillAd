using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HexaBill.Api.Models.Legacy
{
    [Table("LegacyCustomers")]
    public class LegacyCustomer
    {
        [Key]
        public int Id { get; set; }
        public int TenantId { get; set; }
        public int SourceCustomerId { get; set; }
        public string SourceSystem { get; set; } = "Starplus";
        public string Name { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public string? Address { get; set; }
        public string? Trn { get; set; }
        public int? DestinationCustomerId { get; set; }
        public int InvoiceCount { get; set; }
        public int DeletedInvoiceCount { get; set; }
        public int UnpaidInvoiceCount { get; set; }
        public decimal UnpaidInvoiceAmount { get; set; }
        public decimal LedgerCachedPendingBalance { get; set; }
        public decimal LedgerCachedBalance { get; set; }
        public decimal ApprovedOpeningBalance { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    [Table("LegacyInvoices")]
    public class LegacyInvoice
    {
        [Key]
        public int Id { get; set; }
        public int TenantId { get; set; }
        public int SourceInvoiceId { get; set; }
        public string SourceSystem { get; set; } = "Starplus";
        public string LegacyInvoiceNumber { get; set; } = string.Empty;
        public string LegacyIssuer { get; set; } = string.Empty;
        public string? SourceLegalTaxId { get; set; }
        public DateTime InvoiceDate { get; set; }
        public DateTime? DueDate { get; set; }
        public string? DueDateSource { get; set; }
        public int? SourceCustomerId { get; set; }
        public string? CustomerName { get; set; }
        public int? DestinationCustomerId { get; set; }
        public string Status { get; set; } = string.Empty;
        public bool IsDeleted { get; set; }
        public bool IsFinalized { get; set; }
        public bool IsLocked { get; set; }
        public decimal Subtotal { get; set; }
        public decimal VatTotal { get; set; }
        public decimal Discount { get; set; }
        public decimal RoundOff { get; set; }
        public decimal GrandTotal { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal PaidAmount { get; set; }
        public decimal OutstandingCalculated { get; set; }
        public int ItemCount { get; set; }
        public bool ReportedAsPending { get; set; }
        public string? Notes { get; set; }
        public string? ExternalReference { get; set; }
        public string MigrationRunId { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public virtual ICollection<LegacyInvoiceItem> Items { get; set; } = new List<LegacyInvoiceItem>();
        public virtual ICollection<LegacyPayment> Payments { get; set; } = new List<LegacyPayment>();
    }

    [Table("LegacyInvoiceItems")]
    public class LegacyInvoiceItem
    {
        [Key]
        public int Id { get; set; }
        public int TenantId { get; set; }
        public int LegacyInvoiceId { get; set; }
        public int SourceItemId { get; set; }
        public string SourceSystem { get; set; } = "Starplus";
        public int SourceProductId { get; set; }
        public int? DestinationProductId { get; set; }
        public string? Sku { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string UnitType { get; set; } = "PCS";
        public decimal Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal Discount { get; set; }
        public decimal VatAmount { get; set; }
        public decimal LineTotal { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey(nameof(LegacyInvoiceId))]
        public virtual LegacyInvoice? LegacyInvoice { get; set; }
    }

    [Table("LegacyPayments")]
    public class LegacyPayment
    {
        [Key]
        public int Id { get; set; }
        public int TenantId { get; set; }
        public int? LegacyInvoiceId { get; set; }
        public int SourcePaymentId { get; set; }
        public string SourceSystem { get; set; } = "Starplus";
        public int? SourceCustomerId { get; set; }
        public int? DestinationCustomerId { get; set; }
        public decimal Amount { get; set; }
        public string Mode { get; set; } = "Cash";
        public string Status { get; set; } = "Cleared";
        public DateTime PaymentDate { get; set; }
        public string? Reference { get; set; }
        public string MigrationRunId { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey(nameof(LegacyInvoiceId))]
        public virtual LegacyInvoice? LegacyInvoice { get; set; }
    }

    [Table("LegacyOpeningReceivables")]
    public class LegacyOpeningReceivable
    {
        [Key]
        public int Id { get; set; }
        public int TenantId { get; set; }
        public int SourceCustomerId { get; set; }
        public int? DestinationCustomerId { get; set; }
        public string SourceSystem { get; set; } = "Starplus";
        public decimal OpeningBalance { get; set; }
        public int ReconciledInvoicesCount { get; set; }
        public DateTime CutoffDate { get; set; }
        public DateTime ApprovedAt { get; set; } = DateTime.UtcNow;
        public int ApprovedBy { get; set; }
        public string? Notes { get; set; }
    }

    [Table("LegacyCustomerMappings")]
    public class LegacyCustomerMapping
    {
        [Key]
        public int Id { get; set; }
        public int TenantId { get; set; }
        public int SourceCustomerId { get; set; }
        public string SourceCustomerName { get; set; } = string.Empty;
        public int? DestinationCustomerId { get; set; }
        public string MatchType { get; set; } = "NAME_MATCH";
        public string ApprovalStatus { get; set; } = "APPROVED";
        public DateTime ApprovedAt { get; set; } = DateTime.UtcNow;
        public int ApprovedBy { get; set; } = 34;
    }
}
