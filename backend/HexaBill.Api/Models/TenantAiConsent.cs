namespace HexaBill.Api.Models;

/// <summary>Latest owner choice; changes are also recorded in the existing tenant audit trail. No prompts or secrets.</summary>
public sealed class TenantAiConsent
{
    public int TenantId { get; set; }
    public bool Enabled { get; set; }
    public string PolicyFingerprint { get; set; } = string.Empty;
    public int UpdatedByUserId { get; set; }
    public DateTime UpdatedAt { get; set; }
}
