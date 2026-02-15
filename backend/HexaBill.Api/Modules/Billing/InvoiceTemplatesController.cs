/*
Purpose: Invoice templates controller for managing dynamic invoice templates
Author: AI Assistant
Date: 2024
*/
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Modules.Billing;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions;

namespace HexaBill.Api.Modules.Billing
{
    [ApiController]
    [Route("api/invoice/templates")]
    [Authorize]
    public class InvoiceTemplatesController : TenantScopedController // MULTI-TENANT: Owner-scoped templates
    {
        private readonly IInvoiceTemplateService _templateService;

        public InvoiceTemplatesController(IInvoiceTemplateService templateService)
        {
            _templateService = templateService;
        }

        [HttpGet]
        [Authorize(Roles = "Admin,Owner")]
        public async Task<ActionResult<ApiResponse<List<InvoiceTemplateDto>>>> GetTemplates()
        {
            try
            {
                var templates = await _templateService.GetTemplatesAsync();
                return Ok(new ApiResponse<List<InvoiceTemplateDto>>
                {
                    Success = true,
                    Message = "Templates retrieved successfully",
                    Data = templates
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<List<InvoiceTemplateDto>>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("active")]
        public async Task<ActionResult<ApiResponse<InvoiceTemplateDto>>> GetActiveTemplate()
        {
            try
            {
                var template = await _templateService.GetActiveTemplateAsync();
                if (template == null)
                {
                    return NotFound(new ApiResponse<InvoiceTemplateDto>
                    {
                        Success = false,
                        Message = "No active template found"
                    });
                }

                return Ok(new ApiResponse<InvoiceTemplateDto>
                {
                    Success = true,
                    Message = "Active template retrieved successfully",
                    Data = template
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<InvoiceTemplateDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpGet("{id}")]
        [Authorize(Roles = "Admin,Owner")]
        public async Task<ActionResult<ApiResponse<InvoiceTemplateDto>>> GetTemplate(int id)
        {
            try
            {
                var template = await _templateService.GetTemplateByIdAsync(id);
                if (template == null)
                {
                    return NotFound(new ApiResponse<InvoiceTemplateDto>
                    {
                        Success = false,
                        Message = "Template not found"
                    });
                }

                return Ok(new ApiResponse<InvoiceTemplateDto>
                {
                    Success = true,
                    Message = "Template retrieved successfully",
                    Data = template
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<InvoiceTemplateDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost]
        [Authorize(Roles = "Admin,Owner")]
        public async Task<ActionResult<ApiResponse<InvoiceTemplateDto>>> CreateTemplate([FromBody] CreateInvoiceTemplateRequest request)
        {
            try
            {
                var userIdClaim = User.FindFirst("UserId") ?? 
                                  User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier) ?? 
                                  User.FindFirst("id");
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId) || userId == 0)
                {
                    return Unauthorized(new ApiResponse<InvoiceTemplateDto>
                    {
                        Success = false,
                        Message = "Invalid user authentication"
                    });
                }

                // Validate HTML contains required placeholders
                var requiredPlaceholders = new[] { "{{invoice_no}}", "{{date}}", "{{customer_name}}", "{{items}}", "{{subtotal}}", "{{vat_amount}}", "{{grand_total}}" };
                var missingPlaceholders = requiredPlaceholders.Where(p => !request.HtmlCode.Contains(p)).ToList();
                if (missingPlaceholders.Any())
                {
                    return BadRequest(new ApiResponse<InvoiceTemplateDto>
                    {
                        Success = false,
                        Message = $"Template is missing required placeholders: {string.Join(", ", missingPlaceholders)}"
                    });
                }

                var template = await _templateService.CreateTemplateAsync(request, userId);
                return CreatedAtAction(nameof(GetTemplate), new { id = template.Id }, new ApiResponse<InvoiceTemplateDto>
                {
                    Success = true,
                    Message = "Template created successfully",
                    Data = template
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<InvoiceTemplateDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Owner")]
        public async Task<ActionResult<ApiResponse<InvoiceTemplateDto>>> UpdateTemplate(int id, [FromBody] UpdateInvoiceTemplateRequest request)
        {
            try
            {
                var userIdClaim = User.FindFirst("UserId") ?? 
                                  User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier) ?? 
                                  User.FindFirst("id");
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId) || userId == 0)
                {
                    return Unauthorized(new ApiResponse<InvoiceTemplateDto>
                    {
                        Success = false,
                        Message = "Invalid user authentication"
                    });
                }

                // Validate HTML if provided
                if (!string.IsNullOrEmpty(request.HtmlCode))
                {
                    var requiredPlaceholders = new[] { "{{invoice_no}}", "{{date}}", "{{customer_name}}", "{{items}}", "{{subtotal}}", "{{vat_amount}}", "{{grand_total}}" };
                    var missingPlaceholders = requiredPlaceholders.Where(p => !request.HtmlCode.Contains(p)).ToList();
                    if (missingPlaceholders.Any())
                    {
                        return BadRequest(new ApiResponse<InvoiceTemplateDto>
                        {
                            Success = false,
                            Message = $"Template is missing required placeholders: {string.Join(", ", missingPlaceholders)}"
                        });
                    }
                }

                var template = await _templateService.UpdateTemplateAsync(id, request, userId);
                if (template == null)
                {
                    return NotFound(new ApiResponse<InvoiceTemplateDto>
                    {
                        Success = false,
                        Message = "Template not found"
                    });
                }

                return Ok(new ApiResponse<InvoiceTemplateDto>
                {
                    Success = true,
                    Message = "Template updated successfully",
                    Data = template
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<InvoiceTemplateDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPost("{id}/activate")]
        [Authorize(Roles = "Admin,Owner")]
        public async Task<ActionResult<ApiResponse<bool>>> ActivateTemplate(int id)
        {
            try
            {
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

                var result = await _templateService.ActivateTemplateAsync(id, userId);
                if (!result)
                {
                    return NotFound(new ApiResponse<bool>
                    {
                        Success = false,
                        Message = "Template not found"
                    });
                }

                return Ok(new ApiResponse<bool>
                {
                    Success = true,
                    Message = "Template activated successfully",
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

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,Owner")]
        public async Task<ActionResult<ApiResponse<bool>>> DeleteTemplate(int id)
        {
            try
            {
                var result = await _templateService.DeleteTemplateAsync(id);
                if (!result)
                {
                    return NotFound(new ApiResponse<bool>
                    {
                        Success = false,
                        Message = "Template not found or cannot be deleted"
                    });
                }

                return Ok(new ApiResponse<bool>
                {
                    Success = true,
                    Message = "Template deleted successfully",
                    Data = true
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new ApiResponse<bool>
                {
                    Success = false,
                    Message = ex.Message
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

        [HttpPost("preview")]
        [Authorize(Roles = "Admin,Owner")]
        public async Task<ActionResult<ApiResponse<string>>> PreviewTemplate([FromBody] PreviewTemplateRequest request)
        {
            try
            {
                // Create a sample sale DTO for preview
                var sampleSale = new SaleDto
                {
                    Id = 1,
                    InvoiceNo = "INV-0001",
                    InvoiceDate = DateTime.UtcNow,
                    CustomerId = 1,
                    CustomerName = "Sample Customer",
                    Subtotal = 1736.00m,
                    VatTotal = 86.80m,
                    GrandTotal = 1822.80m,
                    Items = new List<SaleItemDto>
                    {
                        new SaleItemDto
                        {
                            Id = 1,
                            ProductName = "BREAST 12KG AROURA",
                            Qty = 3,
                            UnitType = "CRTN",
                            UnitPrice = 140,
                            VatAmount = 21.00m,
                            LineTotal = 441.00m
                        },
                        new SaleItemDto
                        {
                            Id = 2,
                            ProductName = "MEAT MINCE",
                            Qty = 1,
                            UnitType = "CRTN",
                            UnitPrice = 180,
                            VatAmount = 9.00m,
                            LineTotal = 189.00m
                        }
                    }
                };

                var sampleSettings = new InvoiceTemplateService.CompanySettings
                {
                    CompanyNameEn = "HexaBill",
                    CompanyNameAr = "ستار بلس لتجارة المواد الغذائية",
                    CompanyAddress = "Mussafah 44, Industrial Area",
                    CompanyPhone = "+971 555298878",
                    CompanyTrn = "100366253100003",
                    Currency = "AED"
                };

                string renderedHtml;
                if (request.TemplateId.HasValue)
                {
                    renderedHtml = await _templateService.RenderTemplateAsync(request.TemplateId.Value, sampleSale, sampleSettings);
                }
                else if (!string.IsNullOrEmpty(request.HtmlCode))
                {
                    // Create a temporary template service instance to render the HTML
                    // This is a workaround - in production, you might want to add a public method for this
                    var tempTemplate = await _templateService.CreateTemplateAsync(
                        new CreateInvoiceTemplateRequest
                        {
                            Name = "Preview Template",
                            HtmlCode = request.HtmlCode,
                            IsActive = false
                        },
                        1 // System user ID
                    );
                    renderedHtml = await _templateService.RenderTemplateAsync(tempTemplate.Id, sampleSale, sampleSettings);
                    // Clean up temporary template
                    await _templateService.DeleteTemplateAsync(tempTemplate.Id);
                }
                else
                {
                    renderedHtml = await _templateService.RenderActiveTemplateAsync(sampleSale, sampleSettings);
                }

                return Ok(new ApiResponse<string>
                {
                    Success = true,
                    Message = "Template preview generated successfully",
                    Data = renderedHtml
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
    }

    public class PreviewTemplateRequest
    {
        public int? TemplateId { get; set; }
        public string? HtmlCode { get; set; }
    }
}

