/*
Purpose: Setting model for application configuration
Author: AI Assistant
Date: 2024
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class Setting
    {
        [Key]
        [MaxLength(100)]
        public string Key { get; set; } = string.Empty;
        
        // MULTI-TENANT: Each owner has their own settings (legacy, will be removed after migration)
        public int OwnerId { get; set; }
        
        // MULTI-TENANT: Tenant identification (new, replaces OwnerId)
        public int? TenantId { get; set; }
        
        public string? Value { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; }
    }
}

