using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    /// <summary>
    /// A company document (licence, policy, manual). The file itself lives in private storage; this row is the
    /// metadata and the only way to reach it. Always read with a TenantId filter taken from the signed-in user.
    /// </summary>
    public class TenantDocument
    {
        public Guid Id { get; set; }
        public int TenantId { get; set; }

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        /// <summary>Licence, Policy, Manual or Other.</summary>
        [Required]
        [MaxLength(20)]
        public string DocType { get; set; } = "Other";

        /// <summary>OwnerOnly (owner and admin) or AllStaff (every signed-in user of the company, once approved).</summary>
        [Required]
        [MaxLength(20)]
        public string Visibility { get; set; } = "OwnerOnly";

        /// <summary>Active or Deleted.</summary>
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Active";

        /// <summary>The approved version that readers and the assistant may use. Null until one is approved.</summary>
        public Guid? CurrentVersionId { get; set; }

        public int CreatedByUserId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public DateTime? DeletedAt { get; set; }
    }

    /// <summary>One uploaded file of a document. Never edited after upload except for its review status.</summary>
    public class TenantDocumentVersion
    {
        public Guid Id { get; set; }
        public int TenantId { get; set; }
        public Guid DocumentId { get; set; }
        public int VersionNumber { get; set; }

        /// <summary>Display only. Cleaned of path parts; never used to build a storage path.</summary>
        [Required]
        [MaxLength(200)]
        public string OriginalFileName { get; set; } = string.Empty;

        /// <summary>Set by the server from the checked file type, not taken from the browser.</summary>
        [Required]
        [MaxLength(100)]
        public string ContentType { get; set; } = string.Empty;

        public long SizeBytes { get; set; }

        /// <summary>SHA-256 (hex) of the stored bytes.</summary>
        [Required]
        [MaxLength(64)]
        public string Sha256 { get; set; } = string.Empty;

        [Required]
        [MaxLength(300)]
        public string StorageKey { get; set; } = string.Empty;

        /// <summary>NeedsReview, Approved, Superseded or Deleted.</summary>
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "NeedsReview";

        /// <summary>Optional expiry date entered by the owner at upload (for example a licence expiry).</summary>
        public DateTime? ExpiresOn { get; set; }

        public int UploadedByUserId { get; set; }
        public DateTime UploadedAt { get; set; }
        public int? ReviewedByUserId { get; set; }
        public DateTime? ReviewedAt { get; set; }
    }
}
