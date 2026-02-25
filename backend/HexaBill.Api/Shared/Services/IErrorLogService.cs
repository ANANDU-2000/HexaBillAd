namespace HexaBill.Api.Shared.Services;

public interface IErrorLogService
{
    Task LogAsync(string traceId, string errorCode, string message, string? stackTrace, string? path, string? method, int? tenantId, int? userId, CancellationToken ct = default);
}
