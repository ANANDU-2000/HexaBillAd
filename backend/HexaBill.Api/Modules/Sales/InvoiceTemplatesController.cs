/*
Purpose: Invoice templates controller for managing dynamic invoice templates
Author: AI Assistant
Date: 2024
*/
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.SuperAdmin;

namespace HexaBill.Api.Modules.Sales
{
    [ApiController]
    [Route("api/invoice/templates")]
    [Authorize]
    public class InvoiceTemplatesController : TenantScopedController // MULTI-TENANT: Owner-scoped templates
    {
        private readonly IInvoiceTemplateService _templateService;
        private readonly ISettingsService _settingsService;
        private readonly IStorageService _storageService;

        public InvoiceTemplatesController(IInvoiceTemplateService templateService, ISettingsService settingsService, IStorageService storageService)
        {
            _templateService = templateService;
            _settingsService = settingsService;
            _storageService = storageService;
        }

        [HttpGet]
        [Authorize(Roles = "Admin,Owner")]
        public async Task<ActionResult<ApiResponse<List<InvoiceTemplateDto>>>> GetTemplates()
        {
            try
            {
                var templates = await _templateService.GetTemplatesAsync(CurrentTenantId);
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
                var template = await _templateService.GetActiveTemplateAsync(CurrentTenantId);
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
                var template = await _templateService.GetTemplateByIdAsync(id, CurrentTenantId);
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

                var template = await _templateService.CreateTemplateAsync(request, userId, CurrentTenantId);
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

                var template = await _templateService.UpdateTemplateAsync(id, request, userId, CurrentTenantId);
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

                var result = await _templateService.ActivateTemplateAsync(id, userId, CurrentTenantId);
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
                var result = await _templateService.DeleteTemplateAsync(id, CurrentTenantId);
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
                    Id = 0,
                    OwnerId = CurrentTenantId,
                    InvoiceNo = "INV-0001",
                    InvoiceDate = DateTime.UtcNow,
                    CustomerId = null,
                    CustomerName = "Sample Customer",
                    Subtotal = 1736.00m,
                    VatTotal = 86.80m,
                    RoundOff = 0m,
                    GrandTotal = 1822.80m,
                    IsZeroInvoice = false,
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

                var company = await _settingsService.GetCompanySettingsAsync(CurrentTenantId);
                byte[]? logo = null;
                if (!string.IsNullOrEmpty(company.LogoDataUri))
                {
                    var parts = company.LogoDataUri.Split(',', 2);
                    if (parts.Length == 2) logo = Convert.FromBase64String(parts[1]);
                }
                else if (!string.IsNullOrEmpty(company.LogoStorageKey))
                    logo = await _storageService.ReadBytesAsync(company.LogoStorageKey);
                var sampleSettings = new InvoiceTemplateService.CompanySettings
                {
                    CompanyNameEn = company.LegalNameEn, CompanyNameAr = company.LegalNameAr,
                    CompanyAddress = company.Address, CompanyPhone = company.Mobile,
                    CompanyTrn = company.VatNumber, CorporateTaxTrn = company.CorporateTaxTrn,
                    CompanyEmail = company.Email,
                    Currency = company.Currency, LogoImageBytes = logo,
                    BilingualMonochromeHeader = company.BilingualMonochromeHeader
                };

                string renderedHtml;
                if (request.TemplateId.HasValue)
                {
                    renderedHtml = await _templateService.RenderTemplateAsync(request.TemplateId.Value, CurrentTenantId, sampleSale, sampleSettings);
                }
                else if (!string.IsNullOrEmpty(request.HtmlCode))
                {
                    renderedHtml = await _templateService.RenderTemplateHtmlAsync(request.HtmlCode, sampleSale, sampleSettings);
                }
                else
                {
                    renderedHtml = await _templateService.RenderActiveTemplateAsync(CurrentTenantId, sampleSale, sampleSettings);
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

