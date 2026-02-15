/*
Purpose: Subscription model for tenant subscriptions
Author: AI Assistant
Date: 2026-02-11
*/
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HexaBill.Api.Models
{
    public class Subscription
    {
        public int Id { get; set; }
        
        [Required]
        public int TenantId { get; set; }
        
        [Required]
        public int PlanId { get; set; }
        
        [Required]
        public SubscriptionStatus Status { get; set; } = SubscriptionStatus.Trial;
        
        [Required]
        public BillingCycle BillingCycle { get; set; } = BillingCycle.Monthly;
        
        public DateTime StartDate { get; set; } = DateTime.UtcNow;
        
        public DateTime? EndDate { get; set; } // For monthly/yearly subscriptions
        
        public DateTime? TrialEndDate { get; set; }
        
        public DateTime? CancelledAt { get; set; }
        
        [MaxLength(500)]
        public string? CancellationReason { get; set; }
        
        public DateTime? ExpiresAt { get; set; } // When subscription expires if not renewed
        
        public DateTime? NextBillingDate { get; set; } // For recurring subscriptions
        
        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; } // Current subscription amount
        
        [Required]
        [MaxLength(10)]
        public string Currency { get; set; } = "AED";
        
        // Payment gateway integration fields
        [MaxLength(200)]
        public string? PaymentGatewaySubscriptionId { get; set; } // Stripe/Razorpay subscription ID
        
        [MaxLength(200)]
        public string? PaymentGatewayCustomerId { get; set; } // Stripe/Razorpay customer ID
        
        [MaxLength(50)]
        public string? PaymentMethod { get; set; } // "stripe", "razorpay", "manual"
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        
        // Navigation properties
        [ForeignKey("TenantId")]
        public virtual Tenant Tenant { get; set; } = null!;
        
        [ForeignKey("PlanId")]
        public virtual SubscriptionPlan Plan { get; set; } = null!;
    }
    
    public enum SubscriptionStatus
    {
        Trial = 0,          // In trial period
        Active = 1,         // Active and paid
        Expired = 2,        // Trial expired, not paid
        Cancelled = 3,       // Cancelled by user
        Suspended = 4,      // Suspended by admin
        PastDue = 5         // Payment failed, past due
    }
    
    public enum BillingCycle
    {
        Monthly = 0,
        Yearly = 1
    }
}
