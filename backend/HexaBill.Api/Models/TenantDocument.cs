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

        /// <summary>None (not approved yet), Searchable (text was read and indexed) or NotSearchable (stored and approved, but its text could not be read).</summary>
        [Required]
        [MaxLength(20)]
        public string SearchStatus { get; set; } = "None";

        /// <summary>Plain-words reason when the version is NotSearchable.</summary>
        [MaxLength(300)]
        public string? SearchNote { get; set; }

        public int ChunkCount { get; set; }
    }

    /// <summary>
    /// One searchable passage of an APPROVED version, with where it came from (page, rows or lines). Keyed by company, document and
    /// version. Removed when a newer version is approved, when the document is deleted, or when the version is replaced, so old text
    /// can never be found after the owner has moved on. Derived data: the stored file is the record.
    /// </summary>
    public class TenantDocumentChunk
    {
        public Guid Id { get; set; }
        public int TenantId { get; set; }
        public Guid DocumentId { get; set; }
        public Guid VersionId { get; set; }
        public int ChunkIndex { get; set; }

        [Required]
        [MaxLength(40)]
        public string Location { get; set; } = string.Empty;

        [Required]
        public string Text { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; }
    }
}
