/*
Purpose: Invoice versioning model for tracking invoice edits
Author: AI Assistant
Date: 2024
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class InvoiceVersion
    {
        public int Id { get; set; }
        
        // MULTI-TENANT: Owner identification for data isolation (legacy, will be removed after migration)
        public int OwnerId { get; set; }
        
        // MULTI-TENANT: Tenant identification (new, replaces OwnerId)
        public int? TenantId { get; set; }
        
        [Required]
        public int SaleId { get; set; }
        public int VersionNumber { get; set; }
        public int CreatedById { get; set; }
        public DateTime CreatedAt { get; set; }
        public string DataJson { get; set; } = string.Empty; // Full snapshot of sale + saleItems
        public string? EditReason { get; set; }
        public string? DiffSummary { get; set; } // Summary of changes

        // Navigation properties
        public virtual Sale Sale { get; set; } = null!;
        public virtual User CreatedByUser { get; set; } = null!;
    }
}

