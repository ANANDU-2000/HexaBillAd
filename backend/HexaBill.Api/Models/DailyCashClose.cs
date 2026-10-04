using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models;

public class DailyCashClose
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public int OwnerId { get; set; }
    public int? BranchId { get; set; }
    /// <summary>Business date in GST (date component only, UTC-kind storage).</summary>
    public DateTime BusinessDate { get; set; }
    public int Version { get; set; } = 1;
    public DailyCashCloseStatus Status { get; set; } = DailyCashCloseStatus.Draft;
    public decimal OpeningCash { get; set; }
    public decimal CashReceived { get; set; }
    public decimal CashPaidOut { get; set; }
    /// <summary>Cleared non-cash customer collections (bank/online/cheque); informational, not part of drawer expected cash.</summary>
    public decimal BankReceived { get; set; }
    /// <summary>Supplier bank/cheque outflows for the day; informational.</summary>
    public decimal BankPaidOut { get; set; }
    public decimal ExpectedCash { get; set; }
    public decimal CountedCash { get; set; }
    public decimal Variance { get; set; }
    [MaxLength(500)]
    public string? VarianceReason { get; set; }
    [MaxLength(1000)]
    public string? Comment { get; set; }
    public DateTime? ClosedAt { get; set; }
    public int? ClosedByUserId { get; set; }
    public DateTime? ReopenedAt { get; set; }
    [MaxLength(500)]
    public string? ReopenReason { get; set; }
    public int CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public enum DailyCashCloseStatus
{
    Draft = 0,
    Closed = 1,
    Reopened = 2
}
