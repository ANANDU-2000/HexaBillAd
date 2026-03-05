/*
Purpose: SupplierPayment model for payments to suppliers
Author: HexaBill ERP Redesign
Date: 2025
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class SupplierPayment
    {
        public int Id { get; set; }

        public int TenantId { get; set; }

        [Required]
        [MaxLength(200)]
        public string SupplierName { get; set; } = string.Empty;

        public decimal Amount { get; set; }

        public DateTime PaymentDate { get; set; }

        public SupplierPaymentMode Mode { get; set; }

        [MaxLength(200)]
        public string? Reference { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        public int CreatedBy { get; set; }

        public DateTime CreatedAt { get; set; }
    }

    public enum SupplierPaymentMode
    {
        Cash,
        Bank,
        Cheque
    }
}
