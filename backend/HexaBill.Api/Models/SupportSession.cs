using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models;

public sealed class SupportSession
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public int PlatformUserId { get; set; }
    [Required, MaxLength(500)]
    public string Reason { get; set; } = string.Empty;
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public bool ReadOnly { get; set; } = true;
}
