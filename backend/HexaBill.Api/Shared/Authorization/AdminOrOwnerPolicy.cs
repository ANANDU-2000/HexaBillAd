/*
 * Production-ready authorization for Admin/Owner/SystemAdmin endpoints.
 * Uses case-insensitive role matching for JWT interoperability.
 */
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace HexaBill.Api.Shared.Authorization
{
    public class AdminOrOwnerRequirement : IAuthorizationRequirement { }
    public class AdminOrOwnerOrStaffRequirement : IAuthorizationRequirement { }

    public class AdminOrOwnerAuthorizationHandler : AuthorizationHandler<AdminOrOwnerRequirement>
    {
        private static readonly string[] AllowedRoles = { "Admin", "Owner", "SystemAdmin", "admin", "owner", "systemadmin" };

        protected override Task HandleRequirementAsync(
            AuthorizationHandlerContext context,
            AdminOrOwnerRequirement requirement)
        {
            if (context.User?.Identity?.IsAuthenticated != true)
            {
                return Task.CompletedTask;
            }

            // SystemAdmin: tenant_id=0 or owner_id=0
            var tenantClaim = context.User.FindFirst("tenant_id")?.Value
                ?? context.User.FindFirst("owner_id")?.Value
                ?? context.User.Claims.FirstOrDefault(c => c.Type.EndsWith("tenant_id", StringComparison.OrdinalIgnoreCase))?.Value;
            if (tenantClaim != null && int.TryParse(tenantClaim, out var tid) && tid == 0)
            {
                context.Succeed(requirement);
                return Task.CompletedTask;
            }

            // Collect role values from all common claim types (JWT may use short or full URIs)
            var roleClaims = context.User.Claims
                .Where(c => c.Type == ClaimTypes.Role || c.Type == "role" ||
                            c.Type.EndsWith("/role", StringComparison.OrdinalIgnoreCase))
                .Select(c => c?.Value?.Trim())
                .Where(v => !string.IsNullOrEmpty(v));

            foreach (var role in roleClaims)
            {
                if (AllowedRoles.Contains(role, StringComparer.OrdinalIgnoreCase))
                {
                    context.Succeed(requirement);
                    return Task.CompletedTask;
                }
            }

            return Task.CompletedTask;
        }
    }

    public class AdminOrOwnerOrStaffAuthorizationHandler : AuthorizationHandler<AdminOrOwnerOrStaffRequirement>
    {
        private static readonly string[] AllowedRoles = { "Admin", "Owner", "Staff", "SystemAdmin", "admin", "owner", "staff", "systemadmin" };

        protected override Task HandleRequirementAsync(
            AuthorizationHandlerContext context,
            AdminOrOwnerOrStaffRequirement requirement)
        {
            if (context.User?.Identity?.IsAuthenticated != true)
                return Task.CompletedTask;

            var tenantClaim = context.User.FindFirst("tenant_id")?.Value ?? context.User.FindFirst("owner_id")?.Value;
            if (tenantClaim != null && int.TryParse(tenantClaim, out var tid) && tid == 0)
            {
                context.Succeed(requirement);
                return Task.CompletedTask;
            }

            var roleClaims = context.User.Claims
                .Where(c => c.Type == ClaimTypes.Role || c.Type == "role" || c.Type.EndsWith("/role", StringComparison.OrdinalIgnoreCase))
                .Select(c => c?.Value?.Trim())
                .Where(v => !string.IsNullOrEmpty(v));

            foreach (var role in roleClaims)
            {
                if (AllowedRoles.Contains(role, StringComparer.OrdinalIgnoreCase))
                {
                    context.Succeed(requirement);
                    return Task.CompletedTask;
                }
            }
            return Task.CompletedTask;
        }
    }
}
