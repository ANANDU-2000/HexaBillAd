namespace HexaBill.Api.Core.Storage;

/// <summary>
/// Resolves Cloudflare R2 settings. Production must not fall back to Render's ephemeral disk.
/// </summary>
public static class R2Configuration
{
    public const string ProductionBucket = "hexabill-production";

    public static readonly string[] StaffBrandingKeys =
    {
        "COMPANY_NAME_EN",
        "COMPANY_NAME_AR",
        "COMPANY_ADDRESS",
        "COMPANY_PHONE",
        "COMPANY_EMAIL",
        "COMPANY_TRN",
        "CURRENCY",
        "VAT_PERCENT"
    };

    public static bool HasCredentials(string? endpoint, string? accessKey, string? secretKey) =>
        !string.IsNullOrWhiteSpace(endpoint)
        && !string.IsNullOrWhiteSpace(accessKey)
        && !string.IsNullOrWhiteSpace(secretKey);

    /// <summary>
    /// Prefer R2_BUCKET, then R2_BUCKET_NAME. Does not default to a different tenant bucket.
    /// </summary>
    public static string ResolveBucketName(string? bucket, string? bucketName, string? configuredBucket, string? configuredBucketName)
    {
        foreach (var candidate in new[] { bucket, bucketName, configuredBucket, configuredBucketName })
        {
            if (!string.IsNullOrWhiteSpace(candidate))
                return candidate.Trim();
        }

        return ProductionBucket;
    }

    public static string ResolveBucketName()
    {
        return ResolveBucketName(
            Environment.GetEnvironmentVariable("R2_BUCKET"),
            Environment.GetEnvironmentVariable("R2_BUCKET_NAME"),
            null,
            null);
    }

    /// <summary>
    /// Production without credentials must fail closed. Development may use local disk.
    /// </summary>
    public static void EnsureProductionCredentials(bool isProduction, string? endpoint, string? accessKey, string? secretKey)
    {
        if (isProduction && !HasCredentials(endpoint, accessKey, secretKey))
        {
            throw new InvalidOperationException(
                "R2 storage is required in production. Set R2_ENDPOINT, R2_ACCESS_KEY, and R2_SECRET_KEY. Local disk storage is not durable on Render.");
        }
    }

    public static Dictionary<string, string> FilterSettingsForStaff(IReadOnlyDictionary<string, string> settings)
    {
        var filtered = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var key in StaffBrandingKeys)
        {
            if (settings.TryGetValue(key, out var value))
                filtered[key] = value;
        }
        return filtered;
    }
}
