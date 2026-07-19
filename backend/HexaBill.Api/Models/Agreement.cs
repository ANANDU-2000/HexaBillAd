/*
Purpose: Business Development Agreement entity (tenant-scoped; fixed clause template)
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class Agreement
    {
        public int Id { get; set; }
        public int OwnerId { get; set; }
        public int? TenantId { get; set; }

        [Required]
        [MaxLength(50)]
        public string AgreementNo { get; set; } = string.Empty;

        public DateTime AgreementDate { get; set; }

        // Second Party (variable — start blank)
        [MaxLength(200)]
        public string? SecondPartyName { get; set; }

        [MaxLength(100)]
        public string? SecondPartyLicense { get; set; }

        [MaxLength(500)]
        public string? SecondPartyAddress { get; set; }

        [MaxLength(50)]
        public string? SecondPartyMobile { get; set; }

        /// <summary>Template version key; body clauses are fixed in code/PDF.</summary>
        [MaxLength(20)]
        public string TemplateVersion { get; set; } = "v1";

        /// <summary>Draft | Final</summary>
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Draft";

        public string? Notes { get; set; }
        public int CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
        public int? LastModifiedBy { get; set; }
        public DateTime? LastModifiedAt { get; set; }
        public bool IsDeleted { get; set; }
        public int? DeletedBy { get; set; }
        public DateTime? DeletedAt { get; set; }
    }
}
