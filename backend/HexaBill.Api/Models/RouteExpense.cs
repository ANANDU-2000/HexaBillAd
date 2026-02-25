/*
 * Route-level expense tracking: Fuel, Staff, Delivery, Misc per route.
 */
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class RouteExpense
    {
        public int Id { get; set; }
        public int RouteId { get; set; }
        public int TenantId { get; set; }

        public RouteExpenseType Category { get; set; }
        public decimal Amount { get; set; }
        public DateTime ExpenseDate { get; set; }

        [MaxLength(500)]
        public string? Description { get; set; }

        public int CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }

        public virtual Route Route { get; set; } = null!;
        public virtual Tenant Tenant { get; set; } = null!;
        public virtual User CreatedByUser { get; set; } = null!;
    }

    public enum RouteExpenseType
    {
        Fuel,
        Staff,
        Delivery,
        Misc
    }
}
