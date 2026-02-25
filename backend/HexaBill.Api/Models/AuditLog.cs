/*
Purpose: AuditLog model for tracking user actions
Author: AI Assistant
Date: 2024
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class AuditLog
    {
        public int Id { get; set; }
        
        // MULTI-TENANT: Owner identification for data isolation (legacy, will be removed after migration)
        public int OwnerId { get; set; }
        
        // MULTI-TENANT: Tenant identification (new, replaces OwnerId)
        public int? TenantId { get; set; }
        
        public int UserId { get; set; }
        [Required]
        [MaxLength(200)]
        public string Action { get; set; } = string.Empty;
        
        // Entity tracking fields
        [MaxLength(100)]
        public string? EntityType { get; set; }
        public int? EntityId { get; set; }
        
        // Field-level change tracking (JSON serialized)
        public string? OldValues { get; set; }
        public string? NewValues { get; set; }
        
        // IP address tracking
        [MaxLength(45)] // IPv6 max length is 45 characters
        public string? IpAddress { get; set; }
        
        public string? Details { get; set; }
        public DateTime CreatedAt { get; set; }

        // Navigation properties
        public virtual User User { get; set; } = null!;
    }
}

