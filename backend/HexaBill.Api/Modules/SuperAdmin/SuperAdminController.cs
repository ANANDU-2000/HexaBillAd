/*
Purpose: Admin controller for settings and backup management
Author: AI Assistant
Date: 2024
*/
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using HexaBill.Api.Modules.SuperAdmin;
using HexaBill.Api.Models;
using HexaBill.Api.Data;
using HexaBill.Api.Shared.Extensions; // MULTI-TENANT
using System.IO;
using HexaBill.Api.Shared.Security;

namespace HexaBill.Api.Modules.SuperAdmin
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin,Owner")] // CRITICAL: Allow Owner role to access all admin features
    public class AdminController : TenantScopedController // MULTI-TENANT
    {
        private readonly IBackupService _backupService;
        private readonly IComprehensiveBackupService _comprehensiveBackupService;
        private readonly AppDbContext _context;
        private readonly IFileUploadService _fileUploadService;
        private readonly IConfiguration _configuration;

        public AdminController(IBackupService backupService, IComprehensiveBackupService comprehensiveBackupService, AppDbContext context, IFileUploadService fileUploadService, IConfiguration configuration)
        {
            _backupService = backupService;
            _comprehensiveBackupService = comprehensiveBackupService;
            _context = context;
            _fileUploadService = fileUploadService;
            _configuration = configuration;
        }

        [HttpGet("settings")]
        public async Task<ActionResult<ApiResponse<Dictionary<string, string>>>> GetSettings()
        {
            try
            {
                var settings = await _context.Settings
                    .Where(s => s.TenantId == CurrentTenantId)  // CRITICAL: Filter by owner
                    .ToDictionaryAsync(s => s.Key, s => s.Value ?? "");
                
                // Add cloud backup settings from configuration if not in database
                if (!settings.ContainsKey("CLOUD_BACKUP_ENABLED"))
                {
                    var cloudEnabled = _configuration.GetValue<bool>("BackupSettings:GoogleDrive:Enabled", false);
                    settings["CLOUD_BACKUP_ENABLED"] = cloudEnabled.ToString().ToLower();
                }
                if (!settings.ContainsKey("CLOUD_BACKUP_CLIENT_ID"))
                {
                    settings["CLOUD_BACKUP_CLIENT_ID"] = _configuration["BackupSettings:GoogleDrive:ClientId"] ?? "";
                }
                if (!settings.ContainsKey("CLOUD_BACKUP_CLIENT_SECRET"))
                {
                    settings["CLOUD_BACKUP_CLIENT_SECRET"] = _configuration["BackupSettings:GoogleDrive:ClientSecret"] ?? "";
                }
                if (!settings.ContainsKey("CLOUD_BACKUP_REFRESH_TOKEN"))
                {
                    settings["CLOUD_BACKUP_REFRESH_TOKEN"] = _configuration["BackupSettings:GoogleDrive:RefreshToken"] ?? "";
                }
                if (!settings.ContainsKey("CLOUD_BACKUP_FOLDER_ID"))
                {
                    settings["CLOUD_BACKUP_FOLDER_ID"] = _configuration["BackupSettings:GoogleDrive:FolderId"] ?? "";
                }
                
                return Ok(new ApiResponse<Dictionary<string, string>>
                {
                    Success = true,
                    Message = "Settings retrieved successfully",
                    Data = settings
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<Dictionary<string, string>>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPut("settings")]
        public async Task<ActionResult<ApiResponse<object>>> UpdateSettings([FromBody] Dictionary<string, string> settings)
        {
            try
            {
                foreach (var setting in settings)
                {
                    // Normalize key to uppercase for consistency
                    var normalizedKey = setting.Key.ToUpper();
                    
                    // Special handling for INVOICE_TEMPLATE - update active InvoiceTemplate
                    if (normalizedKey == "INVOICE_TEMPLATE" && !string.IsNullOrEmpty(setting.Value))
                    {
                        var activeTemplate = await _context.InvoiceTemplates
                            .FirstOrDefaultAsync(t => t.IsActive);
                        
                        if (activeTemplate != null)
                        {
                            activeTemplate.HtmlCode = setting.Value;
                            activeTemplate.UpdatedAt = DateTime.UtcNow;
                        }
                        else
                        {
                            // Create new active template if none exists
                            var userIdClaim = User.FindFirst("UserId") ??
                                              User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier) ??
                                              User.FindFirst("id");
                            if (userIdClaim != null && int.TryParse(userIdClaim.Value, out int userId) && userId > 0)
                            {
                                var newTemplate = new InvoiceTemplate
                                {
                                    Name = "Custom Invoice Template",
                                    Version = "1.0",
                                    HtmlCode = setting.Value,
                                    IsActive = true,
                                    CreatedBy = userId,
                                    CreatedAt = DateTime.UtcNow,
                                    UpdatedAt = DateTime.UtcNow
                                };
                                _context.InvoiceTemplates.Add(newTemplate);
                            }
                        }
                        continue; // Skip adding to Settings table
                    }
                    
                    // Special handling for cloud backup settings - update both database and configuration
                    if (normalizedKey.StartsWith("CLOUD_BACKUP_"))
                    {
                        // Store in database
                        var cloudBackupSetting = await _context.Settings
                            .FirstOrDefaultAsync(s => s.Key.ToUpper() == normalizedKey);
                        
                        if (cloudBackupSetting != null)
                        {
                            cloudBackupSetting.Value = setting.Value;
                            cloudBackupSetting.UpdatedAt = DateTime.UtcNow;
                        }
                        else
                        {
                            _context.Settings.Add(new Setting
                            {
                                Key = setting.Key,
                                Value = setting.Value,
                                CreatedAt = DateTime.UtcNow,
                                UpdatedAt = DateTime.UtcNow
                            });
                        }
                        continue; // Already handled
                    }
                    
                    var existingSetting = await _context.Settings
                        .FirstOrDefaultAsync(s => s.Key.ToUpper() == normalizedKey);
                    
                    if (existingSetting != null)
                    {
                        existingSetting.Value = setting.Value;
                        existingSetting.UpdatedAt = DateTime.UtcNow;
                    }
                    else
                    {
                        _context.Settings.Add(new Setting
                        {
                            Key = setting.Key, // Keep original key case
                            Value = setting.Value,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        });
                    }
                }

                await _context.SaveChangesAsync();

                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = "Settings updated successfully"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost("logo/upload")]
        public async Task<ActionResult<ApiResponse<string>>> UploadLogo([FromForm] IFormFile file)
        {
            try
            {
                if (file == null || file.Length == 0)
                {
                    return BadRequest(new ApiResponse<string>
                    {
                        Success = false,
                        Message = "No file uploaded"
                    });
                }

                var fileName = await _fileUploadService.UploadLogoAsync(file);
                
                // Return the full URL path
                var logoUrl = $"/uploads/{fileName}";
                
                // Update COMPANY_LOGO for current tenant (each tenant has own logo)
                var tenantId = CurrentTenantId;
                var logoSetting = await _context.Settings
                    .FirstOrDefaultAsync(s => s.Key == "COMPANY_LOGO" && s.OwnerId == tenantId);
                if (logoSetting == null)
                    logoSetting = await _context.Settings
                        .FirstOrDefaultAsync(s => s.Key == "COMPANY_LOGO" && s.TenantId == tenantId);

                if (logoSetting != null)
                {
                    logoSetting.Value = logoUrl;
                    logoSetting.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    _context.Settings.Add(new Setting
                    {
                        Key = "COMPANY_LOGO",
                        OwnerId = tenantId,
                        TenantId = tenantId,
                        Value = logoUrl,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    });
                }

                await _context.SaveChangesAsync();

                return Ok(new ApiResponse<string>
                {
                    Success = true,
                    Message = "Logo uploaded successfully",
                    Data = logoUrl
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<string>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpDelete("logo")]
        public async Task<ActionResult<ApiResponse<object>>> DeleteLogo()
        {
            try
            {
                var tenantId = CurrentTenantId;
                var logoSetting = await _context.Settings
                    .FirstOrDefaultAsync(s => s.Key == "COMPANY_LOGO" && (s.OwnerId == tenantId || s.TenantId == tenantId));

                if (logoSetting != null && !string.IsNullOrEmpty(logoSetting.Value))
                {
                    // Delete the file
                    await _fileUploadService.DeleteFileAsync(logoSetting.Value);
                    
                    // Clear the setting
                    logoSetting.Value = "";
                    logoSetting.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }

                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = "Logo deleted successfully"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost("backup")]
        public async Task<ActionResult<ApiResponse<string>>> CreateBackup()
        {
            try
            {
                var fileName = await _backupService.CreateBackupAsync();
                return Ok(new ApiResponse<string>
                {
                    Success = true,
                    Message = "Backup created successfully",
                    Data = fileName
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<string>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        // Comprehensive Backup Endpoints
        [HttpPost("backup/full")]
        public async Task<ActionResult<ApiResponse<string>>> CreateFullBackup([FromQuery] bool exportToDesktop = false)
        {
            try
            {
                var fileName = await _comprehensiveBackupService.CreateFullBackupAsync(exportToDesktop);
                return Ok(new ApiResponse<string>
                {
                    Success = true,
                    Message = exportToDesktop 
                        ? "Full backup created successfully and copied to Desktop (if permissions allowed)"
                        : "Full backup created successfully",
                    Data = fileName
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Backup failed in controller: {ex.Message}");
                Console.WriteLine($"   Stack trace: {ex.StackTrace}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"   Inner exception: {ex.InnerException.Message}");
                }
                
                return StatusCode(500, new ApiResponse<string>
                {
                    Success = false,
                    Message = $"Backup creation failed: {ex.Message}",
                    Errors = new List<string> { ex.Message, ex.StackTrace ?? "No stack trace available" }
                });
            }
        }

        [HttpGet("backup/list")]
        public async Task<ActionResult<ApiResponse<List<BackupInfoDto>>>> GetBackupList()
        {
            try
            {
                var backups = await _comprehensiveBackupService.GetBackupListAsync();
                var backupDtos = backups.Select(b => new BackupInfoDto
                {
                    FileName = b.FileName,
                    FileSize = b.FileSize,
                    CreatedDate = b.CreatedDate,
                    Location = b.Location
                }).ToList();

                return Ok(new ApiResponse<List<BackupInfoDto>>
                {
                    Success = true,
                    Message = "Backups retrieved successfully",
                    Data = backupDtos
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<List<BackupInfoDto>>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost("backup/restore")]
        public async Task<ActionResult<ApiResponse<object>>> RestoreBackup([FromBody] RestoreRequest request)
        {
            try
            {
                var success = await _comprehensiveBackupService.RestoreFromBackupAsync(request.FileName);
                if (success)
                {
                    return Ok(new ApiResponse<object>
                    {
                        Success = true,
                        Message = "Backup restored successfully"
                    });
                }
                else
                {
                    return BadRequest(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Failed to restore backup"
                    });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost("backup/restore-upload")]
        public async Task<ActionResult<ApiResponse<object>>> RestoreBackupFromUpload([FromForm] IFormFile file)
        {
            try
            {
                if (file == null || file.Length == 0)
                {
                    return BadRequest(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "No file uploaded"
                    });
                }

                // Validate file type
                if (!file.FileName.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest(new ApiResponse<object>
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
                    var success = await _comprehensiveBackupService.RestoreFromBackupAsync("", tempPath);
                    if (success)
                    {
                        return Ok(new ApiResponse<object>
                        {
                            Success = true,
                            Message = "Backup restored successfully from uploaded file"
                        });
                    }
                    else
                    {
                        return BadRequest(new ApiResponse<object>
                        {
                            Success = false,
                            Message = "Failed to restore backup"
                        });
                    }
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
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpDelete("backup/{fileName}")]
        public async Task<ActionResult<ApiResponse<object>>> DeleteComprehensiveBackup(string fileName)
        {
            try
            {
                var success = await _comprehensiveBackupService.DeleteBackupAsync(fileName);
                if (success)
                {
                    return Ok(new ApiResponse<object>
                    {
                        Success = true,
                        Message = "Backup deleted successfully"
                    });
                }
                else
                {
                    return NotFound(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Backup file not found"
                    });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("backup/download/{fileName}")]
        public async Task<ActionResult> DownloadBackup(string fileName)
        {
            try
            {
                // Check server location first
                var backupPath = Path.Combine(Directory.GetCurrentDirectory(), "backups", fileName);
                
                if (!System.IO.File.Exists(backupPath))
                {
                    // Check desktop location
                    var desktopPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Desktop), "HexaBill_Backups", fileName);
                    if (System.IO.File.Exists(desktopPath))
                    {
                        backupPath = desktopPath;
                    }
                    else
                    {
                        return NotFound(new ApiResponse<object>
                        {
                            Success = false,
                            Message = "Backup file not found"
                        });
                    }
                }

                var fileBytes = await System.IO.File.ReadAllBytesAsync(backupPath);
                
                // Determine content type
                string contentType = fileName.EndsWith(".zip", StringComparison.OrdinalIgnoreCase) 
                    ? "application/zip" 
                    : "application/octet-stream";
                
                return File(fileBytes, contentType, fileName);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost("backup/email")]
        public async Task<ActionResult<ApiResponse<object>>> EmailBackup([FromBody] EmailBackupRequest request)
        {
            try
            {
                // Get backup file
                var backups = await _backupService.GetBackupFilesAsync();
                var backupFileName = request.FileName;
                
                if (string.IsNullOrEmpty(backupFileName) && backups.Count > 0)
                {
                    backupFileName = backups[0]; // Use most recent backup
                }

                if (string.IsNullOrEmpty(backupFileName))
                {
                    return BadRequest(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "No backup file found. Please create a backup first."
                    });
                }

                var backupPath = Path.Combine(Directory.GetCurrentDirectory(), "backups", backupFileName);
                if (!System.IO.File.Exists(backupPath))
                {
                    return NotFound(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Backup file not found"
                    });
                }

                // TODO: Implement email service to send backup file
                // For now, return success message
                // In production, integrate with email service and attach backup file
                
                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = $"Backup file '{backupFileName}' ready for email. Email sending requires SMTP configuration in appsettings.json"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("backups")]
        [Authorize(Roles = "Admin,Owner,Staff")] // CRITICAL: Allow Owner role to access backups
        public async Task<ActionResult<ApiResponse<List<string>>>> GetBackups()
        {
            try
            {
                var backups = await _backupService.GetBackupFilesAsync();
                return Ok(new ApiResponse<List<string>>
                {
                    Success = true,
                    Message = "Backups retrieved successfully",
                    Data = backups
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<List<string>>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost("restore")]
        public async Task<ActionResult<ApiResponse<object>>> RestoreBackup([FromBody] RestoreBackupRequest request)
        {
            try
            {
                var result = await _backupService.RestoreBackupAsync(request.FileName);
                if (!result)
                {
                    return BadRequest(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Failed to restore backup"
                    });
                }

                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = "Backup restored successfully"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpDelete("backups/{fileName}")]
        public async Task<ActionResult<ApiResponse<object>>> DeleteBackup(string fileName)
        {
            try
            {
                var result = await _backupService.DeleteBackupAsync(fileName);
                if (!result)
                {
                    return NotFound(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Backup file not found"
                    });
                }

                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = "Backup deleted successfully"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("audit-logs")]
        public async Task<ActionResult<ApiResponse<PagedResponse<AuditLogDto>>>> GetAuditLogs(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10)
        {
            try
            {
                var query = _context.AuditLogs
                    .Include(a => a.User)
                    .AsQueryable();

                var totalCount = await query.CountAsync();
                var logs = await query
                    .OrderByDescending(a => a.CreatedAt)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(a => new AuditLogDto
                    {
                        Id = a.Id,
                        UserName = a.User.Name,
                        Action = a.Action,
                        Details = a.Details,
                        CreatedAt = a.CreatedAt
                    })
                    .ToListAsync();

                var result = new PagedResponse<AuditLogDto>
                {
                    Items = logs,
                    TotalCount = totalCount,
                    Page = page,
                    PageSize = pageSize,
                    TotalPages = (int)Math.Ceiling((double)totalCount / pageSize)
                };

                return Ok(new ApiResponse<PagedResponse<AuditLogDto>>
                {
                    Success = true,
                    Message = "Audit logs retrieved successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<PagedResponse<AuditLogDto>>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("users")]
        public async Task<ActionResult<ApiResponse<PagedResponse<UserDto>>>> GetUsers(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10)
        {
            try
            {
                // CRITICAL: Filter users by owner - each owner sees only their staff
                var tenantId = CurrentTenantId;
                var query = _context.Users
                    .Where(u => u.TenantId == tenantId) // OWNER-SCOPED FILTERING
                    .AsQueryable();
                    
                var totalCount = await query.CountAsync();
                var users = await query
                    .OrderBy(u => u.Name)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(u => new UserDto
                    {
                        Id = u.Id,
                        Name = u.Name,
                        Email = u.Email,
                        Role = u.Role.ToString(),
                        Phone = u.Phone,
                        DashboardPermissions = u.DashboardPermissions,
                        CreatedAt = u.CreatedAt,
                        OwnerId = u.TenantId ?? 0
                    })
                    .ToListAsync();

                return Ok(new ApiResponse<PagedResponse<UserDto>>
                {
                    Success = true,
                    Message = "Users retrieved successfully",
                    Data = new PagedResponse<UserDto>
                    {
                        Items = users,
                        TotalCount = totalCount,
                        Page = page,
                        PageSize = pageSize,
                        TotalPages = (int)Math.Ceiling((double)totalCount / pageSize)
                    }
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<PagedResponse<UserDto>>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost("users")]
        public async Task<ActionResult<ApiResponse<UserDto>>> CreateUser([FromBody] CreateUserRequest request)
        {
            try
            {
                if (await _context.Users.AnyAsync(u => u.Email == request.Email))
                {
                    return Conflict(new ApiResponse<UserDto>
                    {
                        Success = false,
                        Message = "User with this email already exists"
                    });
                }

                // SECURITY: Admin cannot assign Owner role
                if (!IsOwner && request.Role == "Owner")
                {
                    return Forbid();
                }

                var tenantId = CurrentTenantId;

                var user = new User
                {
                    Name = request.Name,
                    Email = request.Email,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                    Role = Enum.Parse<UserRole>(request.Role),
                    Phone = request.Phone,
                    DashboardPermissions = request.DashboardPermissions,
                    TenantId = tenantId, // ASSIGN TO OWNER
                    CreatedAt = DateTime.UtcNow
                };

                _context.Users.Add(user);
                await _context.SaveChangesAsync();

                // Audit log
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim != null && int.TryParse(userIdClaim.Value, out int adminId))
                {
                    _context.AuditLogs.Add(new AuditLog
                    {
                        UserId = adminId,
                        Action = "User Created",
                        Details = $"Created user: {user.Email} with role {user.Role} for owner {tenantId}",
                        CreatedAt = DateTime.UtcNow
                    });
                    await _context.SaveChangesAsync();
                }

                return CreatedAtAction(nameof(GetUsers), new { id = user.Id }, new ApiResponse<UserDto>
                {
                    Success = true,
                    Message = "User created successfully. They can now login with their email and password.",
                    Data = new UserDto
                    {
                        Id = user.Id,
                        Name = user.Name,
                        Email = user.Email,
                        Role = user.Role.ToString(),
                        Phone = user.Phone,
                        DashboardPermissions = user.DashboardPermissions,
                        CreatedAt = user.CreatedAt,
                        OwnerId = user.TenantId ?? 0
                    }
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<UserDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPut("users/{id}")]
        public async Task<ActionResult<ApiResponse<UserDto>>> UpdateUser(int id, [FromBody] UpdateUserRequest request)
        {
            try
            {
                // CRITICAL: Verify user belongs to current owner
                var tenantId = CurrentTenantId;
                var user = await _context.Users
                    .Where(u => u.Id == id && u.TenantId == tenantId)
                    .FirstOrDefaultAsync();
                    
                if (user == null)
                {
                    return NotFound(new ApiResponse<UserDto>
                    {
                        Success = false,
                        Message = "User not found or access denied"
                    });
                }

                // SECURITY: Admin cannot edit Owner and cannot upgrade anyone to Owner
                if (!IsOwner)
                {
                    if (user.Role == UserRole.Owner)
                    {
                        return Forbid(); // Admin cannot edit Owner
                    }
                    if (request.Role == "Owner")
                    {
                        return BadRequest(new ApiResponse<UserDto> { Success = false, Message = "Only company owner can assign Owner role" });
                    }
                }

                user.Name = request.Name ?? user.Name;
                user.Phone = request.Phone ?? user.Phone;
                if (!string.IsNullOrEmpty(request.Role))
                {
                    if (Enum.TryParse<UserRole>(request.Role, true, out var newRole))
                    {
                        user.Role = newRole;
                    }
                }
                
                // Allow admin to update dashboard permissions
                if (request.DashboardPermissions != null)
                {
                    user.DashboardPermissions = request.DashboardPermissions;
                }

                await _context.SaveChangesAsync();

                // Audit log
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim != null && int.TryParse(userIdClaim.Value, out int adminId))
                {
                    _context.AuditLogs.Add(new AuditLog
                    {
                        UserId = adminId,
                        Action = "User Updated",
                        Details = $"Updated user: {user.Email}",
                        CreatedAt = DateTime.UtcNow
                    });
                    await _context.SaveChangesAsync();
                }

                return Ok(new ApiResponse<UserDto>
                {
                    Success = true,
                    Message = "User updated successfully",
                    Data = new UserDto
                    {
                        Id = user.Id,
                        Name = user.Name,
                        Email = user.Email,
                        Role = user.Role.ToString(),
                        Phone = user.Phone,
                        DashboardPermissions = user.DashboardPermissions,
                        CreatedAt = user.CreatedAt,
                        OwnerId = user.TenantId ?? 0
                    }
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<UserDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost("users/{id}/reset-password")]
        public async Task<ActionResult<ApiResponse<object>>> ResetPassword(int id, [FromBody] ResetPasswordRequest request)
        {
            try
            {
                // CRITICAL: Verify user belongs to current owner
                var tenantId = CurrentTenantId;
                var user = await _context.Users
                    .Where(u => u.Id == id && u.TenantId == tenantId)
                    .FirstOrDefaultAsync();
                    
                if (user == null)
                {
                    return NotFound(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "User not found or access denied"
                    });
                }

                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
                await _context.SaveChangesAsync();

                // Audit log
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim != null && int.TryParse(userIdClaim.Value, out int adminId))
                {
                    _context.AuditLogs.Add(new AuditLog
                    {
                        UserId = adminId,
                        Action = "Password Reset",
                        Details = $"Password reset for user: {user.Email}",
                        CreatedAt = DateTime.UtcNow
                    });
                    await _context.SaveChangesAsync();
                }

                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = "Password reset successfully"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpDelete("users/{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> DeleteUser(int id)
        {
            try
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int adminId))
                {
                    return Unauthorized(new ApiResponse<bool> { Success = false, Message = "Invalid user" });
                }

                // Prevent deleting yourself
                if (id == adminId)
                {
                    return BadRequest(new ApiResponse<bool> { Success = false, Message = "You cannot delete your own account" });
                }

                // CRITICAL: Verify user belongs to current owner
                var tenantId = CurrentTenantId;
                var user = await _context.Users
                    .Where(u => u.Id == id && u.TenantId == tenantId)
                    .FirstOrDefaultAsync();

                if (user == null)
                {
                    return NotFound(new ApiResponse<bool> { Success = false, Message = "User not found" });
                }

                // SECURITY: Admin cannot delete Owner
                if (!IsOwner && user.Role == UserRole.Owner)
                {
                    return Forbid();
                }

                _context.Users.Remove(user);
                await _context.SaveChangesAsync();

                // Audit log
                _context.AuditLogs.Add(new AuditLog
                {
                    UserId = adminId,
                    Action = "User Deleted",
                    Details = $"Deleted user: {user.Email}",
                    CreatedAt = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();

                return Ok(new ApiResponse<bool>
                {
                    Success = true,
                    Message = "User deleted successfully",
                    Data = true
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<bool>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }
    }

    public class RestoreBackupRequest
    {
        public string FileName { get; set; } = string.Empty;
    }

    public class EmailBackupRequest
    {
        public string? FileName { get; set; }
        public string? Email { get; set; }
    }

    public class AuditLogDto
    {
        public int Id { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public string? Details { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class BackupInfoDto
    {
        public string FileName { get; set; } = string.Empty;
        public long FileSize { get; set; }
        public DateTime CreatedDate { get; set; }
        public string Location { get; set; } = string.Empty;
    }

    public class RestoreRequest
    {
        public string FileName { get; set; } = string.Empty;
    }
}

