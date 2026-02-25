/*
Purpose: Price change audit log for product price history
Author: AI Assistant
Date: 2024
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class PriceChangeLog
    {
        public int Id { get; set; }
        
        // MULTI-TENANT: Owner identification for data isolation (legacy, will be removed after migration)
        public int OwnerId { get; set; }
        
        // MULTI-TENANT: Tenant identification (new, replaces OwnerId)
        public int? TenantId { get; set; }
        
        [Required]
        public int ProductId { get; set; }
        
        [Required]
        public decimal OldPrice { get; set; }
        
        [Required]
        public decimal NewPrice { get; set; }
        
        public decimal PriceDifference { get; set; }  // For percentage calculations
        
        [Required]
        public int ChangedBy { get; set; }  // User ID
        
        [MaxLength(500)]
        public string? Reason { get; set; }
        
        public DateTime ChangedAt { get; set; }
        
        // Navigation property
        public Product? Product { get; set; }
        public User? ChangedByUser { get; set; }
    }
}


