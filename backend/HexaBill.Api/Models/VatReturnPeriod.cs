/*
Purpose: VAT return period for FTA Form 201 - stores calculated boxes and lock state
Author: HexaBill
Date: 2026
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class VatReturnPeriod
    {
        public int Id { get; set; }
        public int TenantId { get; set; }
        [MaxLength(10)]
        public string PeriodType { get; set; } = "Quarterly"; // Monthly | Quarterly
        [MaxLength(20)]
        public string PeriodLabel { get; set; } = string.Empty; // e.g. Q1-2026, Jan-2026
        public DateTime PeriodStart { get; set; }
        public DateTime PeriodEnd { get; set; }
        public DateTime DueDate { get; set; }
        [MaxLength(15)]
        public string Status { get; set; } = "Draft"; // Draft | Calculated | Reviewed | Submitted | Locked | Amended

        // FTA Form 201 boxes (decimal 18,4)
        public decimal Box1a { get; set; }
        public decimal Box1b { get; set; }
        public decimal Box2 { get; set; }
        public decimal Box3 { get; set; }
        public decimal Box4 { get; set; }
        public decimal Box9b { get; set; }
        public decimal Box10 { get; set; }
        public decimal Box11 { get; set; }
        public decimal Box12 { get; set; }
        public decimal Box13a { get; set; }
        public decimal Box13b { get; set; }
        public decimal PetroleumExcluded { get; set; }

        public DateTime? CalculatedAt { get; set; }
        public DateTime? SubmittedAt { get; set; }
        public int? SubmittedByUserId { get; set; }
        public DateTime? LockedAt { get; set; }
        public int? LockedByUserId { get; set; }
        public string? Notes { get; set; }
    }
}
