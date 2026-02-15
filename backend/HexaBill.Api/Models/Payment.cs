/*
Purpose: Payment model for payment tracking
Author: AI Assistant
Date: 2024
Updated: 2025 - Added Status field and updated enums per spec
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class Payment
    {
        public int Id { get; set; }
        
        // MULTI-TENANT: Owner identification for data isolation (legacy, will be removed after migration)
        public int OwnerId { get; set; }
        
        // MULTI-TENANT: Tenant identification (new, replaces OwnerId)
        public int? TenantId { get; set; }
        
        public int? SaleId { get; set; } // Invoice ID
        public int? CustomerId { get; set; }
        public decimal Amount { get; set; }
        public PaymentMode Mode { get; set; } // CASH, CHEQUE, ONLINE, CREDIT
        [MaxLength(200)]
        public string? Reference { get; set; } // Cheque no / Transaction ID
        public PaymentStatus Status { get; set; } // PENDING, CLEARED, RETURNED, VOID
        public DateTime PaymentDate { get; set; }
        public int CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public byte[]? RowVersion { get; set; } // For optimistic concurrency (nullable for PostgreSQL)

        // Navigation properties
        public virtual Sale? Sale { get; set; }
        public virtual Customer? Customer { get; set; }
        public virtual User CreatedByUser { get; set; } = null!;
    }

    public enum PaymentMode
    {
        CASH,
        CHEQUE,
        ONLINE,
        CREDIT
    }

    public enum PaymentStatus
    {
        PENDING,
        CLEARED,
        RETURNED,
        VOID
    }
}

