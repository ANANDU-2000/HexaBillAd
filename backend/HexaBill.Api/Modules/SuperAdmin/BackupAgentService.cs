using System.Collections.Concurrent;
using System.Security.Cryptography;
using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Modules.SuperAdmin;

public interface IBackupAgentService
{
    Task<bool> FeatureEnabledAsync(int tenantId, CancellationToken ct);
    Task<PairingIssued?> CreatePairingCodeAsync(int tenantId, int userId, CancellationToken ct);
    Task<LocalBackupStatusDto> GetStatusAsync(int tenantId, CancellationToken ct);
    Task<(bool Ok, string Message)> SaveScheduleAsync(int tenantId, int userId, int deviceId, BackupDeviceScheduleDto dto, CancellationToken ct);
    Task<bool> RevokeAsync(int tenantId, int userId, int deviceId, CancellationToken ct);
    Task<AgentSession?> PairAsync(int? hostTenantId, string code, string displayName, CancellationToken ct);
    Task<bool> HeartbeatAsync(int tenantId, int deviceId, string? folderLabel, string? version, CancellationToken ct);
    Task<AgentConfigDto?> GetConfigAsync(int tenantId, int deviceId, CancellationToken ct);
    Task<AgentJobDto?> ClaimAsync(int tenantId, int deviceId, CancellationToken ct);
    Task<bool> ReportAsync(int tenantId, int deviceId, int runId, AgentReportDto report, CancellationToken ct);
    Task<(Stream Stream, string DownloadName)?> OpenDownloadAsync(int tenantId, int deviceId, int runId, CancellationToken ct);
}

public record PairingIssued(string Code, DateTime ExpiresAt);
public record AgentSession(string Token, int DeviceId, string DisplayName, DateTime ExpiresAt);

public class BackupDeviceScheduleDto
{
    public bool Enabled { get; set; }
    public string Time { get; set; } = "23:00";
    public string Frequency { get; set; } = "daily";
    public string TimeZoneId { get; set; } = "UTC";
    public int WeeklyDay { get; set; }
    public bool IncludeInvoicePdfs { get; set; }
    public int RetentionCount { get; set; } = 7;
}

public class AgentReportDto
{
    public bool Verified { get; set; }
    public string? Sha256 { get; set; }
    public long? SizeBytes { get; set; }
    public string? FailureReason { get; set; }
}

public class LocalBackupStatusDto
{
    public bool FeatureEnabled { get; set; }
    public bool ServerCopyEnabled { get; set; }
    public string Status { get; set; } = "Not configured";
    public string? DeviceName { get; set; }
    public int? DeviceId { get; set; }
    public string? FolderLabel { get; set; }
    public DateTime? LastSeenAt { get; set; }
    public bool Online { get; set; }
    public bool ScheduleEnabled { get; set; }
    public string Frequency { get; set; } = "daily";
    public string Time { get; set; } = "23:00";
    public string TimeZoneId { get; set; } = "UTC";
    public string TimeZoneLabel { get; set; } = "UTC";
    public int WeeklyDay { get; set; }
    public bool IncludeInvoicePdfs { get; set; }
    public int RetentionCount { get; set; } = 7;
    public DateTime? LastSuccessAt { get; set; }
    public DateTime? NextRunAt { get; set; }
    public string? LastFailureReason { get; set; }
    public List<BackupDeviceListItem> Devices { get; set; } = new();
    public List<BackupHistoryItem> History { get; set; } = new();
}

public class BackupDeviceListItem
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? FolderLabel { get; set; }
    public bool Online { get; set; }
    public DateTime? LastSeenAt { get; set; }
    public bool ScheduleEnabled { get; set; }
}

public class BackupHistoryItem
{
    public string Id { get; set; } = "";
    public string? FileName { get; set; }
    public DateTime CreatedAt { get; set; }
    public string Type { get; set; } = "Backup";
    public string Device { get; set; } = "";
    public long? SizeBytes { get; set; }
    public string Status { get; set; } = "";
    public bool Verified { get; set; }
    public string? Detail { get; set; }
    public bool CanRestore { get; set; }
    public bool CanDownload { get; set; }
    public bool CanDelete { get; set; }
}

public class AgentConfigDto
{
    public bool ScheduleEnabled { get; set; }
    public string Frequency { get; set; } = "daily";
    public string Time { get; set; } = "23:00";
    public string TimeZoneId { get; set; } = "UTC";
    public string TimeZoneLabel { get; set; } = "UTC";
    public int RetentionCount { get; set; } = 7;
    public bool IncludeInvoicePdfs { get; set; }
    public string CompanyName { get; set; } = "";
    public string? FolderLabel { get; set; }
}

public class AgentJobDto
{
    public bool Due { get; set; }
    public int RunId { get; set; }
    public string? FileName { get; set; }
    public string? DownloadName { get; set; }
    public string? Sha256 { get; set; }
    public bool AlreadyVerified { get; set; }
    public string? Message { get; set; }
}

public class BackupAgentService : IBackupAgentService
{
    private static readonly ConcurrentDictionary<int, SemaphoreSlim> DeviceLocks = new();
    private static readonly TimeSpan StaleRun = TimeSpan.FromMinutes(45);
    private readonly AppDbContext _context;
    private readonly IComprehensiveBackupService _backups;
    private readonly IAuditService _audit;
    private readonly IConfiguration _configuration;
    private readonly ILogger<BackupAgentService> _logger;

    public BackupAgentService(
        AppDbContext context,
        IComprehensiveBackupService backups,
        IAuditService audit,
        IConfiguration configuration,
        ILogger<BackupAgentService> logger)
    {
        _context = context;
        _backups = backups;
        _audit = audit;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<bool> FeatureEnabledAsync(int tenantId, CancellationToken ct)
    {
        var json = await _context.Tenants.AsNoTracking()
            .Where(t => t.Id == tenantId)
            .Select(t => t.FeaturesJson)
            .FirstOrDefaultAsync(ct);
        return TenantFeatureFlags.IsEnabled(json, TenantFeatureFlags.LocalBackupAgent);
    }

    public async Task<PairingIssued?> CreatePairingCodeAsync(int tenantId, int userId, CancellationToken ct)
    {
        if (!await FeatureEnabledAsync(tenantId, ct))
            return null;
        if (await _context.BackupDevices.CountAsync(d => d.TenantId == tenantId && d.RevokedAt == null, ct) >= 10)
            return null;

        var code = BackupAgentSecrets.CreatePairingCode();
        _context.BackupPairingCodes.Add(new BackupPairingCode
        {
            TenantId = tenantId,
            CreatedByUserId = userId,
            CodeHash = BackupAgentSecrets.Hash(code),
            ExpiresAt = DateTime.UtcNow.AddMinutes(10),
            CreatedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync(ct);
        await _audit.LogAsync("Device pairing started", "BackupDevice", null, details: "A pairing code was created.");
        return new PairingIssued(code, DateTime.UtcNow.AddMinutes(10));
    }

    public async Task<LocalBackupStatusDto> GetStatusAsync(int tenantId, CancellationToken ct)
    {
        var enabled = await FeatureEnabledAsync(tenantId, ct);
        var serverCopy = _configuration.GetValue<bool>("BackupSettings:S3:Enabled");
        var dto = new LocalBackupStatusDto { FeatureEnabled = enabled, ServerCopyEnabled = serverCopy };
        if (!enabled)
            return dto;

        var devices = await _context.BackupDevices.AsNoTracking()
            .Where(d => d.TenantId == tenantId && d.RevokedAt == null)
            .OrderByDescending(d => d.LastSeenAt)
            .ToListAsync(ct);
        var schedules = await _context.BackupDeviceSchedules.AsNoTracking()
            .Where(s => s.TenantId == tenantId)
            .ToListAsync(ct);
        var runs = await _context.BackupRuns.AsNoTracking()
            .Where(r => r.TenantId == tenantId)
            .OrderByDescending(r => r.StartedAt)
            .Take(40)
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        dto.Devices = devices.Select(d =>
        {
            var schedule = schedules.FirstOrDefault(s => s.DeviceId == d.Id);
            return new BackupDeviceListItem
            {
                Id = d.Id,
                Name = d.DisplayName,
                FolderLabel = d.FolderLabel,
                Online = d.LastSeenAt.HasValue && now - d.LastSeenAt.Value <= BackupScheduleClock.OnlineWindow,
                LastSeenAt = d.LastSeenAt,
                ScheduleEnabled = schedule?.Enabled == true
            };
        }).ToList();

        var primary = devices.FirstOrDefault();
        if (primary != null)
        {
            var schedule = schedules.FirstOrDefault(s => s.DeviceId == primary.Id);
            var online = primary.LastSeenAt.HasValue && now - primary.LastSeenAt.Value <= BackupScheduleClock.OnlineWindow;
            var latest = runs.FirstOrDefault(r => r.DeviceId == primary.Id);
            dto.DeviceId = primary.Id;
            dto.DeviceName = primary.DisplayName;
            dto.FolderLabel = primary.FolderLabel;
            dto.LastSeenAt = primary.LastSeenAt;
            dto.Online = online;
            dto.ScheduleEnabled = schedule?.Enabled == true;
            dto.Frequency = schedule?.Frequency ?? "daily";
            dto.Time = schedule?.LocalTime ?? "23:00";
            dto.TimeZoneId = schedule?.TimeZoneId ?? "UTC";
            dto.WeeklyDay = schedule?.WeeklyDay ?? 0;
            dto.IncludeInvoicePdfs = schedule?.IncludeInvoicePdfs == true;
            dto.RetentionCount = schedule?.RetentionCount ?? 7;
            if (BackupScheduleClock.TryGetZone(dto.TimeZoneId, out var zone))
                dto.TimeZoneLabel = BackupScheduleClock.ZoneLabel(zone);
            dto.NextRunAt = schedule?.Enabled == true
                ? BackupScheduleClock.NextRunUtc(now, dto.Time, dto.TimeZoneId, dto.Frequency, dto.WeeklyDay)
                : null;
            var success = runs.FirstOrDefault(r => r.DeviceId == primary.Id && r.Status == BackupRunStatus.Verified);
            dto.LastSuccessAt = success?.CompletedAt ?? success?.StartedAt;
            if (latest?.Status == BackupRunStatus.Failed)
                dto.LastFailureReason = latest.FailureReason;
            dto.Status = BackupRunRules.StatusLabel(true, true, dto.ScheduleEnabled, online, latest?.Status);
        }

        var files = await _backups.GetBackupListAsync(tenantId, false);
        foreach (var file in files)
        {
            var run = runs.FirstOrDefault(r => r.FileName == file.FileName);
            dto.History.Add(new BackupHistoryItem
            {
                Id = "file:" + file.FileName,
                FileName = file.FileName,
                CreatedAt = file.CreatedDate,
                Type = run == null ? "Backup" : "Automatic backup",
                Device = run == null ? "Server" : devices.FirstOrDefault(d => d.Id == run.DeviceId)?.DisplayName ?? "This PC",
                SizeBytes = file.FileSize,
                Status = run?.Status == BackupRunStatus.Failed ? "Failed" : (run?.Verified == true ? "Verified" : "Saved"),
                Verified = run?.Verified == true,
                Detail = run?.FailureReason,
                CanRestore = true,
                CanDownload = true,
                CanDelete = true
            });
        }

        foreach (var run in runs.Where(r => r.Status == BackupRunStatus.Failed && string.IsNullOrEmpty(r.FileName)))
        {
            dto.History.Add(new BackupHistoryItem
            {
                Id = "run:" + run.Id,
                CreatedAt = run.StartedAt,
                Type = "Automatic backup",
                Device = devices.FirstOrDefault(d => d.Id == run.DeviceId)?.DisplayName ?? "This PC",
                SizeBytes = run.SizeBytes,
                Status = "Failed",
                Verified = false,
                Detail = run.FailureReason,
                CanRestore = false,
                CanDownload = false,
                CanDelete = false
            });
        }

        dto.History = dto.History.OrderByDescending(h => h.CreatedAt).Take(30).ToList();
        return dto;
    }

    public async Task<(bool Ok, string Message)> SaveScheduleAsync(int tenantId, int userId, int deviceId, BackupDeviceScheduleDto dto, CancellationToken ct)
    {
        if (!await FeatureEnabledAsync(tenantId, ct))
            return (false, "Automatic local backup is not enabled for this company.");
        var device = await _context.BackupDevices.FirstOrDefaultAsync(d => d.Id == deviceId && d.TenantId == tenantId && d.RevokedAt == null, ct);
        if (device == null)
            return (false, "Connect a PC before saving a schedule.");
        if (!BackupScheduleClock.TryParseTime(dto.Time, out _))
            return (false, "Enter a valid backup time.");
        if (!BackupScheduleClock.TryGetZone(dto.TimeZoneId, out _))
            return (false, "Enter a valid timezone.");
        var frequency = string.Equals(dto.Frequency, "weekly", StringComparison.OrdinalIgnoreCase) ? "weekly" : "daily";
        if (!BackupScheduleClock.AllowedRetention.Contains(dto.RetentionCount))
            return (false, "Keep 7, 14, or 30 backups.");
        if (dto.Enabled && string.IsNullOrWhiteSpace(device.FolderLabel))
            return (false, "Choose a backup folder on the connected PC first.");

        var schedule = await _context.BackupDeviceSchedules.FirstOrDefaultAsync(s => s.DeviceId == device.Id && s.TenantId == tenantId, ct);
        if (schedule == null)
        {
            schedule = new BackupDeviceSchedule { TenantId = tenantId, DeviceId = device.Id };
            _context.BackupDeviceSchedules.Add(schedule);
        }
        schedule.Enabled = dto.Enabled;
        schedule.Frequency = frequency;
        schedule.LocalTime = dto.Time.Trim();
        schedule.TimeZoneId = dto.TimeZoneId.Trim();
        schedule.WeeklyDay = dto.WeeklyDay is >= 0 and <= 6 ? dto.WeeklyDay : 0;
        schedule.IncludeInvoicePdfs = dto.IncludeInvoicePdfs;
        schedule.RetentionCount = dto.RetentionCount;
        schedule.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
        await _audit.LogAsync("Backup scheduled", "BackupDevice", device.Id, details: $"Device: {device.DisplayName}. {(dto.Enabled ? "On" : "Off")} {frequency} at {schedule.LocalTime}.", actingUserId: userId);
        return (true, "Schedule saved");
    }

    public async Task<bool> RevokeAsync(int tenantId, int userId, int deviceId, CancellationToken ct)
    {
        var device = await _context.BackupDevices.FirstOrDefaultAsync(d => d.Id == deviceId && d.TenantId == tenantId && d.RevokedAt == null, ct);
        if (device == null)
            return false;
        var now = DateTime.UtcNow;
        device.RevokedAt = now;
        var tokens = await _context.BackupDeviceTokens.Where(t => t.DeviceId == device.Id && t.RevokedAt == null).ToListAsync(ct);
        foreach (var token in tokens)
            token.RevokedAt = now;
        var schedule = await _context.BackupDeviceSchedules.FirstOrDefaultAsync(s => s.DeviceId == device.Id, ct);
        if (schedule != null)
            schedule.Enabled = false;
        await _context.SaveChangesAsync(ct);
        await _audit.LogAsync("Device revoked", "BackupDevice", device.Id, details: $"Device: {device.DisplayName}", actingUserId: userId);
        return true;
    }

    public async Task<AgentSession?> PairAsync(int? hostTenantId, string code, string displayName, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(code))
            return null;
        var hash = BackupAgentSecrets.Hash(code.Trim().ToUpperInvariant());
        var pairing = await _context.BackupPairingCodes.IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.CodeHash == hash && p.ConsumedAt == null && p.ExpiresAt > DateTime.UtcNow, ct);
        if (pairing == null)
            return null;
        if (hostTenantId is > 0 && hostTenantId != pairing.TenantId)
            return null;
        if (!await FeatureEnabledAsync(pairing.TenantId, ct))
            return null;

        _context.SetRequestTenantScope(pairing.TenantId, false);
        var name = string.IsNullOrWhiteSpace(displayName) ? "This PC" : displayName.Trim();
        if (name.Length > 80)
            name = name[..80];
        var device = new BackupDevice
        {
            TenantId = pairing.TenantId,
            CreatedByUserId = pairing.CreatedByUserId,
            DisplayName = name,
            CreatedAt = DateTime.UtcNow
        };
        _context.BackupDevices.Add(device);
        pairing.ConsumedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);

        var token = BackupAgentSecrets.CreateToken();
        _context.BackupDeviceTokens.Add(new BackupDeviceToken
        {
            TenantId = pairing.TenantId,
            DeviceId = device.Id,
            TokenHash = BackupAgentSecrets.Hash(token),
            ExpiresAt = DateTime.UtcNow.AddDays(90),
            CreatedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync(ct);
        await _audit.LogAsync("Device paired", "BackupDevice", device.Id, details: $"Device: {device.DisplayName}", actingUserId: pairing.CreatedByUserId);
        return new AgentSession(token, device.Id, device.DisplayName, DateTime.UtcNow.AddDays(90));
    }

    public async Task<bool> HeartbeatAsync(int tenantId, int deviceId, string? folderLabel, string? version, CancellationToken ct)
    {
        var device = await _context.BackupDevices.FirstOrDefaultAsync(d => d.Id == deviceId && d.TenantId == tenantId && d.RevokedAt == null, ct);
        if (device == null)
            return false;
        device.LastSeenAt = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(version) && version.Length <= 40)
            device.AgentVersion = version.Trim();
        if (!string.IsNullOrWhiteSpace(folderLabel))
        {
            var label = Path.GetFileName(folderLabel.Trim().TrimEnd('\\', '/'));
            if (string.IsNullOrWhiteSpace(label))
                label = "HexaBill Backups";
            device.FolderLabel = label.Length > 120 ? label[..120] : label;
        }
        await _context.SaveChangesAsync(ct);
        return true;
    }

    public async Task<AgentConfigDto?> GetConfigAsync(int tenantId, int deviceId, CancellationToken ct)
    {
        var device = await _context.BackupDevices.AsNoTracking().FirstOrDefaultAsync(d => d.Id == deviceId && d.TenantId == tenantId && d.RevokedAt == null, ct);
        if (device == null)
            return null;
        var schedule = await _context.BackupDeviceSchedules.AsNoTracking().FirstOrDefaultAsync(s => s.DeviceId == deviceId && s.TenantId == tenantId, ct);
        var company = await _context.Tenants.AsNoTracking().Where(t => t.Id == tenantId).Select(t => t.Name).FirstOrDefaultAsync(ct) ?? "";
        var zoneLabel = "UTC";
        if (schedule != null && BackupScheduleClock.TryGetZone(schedule.TimeZoneId, out var zone))
            zoneLabel = BackupScheduleClock.ZoneLabel(zone);
        return new AgentConfigDto
        {
            ScheduleEnabled = schedule?.Enabled == true,
            Frequency = schedule?.Frequency ?? "daily",
            Time = schedule?.LocalTime ?? "23:00",
            TimeZoneId = schedule?.TimeZoneId ?? "UTC",
            TimeZoneLabel = zoneLabel,
            RetentionCount = schedule?.RetentionCount ?? 7,
            IncludeInvoicePdfs = schedule?.IncludeInvoicePdfs == true,
            CompanyName = company,
            FolderLabel = device.FolderLabel
        };
    }

    public async Task<AgentJobDto?> ClaimAsync(int tenantId, int deviceId, CancellationToken ct)
    {
        if (!await FeatureEnabledAsync(tenantId, ct))
            return null;
        var device = await _context.BackupDevices.FirstOrDefaultAsync(d => d.Id == deviceId && d.TenantId == tenantId && d.RevokedAt == null, ct);
        var schedule = device == null ? null : await _context.BackupDeviceSchedules.FirstOrDefaultAsync(s => s.DeviceId == device.Id && s.TenantId == tenantId, ct);
        if (device == null || schedule is not { Enabled: true })
            return new AgentJobDto { Due = false, Message = "Automatic backup is off." };
        if (string.IsNullOrWhiteSpace(device.FolderLabel))
            return new AgentJobDto { Due = false, Message = "Choose a backup folder on this PC." };

        var now = DateTime.UtcNow;
        if (!BackupScheduleClock.TryGetDueSlot(now, schedule.UpdatedAt, schedule.LocalTime, schedule.TimeZoneId, schedule.Frequency, schedule.WeeklyDay, out var slot))
            return new AgentJobDto { Due = false };

        var gate = DeviceLocks.GetOrAdd(device.Id, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(ct);
        try
        {
            _context.SetRequestTenantScope(tenantId, false);
            var existing = await _context.BackupRuns.FirstOrDefaultAsync(r => r.DeviceId == device.Id && r.SlotKey == slot.Key, ct);
            if (existing?.Status == BackupRunStatus.Verified)
                return new AgentJobDto { Due = false, RunId = existing.Id, AlreadyVerified = true, DownloadName = existing.DownloadName, Sha256 = existing.Sha256 };
            if (existing != null && existing.Status is BackupRunStatus.Ready or BackupRunStatus.Running && existing.FileName != null && now - existing.StartedAt < StaleRun)
                return ReadyJob(existing);
            if (existing?.Status == BackupRunStatus.Running && now - existing.StartedAt >= StaleRun)
            {
                existing.Status = BackupRunStatus.Failed;
                existing.FailureReason = BackupRunRules.CouldNotComplete;
                existing.CompletedAt = now;
                await _context.SaveChangesAsync(ct);
                existing = null;
            }
            if (existing?.Status == BackupRunStatus.Failed && existing.FileName != null && !string.IsNullOrEmpty(existing.Sha256))
                return ReadyJob(existing);

            if (existing == null)
            {
                existing = new BackupRun
                {
                    TenantId = tenantId,
                    DeviceId = device.Id,
                    SlotKey = slot.Key,
                    Status = BackupRunStatus.Running,
                    MissedCatchUp = slot.Missed,
                    StartedAt = now
                };
                _context.BackupRuns.Add(existing);
                try
                {
                    await _context.SaveChangesAsync(ct);
                }
                catch (DbUpdateException ex)
                {
                    _logger.LogWarning(ex, "Duplicate backup slot for device {DeviceId}", device.Id);
                    var raced = await _context.BackupRuns.AsNoTracking().FirstOrDefaultAsync(r => r.DeviceId == device.Id && r.SlotKey == slot.Key, ct);
                    return raced == null ? new AgentJobDto { Due = false } : ReadyJob(raced);
                }
            }
            else
            {
                existing.Status = BackupRunStatus.Running;
                existing.StartedAt = now;
                existing.MissedCatchUp = slot.Missed;
                await _context.SaveChangesAsync(ct);
            }

            await _audit.LogAsync("Backup started", "Backup", existing.Id, details: $"Device: {device.DisplayName}", actingUserId: device.CreatedByUserId);
            string fileName;
            try
            {
                fileName = await _backups.CreateFullBackupAsync(tenantId, false, false, false, schedule.IncludeInvoicePdfs);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Scheduled backup failed for tenant {TenantId}", tenantId);
                existing.Status = BackupRunStatus.Failed;
                existing.FailureReason = BackupRunRules.CouldNotComplete;
                existing.CompletedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(ct);
                await _audit.LogAsync("Backup failed", "Backup", existing.Id, details: $"Device: {device.DisplayName}. Reason: {BackupRunRules.CouldNotComplete}", actingUserId: device.CreatedByUserId);
                return new AgentJobDto { Due = false, RunId = existing.Id, Message = BackupRunRules.CouldNotComplete };
            }

            var hash = await HashBackupAsync(fileName, tenantId, ct);
            if (hash == null)
            {
                existing.Status = BackupRunStatus.Failed;
                existing.FailureReason = BackupRunRules.CouldNotComplete;
                existing.CompletedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(ct);
                return new AgentJobDto { Due = false, Message = BackupRunRules.CouldNotComplete };
            }

            var company = await _context.Tenants.AsNoTracking().Where(t => t.Id == tenantId).Select(t => new { t.Subdomain }).FirstAsync(ct);
            existing.FileName = fileName;
            existing.Sha256 = hash;
            existing.DownloadName = DownloadName(company.Subdomain, slot.LocalStart);
            existing.Status = BackupRunStatus.Ready;
            await _context.SaveChangesAsync(ct);
            return ReadyJob(existing);
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task<bool> ReportAsync(int tenantId, int deviceId, int runId, AgentReportDto report, CancellationToken ct)
    {
        var run = await _context.BackupRuns.FirstOrDefaultAsync(r => r.Id == runId && r.TenantId == tenantId && r.DeviceId == deviceId, ct);
        var device = await _context.BackupDevices.AsNoTracking().FirstOrDefaultAsync(d => d.Id == deviceId && d.TenantId == tenantId, ct);
        if (run == null || device == null)
            return false;

        var verified = report.Verified && BackupRunRules.HashesMatch(run.Sha256, report.Sha256);
        run.SizeBytes = report.SizeBytes;
        run.CompletedAt = DateTime.UtcNow;
        if (verified)
        {
            run.Status = BackupRunStatus.Verified;
            run.Verified = true;
            run.FailureReason = null;
            await _context.SaveChangesAsync(ct);
            var size = report.SizeBytes.HasValue ? $"{Math.Max(1, report.SizeBytes.Value / (1024 * 1024))} MB" : "saved";
            var note = run.MissedCatchUp ? " Missed scheduled backup. Completed on next available run." : "";
            await _audit.LogAsync("Backup completed", "Backup", run.Id, details: $"Device: {device.DisplayName}. Size: {size}.{note}", actingUserId: device.CreatedByUserId);
            return true;
        }

        run.Status = BackupRunStatus.Failed;
        run.Verified = false;
        run.FailureReason = report.Verified
            ? BackupRunRules.NotVerified
            : BackupRunRules.SanitizeFailure(report.FailureReason);
        await _context.SaveChangesAsync(ct);
        await _audit.LogAsync("Backup failed", "Backup", run.Id, details: $"Device: {device.DisplayName}. Reason: {run.FailureReason}", actingUserId: device.CreatedByUserId);
        return true;
    }

    public async Task<(Stream Stream, string DownloadName)?> OpenDownloadAsync(int tenantId, int deviceId, int runId, CancellationToken ct)
    {
        var run = await _context.BackupRuns.AsNoTracking().FirstOrDefaultAsync(r => r.Id == runId && r.TenantId == tenantId && r.DeviceId == deviceId, ct);
        if (run?.FileName == null || run.Status is not (BackupRunStatus.Ready or BackupRunStatus.Verified or BackupRunStatus.Failed))
            return null;
        var opened = await _backups.GetBackupForDownloadAsync(run.FileName, tenantId, false);
        if (opened == null)
            return null;
        return (opened.Value.stream, run.DownloadName ?? opened.Value.fileName);
    }

    private static AgentJobDto ReadyJob(BackupRun run) => new()
    {
        Due = run.Status != BackupRunStatus.Verified,
        RunId = run.Id,
        FileName = run.FileName,
        DownloadName = run.DownloadName,
        Sha256 = run.Sha256,
        AlreadyVerified = run.Status == BackupRunStatus.Verified
    };

    private async Task<string?> HashBackupAsync(string fileName, int tenantId, CancellationToken ct)
    {
        var opened = await _backups.GetBackupForDownloadAsync(fileName, tenantId, false);
        if (opened == null)
            return null;
        await using var stream = opened.Value.stream;
        var hash = await SHA256.HashDataAsync(stream, ct);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static string DownloadName(string? subdomain, DateTime localStart)
    {
        var slug = new string((subdomain ?? "company").Select(ch => char.IsLetterOrDigit(ch) || ch == '-' ? ch : '-').ToArray()).Trim('-');
        if (string.IsNullOrWhiteSpace(slug))
            slug = "company";
        return $"HexaBill_{slug}_{localStart:yyyy-MM-dd_HH-mm}.zip";
    }
}
