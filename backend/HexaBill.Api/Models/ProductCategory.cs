/*
Purpose: Product Category model for categorizing products
Author: AI Assistant
Date: 2026-02-17
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class ProductCategory
    {
        public int Id { get; set; }
        
        // MULTI-TENANT: Tenant identification
        public int? TenantId { get; set; }
        
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;
        
        [MaxLength(200)]
        public string? Description { get; set; }
        
        [MaxLength(7)]
        public string ColorCode { get; set; } = "#3B82F6"; // Default blue
        
        public bool IsActive { get; set; } = true;
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        
        // Navigation properties
        public virtual ICollection<Product> Products { get; set; } = new List<Product>();
    }
}
