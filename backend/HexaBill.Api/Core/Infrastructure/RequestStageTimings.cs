using System.Diagnostics;
using System.Globalization;

namespace HexaBill.Api.Core.Infrastructure;

// Fixed names prevent request data, emails, or credentials becoming metric labels.
public enum RequestStage
{
    HostResolution, LockoutCheck, UserLookup, TenantStatus, PasswordVerification,
    LastLoginSave, SessionSave, CompanySettings, BranchAssignments, RouteAssignments,
    JwtGeneration, LockoutClear, LockoutFailure
}

public sealed class RequestStageTimings
{
    private static readonly object ItemKey = new();
    private readonly Dictionary<RequestStage, double> _durations = new();

    public static void StartLogin(HttpContext context)
    {
        if (!HttpMethods.IsPost(context.Request.Method)
            || !string.Equals(context.Request.Path.Value, "/api/auth/login", StringComparison.OrdinalIgnoreCase)
            || context.Items.ContainsKey(ItemKey)) return;

        var timings = new RequestStageTimings();
        context.Items[ItemKey] = timings;
        // Browser diagnostics are local-only. Production keeps structured server logs.
        if (context.RequestServices.GetService<IHostEnvironment>()?.IsDevelopment() == true)
            context.Response.OnStarting(() =>
            {
                context.Response.Headers["Server-Timing"] = timings.Format();
                return Task.CompletedTask;
            });
    }

    public static Measurement Measure(HttpContext? context, RequestStage stage) =>
        new(context?.Items[ItemKey] as RequestStageTimings, stage);

    public static string? Read(HttpContext context) =>
        (context.Items[ItemKey] as RequestStageTimings)?.Format();

    private string Format() => string.Join(", ", _durations.OrderBy(entry => entry.Key)
        .Select(entry => $"{Name(entry.Key)};dur={entry.Value.ToString("F3", CultureInfo.InvariantCulture)}"));

    private static string Name(RequestStage stage) => stage switch
    {
        RequestStage.HostResolution => "host_resolution",
        RequestStage.LockoutCheck => "lockout_check",
        RequestStage.UserLookup => "user_lookup",
        RequestStage.TenantStatus => "tenant_status",
        RequestStage.PasswordVerification => "bcrypt",
        RequestStage.LastLoginSave => "last_login_save",
        RequestStage.SessionSave => "session_save",
        RequestStage.CompanySettings => "company_settings",
        RequestStage.BranchAssignments => "branch_assignments",
        RequestStage.RouteAssignments => "route_assignments",
        RequestStage.JwtGeneration => "jwt",
        RequestStage.LockoutClear => "lockout_clear",
        RequestStage.LockoutFailure => "lockout_failure",
        _ => throw new ArgumentOutOfRangeException(nameof(stage))
    };

    public readonly struct Measurement : IDisposable
    {
        private readonly RequestStageTimings? _timings;
        private readonly RequestStage _stage;
        private readonly long _started;

        internal Measurement(RequestStageTimings? timings, RequestStage stage)
        {
            _timings = timings;
            _stage = stage;
            _started = timings is null ? 0 : Stopwatch.GetTimestamp();
        }

        public void Dispose()
        {
            if (_timings is null) return;
            var duration = Stopwatch.GetElapsedTime(_started).TotalMilliseconds;
            _timings._durations[_stage] = _timings._durations.GetValueOrDefault(_stage) + duration;
        }
    }
}
