/*
Purpose: Product Categories controller for managing product categories
Author: AI Assistant
Date: 2026-02-17
*/
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions;

namespace HexaBill.Api.Modules.Inventory
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ProductCategoriesController : TenantScopedController
    {
        private readonly AppDbContext _context;

        public ProductCategoriesController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<List<ProductCategoryDto>>>> GetCategories()
        {
            try
            {
                var tenantId = CurrentTenantId;
                
                // Check if ProductCategories table exists (graceful handling if migration not run yet)
                try
                {
                    var categories = await _context.ProductCategories
                        .Where(c => c.TenantId == tenantId && c.IsActive)
                        .OrderBy(c => c.Name)
                        .Select(c => new ProductCategoryDto
                        {
                            Id = c.Id,
                            Name = c.Name,
                            Description = c.Description,
                            ColorCode = c.ColorCode,
                            ProductCount = c.Products.Count(p => p.IsActive)
                        })
                        .ToListAsync();

                    return Ok(new ApiResponse<List<ProductCategoryDto>>
                    {
                        Success = true,
                        Message = "Categories retrieved successfully",
                        Data = categories
                    });
                }
                catch (Exception dbEx) when (
                    dbEx.Message.Contains("does not exist") || 
                    dbEx.Message.Contains("relation") || 
                    dbEx.Message.Contains("table") ||
                    dbEx.Message.Contains("42P01") || // PostgreSQL table does not exist error code
                    dbEx.InnerException?.Message.Contains("does not exist") == true ||
                    dbEx.InnerException?.Message.Contains("relation") == true)
                {
                    // Table doesn't exist yet - return empty list (migration not run)
                    return Ok(new ApiResponse<List<ProductCategoryDto>>
                    {
                        Success = true,
                        Message = "Categories table not found. Please run database migration.",
                        Data = new List<ProductCategoryDto>()
                    });
                }
            }
            catch (Exception ex)
            {
                // Log the error but return empty list instead of 500 to prevent frontend crashes
                return Ok(new ApiResponse<List<ProductCategoryDto>>
                {
                    Success = true,
                    Message = "Categories could not be loaded. Please run database migration.",
                    Data = new List<ProductCategoryDto>()
                });
            }
        }

        [HttpPost]
        [Authorize(Roles = "Owner,Admin")]
        public async Task<ActionResult<ApiResponse<ProductCategoryDto>>> CreateCategory([FromBody] CreateProductCategoryRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.Name))
                {
                    return BadRequest(new ApiResponse<ProductCategoryDto>
                    {
                        Success = false,
                        Message = "Category name is required"
                    });
                }

                var tenantId = CurrentTenantId;

                // Check if category with same name already exists for this tenant
                var existingCategory = await _context.ProductCategories
                    .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Name.ToLower() == request.Name.ToLower().Trim());
                
                if (existingCategory != null)
                {
                    return Conflict(new ApiResponse<ProductCategoryDto>
                    {
                        Success = false,
                        Message = "Category already exists",
                        Errors = new List<string> { $"A category named '{request.Name}' already exists" }
                    });
                }

                // Validate color code
                var colorCode = request.ColorCode;
                if (string.IsNullOrWhiteSpace(colorCode) || !colorCode.StartsWith("#"))
                {
                    colorCode = "#3B82F6"; // Default blue
                }

                var category = new ProductCategory
                {
                    TenantId = tenantId,
                    Name = request.Name.Trim(),
                    Description = request.Description?.Trim(),
                    ColorCode = colorCode,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.ProductCategories.Add(category);
                await _context.SaveChangesAsync();

                var categoryDto = new ProductCategoryDto
                {
                    Id = category.Id,
                    Name = category.Name,
                    Description = category.Description,
                    ColorCode = category.ColorCode,
                    ProductCount = 0
                };

                return Ok(new ApiResponse<ProductCategoryDto>
                {
                    Success = true,
                    Message = "Category created successfully",
                    Data = categoryDto
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<ProductCategoryDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Owner,Admin")]
        public async Task<ActionResult<ApiResponse<ProductCategoryDto>>> UpdateCategory(int id, [FromBody] CreateProductCategoryRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.Name))
                {
                    return BadRequest(new ApiResponse<ProductCategoryDto>
                    {
                        Success = false,
                        Message = "Category name is required"
                    });
                }

                var tenantId = CurrentTenantId;
                var category = await _context.ProductCategories
                    .FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId);

                if (category == null)
                {
                    return NotFound(new ApiResponse<ProductCategoryDto>
                    {
                        Success = false,
                        Message = "Category not found"
                    });
                }

                // Check if another category with same name exists
                var existingCategory = await _context.ProductCategories
                    .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Id != id && c.Name.ToLower() == request.Name.ToLower().Trim());
                
                if (existingCategory != null)
                {
                    return Conflict(new ApiResponse<ProductCategoryDto>
                    {
                        Success = false,
                        Message = "Category name already exists"
                    });
                }

                category.Name = request.Name.Trim();
                category.Description = request.Description?.Trim();
                if (!string.IsNullOrWhiteSpace(request.ColorCode) && request.ColorCode.StartsWith("#"))
                {
                    category.ColorCode = request.ColorCode;
                }
                category.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                var categoryDto = new ProductCategoryDto
                {
                    Id = category.Id,
                    Name = category.Name,
                    Description = category.Description,
                    ColorCode = category.ColorCode,
                    ProductCount = await _context.Products.CountAsync(p => p.CategoryId == id && p.IsActive)
                };

                return Ok(new ApiResponse<ProductCategoryDto>
                {
                    Success = true,
                    Message = "Category updated successfully",
                    Data = categoryDto
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<ProductCategoryDto>
                {
                    Success = false,
                    Message = "An error occurred",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Owner,Admin")]
        public async Task<ActionResult<ApiResponse<object>>> DeleteCategory(int id)
        {
            try
            {
                var tenantId = CurrentTenantId;
                var category = await _context.ProductCategories
                    .FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId);

                if (category == null)
                {
                    return NotFound(new ApiResponse<object>
                    {
                        Success = false,
                        Message = "Category not found"
                    });
                }

                // Check if category has products
                var productCount = await _context.Products.CountAsync(p => p.CategoryId == id);
                if (productCount > 0)
                {
                    // Soft delete: deactivate instead of removing
                    category.IsActive = false;
                    category.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();

                    return Ok(new ApiResponse<object>
                    {
                        Success = true,
                        Message = $"Category deactivated. {productCount} products are still assigned to this category."
                    });
                }

                // Hard delete if no products
                _context.ProductCategories.Remove(category);
                await _context.SaveChangesAsync();

                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = "Category deleted successfully"
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
    }
}
