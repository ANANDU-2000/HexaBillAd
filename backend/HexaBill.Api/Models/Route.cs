/*
 * Route model - sales route under a branch. Staff and customers are assigned via RouteStaff / RouteCustomer.
 */
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class Route
    {
        public int Id { get; set; }
        public int BranchId { get; set; }
        public int TenantId { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        /// <summary>Primary assigned staff (optional). Use RouteStaff for multiple staff.</summary>
        public int? AssignedStaffId { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }

        public virtual Branch Branch { get; set; } = null!;
        public virtual Tenant Tenant { get; set; } = null!;
        public virtual User? AssignedStaff { get; set; }
        public virtual ICollection<RouteCustomer> RouteCustomers { get; set; } = new List<RouteCustomer>();
        public virtual ICollection<RouteStaff> RouteStaff { get; set; } = new List<RouteStaff>();
        public virtual ICollection<RouteExpense> RouteExpenses { get; set; } = new List<RouteExpense>();
    }
}
