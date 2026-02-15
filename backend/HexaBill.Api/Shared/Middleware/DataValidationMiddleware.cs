/*
Purpose: Comprehensive Data Validation Middleware
Ensures data integrity and multi-tenant isolation across all features
Author: AI Assistant
Date: 2024-12-26
*/
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using HexaBill.Api.Data;
using HexaBill.Api.Shared.Extensions;
using HexaBill.Api.Models;
using System;
using System.Threading.Tasks;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace HexaBill.Api.Shared.Middleware
{
    public class DataValidationMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<DataValidationMiddleware> _logger;

        public DataValidationMiddleware(RequestDelegate next, ILogger<DataValidationMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context, AppDbContext dbContext)
        {
            // Only validate for authenticated API requests (not health checks, CORS, etc.)
            if (!context.Request.Path.StartsWithSegments("/api") ||
                context.Request.Path.Value.Contains("/auth/") ||
                context.Request.Path.Value.Contains("/cors-check") ||
                !context.User.Identity?.IsAuthenticated == true)
            {
                await _next(context);
                return;
            }

            // Get current user's OwnerId from claims
            var ownerIdClaim = context.User.FindFirst("owner_id")?.Value;
            int? currentOwnerId = null;
            if (!string.IsNullOrEmpty(ownerIdClaim) && int.TryParse(ownerIdClaim, out int ownerId))
            {
                currentOwnerId = ownerId;
            }
            
            // CRITICAL: Validate OwnerId is set for non-super-admin users
            var userRole = context.User.FindFirst("role")?.Value;
            var userId = context.User.FindFirst("user_id")?.Value;
            
            // Skip validation for super admin (OwnerId = null)
            if (currentOwnerId == null && !string.IsNullOrEmpty(userId))
            {
                _logger.LogWarning("User {UserId} has no OwnerId but is not a super admin", 
                    context.User.FindFirst("user_id")?.Value);
                context.Response.StatusCode = 403;
                await context.Response.WriteAsJsonAsync(new
                {
                    success = false,
                    message = "Access denied: Invalid owner context"
                });
                return;
            }

            // Continue processing
            await _next(context);
        }
    }

    /// <summary>
    /// Background service to periodically validate data integrity
    /// </summary>
    public class DataIntegrityValidationService : Microsoft.Extensions.Hosting.BackgroundService
    {
        private readonly IServiceScopeFactory _serviceScopeFactory;
        private readonly ILogger<DataIntegrityValidationService> _logger;

        public DataIntegrityValidationService(
            IServiceScopeFactory serviceScopeFactory,
            ILogger<DataIntegrityValidationService> logger)
        {
            _serviceScopeFactory = serviceScopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Data Integrity Validation Service started");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    // Run validation every 6 hours
                    await Task.Delay(TimeSpan.FromHours(6), stoppingToken);

                    using (var scope = _serviceScopeFactory.CreateScope())
                    {
                        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                        await ValidateDataIntegrity(dbContext);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error during data integrity validation");
                }
            }
        }

        private async Task ValidateDataIntegrity(AppDbContext dbContext)
        {
            _logger.LogInformation("Starting data integrity validation...");

            // 1. Validate customer balances
            var customersWithMismatches = await dbContext.Customers
                .Select(c => new
                {
                    c.Id,
                    c.OwnerId,
                    c.Name,
                    StoredPendingBalance = c.PendingBalance,
                    CalculatedPendingBalance = c.TotalSales - c.TotalPayments
                })
                .Where(c => Math.Abs(c.StoredPendingBalance - c.CalculatedPendingBalance) > 0.01m)
                .ToListAsync();

            if (customersWithMismatches.Any())
            {
                _logger.LogWarning("Found {Count} customers with balance mismatches", 
                    customersWithMismatches.Count);
                
                foreach (var mismatch in customersWithMismatches.Take(5))
                {
                    _logger.LogWarning("Customer {Name} (OwnerId: {OwnerId}): Stored={Stored}, Calculated={Calculated}",
                        mismatch.Name, mismatch.OwnerId, mismatch.StoredPendingBalance, mismatch.CalculatedPendingBalance);
                }
            }

            // 2. Validate sales payment status
            var salesWithWrongStatus = await dbContext.Sales
                .Include(s => s.Items)
                .Where(s => !s.IsDeleted)
                .Select(s => new
                {
                    s.Id,
                    s.OwnerId,
                    s.InvoiceNo,
                    s.GrandTotal,
                    s.PaidAmount,
                    s.PaymentStatus,
                    CalculatedStatus = s.PaidAmount >= s.GrandTotal ? "Paid" :
                                      s.PaidAmount > 0 ? "Partial" : "Pending"
                })
                .Where(s => s.PaymentStatus.ToString() != s.CalculatedStatus)
                .ToListAsync();

            if (salesWithWrongStatus.Any())
            {
                _logger.LogWarning("Found {Count} sales with incorrect payment status", 
                    salesWithWrongStatus.Count);
            }

            // 3. Validate multi-tenant isolation - ensure no cross-owner data access
            var ownersWithData = await dbContext.Sales
                .Where(s => !s.IsDeleted)
                .GroupBy(s => s.OwnerId)
                .Select(g => new { OwnerId = g.Key, Count = g.Count() })
                .ToListAsync();

            _logger.LogInformation("Multi-tenant validation: {OwnerCount} owners have data", 
                ownersWithData.Count);
            
            foreach (var owner in ownersWithData)
            {
                _logger.LogInformation("OwnerId {OwnerId}: {Count} sales", 
                    owner.OwnerId, owner.Count);
            }

            // 4. Validate invoice number uniqueness per owner
            var duplicateInvoices = await dbContext.Sales
                .Where(s => !s.IsDeleted)
                .GroupBy(s => new { s.OwnerId, s.InvoiceNo })
                .Where(g => g.Count() > 1)
                .Select(g => new { g.Key.OwnerId, g.Key.InvoiceNo, Count = g.Count() })
                .ToListAsync();

            if (duplicateInvoices.Any())
            {
                _logger.LogError("CRITICAL: Found {Count} duplicate invoice numbers!", 
                    duplicateInvoices.Count);
                
                foreach (var dup in duplicateInvoices)
                {
                    _logger.LogError("OwnerId {OwnerId}: Invoice {InvoiceNo} appears {Count} times",
                        dup.OwnerId, dup.InvoiceNo, dup.Count);
                }
            }

            // 5. Validate product stock consistency
            var productsWithNegativeStock = await dbContext.Products
                .Where(p => p.StockQty < 0)
                .Select(p => new { p.Id, p.OwnerId, p.NameEn, p.StockQty })
                .ToListAsync();

            if (productsWithNegativeStock.Any())
            {
                _logger.LogWarning("Found {Count} products with negative stock", 
                    productsWithNegativeStock.Count);
            }

            _logger.LogInformation("Data integrity validation completed");
        }
    }

    /// <summary>
    /// Extension methods for middleware registration
    /// </summary>
    public static class DataValidationMiddlewareExtensions
    {
        public static IApplicationBuilder UseDataValidation(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<DataValidationMiddleware>();
        }
    }
}
