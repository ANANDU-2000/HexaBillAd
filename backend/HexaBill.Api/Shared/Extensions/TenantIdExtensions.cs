/*
 * CRITICAL SECURITY: Multi-Tenant Tenant ID Extraction Extension
 * Purpose: Safely extract tenant_id from JWT claims for data isolation
 * Author: AI Assistant
 * Date: 2026
 * 
 * SECURITY RULES:
 * 1. NEVER accept tenant_id from request body
 * 2. ALWAYS extract from validated JWT token or TenantContextService
 * 3. Throw exception if missing or invalid (except SystemAdmin)
 */
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace HexaBill.Api.Shared.Extensions
{
    /// <summary>
    /// Extension methods for extracting tenant ID from claims
    /// MIGRATION: Supports both tenant_id and owner_id claims during transition
    /// </summary>
    public static class TenantIdExtensions
    {
        /// <summary>
        /// CRITICAL: Extract TenantId from authenticated JWT token
        /// This is the ONLY safe way to get tenant_id for data filtering
        /// Returns 0 for SystemAdmin
        /// </summary>
        /// <param name="user">ClaimsPrincipal from authenticated request</param>
        /// <returns>TenantId for current user (0 for SystemAdmin)</returns>
        /// <exception cref="UnauthorizedAccessException">If tenant_id is missing or invalid</exception>
        public static int GetTenantIdFromToken(this ClaimsPrincipal user)
        {
            // Try tenant_id first (new), fallback to owner_id (migration)
            var tenantIdClaim = user.FindFirst("tenant_id")?.Value
                ?? user.FindFirst("owner_id")?.Value;
            
            if (tenantIdClaim == null)
            {
                throw new UnauthorizedAccessException("SECURITY: tenant_id claim missing from token");
            }
            
            if (!int.TryParse(tenantIdClaim, out int tenantId))
            {
                throw new UnauthorizedAccessException("SECURITY: Invalid tenant_id format in token");
            }
            
            // SystemAdmin has TenantId = 0
            return tenantId;
        }
        
        /// <summary>
        /// Get TenantId or null if SystemAdmin (for queries that allow all-tenant access)
        /// </summary>
        public static int? GetTenantIdOrNullForSystemAdmin(this ClaimsPrincipal user)
        {
            var tenantIdClaim = user.FindFirst("tenant_id")?.Value
                ?? user.FindFirst("owner_id")?.Value;
            
            if (tenantIdClaim == null)
            {
                return null; // SystemAdmin
            }
            
            if (!int.TryParse(tenantIdClaim, out int tenantId))
            {
                return null;
            }
            
            // SystemAdmin returns null to indicate all tenants
            return tenantId == 0 ? null : tenantId;
        }
        
        /// <summary>
        /// Check if current user is SystemAdmin (tenant_id = 0 or null)
        /// </summary>
        public static bool IsSystemAdmin(this ClaimsPrincipal user)
        {
            var tenantIdClaim = user.FindFirst("tenant_id")?.Value
                ?? user.FindFirst("owner_id")?.Value;
            
            if (tenantIdClaim == null)
            {
                return false;
            }
            
            if (!int.TryParse(tenantIdClaim, out int tenantId))
            {
                return false;
            }
            
            return tenantId == 0;
        }
    }
    
    /// <summary>
    /// Base controller with built-in tenant_id extraction
    /// All business controllers should inherit from this
    /// MIGRATION: Supports both CurrentOwnerId (legacy) and CurrentTenantId (new)
    /// </summary>
    public class TenantScopedController : ControllerBase
    {
        /// <summary>
        /// CRITICAL: Gets current tenant ID from JWT token or impersonation header
        /// Use this in ALL business logic to filter data
        /// Returns 0 for SystemAdmin if no impersonation header is present
        /// </summary>
        protected int CurrentTenantId
        {
            get
            {
                var idFromToken = User.GetTenantIdFromToken();
                
                // MULTI-TENANT IMPERSONATION: Allow Super Admin to access specific company data
                if (idFromToken == 0 && HttpContext.Request.Headers.TryGetValue("X-Tenant-Id", out var tenantIdHeader))
                {
                    if (int.TryParse(tenantIdHeader, out var impersonatedId))
                    {
                        return impersonatedId;
                    }
                }
                
                return idFromToken;
            }
        }
        
        /// <summary>
        /// Gets TenantId or null for SystemAdmin (for all-tenant queries)
        /// Also supports impersonation header
        /// </summary>
        protected int? CurrentTenantIdOrNull
        {
            get
            {
                var idFromToken = User.GetTenantIdOrNullForSystemAdmin();
                
                // MULTI-TENANT IMPERSONATION: Allow Super Admin to access specific company data
                if (idFromToken == null && HttpContext.Request.Headers.TryGetValue("X-Tenant-Id", out var tenantIdHeader))
                {
                    if (int.TryParse(tenantIdHeader, out var impersonatedId))
                    {
                        return impersonatedId;
                    }
                }
                
                return idFromToken;
            }
        }
        
        /// <summary>
        /// Check if current user is SystemAdmin
        /// </summary>
        protected bool IsSystemAdmin
        {
            get
            {
                return TenantIdExtensions.IsSystemAdmin(User);
            }
        }

        protected bool IsOwner => User.IsInRole("Owner") || IsSystemAdmin;
        protected bool IsAdmin => User.IsInRole("Admin") || User.IsInRole("Owner") || IsSystemAdmin;
        protected bool IsStaff => User.IsInRole("Staff");
        
        // MIGRATION: Legacy support - will be removed after full migration
        /// <summary>
        /// LEGACY: Use CurrentTenantId instead
        /// </summary>
        [Obsolete("Use CurrentTenantId instead. This will be removed after migration.")]
        protected int CurrentOwnerId => CurrentTenantId;
        
        /// <summary>
        /// LEGACY: Use CurrentTenantIdOrNull instead
        /// </summary>
        [Obsolete("Use CurrentTenantIdOrNull instead. This will be removed after migration.")]
        protected int? CurrentOwnerIdOrNull => CurrentTenantIdOrNull;
    }
    
    // LEGACY: OwnerScopedController removed - use TenantScopedController instead
    // The old OwnerScopedController in OwnerIdExtensions.cs is kept for backward compatibility
}
