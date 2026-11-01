const fs = require('fs');
const file = 'backend/HexaBill.Api/Models/Legacy/LegacyEntities.cs';
let content = fs.readFileSync(file, 'utf8');

const additionalClasses = `
    [Table("LegacyPurchases")]
    public class LegacyPurchase
    {
        [Key]
        public int Id { get; set; }
        public int TenantId { get; set; }
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
        public string? InvoiceFilePath { get; set; }
        public string? InvoiceFileName { get; set; }
        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public virtual ICollection<LegacyPurchaseItem> Items { get; set; } = new List<LegacyPurchaseItem>();
    }

    [Table("LegacyPurchaseItems")]
    public class LegacyPurchaseItem
    {
        [Key]
        public int Id { get; set; }
        public int TenantId { get; set; }
        public int SourceItemId { get; set; }
        public int SourcePurchaseId { get; set; }
        public int SourceProductId { get; set; }
        public int? DestinationProductId { get; set; }
        public string UnitType { get; set; } = "CRTN";
        public decimal Qty { get; set; }
        public decimal UnitCost { get; set; }
        public decimal LineTotal { get; set; }
        public decimal? UnitCostExclVat { get; set; }
        public decimal? VatAmount { get; set; }

        [ForeignKey(nameof(SourcePurchaseId))]
        public virtual LegacyPurchase? Purchase { get; set; }
    }

    [Table("LegacyExpenseCategories")]
    public class LegacyExpenseCategory
    {
        [Key]
        public int Id { get; set; }
        public int TenantId { get; set; }
        public int SourceCategoryId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string ColorCode { get; set; } = "#888888";
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public decimal DefaultVatRate { get; set; }
        public string DefaultTaxType { get; set; } = "Standard";
        public bool DefaultIsTaxClaimable { get; set; }
        public bool DefaultIsEntertainment { get; set; }
        public bool VatDefaultLocked { get; set; }
    }

    [Table("LegacyExpenses")]
    public class LegacyExpense
    {
        [Key]
        public int Id { get; set; }
        public int TenantId { get; set; }
        public int SourceExpenseId { get; set; }
        public int SourceCategoryId { get; set; }
        public string? CategoryName { get; set; }
        public decimal Amount { get; set; }
        public DateTime Date { get; set; }
        public string? Note { get; set; }
        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public decimal? VatRate { get; set; }
        public decimal? VatAmount { get; set; }
        public decimal? TotalAmount { get; set; }
        public string? TaxType { get; set; }
        public bool? IsTaxClaimable { get; set; }
        public bool? IsEntertainment { get; set; }
        public string SourceSystem { get; set; } = "Starplus";
    }

    [Table("LegacyInventoryTransactions")]
    public class LegacyInventoryTransaction
    {
        [Key]
        public int Id { get; set; }
        public int TenantId { get; set; }
        public int SourceTransactionId { get; set; }
        public int SourceProductId { get; set; }
        public int? DestinationProductId { get; set; }
        public decimal ChangeQty { get; set; }
        public string TransactionType { get; set; } = string.Empty;
        public int? RefId { get; set; }
        public string? Reason { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    [Table("LegacyInvoiceVersions")]
    public class LegacyInvoiceVersion
    {
        [Key]
        public int Id { get; set; }
        public int TenantId { get; set; }
        public int SourceVersionId { get; set; }
        public int SourceSaleId { get; set; }
        public int VersionNumber { get; set; }
        public int CreatedById { get; set; }
        public DateTime CreatedAt { get; set; }
        public string DataJson { get; set; } = "{}";
        public string? EditReason { get; set; }
        public string? DiffSummary { get; set; }
    }

    [Table("LegacyPaymentReceipts")]
    public class LegacyPaymentReceipt
    {
        [Key]
        public int Id { get; set; }
        public int TenantId { get; set; }
        public int SourceReceiptId { get; set; }
        public string ReceiptNumber { get; set; } = string.Empty;
        public DateTime GeneratedAt { get; set; }
        public int GeneratedByUserId { get; set; }
        public string? PdfStoragePath { get; set; }
    }

    [Table("LegacyPaymentReceiptPayments")]
    public class LegacyPaymentReceiptPayment
    {
        [Key]
        public int Id { get; set; }
        public int TenantId { get; set; }
        public int SourceReceiptPaymentId { get; set; }
        public int PaymentReceiptId { get; set; }
        public int PaymentId { get; set; }
    }
}
`;

const lastClosingBrace = content.lastIndexOf('}');
if (lastClosingBrace !== -1) {
  content = content.slice(0, lastClosingBrace) + additionalClasses;
  fs.writeFileSync(file, content, 'utf8');
  console.log('Appended entity classes to LegacyEntities.cs');
} else {
  console.error('Could not find closing brace');
}

