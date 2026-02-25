/*
Purpose: User model for authentication and authorization
Author: AI Assistant
Date: 2024
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class User
    {
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]
        public string Email { get; set; } = string.Empty;
        [Required]
        public string PasswordHash { get; set; } = string.Empty;
        public UserRole Role { get; set; }
        
        // MULTI-TENANT: Owner identification for data isolation (legacy, will be removed after migration)
        // NULL = Super Admin (sees all owners), NOT NULL = Owner/Staff (sees only their data)
        public int? OwnerId { get; set; }
        
        // MULTI-TENANT: Tenant identification (new, replaces OwnerId)
        // NULL = SystemAdmin (sees all tenants), NOT NULL = Tenant user (sees only their tenant data)
        public int? TenantId { get; set; }
        
        [MaxLength(20)]
        public string? Phone { get; set; }
        public string? DashboardPermissions { get; set; } // Comma-separated list of allowed items
        /// <summary>Comma-separated page access list for Staff. Null = all pages allowed.</summary>
        [MaxLength(500)]
        public string? PageAccess { get; set; }
        public DateTime CreatedAt { get; set; }
        /// <summary>Incremented when Force Logout is triggered. JWT session_version must match or 401.</summary>
        public int SessionVersion { get; set; }
        /// <summary>Last successful login (UTC).</summary>
        public DateTime? LastLoginAt { get; set; }
        /// <summary>Last activity ping (UTC). Used for staff online indicator (green/red).</summary>
        public DateTime? LastActiveAt { get; set; }
        /// <summary>Profile/avatar image path (e.g. profiles/xxx.jpg).</summary>
        [MaxLength(500)]
        public string? ProfilePhotoUrl { get; set; }
        /// <summary>UI language preference: "en" (English) or "ar" (Arabic).</summary>
        [MaxLength(10)]
        public string? LanguagePreference { get; set; }
    }

    public enum UserRole
    {
        Owner,  // Full access to their own company data
        Admin,  // Admin access within their company (OwnerId scoped)
        Staff   // Staff access within their company (OwnerId scoped)
    }
}

