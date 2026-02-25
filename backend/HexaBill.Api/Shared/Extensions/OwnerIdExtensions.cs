/*
 * CRITICAL SECURITY: Multi-Tenant Owner ID Extraction Extension
 * Purpose: Safely extract owner_id from JWT claims for data isolation
 * Author: AI Assistant
 * Date: 2024-12-24
 * 
 * SECURITY RULES:
 * 1. NEVER accept owner_id from request body
 * 2. ALWAYS extract from validated JWT token
 * 3. Throw exception if missing or invalid
 */

using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace HexaBill.Api.Shared.Extensions
{
    /// <summary>
    /// DateTime extension methods for PostgreSQL compatibility
    /// </summary>
    public static class DateTimeExtensions
    {
        /// <summary>
        /// CRITICAL: Converts DateTime to UTC Kind for PostgreSQL compatibility
        /// PostgreSQL timestamp with time zone only accepts UTC Kind DateTimes
        /// </summary>
        public static DateTime ToUtcKind(this DateTime dateTime)
        {
            if (dateTime.Kind == DateTimeKind.Utc)
            {
                return dateTime;
            }
            
            // If Unspecified, treat as UTC and specify the kind
            if (dateTime.Kind == DateTimeKind.Unspecified)
            {
                return DateTime.SpecifyKind(dateTime, DateTimeKind.Utc);
            }
            
            // If Local, convert to UTC
            return dateTime.ToUniversalTime();
        }
    }
    
    public static class OwnerIdExtensions
    {
        /// <summary>
        /// CRITICAL: Extract OwnerId from authenticated JWT token
        /// This is the ONLY safe way to get owner_id for data filtering
        /// </summary>
        /// <param name="user">ClaimsPrincipal from authenticated request</param>
        /// <returns>OwnerId for current user</returns>
        /// <exception cref="UnauthorizedAccessException">If owner_id is missing or invalid</exception>
        public static int GetOwnerIdFromToken(this ClaimsPrincipal user)
        {
            var ownerIdClaim = user.FindFirst("owner_id");
            
            if (ownerIdClaim == null)
            {
                throw new UnauthorizedAccessException("SECURITY: owner_id claim missing from token");
            }
            
            if (!int.TryParse(ownerIdClaim.Value, out int ownerId))
            {
                throw new UnauthorizedAccessException("SECURITY: Invalid owner_id format in token");
            }
            
            // Super admin (owner_id = 0) - return 0 to indicate super admin
            // Controllers should check IsSystemAdmin and handle accordingly
            return ownerId;
        }
        
        /// <summary>
        /// Get OwnerId or null if Super Admin (for queries that allow all-owner access)
        /// </summary>
        public static int? GetOwnerIdOrNullForSuperAdmin(this ClaimsPrincipal user)
        {
            var ownerIdClaim = user.FindFirst("owner_id");
            
            if (ownerIdClaim == null)
            {
                return null;
            }
            
            if (!int.TryParse(ownerIdClaim.Value, out int ownerId))
            {
                return null;
            }
            
            // Super admin returns null to indicate all owners
            return ownerId == 0 ? null : ownerId;
        }
        
        /// <summary>
        /// Check if current user is super admin (owner_id = 0 or null)
        /// </summary>
        public static bool IsSystemAdmin(this ClaimsPrincipal user)
        {
            var ownerIdClaim = user.FindFirst("owner_id");
            
            if (ownerIdClaim == null)
            {
                return false;
            }
            
            if (!int.TryParse(ownerIdClaim.Value, out int ownerId))
            {
                return false;
            }
            
            return ownerId == 0;
        }
    }
    
    /// <summary>
    /// Base controller with built-in owner_id extraction
    /// All business controllers should inherit from this
    /// </summary>
    public class OwnerScopedController : ControllerBase
    {
        /// <summary>
        /// CRITICAL: Gets current owner ID from JWT token
        /// Use this in ALL business logic to filter data
        /// Returns 0 for Super Admin
        /// </summary>
        protected int CurrentOwnerId
        {
            get
            {
                return User.GetOwnerIdFromToken();
            }
        }
        
        /// <summary>
        /// Gets OwnerId or null for Super Admin (for all-owner queries)
        /// </summary>
        protected int? CurrentOwnerIdOrNull
        {
            get
            {
                return User.GetOwnerIdOrNullForSuperAdmin();
            }
        }
        
        /// <summary>
        /// Check if current user is super admin
        /// </summary>
        protected bool IsSystemAdmin
        {
            get
            {
                return OwnerIdExtensions.IsSystemAdmin(User);
            }
        }
    }
}
