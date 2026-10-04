using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models;

/// <summary>Explicit drawer cash flows: owner capital, drawings, and bank↔drawer transfers (audited, not sales).</summary>
public class CashDrawerMovement
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public int OwnerId { get; set; }
    public int? BranchId { get; set; }
    public DateTime MovementDate { get; set; }
    public CashDrawerMovementKind Kind { get; set; }
    public decimal Amount { get; set; }
    [MaxLength(500)]
    public string? Note { get; set; }
    public int CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public enum CashDrawerMovementKind
{
    OwnerCapitalIn = 0,
    OwnerDrawing = 1,
    BankToDrawer = 2,
    DrawerToBank = 3
}
