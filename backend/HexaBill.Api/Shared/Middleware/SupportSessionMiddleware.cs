using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HexaBill.Api.Shared.Middleware;

public sealed class SupportSessionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<SupportSessionMiddleware> _logger;

    public SupportSessionMiddleware(RequestDelegate next, ILogger<SupportSessionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, AppDbContext db)
    {
        var claim = context.User.FindFirst("support_session")?.Value;
        if (string.IsNullOrWhiteSpace(claim))
        {
            await _next(context);
            return;
        }

        if (!int.TryParse(claim, out var sessionId))
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        var session = await db.SupportSessions.AsNoTracking().FirstOrDefaultAsync(s =>
            s.Id == sessionId && s.EndedAt == null && s.ExpiresAt > DateTime.UtcNow);
        var tokenTenant = context.User.FindFirst("tid")?.Value;
        if (session == null || !int.TryParse(tokenTenant, out var tenantId) || tenantId != session.TenantId)
        {
            _logger.LogWarning("Rejected inactive support session {SessionId}", sessionId);
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        context.Items["SupportSessionId"] = session.Id;
        context.Items["SupportReadOnly"] = session.ReadOnly;
        if (session.ReadOnly && !HttpMethods.IsGet(context.Request.Method) &&
            !HttpMethods.IsHead(context.Request.Method) && !HttpMethods.IsOptions(context.Request.Method))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new { error = "SUPPORT_SESSION_READ_ONLY" });
            return;
        }

        await _next(context);
    }
}
