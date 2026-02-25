/*
Purpose: Tracks user login sessions for "who is logged in" / recent logins
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class UserSession
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public int TenantId { get; set; }
        public DateTime LoginAt { get; set; }
        [MaxLength(500)]
        public string? UserAgent { get; set; }
        [MaxLength(45)]
        public string? IpAddress { get; set; }

        public virtual User User { get; set; } = null!;
    }
}
