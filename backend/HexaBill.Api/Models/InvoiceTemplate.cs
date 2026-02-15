/*
Purpose: Invoice template model for dynamic template management
Author: AI Assistant
Date: 2024
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class InvoiceTemplate
    {
        public int Id { get; set; }
        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;
        [MaxLength(50)]
        public string Version { get; set; } = "1.0";
        public int CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        
        [Required]
        public string HtmlCode { get; set; } = string.Empty; // Full HTML template with placeholders
        public string? CssCode { get; set; } // Additional CSS (optional, can be embedded in HTML)
        public bool IsActive { get; set; } = false; // Only one template can be active at a time
        public string? Description { get; set; } // Template description/notes
        
        // Navigation properties
        public virtual User CreatedByUser { get; set; } = null!;
    }
}

