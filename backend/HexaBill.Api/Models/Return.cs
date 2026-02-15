/*
Purpose: Return models for sales returns and purchase returns
Author: AI Assistant
Date: 2025
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class SaleReturn
    {
        public int Id { get; set; }
        
        // MULTI-TENANT: Owner identification for data isolation (legacy, will be removed after migration)
        public int OwnerId { get; set; }
        
        // MULTI-TENANT: Tenant identification (new, replaces OwnerId)
        public int? TenantId { get; set; }
        
        [Required]
        public int SaleId { get; set; } // Original sale invoice
        public int? CustomerId { get; set; }
        [Required]
        [MaxLength(100)]
        public string ReturnNo { get; set; } = string.Empty; // RET-001, RET-002
        public DateTime ReturnDate { get; set; }
        public decimal Subtotal { get; set; }
        public decimal VatTotal { get; set; }
        public decimal Discount { get; set; }
        public decimal GrandTotal { get; set; }
        [MaxLength(500)]
        public string? Reason { get; set; } // Bad item, damaged, wrong item, etc.
        public ReturnStatus Status { get; set; } // Pending, Approved, Rejected
        public bool RestoreStock { get; set; } = true; // Add back to stock
        public bool IsBadItem { get; set; } = false; // If true, don't restore to sellable stock
        public int CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }

        // Navigation properties
        public virtual Sale Sale { get; set; } = null!;
        public virtual Customer? Customer { get; set; }
        public virtual User CreatedByUser { get; set; } = null!;
        public virtual ICollection<SaleReturnItem> Items { get; set; } = new List<SaleReturnItem>();
    }

    public class SaleReturnItem
    {
        public int Id { get; set; }
        public int SaleReturnId { get; set; }
        public int SaleItemId { get; set; } // Original sale item
        public int ProductId { get; set; }
        [Required]
        [MaxLength(20)]
        public string UnitType { get; set; } = "CRTN";
        public decimal Qty { get; set; } // Quantity returned
        public decimal UnitPrice { get; set; } // Original unit price
        public decimal VatAmount { get; set; }
        public decimal LineTotal { get; set; }
        [MaxLength(200)]
        public string? Reason { get; set; } // Item-specific reason

        // Navigation properties
        public virtual SaleReturn SaleReturn { get; set; } = null!;
        public virtual SaleItem SaleItem { get; set; } = null!;
        public virtual Product Product { get; set; } = null!;
    }

    public class PurchaseReturn
    {
        public int Id { get; set; }
        
        // MULTI-TENANT: Owner identification for data isolation (legacy, will be removed after migration)
        public int OwnerId { get; set; }
        
        // MULTI-TENANT: Tenant identification (new, replaces OwnerId)
        public int? TenantId { get; set; }
        
        [Required]
        public int PurchaseId { get; set; } // Original purchase
        public int? SupplierId { get; set; }
        [Required]
        [MaxLength(100)]
        public string ReturnNo { get; set; } = string.Empty; // PUR-RET-001
        public DateTime ReturnDate { get; set; }
        public decimal Subtotal { get; set; }
        public decimal VatTotal { get; set; }
        public decimal GrandTotal { get; set; }
        [MaxLength(500)]
        public string? Reason { get; set; }
        public ReturnStatus Status { get; set; }
        public int CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }

        // Navigation properties
        public virtual Purchase Purchase { get; set; } = null!;
        public virtual User CreatedByUser { get; set; } = null!;
        public virtual ICollection<PurchaseReturnItem> Items { get; set; } = new List<PurchaseReturnItem>();
    }

    public class PurchaseReturnItem
    {
        public int Id { get; set; }
        public int PurchaseReturnId { get; set; }
        public int PurchaseItemId { get; set; }
        public int ProductId { get; set; }
        [Required]
        [MaxLength(20)]
        public string UnitType { get; set; } = "CRTN";
        public decimal Qty { get; set; }
        public decimal UnitCost { get; set; }
        public decimal LineTotal { get; set; }
        [MaxLength(200)]
        public string? Reason { get; set; }

        // Navigation properties
        public virtual PurchaseReturn PurchaseReturn { get; set; } = null!;
        public virtual PurchaseItem PurchaseItem { get; set; } = null!;
        public virtual Product Product { get; set; } = null!;
    }

    public enum ReturnStatus
    {
        Pending,
        Approved,
        Rejected
    }
}

