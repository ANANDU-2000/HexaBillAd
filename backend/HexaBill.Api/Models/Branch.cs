/*
 * Branch model for multi-branch / route architecture.
 * Tenant -> Branches -> Routes -> Sales, Expenses, Customers, Staff.
 */
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class Branch
    {
        public int Id { get; set; }
        public int TenantId { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Address { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }

        public virtual Tenant Tenant { get; set; } = null!;
        public virtual ICollection<Route> Routes { get; set; } = new List<Route>();
        public virtual ICollection<BranchStaff> BranchStaff { get; set; } = new List<BranchStaff>();
    }
}
