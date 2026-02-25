namespace HexaBill.Api.Models;

/// <summary>Demo request from marketing site. SuperAdmin approves → creates Tenant.</summary>
public class DemoRequest
{
    public int Id { get; set; }
    public string CompanyName { get; set; } = string.Empty;
    public string ContactName { get; set; } = string.Empty;
    public string WhatsApp { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Country { get; set; } = "AE";
    public string Industry { get; set; } = string.Empty;
    public string MonthlySalesRange { get; set; } = string.Empty;
    public int StaffCount { get; set; }
    public DemoRequestStatus Status { get; set; } = DemoRequestStatus.Pending;
    public string? RejectionReason { get; set; }
    public int? AssignedPlanId { get; set; }
    public int? CreatedTenantId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessedAt { get; set; }
    public int? ProcessedByUserId { get; set; }
}

public enum DemoRequestStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2,
    Converted = 3 // Tenant created
}
