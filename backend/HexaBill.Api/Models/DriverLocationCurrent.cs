using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    /// <summary>
    /// The latest position a driver chose to share for one route. One row per (tenant, route, user), overwritten on every
    /// update: there is no trail. Deleted when the driver stops sharing or the route run ends, and ignored once it expires.
    /// Never copied to the customer's saved shop pin, to visits, or to logs.
    /// </summary>
    public class DriverLocationCurrent
    {
        public int Id { get; set; }
        public int TenantId { get; set; }
        public int RouteId { get; set; }
        public int UserId { get; set; }

        /// <summary>The open run this sharing belongs to.</summary>
        public int RunId { get; set; }

        /// <summary>Random id the driver's screen makes when they press Share; a new one needs new consent.</summary>
        [Required]
        [MaxLength(64)]
        public string SessionId { get; set; } = string.Empty;

        public decimal Latitude { get; set; }
        public decimal Longitude { get; set; }
        public decimal? AccuracyMeters { get; set; }

        /// <summary>When the driver agreed to share in this session.</summary>
        public DateTime ConsentAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        /// <summary>After this the position is ignored even if nothing deleted it.</summary>
        public DateTime ExpiresAt { get; set; }
    }
}
