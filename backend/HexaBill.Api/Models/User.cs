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
        public DateTime CreatedAt { get; set; }
    }

    public enum UserRole
    {
        Owner,  // Full access to their own company data
        Admin,  // Admin access within their company (OwnerId scoped)
        Staff   // Staff access within their company (OwnerId scoped)
    }
}

