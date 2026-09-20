using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models;

public sealed class TenantInvite
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public int UserId { get; set; }
    [Required, MaxLength(128)]
    public string TokenHash { get; set; } = string.Empty;
    [Required, MaxLength(30)]
    public string HostSubdomain { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public int CreatedByUserId { get; set; }
}
