/*
Purpose: Quotation and QuotationItem entities (tenant-scoped commercial quotes)
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class Quotation
    {
        public int Id { get; set; }
        public int OwnerId { get; set; }
        public int? TenantId { get; set; }

        [Required]
        [MaxLength(50)]
        public string QuoteNo { get; set; } = string.Empty;

        public DateTime QuoteDate { get; set; }

        [MaxLength(200)]
        public string? CustomerName { get; set; }

        [MaxLength(500)]
        public string? CustomerAddress { get; set; }

        [MaxLength(50)]
        public string? CustomerPhone { get; set; }

        [MaxLength(100)]
        public string? CustomerEmail { get; set; }

        public int? CustomerId { get; set; }

        public decimal Subtotal { get; set; }
        public decimal VatTotal { get; set; }
        public decimal Discount { get; set; }
        public decimal GrandTotal { get; set; }

        /// <summary>Draft | Final</summary>
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Draft";

        public string? Notes { get; set; }
        public int CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
        public int? LastModifiedBy { get; set; }
        public DateTime? LastModifiedAt { get; set; }
        public bool IsDeleted { get; set; }
        public int? DeletedBy { get; set; }
        public DateTime? DeletedAt { get; set; }

        public virtual Customer? Customer { get; set; }
        public virtual ICollection<QuotationItem> Items { get; set; } = new List<QuotationItem>();
    }

    public class QuotationItem
    {
        public int Id { get; set; }
        public int QuotationId { get; set; }
        public int? ProductId { get; set; }

        [Required]
        [MaxLength(500)]
        public string Description { get; set; } = string.Empty;

        [MaxLength(50)]
        public string UnitLabel { get; set; } = "Pcs";

        public decimal Qty { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal VatRate { get; set; }
        public decimal VatAmount { get; set; }
        public decimal LineTotal { get; set; }
        public int SortOrder { get; set; }

        public virtual Quotation Quotation { get; set; } = null!;
        public virtual Product? Product { get; set; }
    }
}
