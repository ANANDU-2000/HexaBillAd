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
        public string? SnapshotJson { get; set; }
        public string? SnapshotHash { get; set; }
        public string? SnapshotHistoryJson { get; set; }
        public int SnapshotVersion { get; set; }
        public DateTime? SnapshotAt { get; set; }

        // Staleness control: every calculation gets a new version and a fingerprint of the source data it saw.
        public int CalculationVersion { get; set; }
        [MaxLength(64)]
        public string? SourceFingerprint { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public int? ReviewedByUserId { get; set; }
        public int? ReviewedCalculationVersion { get; set; }
        public DateTime? ReviewInvalidatedAt { get; set; }
        [MaxLength(200)]
        public string? ReviewInvalidatedReason { get; set; }
    }
}
