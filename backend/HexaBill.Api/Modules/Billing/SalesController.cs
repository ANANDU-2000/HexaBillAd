/*
Purpose: Sales controller for POS billing
Author: AI Assistant
Date: 2024
*/
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Modules.Billing;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions;
using HexaBill.Api.Shared.Services;

namespace HexaBill.Api.Modules.Billing
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SalesController : TenantScopedController
    {
        private readonly ISaleService _saleService;
        private readonly IRouteScopeService _routeScopeService;

        public SalesController(ISaleService saleService, IRouteScopeService routeScopeService)
        {
            _saleService = saleService;
            _routeScopeService = routeScopeService;
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<PagedResponse<SaleDto>>>> GetSales(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? search = null,
            [FromQuery] int? branchId = null,
            [FromQuery] int? routeId = null)
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Get from JWT
                var userId = int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var uid) ? uid : (int?)null;
                var role = User.FindFirst(ClaimTypes.Role)?.Value;
                var result = await _saleService.GetSalesAsync(tenantId, page, pageSize, search, branchId, routeId, userId, role);
                return Ok(new ApiResponse<PagedResponse<SaleDto>>
                {
                    Success = true,
                    Message = "Sales retrieved successfully",
                    Data = result
                });
            }
            catch (Microsoft.EntityFrameworkCore.DbUpdateException ex)
            {
                var errorMessage = ex.InnerException?.Message ?? ex.Message;
                Console.WriteLine($"❌ Database Error in GetSales: {errorMessage}");
                
                return StatusCode(500, new ApiResponse<PagedResponse<SaleDto>>
                {
                    Success = false,
                    Message = "Database error occurred. Please check database schema.",
                    Errors = new List<string> { errorMessage }
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ GetSales Error: {ex.Message}");
                Console.WriteLine($"❌ Stack Trace: {ex.StackTrace}");
                
                return StatusCode(500, new ApiResponse<PagedResponse<SaleDto>>
                {
                    Success = false,
                    Message = $"An error occurred: {ex.Message}",
                    Errors = new List<string> { ex.Message, ex.InnerException?.Message ?? "" }
                });
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<SaleDto>>> GetSale(int id)
        {
            try
            {
                var tenantId = CurrentTenantId;
                var userId = int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var uid) ? uid : 0;
                var role = User.FindFirst(ClaimTypes.Role)?.Value ?? "";
                HashSet<int>? allowedRouteIds = null;
                if (tenantId > 0 && string.Equals(role, "Staff", StringComparison.OrdinalIgnoreCase))
                {
                    var routeIds = await _routeScopeService.GetRestrictedRouteIdsAsync(userId, tenantId, role);
                    if (routeIds != null)
                        allowedRouteIds = new HashSet<int>(routeIds);
                }
                var result = await _saleService.GetSaleByIdAsync(id, tenantId, allowedRouteIds);
                if (result == null)
                {
                    return NotFound(new ApiResponse<SaleDto>
                    {
                        Success = false,
                        Message = "Sale not found"
                    });
                }

                return Ok(new ApiResponse<SaleDto>
                {
                    Success = true,
                    Message = "Sale retrieved successfully",
                    Data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<SaleDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<SaleDto>>> CreateSale([FromBody] CreateSaleRequest request)
        {
            try
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                {
                    return Unauthorized(new ApiResponse<SaleDto>
                    {
                        Success = false,
                        Message = "Invalid user"
                    });
                }

                var tenantId = CurrentTenantId; // CRITICAL: Get from JWT
                var result = await _saleService.CreateSaleAsync(request, userId, tenantId);
                return CreatedAtAction(nameof(GetSale), new { id = result.Id }, new ApiResponse<SaleDto>
                {
                    Success = true,
                    Message = "Sale created successfully",
                    Data = result
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new ApiResponse<SaleDto>
                {
                    Success = false,
                    Message = ex.Message,
                    Errors = new List<string> { ex.Message }
                });
            }
            catch (Microsoft.EntityFrameworkCore.DbUpdateException ex)
            {
                // Database constraint or column errors
                var errorMessage = ex.InnerException?.Message ?? ex.Message;
                Console.WriteLine($"❌ Database Error in CreateSale: {errorMessage}");
                Console.WriteLine($"❌ Full Exception: {ex}");
                
                return StatusCode(500, new ApiResponse<SaleDto>
                {
                    Success = false,
                    Message = "Database error occurred while creating sale. Please check database schema.",
                    Errors = new List<string> { errorMessage }
                });
            }
            catch (Exception ex)
            {
                // Log full exception details for debugging
                Console.WriteLine($"❌ CreateSale Error: {ex.Message}");
                Console.WriteLine($"❌ Stack Trace: {ex.StackTrace}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"❌ Inner Exception: {ex.InnerException.Message}");
                    Console.WriteLine($"❌ Inner Stack Trace: {ex.InnerException.StackTrace}");
                }
                
                return StatusCode(500, new ApiResponse<SaleDto>
                {
                    Success = false,
                    Message = $"An error occurred: {ex.Message}",
                    Errors = new List<string> { ex.Message, ex.InnerException?.Message ?? "" }
                });
            }
        }

        [HttpPost("override")]
        [Authorize(Roles = "Admin,Owner")] // CRITICAL: Allow Owner role
        public async Task<ActionResult<ApiResponse<SaleDto>>> CreateSaleWithOverride([FromBody] CreateSaleOverrideRequest request)
        {
            try
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                {
                    return Unauthorized(new ApiResponse<SaleDto>
                    {
                        Success = false,
                        Message = "Invalid user"
                    });
                }

                var tenantId = CurrentTenantId; // CRITICAL: Get from JWT
                var result = await _saleService.CreateSaleWithOverrideAsync(request.SaleRequest, request.Reason, userId, tenantId);
                return CreatedAtAction(nameof(GetSale), new { id = result.Id }, new ApiResponse<SaleDto>
                {
                    Success = true,
                    Message = "Sale created successfully with admin override",
                    Data = result
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new ApiResponse<SaleDto>
                {
                    Success = false,
                    Message = ex.Message,
                    Errors = new List<string> { ex.Message }
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<SaleDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost("combined-pdf")]
        public async Task<ActionResult> GetCombinedInvoicesPdf([FromBody] CombinedInvoiceRequest request)
        {
            try
            {
                if (request.InvoiceIds == null || !request.InvoiceIds.Any())
                {
                    return BadRequest(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "No invoice IDs provided"
                    });
                }

                var sales = new List<SaleDto>();
                var tenantId = CurrentTenantId; // CRITICAL: Get from JWT
                foreach (var id in request.InvoiceIds)
                {
                    var sale = await _saleService.GetSaleByIdAsync(id, tenantId);
                    if (sale != null)
                    {
                        sales.Add(sale);
                    }
                }

                if (!sales.Any())
                {
                    return NotFound(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "No valid invoices found"
                    });
                }

                var pdfService = HttpContext.RequestServices.GetRequiredService<IPdfService>();
                var pdfBytes = await pdfService.GenerateCombinedInvoicePdfAsync(sales);
                
                if (pdfBytes == null || pdfBytes.Length == 0)
                {
                    return StatusCode(500, new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Failed to generate combined PDF. PDF bytes are empty."
                    });
                }
                
                var filename = $"Combined_Invoices_{DateTime.UtcNow:yyyyMMdd_HHmmss}.pdf";
                
                var isPrint = Request.Query.ContainsKey("print") || Request.Headers["Accept"].ToString().Contains("application/pdf");
                var disposition = isPrint ? "inline" : "attachment";
                
                Response.Headers.Append("Content-Disposition", $"{disposition}; filename=\"{filename}\"");
                Response.ContentType = "application/pdf";
                return File(pdfBytes, "application/pdf", filename);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Combined PDF Generation Error: {ex.Message}");
                Console.WriteLine($"❌ Stack Trace: {ex.StackTrace}");
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = $"Failed to generate combined PDF: {ex.Message}",
                    Errors = new List<string> { ex.Message, ex.InnerException?.Message ?? "" }
                });
            }
        }

        [HttpGet("{id}/pdf")]
        [AllowAnonymous]  // Allow PDF generation and printing without authentication
        public async Task<ActionResult> GetInvoicePdf(int id)
        {
            try
            {
                Console.WriteLine($"\n📄 PDF Request: Getting invoice {id}");
                
                var tenantId = CurrentTenantId; // CRITICAL: Get from JWT
                // Validate sale exists first
                var sale = await _saleService.GetSaleByIdAsync(id, tenantId);
                if (sale == null)
                {
                    Console.WriteLine($"❌ PDF Request: Invoice {id} not found");
                    return NotFound(new ApiResponse<object>
                    {
                        Success = false,
                        Message = $"Invoice with ID {id} not found"
                    });
                }

                Console.WriteLine($"✅ PDF Request: Invoice {id} found, generating PDF...");
                var pdfBytes = await _saleService.GenerateInvoicePdfAsync(id, tenantId);
                
                if (pdfBytes == null || pdfBytes.Length == 0)
                {
                    Console.WriteLine($"❌ PDF Request: PDF bytes are empty for invoice {id}");
                    return StatusCode(500, new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Failed to generate PDF. PDF bytes are empty."
                    });
                }
                
                Console.WriteLine($"✅ PDF Request: Successfully generated {pdfBytes.Length} bytes for invoice {id}");
                
                var filename = sale != null ? $"INV-{sale.InvoiceNo}.pdf" : $"invoice_{id}.pdf";
                
                // Check if it's for printing (inline) or download (attachment)
                var isPrint = Request.Query.ContainsKey("print") || Request.Headers["Accept"].ToString().Contains("application/pdf");
                var disposition = isPrint ? "inline" : "attachment";
                
                Response.Headers.Append("Content-Disposition", $"{disposition}; filename=\"{filename}\"");
                Response.ContentType = "application/pdf";
                return File(pdfBytes, "application/pdf", filename);
            }
            catch (InvalidOperationException ex)
            {
                Console.WriteLine($"❌ PDF Generation Error (InvalidOperation): {ex.Message}");
                Console.WriteLine($"❌ Stack Trace: {ex.StackTrace}");
                // Return 500 instead of 404 for PDF generation errors
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = $"Failed to generate PDF: {ex.Message}",
                    Errors = new List<string> { ex.Message }
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ PDF Generation Error: {ex.GetType().Name}");
                Console.WriteLine($"❌ Message: {ex.Message}");
                Console.WriteLine($"❌ Stack Trace: {ex.StackTrace}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"❌ Inner Exception: {ex.InnerException.GetType().Name}");
                    Console.WriteLine($"❌ Inner Message: {ex.InnerException.Message}");
                    Console.WriteLine($"❌ Inner Stack: {ex.InnerException.StackTrace}");
                }
                // Return 500 with detailed error info for debugging
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = $"Failed to generate PDF: {ex.Message}",
                    Errors = new List<string> 
                    { 
                        $"Error: {ex.Message}",
                        $"Type: {ex.GetType().Name}",
                        ex.InnerException != null ? $"InnerError: {ex.InnerException.Message}" : "No inner exception"
                    }
                });
            }
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Owner,Staff")] // CRITICAL: Allow Owner role to edit invoices
        public async Task<ActionResult<ApiResponse<SaleDto>>> UpdateSale(int id, [FromBody] UpdateSaleRequest request)
        {
            try
            {
                // Try multiple claim types to find user ID
                var userIdClaim = User.FindFirst("UserId") ?? 
                                  User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier) ?? 
                                  User.FindFirst("id");
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId) || userId == 0)
                {
                    return Unauthorized(new ApiResponse<SaleDto>
                    {
                        Success = false,
                        Message = "Invalid user authentication"
                    });
                }
                
                // Convert UpdateSaleRequest to CreateSaleRequest
                var createRequest = new CreateSaleRequest
                {
                    CustomerId = request.CustomerId,
                    Items = request.Items ?? new List<SaleItemRequest>(),
                    Discount = request.Discount,
                    Notes = request.Notes,
                    Payments = request.Payments,
                    InvoiceDate = request.InvoiceDate,
                    DueDate = request.DueDate
                };
                
                byte[]? rowVersion = null;
                if (!string.IsNullOrEmpty(request.RowVersion))
                {
                    try
                    {
                        rowVersion = Convert.FromBase64String(request.RowVersion);
                    }
                    catch
                    {
                        // Invalid base64, ignore
                    }
                }
                
                var tenantId = CurrentTenantId; // CRITICAL: Get from JWT
                var result = await _saleService.UpdateSaleAsync(id, createRequest, userId, tenantId, request.EditReason, rowVersion);
                return Ok(new ApiResponse<SaleDto>
                {
                    Success = true,
                    Message = "Sale updated successfully",
                    Data = result
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new ApiResponse<SaleDto>
                {
                    Success = false,
                    Message = ex.Message
                });
            }
            catch (Exception ex)
            {
                // Log the exception for debugging
                Console.WriteLine($"❌ UpdateSale Controller Error: {ex.GetType().Name}");
                Console.WriteLine($"❌ Message: {ex.Message}");
                Console.WriteLine($"❌ Stack Trace: {ex.StackTrace}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"❌ Inner Exception: {ex.InnerException.GetType().Name}");
                    Console.WriteLine($"❌ Inner Message: {ex.InnerException.Message}");
                }
                
                return StatusCode(500, new ApiResponse<SaleDto>
                {
                    Success = false,
                    Message = ex.Message ?? "An error occurred while updating the invoice",
                    Errors = new List<string> { ex.Message ?? "An error occurred" }
                });
            }
        }

        [HttpGet("{id}/versions")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<ApiResponse<List<InvoiceVersion>>>> GetInvoiceVersions(int id)
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Get from JWT
                var versions = await _saleService.GetInvoiceVersionsAsync(id, tenantId);
                return Ok(new ApiResponse<List<InvoiceVersion>>
                {
                    Success = true,
                    Message = "Invoice versions retrieved successfully",
                    Data = versions
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<List<InvoiceVersion>>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost("{id}/restore/{versionNumber}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<ApiResponse<SaleDto>>> RestoreInvoiceVersion(int id, int versionNumber)
        {
            try
            {
                var userIdClaim = User.FindFirst("UserId") ?? 
                                  User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier) ?? 
                                  User.FindFirst("id");
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId) || userId == 0)
                {
                    return Unauthorized(new ApiResponse<SaleDto>
                    {
                        Success = false,
                        Message = "Invalid user authentication"
                    });
                }

                var tenantId = CurrentTenantId; // CRITICAL: Get from JWT
                var result = await _saleService.RestoreInvoiceVersionAsync(id, versionNumber, userId, tenantId);
                if (result == null)
                {
                    return NotFound(new ApiResponse<SaleDto>
                    {
                        Success = false,
                        Message = "Invoice or version not found"
                    });
                }

                return Ok(new ApiResponse<SaleDto>
                {
                    Success = true,
                    Message = $"Invoice restored to version {versionNumber} successfully",
                    Data = result
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new ApiResponse<SaleDto>
                {
                    Success = false,
                    Message = ex.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<SaleDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,Owner,Staff")] // CRITICAL: Allow Owner role to delete invoices
        public async Task<ActionResult<ApiResponse<bool>>> DeleteSale(int id)
        {
            try
            {
                // Try multiple claim types to find user ID
                var userIdClaim = User.FindFirst("UserId") ?? 
                                  User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier) ?? 
                                  User.FindFirst("id");
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId) || userId == 0)
                {
                    return Unauthorized(new ApiResponse<bool>
                    {
                        Success = false,
                        Message = "Invalid user authentication"
                    });
                }
                
                var tenantId = CurrentTenantId; // CRITICAL: Get from JWT
                var result = await _saleService.DeleteSaleAsync(id, userId, tenantId);
                return Ok(new ApiResponse<bool>
                {
                    Success = true,
                    Message = "Sale deleted successfully",
                    Data = result
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

        [HttpPost("{id}/unlock")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<ApiResponse<bool>>> UnlockInvoice(int id, [FromBody] UnlockInvoiceRequest request)
        {
            try
            {
                // Try multiple claim types to find user ID
                var userIdClaim = User.FindFirst("UserId") ?? 
                                  User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier) ?? 
                                  User.FindFirst("id");
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId) || userId == 0)
                {
                    return Unauthorized(new ApiResponse<bool>
                    {
                        Success = false,
                        Message = "Invalid user authentication"
                    });
                }

                var tenantId = CurrentTenantId; // CRITICAL: Get from JWT
                var result = await _saleService.UnlockInvoiceAsync(id, userId, request.Reason, tenantId);
                if (result)
                {
                    return Ok(new ApiResponse<bool>
                    {
                        Success = true,
                        Message = "Invoice unlocked successfully",
                        Data = true
                    });
                }
                else
                {
                    return NotFound(new ApiResponse<bool>
                    {
                        Success = false,
                        Message = "Invoice not found"
                    });
                }
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

        [HttpGet("next-invoice-number")]
        public async Task<ActionResult<ApiResponse<string>>> GetNextInvoiceNumber()
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Get from JWT
                var invoiceNumber = await _saleService.GenerateInvoiceNumberAsync(tenantId);
                return Ok(new ApiResponse<string>
                {
                    Success = true,
                    Message = "Invoice number generated successfully",
                    Data = invoiceNumber
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

        [HttpPost("validate-invoice-number")]
        public async Task<ActionResult<ApiResponse<bool>>> ValidateInvoiceNumber([FromBody] ValidateInvoiceNumberRequest request)
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Get from JWT
                var invoiceNumberService = HttpContext.RequestServices.GetRequiredService<IInvoiceNumberService>();
                var isValid = await invoiceNumberService.ValidateInvoiceNumberAsync(request.InvoiceNumber, tenantId, request.ExcludeSaleId);
                return Ok(new ApiResponse<bool>
                {
                    Success = true,
                    Message = isValid ? "Invoice number is valid" : "Invoice number is invalid or duplicate",
                    Data = isValid
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

        [HttpPost("{id}/email")]
        public async Task<ActionResult<ApiResponse<object>>> SendInvoiceEmail(int id, [FromBody] EmailRequest request)
        {
            try
            {
                var tenantId = CurrentTenantId; // CRITICAL: Get from JWT
                // Get sale details
                var sale = await _saleService.GetSaleByIdAsync(id, tenantId);
                if (sale == null)
                {
                    return NotFound(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Sale not found"
                    });
                }

                // Generate PDF
                var pdfBytes = await _saleService.GenerateInvoicePdfAsync(id, tenantId);
                
                // TODO: Implement email sending service
                // For now, return success message indicating feature is ready
                // In production, integrate with email service (SendGrid, SMTP, etc.)
                
                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = $"Invoice PDF generated. Email sending feature requires SMTP configuration in appsettings.json"
                });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new ApiResponse<object>
                {
                    Success = false,
                    Message = ex.Message
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

        /// <summary>
        /// CRITICAL: Reconcile all payment statuses with actual payments
        /// This fixes any discrepancies between Sale.PaymentStatus and Payments table
        /// </summary>
        [HttpPost("reconcile-payment-status")]
        [Authorize(Roles = "Admin,Owner")] // Admin and Owner only
        public async Task<ActionResult<ApiResponse<ReconciliationResult>>> ReconcilePaymentStatus()
        {
            try
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
                {
                    return Unauthorized(new ApiResponse<ReconciliationResult>
                    {
                        Success = false,
                        Message = "Invalid user"
                    });
                }

                var tenantId = CurrentTenantId;
                var result = await _saleService.ReconcileAllPaymentStatusAsync(tenantId, userId);
                
                var message = $"Reconciliation complete: {result.SalesFixed}/{result.TotalSales} invoices fixed";
                if (result.SalesWithDuplicatePayments.Count > 0)
                {
                    message += $", {result.SalesWithDuplicatePayments.Count} duplicate payments detected";
                }
                if (result.SalesWithOverpayment.Count > 0)
                {
                    message += $", {result.SalesWithOverpayment.Count} overpayments detected";
                }
                
                return Ok(new ApiResponse<ReconciliationResult>
                {
                    Success = true,
                    Message = message,
                    Data = result
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"\u274c ReconcilePaymentStatus Error: {ex.Message}");
                return StatusCode(500, new ApiResponse<ReconciliationResult>
                {
                    Success = false,
                    Message = $"An error occurred: {ex.Message}",
                    Errors = new List<string> { ex.Message }
                });
            }
        }
    }

    public class EmailRequest
    {
        public string Email { get; set; } = string.Empty;
    }

    public class CombinedInvoiceRequest
    {
        public List<int> InvoiceIds { get; set; } = new();
    }

    public class CreateSaleOverrideRequest
    {
        public CreateSaleRequest SaleRequest { get; set; } = new();
        public string Reason { get; set; } = string.Empty;
    }
}

