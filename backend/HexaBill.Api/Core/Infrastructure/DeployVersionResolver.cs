using System.Reflection;

namespace HexaBill.Api.Core.Infrastructure;

/// <summary>
/// Optional deploy/commit identifier for health and diagnostics (never invented when unset).
/// </summary>
public static class DeployVersionResolver
{
    public static string? Resolve()
    {
        foreach (var key in new[] { "RENDER_GIT_COMMIT", "GIT_COMMIT", "VERCEL_GIT_COMMIT_SHA" })
        {
            var value = Environment.GetEnvironmentVariable(key);
            if (!string.IsNullOrWhiteSpace(value))
                return value.Trim();
        }

        return Assembly.GetExecutingAssembly()
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()
            ?.InformationalVersion;
    }
}
