/*
Purpose: File upload service for logo and document management
Author: AI Assistant
Date: 2024
*/
using HexaBill.Api.Models;
using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Shared.Security
{
    public interface IFileUploadService
    {
        Task<string> UploadLogoAsync(IFormFile file, int tenantId);
        Task<string> UploadInvoiceAttachmentAsync(IFormFile file, int purchaseId, int tenantId);
        Task<string> UploadProductImageAsync(IFormFile file, int productId, int tenantId);
        Task<string> UploadProfilePhotoAsync(IFormFile file, int userId, int tenantId);
        Task<bool> DeleteFileAsync(string filePath);
        Task<string> GetFileUrlAsync(string filePath);
        Task<List<string>> GetUploadedFilesAsync(int tenantId);
    }

    public class FileUploadService : IFileUploadService
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _environment;
        private readonly string _uploadPath;

        public FileUploadService(AppDbContext context, IWebHostEnvironment environment)
        {
            _context = context;
            _environment = environment;
            _uploadPath = Path.Combine(_environment.WebRootPath, "uploads");
            
            // Ensure upload directory exists
            if (!Directory.Exists(_uploadPath))
            {
                Directory.CreateDirectory(_uploadPath);
            }
        }

        private string GetTenantUploadPath(int tenantId)
        {
            var tenantPath = Path.Combine(_uploadPath, tenantId.ToString());
            if (!Directory.Exists(tenantPath))
            {
                Directory.CreateDirectory(tenantPath);
            }
            return tenantPath;
        }

        public async Task<string> UploadLogoAsync(IFormFile file, int tenantId)
        {
            if (file == null || file.Length == 0)
                throw new ArgumentException("No file provided");

            // Validate file type
            var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/svg+xml" };
            if (!allowedTypes.Contains(file.ContentType.ToLower()))
                throw new ArgumentException("Invalid file type. Only images are allowed.");

            // Validate file size (max 5MB)
            if (file.Length > 5 * 1024 * 1024)
                throw new ArgumentException("File size too large. Maximum 5MB allowed.");

            // Use tenant-specific subfolder for file isolation
            var tenantUploadPath = GetTenantUploadPath(tenantId);
            var fileName = $"logo_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
            var filePath = Path.Combine(tenantUploadPath, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // CRITICAL FIX: Save logo path to settings with TenantId filter to prevent cross-contamination
            var relativePath = $"{tenantId}/{fileName}";
            var setting = await _context.Settings
                .FirstOrDefaultAsync(s => s.Key == "company_logo" && (s.OwnerId == tenantId || s.TenantId == tenantId));

            if (setting == null)
            {
                setting = new Setting
                {
                    Key = "company_logo",
                    Value = relativePath,
                    OwnerId = tenantId,
                    TenantId = tenantId,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.Settings.Add(setting);
            }
            else
            {
                // Delete old logo if exists
                if (!string.IsNullOrEmpty(setting.Value))
                {
                    var oldLogoPath = Path.Combine(_uploadPath, setting.Value);
                    if (File.Exists(oldLogoPath))
                    {
                        File.Delete(oldLogoPath);
                    }
                }

                setting.Value = relativePath;
                setting.OwnerId = tenantId;
                setting.TenantId = tenantId;
                setting.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            return relativePath;
        }

        public async Task<string> UploadInvoiceAttachmentAsync(IFormFile file, int purchaseId, int tenantId)
        {
            if (file == null || file.Length == 0)
                throw new ArgumentException("No file provided");

            // Validate file type
            var allowedTypes = new[] { 
                "image/jpeg", "image/png", "image/gif", 
                "application/pdf", 
                "application/msword", 
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
            };
            if (!allowedTypes.Contains(file.ContentType.ToLower()))
                throw new ArgumentException("Invalid file type. Only images and documents are allowed.");

            // Validate file size (max 10MB)
            if (file.Length > 10 * 1024 * 1024)
                throw new ArgumentException("File size too large. Maximum 10MB allowed.");

            var tenantUploadPath = GetTenantUploadPath(tenantId);
            var fileName = $"invoice_{purchaseId}_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
            var filePath = Path.Combine(tenantUploadPath, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return $"{tenantId}/{fileName}";
        }

        public async Task<string> UploadProductImageAsync(IFormFile file, int productId, int tenantId)
        {
            if (file == null || file.Length == 0)
                throw new ArgumentException("No file provided");

            // Validate file type (images only)
            var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
            if (!allowedTypes.Contains(file.ContentType.ToLower()))
                throw new ArgumentException("Invalid file type. Only images (JPEG, PNG, GIF, WebP) are allowed.");

            // Validate file size (max 5MB)
            if (file.Length > 5 * 1024 * 1024)
                throw new ArgumentException("File size too large. Maximum 5MB allowed.");

            // Use tenant-specific subfolder for file isolation
            var tenantUploadPath = GetTenantUploadPath(tenantId);
            var productsDir = Path.Combine(tenantUploadPath, "products");
            if (!Directory.Exists(productsDir))
            {
                Directory.CreateDirectory(productsDir);
            }

            var fileName = $"product_{productId}_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
            var filePath = Path.Combine(productsDir, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Return relative path for storage in database
            return $"{tenantId}/products/{fileName}";
        }

        public async Task<string> UploadProfilePhotoAsync(IFormFile file, int userId, int tenantId)
        {
            if (file == null || file.Length == 0)
                throw new ArgumentException("No file provided");

            var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
            if (!allowedTypes.Contains(file.ContentType.ToLower()))
                throw new ArgumentException("Invalid file type. Only images (JPEG, PNG, GIF, WebP) are allowed.");

            if (file.Length > 2 * 1024 * 1024) // 2MB
                throw new ArgumentException("File size too large. Maximum 2MB allowed.");

            // Use tenant-specific subfolder for file isolation
            var tenantUploadPath = GetTenantUploadPath(tenantId);
            var profilesDir = Path.Combine(tenantUploadPath, "profiles");
            if (!Directory.Exists(profilesDir))
                Directory.CreateDirectory(profilesDir);

            var fileName = $"profile_{userId}_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
            var filePath = Path.Combine(profilesDir, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return $"{tenantId}/profiles/{fileName}";
        }

        public Task<bool> DeleteFileAsync(string filePath)
        {
            if (string.IsNullOrEmpty(filePath))
                return Task.FromResult(false);

            try
            {
                // PROD-17: Handle tenant-isolated file paths
                string fullPath;
                if (Path.IsPathRooted(filePath))
                {
                    fullPath = filePath;
                }
                else if (filePath.StartsWith("/uploads/") || filePath.StartsWith("uploads/"))
                {
                    // Path format: "uploads/{tenantId}/filename" or "/uploads/{tenantId}/filename"
                    // Remove leading slash and "uploads/" prefix
                    var relativePath = filePath.TrimStart('/').Replace("uploads/", "", StringComparison.OrdinalIgnoreCase);
                    fullPath = Path.Combine(_uploadPath, relativePath);
                }
                else if (filePath.Contains('/') || filePath.Contains('\\'))
                {
                    // Path format: "{tenantId}/filename" or "{tenantId}/products/filename"
                    fullPath = Path.Combine(_uploadPath, filePath);
                }
                else
                {
                    // Legacy: Just filename (should not happen with tenant isolation)
                    fullPath = Path.Combine(_uploadPath, filePath);
                }

                // PROD-17: Security check - ensure file is within upload directory (prevent path traversal)
                var normalizedFullPath = Path.GetFullPath(fullPath);
                var normalizedUploadPath = Path.GetFullPath(_uploadPath);
                if (!normalizedFullPath.StartsWith(normalizedUploadPath, StringComparison.OrdinalIgnoreCase))
                {
                    return Task.FromResult(false); // Path traversal attempt
                }

                if (File.Exists(fullPath))
                {
                    File.Delete(fullPath);
                    return Task.FromResult(true);
                }
                return Task.FromResult(false);
            }
            catch
            {
                return Task.FromResult(false);
            }
        }

        public Task<string> GetFileUrlAsync(string filePath)
        {
            if (string.IsNullOrEmpty(filePath))
                return Task.FromResult(string.Empty);

            // PROD-17: Security check - ensure file path is within upload directory
            var fullPath = Path.Combine(_uploadPath, filePath);
            var normalizedFullPath = Path.GetFullPath(fullPath);
            var normalizedUploadPath = Path.GetFullPath(_uploadPath);
            
            if (!normalizedFullPath.StartsWith(normalizedUploadPath, StringComparison.OrdinalIgnoreCase))
            {
                return Task.FromResult(string.Empty); // Path traversal attempt
            }

            if (File.Exists(fullPath))
            {
                return Task.FromResult($"/uploads/{filePath}");
            }

            return Task.FromResult(string.Empty);
        }

        public Task<List<string>> GetUploadedFilesAsync(int tenantId)
        {
            var files = new List<string>();
            
            // CRITICAL FIX: Only return files for the specific tenant
            var tenantUploadPath = Path.Combine(_uploadPath, tenantId.ToString());
            if (Directory.Exists(tenantUploadPath))
            {
                var filePaths = Directory.GetFiles(tenantUploadPath, "*", SearchOption.AllDirectories);
                var relativePaths = filePaths
                    .Select(fp => Path.GetRelativePath(_uploadPath, fp))
                    .Where(path => !string.IsNullOrEmpty(path))
                    .ToList();
                files.AddRange(relativePaths);
            }

            return Task.FromResult(files);
        }
    }
}

