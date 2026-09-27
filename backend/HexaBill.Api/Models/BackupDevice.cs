namespace HexaBill.Api.Models;

public class BackupDevice
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public int CreatedByUserId { get; set; }
    public string DisplayName { get; set; } = "";
    public string? FolderLabel { get; set; }
    public DateTime? LastSeenAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public string? AgentVersion { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class BackupDeviceSchedule
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public int DeviceId { get; set; }
    public bool Enabled { get; set; }
    public string Frequency { get; set; } = "daily";
    public string LocalTime { get; set; } = "23:00";
    public string TimeZoneId { get; set; } = "UTC";
    public int WeeklyDay { get; set; }
    public bool IncludeInvoicePdfs { get; set; }
    public int RetentionCount { get; set; } = 7;
    public DateTime UpdatedAt { get; set; }
}

public class BackupDeviceToken
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public int DeviceId { get; set; }
    public string TokenHash { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class BackupPairingCode
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public int CreatedByUserId { get; set; }
    public string CodeHash { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public DateTime? ConsumedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class BackupRun
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public int DeviceId { get; set; }
    public string SlotKey { get; set; } = "";
    public string Status { get; set; } = BackupRunStatus.Running;
    public long? SizeBytes { get; set; }
    public string? Sha256 { get; set; }
    public bool Verified { get; set; }
    public bool MissedCatchUp { get; set; }
    public string? FailureReason { get; set; }
    public string? FileName { get; set; }
    public string? DownloadName { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}

public static class BackupRunStatus
{
    public const string Running = "Running";
    public const string Ready = "Ready";
    public const string Verified = "Verified";
    public const string Failed = "Failed";
}
