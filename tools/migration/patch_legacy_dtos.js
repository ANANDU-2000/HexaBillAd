const fs = require('fs');
const file = 'backend/HexaBill.Api/Modules/Legacy/LegacyDtos.cs';
let content = fs.readFileSync(file, 'utf8');

const dtos = `
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
`;

const lastClosingBrace = content.lastIndexOf('}');
if (lastClosingBrace !== -1) {
  content = content.slice(0, lastClosingBrace) + dtos;
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully appended DTOs to LegacyDtos.cs');
} else {
  console.error('Could not find closing brace');
}

