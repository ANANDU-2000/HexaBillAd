/*
Purpose: Damage category for sales returns (tenant-scoped)
Author: AI Assistant
Date: 2026
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    /// <summary>
    /// Tenant-scoped reason/category for returned items (e.g. Damaged, Expired, Wrong Item).
    /// AffectsStock: when true, return can add qty back to stock (resaleable) or not (damaged).
    /// AffectsLedger: when true, return adjusts customer balance.
    /// </summary>
    public class DamageCategory
    {
        public int Id { get; set; }
        public int TenantId { get; set; }
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;
        /// <summary>When true, return affects Product.StockQty (resaleable) or damaged tracking.</summary>
        public bool AffectsStock { get; set; } = true;
        /// <summary>When true, return adjusts customer ledger.</summary>
        public bool AffectsLedger { get; set; } = true;
        /// <summary>Resaleable = add back to sellable stock; false = damaged/expired, do not add to stock.</summary>
        public bool IsResaleable { get; set; } = true;
        public int SortOrder { get; set; }
        public DateTime CreatedAt { get; set; }

        public virtual Tenant Tenant { get; set; } = null!;
    }
}
