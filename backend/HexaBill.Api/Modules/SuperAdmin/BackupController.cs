/*
Purpose: Backup controller for manual backup, restore, and backup management.
Author: AI Assistant
Date: 2025

EPHEMERAL STORAGE (Production): Backup files under ./backups are stored on the
app server's disk. On cloud hosts (e.g. Render), the filesystem is ephemeral:
files are lost on restart/redeploy. Use "Download to browser" or external
storage (S3/R2) for retention. See docs/BACKUP_AND_IMPORT_STRATEGY.md.
*/
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Modules.SuperAdmin;
using HexaBill.Api.Models;
using HexaBill.Api.Data;
using HexaBill.Api.Shared.Services;
using HexaBill.Api.Shared.Extensions;
using System.Collections.Generic;

namespace HexaBill.Api.Modules.SuperAdmin
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Policy = "AdminOrOwner")] // Production: case-insensitive Admin/Owner/SystemAdmin
    public class BackupController : TenantScopedController
    {
        private const long MaxRestoreFileSizeBytes = 100L * 1024 * 1024; // 100 MB
        private const int BackupScheduleOwnerId = 0; // Platform-wide schedule
        private readonly IComprehensiveBackupService _backupService;
        private readonly IAuditService _auditService;
        private readonly AppDbContext _context;

        public BackupController(IComprehensiveBackupService backupService, IAuditService auditService, AppDbContext context)
        {
            _backupService = backupService;
            _auditService = auditService;
            _context = context;
        }

        [HttpGet("schedule")]
        public async Task<ActionResult<ApiResponse<BackupScheduleDto>>> GetSchedule()
        {
            try
            {
                var settings = await _context.Settings
                    .Where(s => s.OwnerId == BackupScheduleOwnerId && (
                        s.Key == "BACKUP_SCHEDULE_ENABLED" ||
                        s.Key == "BACKUP_SCHEDULE_TIME" ||
                        s.Key == "BACKUP_SCHEDULE_FREQUENCY" ||
                        s.Key == "BACKUP_RETENTION_DAYS"))
                    .ToDictionaryAsync(s => s.Key, s => s.Value ?? "");

                var dto = new BackupScheduleDto
                {
                    Enabled = settings.GetValueOrDefault("BACKUP_SCHEDULE_ENABLED", "false").Equals("true", StringComparison.OrdinalIgnoreCase),
                    Time = settings.GetValueOrDefault("BACKUP_SCHEDULE_TIME", "21:00"),
                    Frequency = settings.GetValueOrDefault("BACKUP_SCHEDULE_FREQUENCY", "daily"),
                    RetentionDays = int.TryParse(settings.GetValueOrDefault("BACKUP_RETENTION_DAYS", "30"), out var rd) ? rd : 30
                };
                return Ok(new ApiResponse<BackupScheduleDto>
                {
                    Success = true,
                    Message = "Schedule retrieved",
                    Data = dto
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<BackupScheduleDto>
                {
                    Success = false,
                    Message = "Failed to get schedule",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost("schedule")]
        public async Task<ActionResult<ApiResponse<BackupScheduleDto>>> SaveSchedule([FromBody] BackupScheduleDto dto)
        {
            try
            {
                if (dto == null) dto = new BackupScheduleDto();
                var keys = new[] { "BACKUP_SCHEDULE_ENABLED", "BACKUP_SCHEDULE_TIME", "BACKUP_SCHEDULE_FREQUENCY", "BACKUP_RETENTION_DAYS" };
                var values = new[]
                {
                    dto.Enabled ? "true" : "false",
                    string.IsNullOrWhiteSpace(dto.Time) ? "21:00" : dto.Time.Trim(),
                    string.IsNullOrWhiteSpace(dto.Frequency) || (dto.Frequency != "weekly" && dto.Frequency != "daily") ? "daily" : dto.Frequency,
                    (dto.RetentionDays < 1 ? 30 : dto.RetentionDays > 365 ? 365 : dto.RetentionDays).ToString()
                };
                for (var i = 0; i < keys.Length; i++)
                {
                    var existing = await _context.Settings.FindAsync(keys[i], BackupScheduleOwnerId);
                    if (existing != null)
                    {
                        existing.Value = values[i];
                        existing.UpdatedAt = DateTime.UtcNow;
                    }
                    else
                    {
                        _context.Settings.Add(new Setting
                        {
                            Key = keys[i],
                            OwnerId = BackupScheduleOwnerId,
                            Value = values[i],
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        });
                    }
                }
                await _context.SaveChangesAsync();
                await _auditService.LogAsync("Backup schedule updated", entityType: "Backup", details: $"Enabled={dto.Enabled}, Time={dto.Time}, Retention={dto.RetentionDays}");
                return Ok(new ApiResponse<BackupScheduleDto>
                {
                    Success = true,
                    Message = "Schedule saved",
                    Data = new BackupScheduleDto { Enabled = dto.Enabled, Time = dto.Time ?? "21:00", Frequency = dto.Frequency ?? "daily", RetentionDays = dto.RetentionDays }
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<BackupScheduleDto>
                {
                    Success = false,
                    Message = "Failed to save schedule",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost("create")]
        public async Task<ActionResult> CreateBackup(
            [FromQuery] bool downloadToBrowser = false,
            [FromQuery] bool uploadToGoogleDrive = false,
            [FromQuery] bool sendEmail = false)
        {
            try
            {
                // AUDIT-8 FIX: Get tenantId from controller context
                var tenantId = CurrentTenantId;
                if (tenantId <= 0)
                {
                    return BadRequest(new ApiResponse<BackupInfo>
                    {
                        Success = false,
                        Message = "Tenant ID is required for backup. SystemAdmin must specify tenant."
                    });
                }
                
                // Note: downloadToBrowser replaces exportToDesktop - backups are always created on server
                // If downloadToBrowser=true, return the file directly for browser download
                var fileName = await _backupService.CreateFullBackupAsync(tenantId, false, uploadToGoogleDrive, sendEmail);
                
                if (downloadToBrowser)
                {
                    // Stream from local or S3 (S3 may have been used and local file deleted)
                    var result = await _backupService.GetBackupForDownloadAsync(fileName);
                    if (result == null)
                    {
                        return NotFound(new ApiResponse<object>
                        {
                            Success = false,
                            Message = "Backup file not found"
                        });
                    }
                    var (stream, downloadFileName) = result.Value;
                    return new FileStreamResult(stream, "application/zip")
                    {
                        FileDownloadName = downloadFileName
                    };
                }
                
                var backups = await _backupService.GetBackupListAsync();
                var backupInfo = backups.FirstOrDefault(b => b.FileName == fileName);

                return Ok(new ApiResponse<BackupInfo>
                {
                    Success = true,
                    Message = "Backup created successfully",
                    Data = backupInfo
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<BackupInfo>
                {
                    Success = false,
                    Message = "Backup creation failed",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("list")]
        public async Task<ActionResult<ApiResponse<List<BackupInfo>>>> GetBackups()
        {
            try
            {
                var backups = await _backupService.GetBackupListAsync();
                return Ok(new ApiResponse<List<BackupInfo>>
                {
                    Success = true,
                    Message = "Backups retrieved successfully",
                    Data = backups
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<List<BackupInfo>>
                {
                    Success = false,
                    Message = "Failed to retrieve backups",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost("preview")]
        public async Task<ActionResult<ApiResponse<ImportPreview>>> PreviewImport(
            [FromBody] PreviewImportRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.FileName) && string.IsNullOrWhiteSpace(request.UploadedFilePath))
                {
                    return BadRequest(new ApiResponse<ImportPreview>
                    {
                        Success = false,
                        Message = "Either FileName or UploadedFilePath must be provided"
                    });
                }
                
                var preview = await _backupService.PreviewImportAsync(
                    request.FileName ?? string.Empty, 
                    request.UploadedFilePath);
                return Ok(new ApiResponse<ImportPreview>
                {
                    Success = true,
                    Message = "Import preview generated successfully",
                    Data = preview
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<ImportPreview>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost("import")]
        public async Task<ActionResult<ApiResponse<ImportResult>>> ImportWithResolution(
            [FromBody] ImportWithResolutionRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.FileName) && string.IsNullOrWhiteSpace(request.UploadedFilePath))
                {
                    return BadRequest(new ApiResponse<ImportResult>
                    {
                        Success = false,
                        Message = "Either FileName or UploadedFilePath must be provided"
                    });
                }

                var userIdClaim = User.FindFirst("UserId") ?? 
                                  User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier) ?? 
                                  User.FindFirst("id");
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId) || userId == 0)
                {
                    return Unauthorized(new ApiResponse<ImportResult>
                    {
                        Success = false,
                        Message = "Invalid user authentication"
                    });
                }

                var result = await _backupService.ImportWithResolutionAsync(
                    request.FileName ?? string.Empty, 
                    request.UploadedFilePath, 
                    request.ConflictResolutions ?? new Dictionary<int, string>(),
                    userId);

                return Ok(new ApiResponse<ImportResult>
                {
                    Success = result.Success,
                    Message = result.Success 
                        ? $"Import completed: {result.Imported} imported, {result.Updated} updated, {result.Skipped} skipped"
                        : "Import failed",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<ImportResult>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost("restore")]
        public async Task<ActionResult<ApiResponse<bool>>> RestoreBackup(
            [FromBody] RestoreBackupRequestDto request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request?.FileName) && string.IsNullOrWhiteSpace(request?.UploadedFilePath))
                {
                    return BadRequest(new ApiResponse<bool> { Success = false, Message = "FileName or UploadedFilePath is required." });
                }
                // AUDIT-8 FIX: Get tenantId and validate before restore
                var tenantId = CurrentTenantId;
                if (tenantId <= 0)
                {
                    return BadRequest(new ApiResponse<bool>
                    {
                        Success = false,
                        Message = "Tenant ID is required for restore. SystemAdmin must specify tenant."
                    });
                }
                
                var result = await _backupService.RestoreFromBackupAsync(tenantId, request.FileName ?? "", request.UploadedFilePath);
                if (result)
                {
                    await _auditService.LogAsync("Backup Restored", entityType: "Backup", details: $"FileName: {request.FileName ?? "uploaded"}");
                    return Ok(new ApiResponse<bool>
                    {
                        Success = true,
                        Message = "Backup restored successfully",
                        Data = true
                    });
                }
                return BadRequest(new ApiResponse<bool>
                {
                    Success = false,
                    Message = "Backup file not found or restore failed"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<bool>
                {
                    Success = false,
                    Message = "Restore failed",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost("restore-upload")]
        public async Task<ActionResult<ApiResponse<bool>>> RestoreBackupFromUpload([FromForm] IFormFile file)
        {
            try
            {
                if (file == null || file.Length == 0)
                {
                    return BadRequest(new ApiResponse<bool>
                    {
                        Success = false,
                        Message = "No file uploaded"
                    });
                }
                if (file.Length > MaxRestoreFileSizeBytes)
                {
                    return BadRequest(new ApiResponse<bool>
                    {
                        Success = false,
                        Message = $"File too large. Maximum size is {MaxRestoreFileSizeBytes / (1024 * 1024)} MB"
                    });
                }
                if (!file.FileName.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest(new ApiResponse<bool>
                    {
                        Success = false,
                        Message = "Invalid file type. Only ZIP files are supported"
                    });
                }

                // Save uploaded file temporarily
                var tempPath = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid()}_{file.FileName}");
                using (var stream = new FileStream(tempPath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                try
                {
                    // AUDIT-8 FIX: Get tenantId and validate before restore
                    var tenantId = CurrentTenantId;
                    if (tenantId <= 0)
                    {
                        return BadRequest(new ApiResponse<bool>
                        {
                            Success = false,
                            Message = "Tenant ID is required for restore. SystemAdmin must specify tenant."
                        });
                    }
                    
                    var success = await _backupService.RestoreFromBackupAsync(tenantId, "", tempPath);
                    if (success)
                    {
                        await _auditService.LogAsync("Backup Restored", entityType: "Backup", details: $"Uploaded file: {file.FileName}");
                        return Ok(new ApiResponse<bool>
                        {
                            Success = true,
                            Message = "Backup restored successfully from uploaded file",
                            Data = true
                        });
                    }
                    return BadRequest(new ApiResponse<bool>
                    {
                        Success = false,
                        Message = "Failed to restore backup"
                    });
                }
                finally
                {
                    if (System.IO.File.Exists(tempPath))
                    {
                        System.IO.File.Delete(tempPath);
                    }
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<bool>
                {
                    Success = false,
                    Message = "Restore failed",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpDelete("{fileName}")]
        public async Task<ActionResult<ApiResponse<bool>>> DeleteBackup(string fileName)
        {
            try
            {
                var result = await _backupService.DeleteBackupAsync(fileName);
                
                return Ok(new ApiResponse<bool>
                {
                    Success = result,
                    Message = result ? "Backup deleted successfully" : "Backup not found",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<bool>
                {
                    Success = false,
                    Message = "Failed to delete backup",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("download/{fileName}")]
        public async Task<ActionResult> DownloadBackup(string fileName)
        {
            try
            {
                var result = await _backupService.GetBackupForDownloadAsync(fileName);
                if (result == null)
                {
                    return NotFound(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Backup file not found (check Server, Desktop, or S3)"
                    });
                }

                var (stream, downloadFileName) = result.Value;
                return new FileStreamResult(stream, "application/zip")
                {
                    FileDownloadName = downloadFileName
                };
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "Failed to download backup",
                    Errors = new List<string> { ex.Message }
                });
            }
        }
    }

    public class BackupScheduleDto
    {
        public bool Enabled { get; set; }
        public string Time { get; set; } = "21:00";
        public string Frequency { get; set; } = "daily";
        public int RetentionDays { get; set; } = 30;
    }
}

