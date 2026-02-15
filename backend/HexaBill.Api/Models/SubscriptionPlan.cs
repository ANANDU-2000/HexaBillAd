/*
Purpose: Subscription Plan model for SaaS billing
Author: AI Assistant
Date: 2026-02-11
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class SubscriptionPlan
    {
        public int Id { get; set; }
        
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty; // e.g., "Basic", "Professional", "Enterprise"
        
        [MaxLength(500)]
        public string? Description { get; set; }
        
        [Required]
        public decimal MonthlyPrice { get; set; }
        
        [Required]
        public decimal YearlyPrice { get; set; }
        
        [Required]
        public string Currency { get; set; } = "AED";
        
        // Feature limits
        public int MaxUsers { get; set; } = 5; // -1 = unlimited
        public int MaxInvoicesPerMonth { get; set; } = 100; // -1 = unlimited
        public int MaxCustomers { get; set; } = 500; // -1 = unlimited
        public int MaxProducts { get; set; } = 1000; // -1 = unlimited
        public long MaxStorageMB { get; set; } = 1024; // -1 = unlimited
        
        // Feature flags
        public bool HasAdvancedReports { get; set; } = false;
        public bool HasApiAccess { get; set; } = false;
        public bool HasWhiteLabel { get; set; } = false;
        public bool HasPrioritySupport { get; set; } = false;
        public bool HasCustomBranding { get; set; } = false;
        
        public int TrialDays { get; set; } = 14; // Default trial period
        
        public bool IsActive { get; set; } = true;
        
        public int DisplayOrder { get; set; } = 0; // For sorting plans
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        
        // Navigation properties
        public virtual ICollection<Subscription> Subscriptions { get; set; } = new List<Subscription>();
    }
}
