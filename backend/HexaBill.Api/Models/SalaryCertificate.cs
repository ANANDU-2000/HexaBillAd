/*
Purpose: Salary Certificate entity (tenant-scoped; fixed Zayoga body template with dynamic employee fields)
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class SalaryCertificate
    {
        public int Id { get; set; }
        public int OwnerId { get; set; }
        public int? TenantId { get; set; }

        [Required]
        [MaxLength(50)]
        public string CertificateNo { get; set; } = string.Empty;

        public DateTime CertificateDate { get; set; }

        /// <summary>Bank / recipient e.g. DIB</summary>
        [MaxLength(200)]
        public string? Recipient { get; set; }

        [MaxLength(200)]
        public string? EmployeeName { get; set; }

        [MaxLength(50)]
        public string? PassportNumber { get; set; }

        [MaxLength(100)]
        public string? EmployeeNationality { get; set; }

        public DateTime? JoiningDate { get; set; }

        [MaxLength(200)]
        public string? Designation { get; set; }

        public decimal? MonthlySalary { get; set; }

        [MaxLength(200)]
        public string? MonthlySalaryWords { get; set; }

        [MaxLength(50)]
        public string? EmployeePhone { get; set; }

        [MaxLength(200)]
        public string SignatoryName { get; set; } = "Sudheesh Thampi";

        [MaxLength(100)]
        public string SignatoryTitle { get; set; } = "Manager";

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
