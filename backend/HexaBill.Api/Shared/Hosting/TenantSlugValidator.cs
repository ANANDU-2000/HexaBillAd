using System.Text.RegularExpressions;

namespace HexaBill.Api.Shared.Hosting;

public static partial class TenantSlugValidator
{
    private static readonly HashSet<string> Reserved = new(StringComparer.OrdinalIgnoreCase)
    {
        "www", "admin", "api", "app", "mail", "support", "status", "static",
        "cdn", "docs", "help", "billing", "login", "demo", "test", "hexabill"
    };

    [GeneratedRegex("^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$")]
    private static partial Regex SlugPattern();

    public static bool IsValid(string? slug)
    {
        if (string.IsNullOrWhiteSpace(slug) || slug != slug.ToLowerInvariant())
            return false;

        return SlugPattern().IsMatch(slug)
            && !slug.Contains("--", StringComparison.Ordinal)
            && !Reserved.Contains(slug);
    }

    public static string? Normalize(string? slug)
    {
        var normalized = slug?.Trim().ToLowerInvariant();
        return IsValid(normalized) ? normalized : null;
    }

    public static string Suggest(string? value)
    {
        var source = (value ?? string.Empty).Trim().ToLowerInvariant();
        var slug = Regex.Replace(source, "[^a-z0-9]+", "-").Trim('-');
        if (slug.Length > 30) slug = slug[..30].TrimEnd('-');
        if (slug.Length < 2 || !IsValid(slug)) slug = "tenant";
        return slug;
    }
}
