/*
Purpose: Backup controller for manual backup, restore, and backup management
Author: AI Assistant
Date: 2025
*/
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Modules.SuperAdmin;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Services;
using System.Collections.Generic;

namespace HexaBill.Api.Modules.SuperAdmin
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin,Owner")] // CRITICAL: Allow Owner role to access backups
    public class BackupController : ControllerBase
    {
        private const long MaxRestoreFileSizeBytes = 100L * 1024 * 1024; // 100 MB
        private readonly IComprehensiveBackupService _backupService;
        private readonly IAuditService _auditService;

        public BackupController(IComprehensiveBackupService backupService, IAuditService auditService)
        {
            _backupService = backupService;
            _auditService = auditService;
        }

        [HttpPost("create")]
        public async Task<ActionResult<ApiResponse<BackupInfo>>> CreateBackup(
            [FromQuery] bool exportToDesktop = true,
            [FromQuery] bool uploadToGoogleDrive = false,
            [FromQuery] bool sendEmail = false)
        {
            try
            {
                var fileName = await _backupService.CreateFullBackupAsync(exportToDesktop, uploadToGoogleDrive, sendEmail);
                
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
                var result = await _backupService.RestoreFromBackupAsync(request.FileName ?? "", request.UploadedFilePath);
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
                    var success = await _backupService.RestoreFromBackupAsync("", tempPath);
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
                var backups = await _backupService.GetBackupListAsync();
                var backup = backups.FirstOrDefault(b => b.FileName == fileName);
                
                if (backup == null)
                {
                    return NotFound(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Backup file not found"
                    });
                }

                // Determine file path based on location
                var backupDirectory = System.IO.Path.Combine(Directory.GetCurrentDirectory(), "backups");
                var desktopPath = System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Desktop), "HexaBill_Backups");
                
                string? filePath = null;
                if (backup.Location == "Server")
                {
                    filePath = System.IO.Path.Combine(backupDirectory, fileName);
                }
                else if (backup.Location == "Desktop")
                {
                    filePath = System.IO.Path.Combine(desktopPath, fileName);
                }

                if (filePath == null || !System.IO.File.Exists(filePath))
                {
                    return NotFound(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Backup file not found on disk"
                    });
                }

                var fileBytes = await System.IO.File.ReadAllBytesAsync(filePath);
                return new FileContentResult(fileBytes, "application/zip")
                {
                    FileDownloadName = fileName
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
}

