/*
Purpose: Tenant context service interface for multi-tenant SaaS
Author: AI Assistant
Date: 2026
*/
using HexaBill.Api.Models;

namespace HexaBill.Api.Shared.Services
{
    /// <summary>
    /// Service to provide current tenant context for request
    /// Scoped service - one instance per HTTP request
    /// </summary>
    public interface ITenantContextService
    {
        /// <summary>
        /// Get current tenant ID from request context
        /// Returns null for SystemAdmin
        /// </summary>
        int? GetCurrentTenantId();

        /// <summary>
        /// Get current tenant entity
        /// Returns null for SystemAdmin or if tenant not found
        /// </summary>
        Tenant? GetCurrentTenant();

        /// <summary>
        /// Check if current user is SystemAdmin (no tenant)
        /// </summary>
        bool IsSystemAdmin();

        /// <summary>
        /// Set tenant ID (for testing or impersonation)
        /// Should only be used in special cases
        /// </summary>
        void SetTenantId(int tenantId);
    }
}
