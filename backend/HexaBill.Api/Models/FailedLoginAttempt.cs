/*
Purpose: FailedLoginAttempt model for persistent login lockout tracking
Author: AI Assistant
Date: 2026-02-18
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    /// <summary>
    /// BUG #2.7 FIX: Persistent login lockout tracking - survives server restarts
    /// Stores failed login attempts per email to prevent brute force attacks
    /// </summary>
    public class FailedLoginAttempt
    {
        public int Id { get; set; }
        
        [Required]
        [MaxLength(100)]
        public string Email { get; set; } = string.Empty; // Normalized email (lowercase)
        
        public int FailedCount { get; set; } = 1; // Number of failed attempts
        
        public DateTime? LockoutUntil { get; set; } // When lockout expires (null if not locked)
        
        public DateTime LastAttemptAt { get; set; } = DateTime.UtcNow; // Last failed attempt timestamp
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        public DateTime? UpdatedAt { get; set; }
    }
}
