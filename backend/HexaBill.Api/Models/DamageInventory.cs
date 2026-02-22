/*
Purpose: Damage inventory tracking for returned damaged items (ERP-style)
Author: AI Assistant
Date: 2026
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    /// <summary>
    /// Tracks quantity of product in damage inventory (returned as damaged, not resellable).
    /// One row per tenant/product/branch; quantity is cumulative.
    /// </summary>
    public class DamageInventory
    {
        public int Id { get; set; }
        public int TenantId { get; set; }
        public int ProductId { get; set; }
        public int? BranchId { get; set; }
        /// <summary>Cumulative quantity in damage inventory (base units if product has conversion).</summary>
        public decimal Quantity { get; set; }
        /// <summary>Last return that added to this row (for audit).</summary>
        public int? SourceReturnId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public virtual Tenant Tenant { get; set; } = null!;
        public virtual Product Product { get; set; } = null!;
        public virtual Branch? Branch { get; set; }
        public virtual SaleReturn? SourceReturn { get; set; }
    }
}
