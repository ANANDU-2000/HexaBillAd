/*
Purpose: Tenant entity for multi-tenant SaaS architecture
Author: AI Assistant
Date: 2026
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class Tenant
    {
        public int Id { get; set; }
        
        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;
        
        [MaxLength(100)]
        public string? Subdomain { get; set; } // For future: tenant1.app.com
        
        [MaxLength(200)]
        public string? Domain { get; set; } // For future: tenant1.com
        
        [Required]
        [MaxLength(10)]
        public string Country { get; set; } = "AE"; // Default UAE
        
        [Required]
        [MaxLength(10)]
        public string Currency { get; set; } = "AED"; // Default AED
        
        [MaxLength(50)]
        public string? VatNumber { get; set; }
        
        [MaxLength(200)]
        public string? CompanyNameEn { get; set; }
        
        [MaxLength(200)]
        public string? CompanyNameAr { get; set; }
        
        [MaxLength(500)]
        public string? Address { get; set; }
        
        [MaxLength(20)]
        public string? Phone { get; set; }
        
        [MaxLength(100)]
        [EmailAddress]
        public string? Email { get; set; }
        
        [MaxLength(500)]
        public string? LogoPath { get; set; }
        
        public TenantStatus Status { get; set; } = TenantStatus.Active;
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        public DateTime? TrialEndDate { get; set; }
        
        public DateTime? SuspendedAt { get; set; }
        
        [MaxLength(500)]
        public string? SuspensionReason { get; set; }
        
        // Navigation properties
        public virtual ICollection<User> Users { get; set; } = new List<User>();
        public virtual ICollection<Setting> Settings { get; set; } = new List<Setting>();
        public virtual ICollection<Branch> Branches { get; set; } = new List<Branch>();
    }

    public enum TenantStatus
    {
        Active = 0,      // Fully operational
        Suspended = 1,   // Temporarily disabled
        Trial = 2,       // In trial period
        Expired = 3      // Trial expired, needs payment
    }
}
