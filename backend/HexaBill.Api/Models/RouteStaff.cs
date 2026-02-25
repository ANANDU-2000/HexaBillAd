/*
 * Many-to-many: Route <-> User (Staff). Staff assigned to a route.
 */
namespace HexaBill.Api.Models
{
    public class RouteStaff
    {
        public int Id { get; set; }
        public int RouteId { get; set; }
        public int UserId { get; set; }
        public DateTime AssignedAt { get; set; }

        public virtual Route Route { get; set; } = null!;
        public virtual User User { get; set; } = null!;
    }
}
