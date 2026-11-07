using System;
using System.Collections.Generic;

namespace HexaBill.Api.Modules.Legacy
{
    public class LegacyInvoiceSummaryDto
    {
        public int Id { get; set; }
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
        public decimal Subtotal { get; set; }
        public decimal VatTotal { get; set; }
        public decimal Discount { get; set; }
        public decimal GrandTotal { get; set; }
        public decimal PaidAmount { get; set; }
        public decimal OutstandingCalculated { get; set; }
        public int ItemCount { get; set; }
        public bool ReportedAsPending { get; set; }
        public string? Notes { get; set; }
    }

    public class LegacyInvoiceDetailDto : LegacyInvoiceSummaryDto
    {
        public bool IsFinalized { get; set; }
        public bool IsLocked { get; set; }
        public decimal RoundOff { get; set; }
        public decimal TotalAmount { get; set; }
        public string? ExternalReference { get; set; }
        public string MigrationRunId { get; set; } = string.Empty;
        public List<LegacyInvoiceItemDto> Items { get; set; } = new();
        public List<LegacyPaymentDto> Payments { get; set; } = new();
    }

    public class LegacyInvoiceItemDto
    {
        public int Id { get; set; }
        public int SourceItemId { get; set; }
        public int? SourceProductId { get; set; }
        public int? DestinationProductId { get; set; }
        public string? Sku { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string UnitType { get; set; } = "CRTN";
        public decimal Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal Discount { get; set; }
        public decimal VatAmount { get; set; }
        public decimal LineTotal { get; set; }
    }

    public class LegacyPaymentDto
    {
        public int Id { get; set; }
        public int SourcePaymentId { get; set; }
        public int? SourceCustomerId { get; set; }
        public int? DestinationCustomerId { get; set; }
        public decimal Amount { get; set; }
        public string Mode { get; set; } = "Cash";
        public string Status { get; set; } = "Cleared";
        public DateTime PaymentDate { get; set; }
        public string? Reference { get; set; }
    }

    public class LegacyCustomerSummaryDto
    {
        public int Id { get; set; }
        public int SourceCustomerId { get; set; }
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
        public decimal ApprovedOpeningBalance { get; set; }
    }

    public class LegacyOpeningReceivableDto
    {
        public int Id { get; set; }
        public int SourceCustomerId { get; set; }
        public int? DestinationCustomerId { get; set; }
        public string? CustomerName { get; set; }
        public string SourceSystem { get; set; } = "Starplus";
        public decimal OpeningBalance { get; set; }
        public int ReconciledInvoicesCount { get; set; }
        public DateTime CutoffDate { get; set; }
        public DateTime ApprovedAt { get; set; }
        public string? Notes { get; set; }
    }

    public class LegacyReconciliationSummaryDto
    {
        public int TotalInvoices { get; set; }
        public int ActiveInvoices { get; set; }
        public int DeletedInvoices { get; set; }
        public int TotalInvoiceItems { get; set; }
        public int TotalPayments { get; set; }
        public int ClearedPayments { get; set; }
        public int PendingPayments { get; set; }
        public decimal ActiveGrandTotal { get; set; }
        public decimal ActivePaidTotal { get; set; }
        public decimal PositiveOutstandingSum { get; set; }
        public int PositiveOutstandingCount { get; set; }
        public int PendingReportCount { get; set; }
        public decimal PendingReportTotal { get; set; }
        public int ResidualInvoicesCount { get; set; }
        public decimal ResidualInvoicesTotal { get; set; }
        public int CustomerOpeningReceivablesCount { get; set; }
        public decimal CustomerOpeningReceivablesTotal { get; set; }
        public decimal UnattributedOpenTotal { get; set; }
    }

    public class UnifiedInvoiceSummaryDto
    {
        public string Id { get; set; } = string.Empty;
        public int? OperatingSaleId { get; set; }
        public int? LegacyInvoiceId { get; set; }
        public string SourceCompany { get; set; } = string.Empty;
        public string InvoiceNumber { get; set; } = string.Empty;
        public DateTime InvoiceDate { get; set; }
        public int? CustomerId { get; set; }
        public string? CustomerName { get; set; }
        public int ItemCount { get; set; }
        public decimal Subtotal { get; set; }
        public decimal VatTotal { get; set; }
        public decimal GrandTotal { get; set; }
        public decimal PaidAmount { get; set; }
        public decimal OutstandingBalance { get; set; }
        public string PaymentStatus { get; set; } = string.Empty;
        public string OriginalStatus { get; set; } = string.Empty;
        public bool IsDeleted { get; set; }
        public bool IsLegacy { get; set; }
        /// <summary>True for read-only rows (all historical invoices, and operating invoices locked after posting).</summary>
        public bool IsLocked { get; set; }
        /// <summary>Original legal issuer of a historical invoice (provenance; never rewritten).</summary>
        public string? LegacyIssuer { get; set; }
        /// <summary>First cleared payment mode for operating invoices.</summary>
        public string? PrimaryPaymentMode { get; set; }
        public string? Notes { get; set; }
    }

    public class LegacyPaymentListItemDto
    {
        public int Id { get; set; }
        public int SourcePaymentId { get; set; }
        public int? LegacyInvoiceId { get; set; }
        public string? LegacyInvoiceNumber { get; set; }
        public int? SourceCustomerId { get; set; }
        public int? DestinationCustomerId { get; set; }
        public string? CustomerName { get; set; }
        public decimal Amount { get; set; }
        public string Mode { get; set; } = "Cash";
        public string Status { get; set; } = "Cleared";
        public DateTime PaymentDate { get; set; }
        public string? Reference { get; set; }
    }

    /// <summary>One row of the combined payment history: a current payment or a read-only historical (migrated) payment.</summary>
    public class UnifiedPaymentDto
    {
        /// <summary>True for a migrated historical payment (read-only, never editable).</summary>
        public bool IsHistorical { get; set; }
        public int Id { get; set; }
        public int? SaleId { get; set; }
        public int? LegacyInvoiceId { get; set; }
        public string? InvoiceNo { get; set; }
        public int? CustomerId { get; set; }
        public string? CustomerName { get; set; }
        public decimal Amount { get; set; }
        public string Mode { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? Reference { get; set; }
        public DateTime PaymentDate { get; set; }
        // Current payments only (null/false for historical rows):
        public int? SaleReturnId { get; set; }
        public int? CreatedBy { get; set; }
        public DateTime? CreatedAt { get; set; }
        public bool IsSettlementAdjustment { get; set; }
        public int? ParentPaymentId { get; set; }
    }

    public class LegacyPaymentsSummaryDto
    {
        /// <summary>Number of historical payments this tenant owns. 0 means the tenant has no historical data.</summary>
        public int HistoricalCount { get; set; }
    }

    public class LegacyPurchaseSummaryDto
    {
        public int Id { get; set; }
        public int SourcePurchaseId { get; set; }
        public string SourceSystem { get; set; } = "Starplus";
        public string SupplierName { get; set; } = string.Empty;
        public string InvoiceNo { get; set; } = string.Empty;
        public string? ExternalReference { get; set; }
        public string? ExpenseCategory { get; set; }
        public DateTime PurchaseDate { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal? Subtotal { get; set; }
        public decimal? VatTotal { get; set; }
        public int ItemCount { get; set; }
    }

    public class LegacyPurchaseDetailDto : LegacyPurchaseSummaryDto
    {
        public string? InvoiceFilePath { get; set; }
        public string? InvoiceFileName { get; set; }
        public List<LegacyPurchaseItemDto> Items { get; set; } = new();
    }

    public class LegacyPurchaseItemDto
    {
        public int Id { get; set; }
        public int SourceItemId { get; set; }
        public int SourceProductId { get; set; }
        public int? DestinationProductId { get; set; }
        public string? ProductName { get; set; }
        public string UnitType { get; set; } = "CRTN";
        public decimal Qty { get; set; }
        public decimal UnitCost { get; set; }
        public decimal LineTotal { get; set; }
        public decimal? UnitCostExclVat { get; set; }
        public decimal? VatAmount { get; set; }
    }

    public class LegacyExpenseSummaryDto
    {
        public int Id { get; set; }
        public int SourceExpenseId { get; set; }
        public int SourceCategoryId { get; set; }
        public string? CategoryName { get; set; }
        public decimal Amount { get; set; }
        public DateTime Date { get; set; }
        public string? Note { get; set; }
        public decimal? VatRate { get; set; }
        public decimal? VatAmount { get; set; }
        public decimal? TotalAmount { get; set; }
        public string? TaxType { get; set; }
        public bool? IsTaxClaimable { get; set; }
    }

    public class LegacySupplierSummaryDto
    {
        public string SupplierName { get; set; } = string.Empty;
        public int PurchaseCount { get; set; }
        public decimal TotalPurchases { get; set; }
        public DateTime? FirstPurchaseDate { get; set; }
        public DateTime? LastPurchaseDate { get; set; }
    }
}
