/*
Purpose: HeldInvoice model for storing POS held invoices server-side
Author: AI Assistant
Date: 2026-02-17
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class HeldInvoice
    {
        public int Id { get; set; }
        
        // MULTI-TENANT: Tenant identification
        public int TenantId { get; set; }
        
        // User who held the invoice
        public int UserId { get; set; }
        
        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;
        
        // JSON data for cart items and invoice details
        [Required]
        public string InvoiceData { get; set; } = string.Empty; // JSON string containing cart, customer, notes, etc.
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        // Navigation properties
        public virtual User User { get; set; } = null!;
    }
}
