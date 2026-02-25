/*
 * Many-to-many: Route <-> Customer. Customers assigned to a route.
 */
namespace HexaBill.Api.Models
{
    public class RouteCustomer
    {
        public int Id { get; set; }
        public int RouteId { get; set; }
        public int CustomerId { get; set; }
        public DateTime AssignedAt { get; set; }

        public virtual Route Route { get; set; } = null!;
        public virtual Customer Customer { get; set; } = null!;
    }
}
