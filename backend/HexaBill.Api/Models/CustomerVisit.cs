/*
 * Customer visit tracking for route collection sheets.
 * Tracks visit status (visited, not home, payment collected) per customer per route per date.
 */
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public enum VisitStatus
    {
        NotVisited = 0,
        Visited = 1,
        NotHome = 2,
        PaymentCollected = 3,
        Rescheduled = 4
    }

    public class CustomerVisit
    {
        public int Id { get; set; }
        public int RouteId { get; set; }
        public int CustomerId { get; set; }
        public int TenantId { get; set; }
        public int? StaffId { get; set; } // Staff member who made the visit
        
        public DateTime VisitDate { get; set; } // Date of the visit
        
        public VisitStatus Status { get; set; } = VisitStatus.NotVisited;
        
        [MaxLength(500)]
        public string? Notes { get; set; } // Additional notes about the visit
        
        public decimal? PaymentCollected { get; set; } // If PaymentCollected status, amount collected
        /// <summary>Alias for PaymentCollected used by route/visit APIs.</summary>
        public decimal? AmountCollected { get => PaymentCollected; set => PaymentCollected = value; }
        
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }

        // Navigation properties
        public virtual Route Route { get; set; } = null!;
        public virtual Customer Customer { get; set; } = null!;
        public virtual Tenant Tenant { get; set; } = null!;
        public virtual User? Staff { get; set; }
    }
}
