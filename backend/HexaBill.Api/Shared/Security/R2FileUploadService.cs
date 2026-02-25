/*
Purpose: Cloudflare R2 file upload service (S3-compatible)
Author: AI Assistant
Date: 2026-02-18
*/
using Amazon.S3;
using Amazon.S3.Model;
using HexaBill.Api.Models;
using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.AspNetCore.Http;

namespace HexaBill.Api.Shared.Security
{
    /// <summary>
    /// BUG #2.2 FIX: Cloudflare R2 storage service for persistent file storage
    /// Replaces ephemeral disk storage on Render with cloud storage
    /// </summary>
    public class R2FileUploadService : IFileUploadService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IAmazonS3 _s3Client;
        private readonly string _bucketName;
        private readonly string _publicUrlBase;
        private readonly bool _isEnabled;

        public R2FileUploadService(AppDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;

            // Read R2 configuration from environment variables or appsettings.json
            var r2Endpoint = Environment.GetEnvironmentVariable("R2_ENDPOINT") 
                ?? _configuration["R2Settings:Endpoint"] 
                ?? _configuration["CloudflareR2:Endpoint"];
            
            var r2AccessKey = Environment.GetEnvironmentVariable("R2_ACCESS_KEY") 
                ?? _configuration["R2Settings:AccessKey"] 
                ?? _configuration["CloudflareR2:AccessKey"];
            
            var r2SecretKey = Environment.GetEnvironmentVariable("R2_SECRET_KEY") 
                ?? _configuration["R2Settings:SecretKey"] 
                ?? _configuration["CloudflareR2:SecretKey"];
            
            _bucketName = Environment.GetEnvironmentVariable("R2_BUCKET_NAME") 
                ?? _configuration["R2Settings:BucketName"] 
                ?? _configuration["CloudflareR2:BucketName"] 
                ?? "hexabill-uploads";
            
            _publicUrlBase = Environment.GetEnvironmentVariable("R2_PUBLIC_URL") 
                ?? _configuration["R2Settings:PublicUrl"] 
                ?? _configuration["CloudflareR2:PublicUrl"] 
                ?? "";

            // Only enable R2 if credentials are provided
            _isEnabled = !string.IsNullOrWhiteSpace(r2Endpoint) 
                        && !string.IsNullOrWhiteSpace(r2AccessKey) 
                        && !string.IsNullOrWhiteSpace(r2SecretKey);

            if (_isEnabled)
            {
                // Configure S3 client for Cloudflare R2 (S3-compatible API)
                var config = new AmazonS3Config
                {
                    ServiceURL = r2Endpoint, // R2 endpoint (e.g., https://<account-id>.r2.cloudflarestorage.com)
                    ForcePathStyle = true, // R2 requires path-style URLs
                    RegionEndpoint = Amazon.RegionEndpoint.USEast1 // Dummy region, R2 doesn't use AWS regions
                };

                _s3Client = new AmazonS3Client(r2AccessKey, r2SecretKey, config);
            }
            else
            {
                _s3Client = null!; // Will be null if R2 is not configured
            }
        }

        private string GetS3Key(string relativePath)
        {
            // Remove leading slash if present, ensure consistent key format
            return relativePath.TrimStart('/');
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

            var fileName = $"logo_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
            var relativePath = $"{tenantId}/{fileName}";
            var s3Key = GetS3Key(relativePath);

            if (_isEnabled)
            {
                // Upload to R2
                using (var stream = new MemoryStream())
                {
                    await file.CopyToAsync(stream);
                    stream.Position = 0;

                    var putRequest = new PutObjectRequest
                    {
                        BucketName = _bucketName,
                        Key = s3Key,
                        InputStream = stream,
                        ContentType = file.ContentType,
                        CannedACL = S3CannedACL.PublicRead // Make files publicly readable
                    };

                    await _s3Client.PutObjectAsync(putRequest);
                }
            }
            else
            {
                throw new InvalidOperationException("R2 storage is not configured. Please set R2_ENDPOINT, R2_ACCESS_KEY, and R2_SECRET_KEY environment variables.");
            }

            // Save logo path to settings with TenantId filter
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
                // Delete old logo from R2 if exists
                if (!string.IsNullOrEmpty(setting.Value))
                {
                    await DeleteFileAsync(setting.Value);
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

            var allowedTypes = new[] { 
                "image/jpeg", "image/png", "image/gif", 
                "application/pdf", 
                "application/msword", 
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
            };
            if (!allowedTypes.Contains(file.ContentType.ToLower()))
                throw new ArgumentException("Invalid file type. Only images and documents are allowed.");

            if (file.Length > 10 * 1024 * 1024)
                throw new ArgumentException("File size too large. Maximum 10MB allowed.");

            var fileName = $"invoice_{purchaseId}_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
            var relativePath = $"{tenantId}/{fileName}";
            var s3Key = GetS3Key(relativePath);

            if (_isEnabled)
            {
                using (var stream = new MemoryStream())
                {
                    await file.CopyToAsync(stream);
                    stream.Position = 0;

                    var putRequest = new PutObjectRequest
                    {
                        BucketName = _bucketName,
                        Key = s3Key,
                        InputStream = stream,
                        ContentType = file.ContentType,
                        CannedACL = S3CannedACL.PublicRead
                    };

                    await _s3Client.PutObjectAsync(putRequest);
                }
            }
            else
            {
                throw new InvalidOperationException("R2 storage is not configured.");
            }

            return relativePath;
        }

        public async Task<string> UploadProductImageAsync(IFormFile file, int productId, int tenantId)
        {
            if (file == null || file.Length == 0)
                throw new ArgumentException("No file provided");

            var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
            if (!allowedTypes.Contains(file.ContentType.ToLower()))
                throw new ArgumentException("Invalid file type. Only images (JPEG, PNG, GIF, WebP) are allowed.");

            if (file.Length > 5 * 1024 * 1024)
                throw new ArgumentException("File size too large. Maximum 5MB allowed.");

            var fileName = $"product_{productId}_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
            var relativePath = $"{tenantId}/products/{fileName}";
            var s3Key = GetS3Key(relativePath);

            if (_isEnabled)
            {
                using (var stream = new MemoryStream())
                {
                    await file.CopyToAsync(stream);
                    stream.Position = 0;

                    var putRequest = new PutObjectRequest
                    {
                        BucketName = _bucketName,
                        Key = s3Key,
                        InputStream = stream,
                        ContentType = file.ContentType,
                        CannedACL = S3CannedACL.PublicRead
                    };

                    await _s3Client.PutObjectAsync(putRequest);
                }
            }
            else
            {
                throw new InvalidOperationException("R2 storage is not configured.");
            }

            return relativePath;
        }

        public async Task<string> UploadProfilePhotoAsync(IFormFile file, int userId, int tenantId)
        {
            if (file == null || file.Length == 0)
                throw new ArgumentException("No file provided");

            var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
            if (!allowedTypes.Contains(file.ContentType.ToLower()))
                throw new ArgumentException("Invalid file type. Only images (JPEG, PNG, GIF, WebP) are allowed.");

            if (file.Length > 2 * 1024 * 1024)
                throw new ArgumentException("File size too large. Maximum 2MB allowed.");

            var fileName = $"profile_{userId}_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
            var relativePath = $"{tenantId}/profiles/{fileName}";
            var s3Key = GetS3Key(relativePath);

            if (_isEnabled)
            {
                using (var stream = new MemoryStream())
                {
                    await file.CopyToAsync(stream);
                    stream.Position = 0;

                    var putRequest = new PutObjectRequest
                    {
                        BucketName = _bucketName,
                        Key = s3Key,
                        InputStream = stream,
                        ContentType = file.ContentType,
                        CannedACL = S3CannedACL.PublicRead
                    };

                    await _s3Client.PutObjectAsync(putRequest);
                }
            }
            else
            {
                throw new InvalidOperationException("R2 storage is not configured.");
            }

            return relativePath;
        }

        public async Task<bool> DeleteFileAsync(string filePath)
        {
            if (string.IsNullOrEmpty(filePath))
                return false;

            if (!_isEnabled)
                return false;

            try
            {
                var s3Key = GetS3Key(filePath);
                var deleteRequest = new DeleteObjectRequest
                {
                    BucketName = _bucketName,
                    Key = s3Key
                };

                await _s3Client.DeleteObjectAsync(deleteRequest);
                return true;
            }
            catch
            {
                return false;
            }
        }

        public Task<string> GetFileUrlAsync(string filePath)
        {
            if (string.IsNullOrEmpty(filePath))
                return Task.FromResult(string.Empty);

            if (!_isEnabled)
                return Task.FromResult(string.Empty);

            // If public URL base is configured, use it; otherwise construct from bucket name
            if (!string.IsNullOrWhiteSpace(_publicUrlBase))
            {
                var s3Key = GetS3Key(filePath);
                var url = _publicUrlBase.EndsWith("/") 
                    ? $"{_publicUrlBase}{s3Key}" 
                    : $"{_publicUrlBase}/{s3Key}";
                return Task.FromResult(url);
            }
            else
            {
                // Fallback: construct URL from bucket name (requires custom domain setup)
                var s3Key = GetS3Key(filePath);
                var url = $"https://{_bucketName}.r2.cloudflarestorage.com/{s3Key}";
                return Task.FromResult(url);
            }
        }

        public async Task<List<string>> GetUploadedFilesAsync(int tenantId)
        {
            var files = new List<string>();

            if (!_isEnabled)
                return files;

            try
            {
                var prefix = $"{tenantId}/";
                var listRequest = new ListObjectsV2Request
                {
                    BucketName = _bucketName,
                    Prefix = prefix
                };

                var response = await _s3Client.ListObjectsV2Async(listRequest);
                files.AddRange(response.S3Objects.Select(obj => obj.Key));
            }
            catch
            {
                // Return empty list on error
            }

            return files;
        }
    }
}
