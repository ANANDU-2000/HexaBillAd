using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    /// <summary>
    /// One run of a route: a driver taps Start when they leave and End when they are done. Location sharing (when it is
    /// switched on) is only allowed while a run is open, and the counts are frozen when the run ends so the owner can
    /// reconcile completed and missed stops. At most one run is open per route at a time.
    /// </summary>
    public class RouteRun
    {
        public int Id { get; set; }
        public int TenantId { get; set; }
        public int RouteId { get; set; }

        /// <summary>The service day the stops belong to (date only, UTC).</summary>
        public DateTime ServiceDate { get; set; }

        public int StartedByUserId { get; set; }
        public DateTime StartedAt { get; set; }

        public DateTime? EndedAt { get; set; }
        public int? EndedByUserId { get; set; }

        /// <summary>Why the run ended early or was closed for the driver, optional (max 500).</summary>
        [MaxLength(500)]
        public string? EndNote { get; set; }

        // Frozen when the run ends. Stops not visited are the missed ones.
        public int StopsTotal { get; set; }
        public int StopsDelivered { get; set; }
        public int StopsFailed { get; set; }
        public int StopsSkipped { get; set; }
        public int StopsNotVisited { get; set; }

        public virtual Route Route { get; set; } = null!;
    }
}
