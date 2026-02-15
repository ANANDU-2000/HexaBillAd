namespace HexaBill.Api.Models;

/// <summary>Server-side log for 500 errors. SuperAdmin can query for monitoring.</summary>
public class ErrorLog
{
    public int Id { get; set; }
    public string TraceId { get; set; } = string.Empty;
    public string ErrorCode { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? StackTrace { get; set; }
    public string? Path { get; set; }
    public string? Method { get; set; }
    public int? TenantId { get; set; }
    public int? UserId { get; set; }
    public DateTime CreatedAt { get; set; }
}
