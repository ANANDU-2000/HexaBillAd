using HexaBill.Api.Data;
using HexaBill.Api.Models;

namespace HexaBill.Api.Shared.Services;

public class ErrorLogService : IErrorLogService
{
    private readonly AppDbContext _context;

    public ErrorLogService(AppDbContext context)
    {
        _context = context;
    }

    public async Task LogAsync(string traceId, string errorCode, string message, string? stackTrace, string? path, string? method, int? tenantId, int? userId, CancellationToken ct = default)
    {
        try
        {
            var entry = new ErrorLog
            {
                TraceId = traceId.Length > 64 ? traceId[..64] : traceId,
                ErrorCode = errorCode.Length > 64 ? errorCode[..64] : errorCode,
                Message = message.Length > 2000 ? message[..2000] : message,
                StackTrace = stackTrace != null && stackTrace.Length > 4000 ? stackTrace[..4000] : stackTrace,
                Path = path != null && path.Length > 500 ? path[..500] : path,
                Method = method != null && method.Length > 16 ? method[..16] : method,
                TenantId = tenantId,
                UserId = userId,
                CreatedAt = DateTime.UtcNow
            };
            _context.ErrorLogs.Add(entry);
            await _context.SaveChangesAsync(ct);
        }
        catch
        {
            // Do not throw; logging must not break the pipeline
        }
    }
}
