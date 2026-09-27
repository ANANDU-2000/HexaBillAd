using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using HexaBill.Api.Models;

namespace HexaBill.Api.Modules.SuperAdmin;

public static class TenantFeatureFlags
{
    public const string LocalBackupAgent = "localBackupAgent";

    public static bool IsEnabled(string? featuresJson, string key)
    {
        if (string.IsNullOrWhiteSpace(featuresJson) || string.IsNullOrWhiteSpace(key))
            return false;
        try
        {
            var list = JsonSerializer.Deserialize<List<string>>(featuresJson);
            return list?.Any(item => string.Equals(item, key, StringComparison.OrdinalIgnoreCase)) == true;
        }
        catch (JsonException)
        {
            return false;
        }
    }
}

public static class BackupAgentSecrets
{
    public const string TokenPrefix = "hbba_";
    public const string Scope = "backup.agent";

    public static string Hash(string secret)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(secret));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    public static string CreateToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return TokenPrefix + Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    public static string CreatePairingCode()
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var bytes = RandomNumberGenerator.GetBytes(8);
        var chars = new char[8];
        for (var i = 0; i < chars.Length; i++)
            chars[i] = alphabet[bytes[i] % alphabet.Length];
        return new string(chars);
    }
}

public readonly record struct BackupSlot(string Key, DateTime LocalStart, DateTime UtcStart, bool Missed);

public static class BackupScheduleClock
{
    public static readonly TimeSpan MissedAfter = TimeSpan.FromMinutes(30);
    public static readonly TimeSpan OnlineWindow = TimeSpan.FromMinutes(15);
    public static readonly HashSet<int> AllowedRetention = [7, 14, 30];

    public static bool TryGetZone(string? timeZoneId, out TimeZoneInfo zone)
    {
        zone = TimeZoneInfo.Utc;
        if (string.IsNullOrWhiteSpace(timeZoneId))
            return false;
        try
        {
            zone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId.Trim());
            return true;
        }
        catch (TimeZoneNotFoundException)
        {
            return false;
        }
        catch (InvalidTimeZoneException)
        {
            return false;
        }
    }

    public static string ZoneLabel(TimeZoneInfo zone)
    {
        if (zone.Id is "Asia/Kolkata" or "India Standard Time")
            return "India Standard Time";
        return string.IsNullOrWhiteSpace(zone.DisplayName) ? zone.Id : zone.DisplayName;
    }

    public static bool TryParseTime(string? value, out TimeSpan time)
    {
        time = default;
        if (string.IsNullOrWhiteSpace(value))
            return false;
        if (!TimeSpan.TryParseExact(value.Trim(), @"hh\:mm", null, out time) &&
            !TimeSpan.TryParseExact(value.Trim(), @"h\:mm", null, out time))
            return false;
        return time >= TimeSpan.Zero && time < TimeSpan.FromDays(1);
    }

    /// <summary>
    /// The single latest occurrence at or before now that is not earlier than the schedule update.
    /// Older missed days are not returned.
    /// </summary>
    public static bool TryGetDueSlot(
        DateTime utcNow,
        DateTime scheduleUpdatedUtc,
        string localTime,
        string timeZoneId,
        string frequency,
        int weeklyDay,
        out BackupSlot slot)
    {
        slot = default;
        if (!TryParseTime(localTime, out var timeOfDay) || !TryGetZone(timeZoneId, out var zone))
            return false;

        var localNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc), zone);
        DateTime? occurrence = null;
        if (string.Equals(frequency, "weekly", StringComparison.OrdinalIgnoreCase))
        {
            var day = weeklyDay is >= 0 and <= 6 ? (DayOfWeek)weeklyDay : DayOfWeek.Sunday;
            for (var back = 0; back <= 7; back++)
            {
                var date = localNow.Date.AddDays(-back);
                if (date.DayOfWeek != day)
                    continue;
                var candidate = date.Add(timeOfDay);
                if (candidate <= localNow)
                {
                    occurrence = candidate;
                    break;
                }
            }
        }
        else
        {
            var today = localNow.Date.Add(timeOfDay);
            occurrence = today <= localNow ? today : today.AddDays(-1);
        }

        if (occurrence is null)
            return false;

        var unspecified = DateTime.SpecifyKind(occurrence.Value, DateTimeKind.Unspecified);
        var utcStart = TimeZoneInfo.ConvertTimeToUtc(unspecified, zone);
        if (utcStart < scheduleUpdatedUtc)
            return false;

        slot = new BackupSlot(
            occurrence.Value.ToString("yyyy-MM-dd"),
            occurrence.Value,
            utcStart,
            utcNow - utcStart > MissedAfter);
        return true;
    }

    public static DateTime? NextRunUtc(
        DateTime utcNow,
        string localTime,
        string timeZoneId,
        string frequency,
        int weeklyDay)
    {
        if (!TryParseTime(localTime, out var timeOfDay) || !TryGetZone(timeZoneId, out var zone))
            return null;
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc), zone);
        if (string.Equals(frequency, "weekly", StringComparison.OrdinalIgnoreCase))
        {
            var day = weeklyDay is >= 0 and <= 6 ? (DayOfWeek)weeklyDay : DayOfWeek.Sunday;
            for (var forward = 0; forward <= 7; forward++)
            {
                var date = localNow.Date.AddDays(forward);
                if (date.DayOfWeek != day)
                    continue;
                var candidate = date.Add(timeOfDay);
                if (candidate > localNow)
                    return TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(candidate, DateTimeKind.Unspecified), zone);
            }
            return null;
        }

        var today = localNow.Date.Add(timeOfDay);
        var next = today > localNow ? today : today.AddDays(1);
        return TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(next, DateTimeKind.Unspecified), zone);
    }
}

public static class BackupRunRules
{
    public const string FolderUnavailable = "Backup folder is unavailable.";
    public const string ServerUnreachable = "Unable to reach HexaBill.";
    public const string NotVerified = "Backup could not be verified.";
    public const string NetworkUnavailable = "Network connection unavailable.";
    public const string CouldNotComplete = "Backup could not be completed.";

    public static bool CanReuseArchive(string? status) =>
        status is BackupRunStatus.Ready or BackupRunStatus.Verified or BackupRunStatus.Running;

    public static string SanitizeFailure(string? reason)
    {
        if (reason is FolderUnavailable or ServerUnreachable or NotVerified or NetworkUnavailable)
            return reason;
        return CouldNotComplete;
    }

    public static bool HashesMatch(string? expected, string? actual) =>
        !string.IsNullOrWhiteSpace(expected) &&
        !string.IsNullOrWhiteSpace(actual) &&
        string.Equals(expected.Trim(), actual.Trim(), StringComparison.OrdinalIgnoreCase);

    public static string StatusLabel(bool featureEnabled, bool hasDevice, bool scheduleEnabled, bool online, string? latestRunStatus)
    {
        if (!featureEnabled)
            return "Not configured";
        if (!hasDevice)
            return scheduleEnabled ? "Not configured" : "Not configured";
        if (!online)
            return scheduleEnabled ? "Configured, device offline" : "Disconnected";
        if (latestRunStatus == BackupRunStatus.Running)
            return "Running";
        if (latestRunStatus == BackupRunStatus.Failed)
            return "Needs attention";
        if (scheduleEnabled)
            return "Automatic backup active";
        return "Connected";
    }
}
