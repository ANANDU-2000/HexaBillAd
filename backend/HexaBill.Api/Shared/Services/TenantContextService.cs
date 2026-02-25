/*
Purpose: Tenant context service implementation for multi-tenant SaaS
Author: AI Assistant
Date: 2026
*/
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Shared.Services
{
    /// <summary>
    /// Scoped service that provides current tenant context
    /// TenantId is set by TenantContextMiddleware
    /// </summary>
    public class TenantContextService : ITenantContextService
    {
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly AppDbContext _context;
        private Tenant? _cachedTenant;

        public TenantContextService(
            IHttpContextAccessor httpContextAccessor,
            AppDbContext context)
        {
            _httpContextAccessor = httpContextAccessor;
            _context = context;
        }

        /// <summary>
        /// Get current tenant ID from HttpContext.Items
        /// Set by TenantContextMiddleware
        /// Returns null for SystemAdmin
        /// </summary>
        public int? GetCurrentTenantId()
        {
            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext == null)
            {
                return null;
            }

            // Check if tenant ID was set in middleware
            if (httpContext.Items.TryGetValue("TenantId", out var tenantIdObj) && tenantIdObj is int tenantId)
            {
                // SystemAdmin has tenantId = 0, convert to null
                return tenantId == 0 ? null : tenantId;
            }

            // Fallback: Try to get from JWT claim (for backward compatibility during migration)
            var tenantIdClaim = httpContext.User?.FindFirst("tenant_id")?.Value 
                ?? httpContext.User?.FindFirst("owner_id")?.Value; // Migration fallback

            if (!string.IsNullOrEmpty(tenantIdClaim) && int.TryParse(tenantIdClaim, out int claimTenantId))
            {
                return claimTenantId == 0 ? null : claimTenantId;
            }

            return null;
        }

        /// <summary>
        /// Get current tenant entity (cached per request)
        /// </summary>
        public Tenant? GetCurrentTenant()
        {
            var tenantId = GetCurrentTenantId();
            if (tenantId == null)
            {
                return null; // SystemAdmin
            }

            // Cache tenant for request lifetime
            if (_cachedTenant != null && _cachedTenant.Id == tenantId)
            {
                return _cachedTenant;
            }

            _cachedTenant = _context.Tenants
                .AsNoTracking()
                .FirstOrDefault(t => t.Id == tenantId);

            return _cachedTenant;
        }

        /// <summary>
        /// Check if current user is SystemAdmin
        /// </summary>
        public bool IsSystemAdmin()
        {
            var tenantId = GetCurrentTenantId();
            return tenantId == null;
        }

        /// <summary>
        /// Set tenant ID (for testing or impersonation)
        /// </summary>
        public void SetTenantId(int tenantId)
        {
            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext != null)
            {
                httpContext.Items["TenantId"] = tenantId;
                _cachedTenant = null; // Clear cache
            }
        }
    }
}
