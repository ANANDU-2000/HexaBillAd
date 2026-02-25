/*
Purpose: Purchases controller for supplier purchase management
Author: AI Assistant
Date: 2024
*/
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Modules.Purchases;
using HexaBill.Api.Models;
using HexaBill.Api.Data;
using HexaBill.Api.Shared.Extensions;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Modules.Purchases
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class PurchasesController : TenantScopedController // MULTI-TENANT: Owner-scoped purchases
    {
        private readonly IPurchaseService _purchaseService;
        private readonly AppDbContext _context;
        private readonly ILogger<PurchasesController> _logger;

        public PurchasesController(IPurchaseService purchaseService, AppDbContext context, ILogger<PurchasesController> logger)
        {
            _purchaseService = purchaseService;
            _context = context;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<PagedResponse<PurchaseDto>>>> GetPurchases(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] string? supplierName = null,
            [FromQuery] string? category = null)
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                var result = await _purchaseService.GetPurchasesAsync(tenantId, page, pageSize, startDate, endDate, supplierName, category);
                return Ok(new ApiResponse<PagedResponse<PurchaseDto>>
                {
                    Success = true,
                    Message = "Purchases retrieved successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<PagedResponse<PurchaseDto>>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<PurchaseDto>>> GetPurchase(int id)
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                var result = await _purchaseService.GetPurchaseByIdAsync(id, tenantId);
                if (result == null)
                {
                    return NotFound(new ApiResponse<PurchaseDto>
                    {
                        Success = false,
                        Message = "Purchase not found"
                    });
                }

                return Ok(new ApiResponse<PurchaseDto>
                {
                    Success = true,
                    Message = "Purchase retrieved successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<PurchaseDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<PurchaseDto>>> CreatePurchase([FromBody] CreatePurchaseRequest request)
        {
            try
            {
                // Validate request
                if (request == null)
                {
                    return BadRequest(new ApiResponse<PurchaseDto>
                    {
                        Success = false,
                        Message = "Request body is required"
                    });
                }

                if (string.IsNullOrWhiteSpace(request.SupplierName))
                {
                    return BadRequest(new ApiResponse<PurchaseDto>
                    {
                        Success = false,
                        Message = "Supplier name is required"
                    });
                }

                if (string.IsNullOrWhiteSpace(request.InvoiceNo))
                {
                    return BadRequest(new ApiResponse<PurchaseDto>
                    {
                        Success = false,
                        Message = "Invoice number is required"
                    });
                }

                if (request.Items == null || !request.Items.Any())
                {
                    return BadRequest(new ApiResponse<PurchaseDto>
                    {
                        Success = false,
                        Message = "Purchase must have at least one item"
                    });
                }

                // Validate each item
                foreach (var item in request.Items)
                {
                    if (item.ProductId <= 0)
                    {
                        return BadRequest(new ApiResponse<PurchaseDto>
                        {
                            Success = false,
                            Message = "Invalid product ID"
                        });
                    }

                    if (item.Qty <= 0)
                    {
                        return BadRequest(new ApiResponse<PurchaseDto>
                        {
                            Success = false,
                            Message = "Quantity must be greater than zero"
                        });
                    }

                    if (item.UnitCost < 0)
                    {
                        return BadRequest(new ApiResponse<PurchaseDto>
                        {
                            Success = false,
                            Message = "Unit cost cannot be negative"
                        });
                    }

                    if (string.IsNullOrWhiteSpace(item.UnitType))
                    {
                        return BadRequest(new ApiResponse<PurchaseDto>
                        {
                            Success = false,
                            Message = "Unit type is required"
                        });
                    }
                }

                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                {
                    return Unauthorized(new ApiResponse<PurchaseDto>
                    {
                        Success = false,
                        Message = "Invalid user authentication"
                    });
                }

                // Service already uses transaction, no need for nested transaction here
                _logger.LogInformation("?? Creating purchase for supplier: {Supplier}, Invoice: {Invoice}", 
                    request.SupplierName, request.InvoiceNo);

                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                var result = await _purchaseService.CreatePurchaseAsync(request, userId, tenantId);
                
                _logger.LogInformation("? Purchase created successfully: ID {Id}, Invoice {Invoice}", 
                    result.Id, result.InvoiceNo);

                return CreatedAtAction(nameof(GetPurchase), new { id = result.Id }, new ApiResponse<PurchaseDto>
                {
                    Success = true,
                    Message = "Purchase created successfully",
                    Data = result
                });
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning(ex, "?? Purchase creation conflict: {Message}", ex.Message);
                return Conflict(new ApiResponse<PurchaseDto>
                {
                    Success = false,
                    Message = ex.Message,
                    Errors = new List<string> { ex.Message }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Purchase creation error: {Message}", ex.Message);
                var err = ex;
                while (err?.InnerException != null) err = err.InnerException;
                var userMessage = err?.Message ?? ex.Message;
                if (userMessage.Contains("UNIQUE constraint") || userMessage.Contains("duplicate key"))
                    userMessage = "Invoice number already exists. Use a different invoice number.";
                return StatusCode(500, new ApiResponse<PurchaseDto>
                {
                    Success = false,
                    Message = userMessage,
                    Errors = new List<string> { userMessage }
                });
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<PurchaseDto>>> UpdatePurchase(int id, [FromBody] CreatePurchaseRequest request)
        {
            try
            {
                // Validate request (same as create)
                if (request == null)
                {
                    return BadRequest(new ApiResponse<PurchaseDto>
                    {
                        Success = false,
                        Message = "Request body is required"
                    });
                }

                if (string.IsNullOrWhiteSpace(request.SupplierName))
                {
                    return BadRequest(new ApiResponse<PurchaseDto>
                    {
                        Success = false,
                        Message = "Supplier name is required"
                    });
                }

                if (request.Items == null || !request.Items.Any())
                {
                    return BadRequest(new ApiResponse<PurchaseDto>
                    {
                        Success = false,
                        Message = "Purchase must have at least one item"
                    });
                }

                // Validate each item
                foreach (var item in request.Items)
                {
                    if (item.ProductId <= 0)
                    {
                        return BadRequest(new ApiResponse<PurchaseDto>
                        {
                            Success = false,
                            Message = "Invalid product ID"
                        });
                    }

                    if (item.Qty <= 0)
                    {
                        return BadRequest(new ApiResponse<PurchaseDto>
                        {
                            Success = false,
                            Message = "Quantity must be greater than zero"
                        });
                    }

                    if (item.UnitCost < 0)
                    {
                        return BadRequest(new ApiResponse<PurchaseDto>
                        {
                            Success = false,
                            Message = "Unit cost cannot be negative"
                        });
                    }

                    if (string.IsNullOrWhiteSpace(item.UnitType))
                    {
                        return BadRequest(new ApiResponse<PurchaseDto>
                        {
                            Success = false,
                            Message = "Unit type is required"
                        });
                    }
                }

                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                {
                    return Unauthorized(new ApiResponse<PurchaseDto>
                    {
                        Success = false,
                        Message = "Invalid user authentication"
                    });
                }

                _logger.LogInformation("?? Updating purchase ID: {Id}", id);

                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                var result = await _purchaseService.UpdatePurchaseAsync(id, request, userId, tenantId);
                
                if (result == null)
                {
                    return NotFound(new ApiResponse<PurchaseDto>
                    {
                        Success = false,
                        Message = "Purchase not found"
                    });
                }

                _logger.LogInformation("? Purchase updated successfully: ID {Id}", id);

                return Ok(new ApiResponse<PurchaseDto>
                {
                    Success = true,
                    Message = "Purchase updated successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "? Purchase update error: {Message}", ex.Message);
                return StatusCode(500, new ApiResponse<PurchaseDto>
                {
                    Success = false,
                    Message = "Purchase update failed. Please try again.",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,Owner")]
        public async Task<ActionResult<ApiResponse<object>>> DeletePurchase(int id)
        {
            try
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                {
                    return Unauthorized(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Invalid user authentication"
                    });
                }

                // Check if purchase exists first
                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                var purchase = await _purchaseService.GetPurchaseByIdAsync(id, tenantId);
                if (purchase == null)
                {
                    return NotFound(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Purchase not found"
                    });
                }

                _logger.LogInformation("??? Deleting purchase ID: {Id}, Invoice: {Invoice}", id, purchase.InvoiceNo);

                var result = await _purchaseService.DeletePurchaseAsync(id, userId, tenantId);
                
                if (!result)
                {
                    return NotFound(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Purchase not found or already deleted"
                    });
                }

                _logger.LogInformation("? Purchase deleted successfully: ID {Id}", id);

                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = "Purchase deleted successfully. Stock quantities have been reversed.",
                    Data = new 
                    { 
                        DeletedPurchaseId = id,
                        InvoiceNo = purchase.InvoiceNo,
                        Supplier = purchase.SupplierName,
                        ItemsCount = purchase.Items?.Count ?? 0
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "? Purchase deletion error: {Message}", ex.Message);
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "Failed to delete purchase. Please try again.",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost("{id}/upload")]
        [Authorize(Roles = "Admin,Staff")]
        public async Task<ActionResult<ApiResponse<string>>> UploadInvoice(int id, IFormFile file)
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

                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                var purchase = await _purchaseService.GetPurchaseByIdAsync(id, tenantId);
                if (purchase == null)
                {
                    return NotFound(new ApiResponse<string>
                    {
                        Success = false,
                        Message = "Purchase not found"
                    });
                }

                // Validate file type
                var allowedExtensions = new[] { ".pdf", ".jpg", ".jpeg", ".png" };
                var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
                if (!allowedExtensions.Contains(fileExtension))
                {
                    return BadRequest(new ApiResponse<string>
                    {
                        Success = false,
                        Message = "Invalid file type. Allowed: PDF, JPG, PNG"
                    });
                }

                // PROD-17: Use tenant-specific directory for file isolation
                var baseDir = Path.Combine(Directory.GetCurrentDirectory(), "storage", "purchases");
                var tenantDir = Path.Combine(baseDir, tenantId.ToString());
                if (!Directory.Exists(tenantDir))
                {
                    Directory.CreateDirectory(tenantDir);
                }

                // Generate unique filename
                var fileName = $"{id}_{Guid.NewGuid()}{fileExtension}";
                var filePath = Path.Combine(tenantDir, fileName);

                // Save file
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                // Update purchase record
                // PROD-4: Filter by TenantId for tenant isolation
                var purchaseEntity = await _context.Purchases
                    .FirstOrDefaultAsync(p => p.Id == id && p.TenantId == tenantId);
                if (purchaseEntity != null)
                {
                    purchaseEntity.InvoiceFileName = file.FileName;
                    // PROD-17: Include tenant ID in file path for isolation
                    purchaseEntity.InvoiceFilePath = $"storage/purchases/{tenantId}/{fileName}";
                    await _context.SaveChangesAsync();
                }

                return Ok(new ApiResponse<string>
                {
                    Success = true,
                    Message = "Invoice uploaded successfully",
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

        [HttpGet("{id}/invoice")]
        [Authorize]
        public async Task<IActionResult> DownloadInvoice(int id)
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                var purchase = await _purchaseService.GetPurchaseByIdAsync(id, tenantId);
                if (purchase == null)
                {
                    return NotFound();
                }

                // PROD-4: Filter by TenantId for tenant isolation
                var purchaseEntity = await _context.Purchases
                    .FirstOrDefaultAsync(p => p.Id == id && p.TenantId == tenantId);
                if (purchaseEntity == null || string.IsNullOrEmpty(purchaseEntity.InvoiceFilePath))
                {
                    return NotFound();
                }

                // PROD-17: Validate file path contains tenant ID to prevent cross-tenant access
                var invoiceFilePath = purchaseEntity.InvoiceFilePath;
                if (!invoiceFilePath.Contains($"/{tenantId}/") && !invoiceFilePath.Contains($"\\{tenantId}\\"))
                {
                    // Security check: File path must contain tenant ID
                    return Forbid("Access denied: Invalid file path");
                }

                var filePath = Path.Combine(Directory.GetCurrentDirectory(), invoiceFilePath);
                
                // PROD-17: Additional security check - verify file path is within expected directory
                var expectedBaseDir = Path.Combine(Directory.GetCurrentDirectory(), "storage", "purchases", tenantId.ToString());
                if (!filePath.StartsWith(expectedBaseDir, StringComparison.OrdinalIgnoreCase))
                {
                    return Forbid("Access denied: File path outside tenant directory");
                }

                if (!System.IO.File.Exists(filePath))
                {
                    return NotFound();
                }

                var fileBytes = await System.IO.File.ReadAllBytesAsync(filePath);
                var contentType = purchaseEntity.InvoiceFileName?.EndsWith(".pdf") == true 
                    ? "application/pdf" 
                    : "image/jpeg";

                return File(fileBytes, contentType, purchaseEntity.InvoiceFileName ?? "invoice");
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        [HttpGet("analytics")]
        [Authorize]
        public async Task<ActionResult<ApiResponse<object>>> GetPurchaseAnalytics(
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null)
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Multi-tenant data isolation
                var result = await _purchaseService.GetPurchaseAnalyticsAsync(tenantId, startDate, endDate);
                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = "Analytics retrieved successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "? Analytics retrieval error: {Message}", ex.Message);
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "Failed to retrieve analytics",
                    Errors = new List<string> { ex.Message }
                });
            }
        }
    }
}

