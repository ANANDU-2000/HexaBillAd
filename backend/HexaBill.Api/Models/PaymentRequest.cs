/*
Purpose: Payment Request model for idempotency protection
Author: AI Assistant
Date: 2025
*/
namespace HexaBill.Api.Models
{
    /// <summary>
    /// Tracks payment requests with idempotency keys to prevent duplicate processing
    /// </summary>
    public class PaymentIdempotency
    {
        public string IdempotencyKey { get; set; } = string.Empty; // Primary key
        public int PaymentId { get; set; }
        public int UserId { get; set; }
        public DateTime CreatedAt { get; set; }
        public string? ResponseSnapshot { get; set; } // JSON snapshot of response

        // Navigation
        public virtual Payment Payment { get; set; } = null!;
        public virtual User User { get; set; } = null!;
    }
}

