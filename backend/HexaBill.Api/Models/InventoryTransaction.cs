/*
Purpose: InventoryTransaction model for stock tracking
Author: AI Assistant
Date: 2024
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class InventoryTransaction
    {
        public int Id { get; set; }
        
        // MULTI-TENANT: Owner identification for data isolation (legacy, will be removed after migration)
        public int OwnerId { get; set; }
        
        // MULTI-TENANT: Tenant identification (new, replaces OwnerId)
        public int? TenantId { get; set; }
        
        public int ProductId { get; set; }
        public decimal ChangeQty { get; set; }
        public TransactionType TransactionType { get; set; }
        public int? RefId { get; set; }
        public string? Reason { get; set; }
        public DateTime CreatedAt { get; set; }

        // Navigation properties
        public virtual Product Product { get; set; } = null!;
    }

    public enum TransactionType
    {
        Purchase,
        Sale,
        Adjustment,
        Return,
        PurchaseReturn
    }
}

