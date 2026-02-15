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
        Task<string> UploadLogoAsync(IFormFile file);
        Task<string> UploadInvoiceAttachmentAsync(IFormFile file, int purchaseId);
        Task<bool> DeleteFileAsync(string filePath);
        Task<string> GetFileUrlAsync(string filePath);
        Task<List<string>> GetUploadedFilesAsync();
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

        public async Task<string> UploadLogoAsync(IFormFile file)
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

            var fileName = $"logo_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
            var filePath = Path.Combine(_uploadPath, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Save logo path to settings
            var setting = await _context.Settings
                .FirstOrDefaultAsync(s => s.Key == "company_logo");

            if (setting == null)
            {
                setting = new Setting
                {
                    Key = "company_logo",
                    Value = fileName,
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

                setting.Value = fileName;
                setting.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            return fileName;
        }

        public async Task<string> UploadInvoiceAttachmentAsync(IFormFile file, int purchaseId)
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

            var fileName = $"invoice_{purchaseId}_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
            var filePath = Path.Combine(_uploadPath, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return fileName;
        }

        public Task<bool> DeleteFileAsync(string filePath)
        {
            if (string.IsNullOrEmpty(filePath))
                return Task.FromResult(false);

            try
            {
                // Handle both full paths and relative paths
                string fullPath;
                if (Path.IsPathRooted(filePath))
                {
                    fullPath = filePath;
                }
                else if (filePath.StartsWith("/uploads/") || filePath.StartsWith("uploads/"))
                {
                    // Extract filename from path like "/uploads/logo_xxx.png"
                    var fileName = Path.GetFileName(filePath);
                    fullPath = Path.Combine(_uploadPath, fileName);
                }
                else
                {
                    // Assume it's just a filename
                    fullPath = Path.Combine(_uploadPath, filePath);
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

            var fullPath = Path.Combine(_uploadPath, filePath);
            if (File.Exists(fullPath))
            {
                return Task.FromResult($"/uploads/{filePath}");
            }

            return Task.FromResult(string.Empty);
        }

        public Task<List<string>> GetUploadedFilesAsync()
        {
            var files = new List<string>();
            
            if (Directory.Exists(_uploadPath))
            {
                var filePaths = Directory.GetFiles(_uploadPath);
                var fileNames = filePaths
                    .Select(Path.GetFileName)
                    .Where(name => name != null)
                    .Cast<string>()
                    .ToList();
                files.AddRange(fileNames);
            }

            return Task.FromResult(files);
        }
    }
}

