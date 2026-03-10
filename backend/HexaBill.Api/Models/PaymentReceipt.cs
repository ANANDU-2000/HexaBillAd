/*
Purpose: Payment receipt - proof of payment received (not a tax invoice)
Author: HexaBill 3-Feature Implementation
Date: 2026-03
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class PaymentReceipt
    {
        public int Id { get; set; }
        public int TenantId { get; set; }
        [Required]
        [MaxLength(30)]
        public string ReceiptNumber { get; set; } = string.Empty; // REC-2026-0001
        public int PaymentId { get; set; }
        public DateTime GeneratedAt { get; set; }
        public int GeneratedByUserId { get; set; }
        [MaxLength(500)]
        public string? PdfStoragePath { get; set; }

        public virtual Payment Payment { get; set; } = null!;
        public virtual User GeneratedByUser { get; set; } = null!;
    }
}
