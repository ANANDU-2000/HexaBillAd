using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace StarplusMigrationRunner
{
    public class StagingArchiveRoot
    {
        [JsonPropertyName("metadata")]
        public ArchiveMetadata? Metadata { get; set; }

        [JsonPropertyName("summary")]
        public ArchiveSummary? Summary { get; set; }

        [JsonPropertyName("customers")]
        public List<StagingCustomer> Customers { get; set; } = new();

        [JsonPropertyName("unattributed_invoices")]
        public List<StagingInvoice> UnattributedInvoices { get; set; } = new();

        [JsonPropertyName("products")]
        public List<StagingProduct> Products { get; set; } = new();
    }

    public class ArchiveMetadata
    {
        [JsonPropertyName("source_system")]
        public string? SourceSystem { get; set; }

        [JsonPropertyName("target_tenant_id")]
        public string? TargetTenantId { get; set; }

        [JsonPropertyName("generated_at")]
        public string? GeneratedAt { get; set; }
    }

    public class ArchiveSummary
    {
        [JsonPropertyName("customers")]
        public int Customers { get; set; }

        [JsonPropertyName("products")]
        public int Products { get; set; }

        [JsonPropertyName("invoices_total")]
        public int InvoicesTotal { get; set; }

        [JsonPropertyName("invoices_active")]
        public int InvoicesActive { get; set; }

        [JsonPropertyName("invoices_deleted")]
        public int InvoicesDeleted { get; set; }

        [JsonPropertyName("active_invoice_total")]
        public string? ActiveInvoiceTotal { get; set; }

        [JsonPropertyName("active_paid_amount")]
        public string? ActivePaidAmount { get; set; }

        [JsonPropertyName("positive_outstanding_sum")]
        public string? PositiveOutstandingSum { get; set; }

        [JsonPropertyName("positive_outstanding_invoice_count")]
        public int PositiveOutstandingInvoiceCount { get; set; }

        [JsonPropertyName("sale_line_items")]
        public int SaleLineItems { get; set; }

        [JsonPropertyName("payments")]
        public int Payments { get; set; }
    }

    public class StagingCustomer
    {
        [JsonPropertyName("source_customer_id")]
        public int SourceCustomerId { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("phone")]
        public string? Phone { get; set; }

        [JsonPropertyName("email")]
        public string? Email { get; set; }

        [JsonPropertyName("address")]
        public string? Address { get; set; }

        [JsonPropertyName("trn")]
        public string? Trn { get; set; }

        [JsonPropertyName("ledger_cached_pending_balance")]
        public string? LedgerCachedPendingBalance { get; set; }

        [JsonPropertyName("ledger_cached_balance")]
        public string? LedgerCachedBalance { get; set; }

        [JsonPropertyName("invoice_count")]
        public int InvoiceCount { get; set; }

        [JsonPropertyName("deleted_invoice_count")]
        public int DeletedInvoiceCount { get; set; }

        [JsonPropertyName("unpaid_invoice_count")]
        public int UnpaidInvoiceCount { get; set; }

        [JsonPropertyName("unpaid_invoice_amount")]
        public string? UnpaidInvoiceAmount { get; set; }

        [JsonPropertyName("invoices")]
        public List<StagingInvoice> Invoices { get; set; } = new();
    }

    public class StagingProduct
    {
        [JsonPropertyName("source_product_id")]
        public int SourceProductId { get; set; }

        [JsonPropertyName("sku")]
        public string Sku { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("name_ar")]
        public string? NameAr { get; set; }

        [JsonPropertyName("unit_type")]
        public string UnitType { get; set; } = "CRTN";

        [JsonPropertyName("conversion_to_base")]
        public string? ConversionToBase { get; set; }

        [JsonPropertyName("sell_price")]
        public string? SellPrice { get; set; }

        [JsonPropertyName("cost_price")]
        public string? CostPrice { get; set; }

        [JsonPropertyName("stock_qty_legacy")]
        public string? StockQtyLegacy { get; set; }

        [JsonPropertyName("barcode")]
        public string? Barcode { get; set; }
    }

    public class StagingInvoice
    {
        [JsonPropertyName("source_invoice_id")]
        public int SourceInvoiceId { get; set; }

        [JsonPropertyName("legacy_invoice_number")]
        public string LegacyInvoiceNumber { get; set; } = string.Empty;

        [JsonPropertyName("legacy_issuer")]
        public string LegacyIssuer { get; set; } = "STARPLUS FOODSTUFF TRADING";

        [JsonPropertyName("invoice_date")]
        public string InvoiceDate { get; set; } = string.Empty;

        [JsonPropertyName("due_date")]
        public string? DueDate { get; set; }

        [JsonPropertyName("source_customer_id")]
        public int? SourceCustomerId { get; set; }

        [JsonPropertyName("customer_name")]
        public string? CustomerName { get; set; }

        [JsonPropertyName("source_legal_tax_id")]
        public string SourceLegalTaxId { get; set; } = "100366253100003";

        [JsonPropertyName("status")]
        public string Status { get; set; } = "Pending";

        [JsonPropertyName("is_deleted")]
        public bool IsDeleted { get; set; }

        [JsonPropertyName("is_finalized")]
        public bool IsFinalized { get; set; } = true;

        [JsonPropertyName("is_locked")]
        public bool IsLocked { get; set; }

        [JsonPropertyName("subtotal")]
        public string? Subtotal { get; set; }

        [JsonPropertyName("vat_total")]
        public string? VatTotal { get; set; }

        [JsonPropertyName("discount")]
        public string? Discount { get; set; }

        [JsonPropertyName("round_off")]
        public string? RoundOff { get; set; }

        [JsonPropertyName("grand_total")]
        public string? GrandTotal { get; set; }

        [JsonPropertyName("total_amount")]
        public string? TotalAmount { get; set; }

        [JsonPropertyName("paid_amount")]
        public string? PaidAmount { get; set; }

        [JsonPropertyName("outstanding_calculated")]
        public string? OutstandingCalculated { get; set; }

        [JsonPropertyName("source_external_reference")]
        public string? SourceExternalReference { get; set; }

        [JsonPropertyName("reported_as_pending_2026_10_31")]
        public bool ReportedAsPending20261031 { get; set; }

        [JsonPropertyName("items")]
        public List<StagingItem> Items { get; set; } = new();

        [JsonPropertyName("payments")]
        public List<StagingPayment> Payments { get; set; } = new();
    }

    public class StagingItem
    {
        [JsonPropertyName("source_item_id")]
        public int SourceItemId { get; set; }

        [JsonPropertyName("source_product_id")]
        public int? SourceProductId { get; set; }

        [JsonPropertyName("sku")]
        public string? Sku { get; set; }

        [JsonPropertyName("product_name")]
        public string ProductName { get; set; } = string.Empty;

        [JsonPropertyName("unit_type")]
        public string UnitType { get; set; } = "CRTN";

        [JsonPropertyName("quantity")]
        public string? Quantity { get; set; }

        [JsonPropertyName("unit_price")]
        public string? UnitPrice { get; set; }

        [JsonPropertyName("discount")]
        public string? Discount { get; set; }

        [JsonPropertyName("vat_amount")]
        public string? VatAmount { get; set; }

        [JsonPropertyName("line_total")]
        public string? LineTotal { get; set; }
    }

    public class StagingPayment
    {
        [JsonPropertyName("source_payment_id")]
        public int SourcePaymentId { get; set; }

        [JsonPropertyName("amount")]
        public string? Amount { get; set; }

        [JsonPropertyName("status")]
        public string Status { get; set; } = "CLEARED";

        [JsonPropertyName("mode")]
        public string Mode { get; set; } = "CASH";

        [JsonPropertyName("payment_date")]
        public string PaymentDate { get; set; } = string.Empty;

        [JsonPropertyName("reference")]
        public string? Reference { get; set; }
    }
}
