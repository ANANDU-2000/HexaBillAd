using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    /// <summary>
    /// A proposed action held on the server until a person reviews and confirms it.
    /// Nothing in a draft changes the books. The payload hash lets the confirm step prove the person confirmed exactly
    /// the content they were shown; the idempotency key makes a repeated confirm return the first result.
    /// </summary>
    public class AssistantDraft
    {
        public Guid Id { get; set; }

        /// <summary>Company scope, always taken from the signed-in user.</summary>
        public int TenantId { get; set; }

        /// <summary>Only this user may confirm or cancel the draft.</summary>
        public int UserId { get; set; }

        /// <summary>For example "customer.create".</summary>
        [Required]
        [MaxLength(40)]
        public string Kind { get; set; } = string.Empty;

        [Required]
        public string PayloadJson { get; set; } = string.Empty;

        /// <summary>SHA-256 (hex) of the normalised payload.</summary>
        [Required]
        [MaxLength(64)]
        public string PayloadHash { get; set; } = string.Empty;

        /// <summary>Draft, Executing, Confirmed, Cancelled or Expired.</summary>
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Draft";

        public DateTime CreatedAt { get; set; }
        public DateTime ExpiresAt { get; set; }
        public DateTime? ConfirmedAt { get; set; }

        [MaxLength(80)]
        public string? IdempotencyKey { get; set; }

        /// <summary>Small JSON result of the executed action, for example the new record id.</summary>
        public string? ResultJson { get; set; }
    }
}
