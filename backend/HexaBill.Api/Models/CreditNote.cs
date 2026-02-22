/*
Purpose: Credit note for sales returns (cash/paid invoice flow - ERP style)
Author: AI Assistant
Date: 2026
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    /// <summary>
    /// Credit note linked to a sale return. Used for cash (paid) invoices: refund or future adjustment.
    /// </summary>
    public class CreditNote
    {
        public int Id { get; set; }
        public int TenantId { get; set; }
        public int CustomerId { get; set; }
        public int LinkedReturnId { get; set; }
        public decimal Amount { get; set; }
        [MaxLength(10)]
        public string Currency { get; set; } = "AED";
        /// <summary>unused, used, cancelled</summary>
        [MaxLength(20)]
        public string Status { get; set; } = "unused";
        public DateTime CreatedAt { get; set; }
        public int CreatedBy { get; set; }

        public virtual Tenant Tenant { get; set; } = null!;
        public virtual Customer Customer { get; set; } = null!;
        public virtual SaleReturn LinkedReturn { get; set; } = null!;
        public virtual User CreatedByUser { get; set; } = null!;
    }
}
