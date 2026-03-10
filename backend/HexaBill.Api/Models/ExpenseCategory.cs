/*
Purpose: Expense Category model for categorizing expenses
Author: AI Assistant
Date: 2024
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class ExpenseCategory
    {
        public int Id { get; set; }
        /// <summary>Tenant/company that owns this category. Required for multi-tenant isolation.</summary>
        public int? TenantId { get; set; }
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;
        [MaxLength(7)]
        public string ColorCode { get; set; } = "#3B82F6"; // Default blue
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>Default VAT rate (e.g. 0.05 for 5%) applied when creating expense from this category if not overridden.</summary>
        public decimal DefaultVatRate { get; set; }
        /// <summary>Default tax type: Standard, Petroleum, Exempt, OutOfScope.</summary>
        [MaxLength(20)]
        public string DefaultTaxType { get; set; } = "Standard";
        /// <summary>Default ITC claimable for expenses in this category.</summary>
        public bool DefaultIsTaxClaimable { get; set; }
        /// <summary>Default entertainment flag (50% cap).</summary>
        public bool DefaultIsEntertainment { get; set; }
        /// <summary>When true, expense VAT is always taken from category defaults; user input is ignored.</summary>
        public bool VatDefaultLocked { get; set; }

        // Navigation properties
        public virtual ICollection<Expense> Expenses { get; set; } = new List<Expense>();
    }
}

