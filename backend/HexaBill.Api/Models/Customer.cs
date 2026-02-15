/*
Purpose: Customer model for customer management
Author: AI Assistant
Date: 2024
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    /// <summary>
    /// Customer type: Cash customers pay immediately, Credit customers can have outstanding balance
    /// </summary>
    public enum CustomerType
    {
        Credit = 0,  // Default: Customer with credit account (can have outstanding balance)
        Cash = 1     // Walk-in customer (must pay immediately, no credit allowed)
    }

    public class Customer
    {
        public int Id { get; set; }
        
        // MULTI-TENANT: Owner identification for data isolation (legacy, will be removed after migration)
        public int OwnerId { get; set; }
        
        // MULTI-TENANT: Tenant identification (new, replaces OwnerId)
        public int? TenantId { get; set; }
        
        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;
        
        /// <summary>
        /// Customer type: Credit or Cash
        /// Credit customers can have outstanding balance, Cash customers must pay immediately
        /// </summary>
        public CustomerType CustomerType { get; set; } = CustomerType.Credit;
        
        [MaxLength(20)]
        public string? Phone { get; set; }
        [EmailAddress]
        [MaxLength(100)]
        public string? Email { get; set; }
        [MaxLength(50)]
        public string? Trn { get; set; }
        [MaxLength(500)]
        public string? Address { get; set; }
        public decimal CreditLimit { get; set; }
            
        // REAL-TIME BALANCE TRACKING FIELDS
        public decimal TotalSales { get; set; } = 0; // Sum of all invoice GrandTotal (excluding deleted)
        public decimal TotalPayments { get; set; } = 0; // Sum of all CLEARED payments
        public decimal PendingBalance { get; set; } = 0; // TotalSales - TotalPayments (amount customer owes)
            
        // Legacy balance field (kept for backward compatibility, but use PendingBalance instead)
        public decimal Balance { get; set; } // Positive = customer owes, negative = customer has credit
            
        public DateTime? LastActivity { get; set; } // Last transaction date
        public DateTime? LastPaymentDate { get; set; } // Last payment received date
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public byte[] RowVersion { get; set; } = Array.Empty<byte>(); // For optimistic concurrency
    }
}
