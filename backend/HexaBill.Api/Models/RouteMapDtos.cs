namespace HexaBill.Api.Models
{
    /// <summary>A stop on the Route Map: the usual map data plus what the customer owes and how late it is.</summary>
    public class RouteMapStopDto : RouteStopMapDto
    {
        public string? Phone { get; set; }
        /// <summary>Amount the customer owes (never negative).</summary>
        public decimal Balance { get; set; }
        /// <summary>Part of the open invoices that is past its due date.</summary>
        public decimal OverdueAmount { get; set; }
        /// <summary>Days the oldest overdue invoice is late; 0 when nothing is overdue.</summary>
        public int OverdueDays { get; set; }
        public DateTime? LastPaymentDate { get; set; }
        /// <summary>Latest recorded visit on this route (any day); null when never visited.</summary>
        public DateTime? LastVisitAt { get; set; }
        /// <summary>Only owners and admins see credit limits.</summary>
        public decimal? CreditLimit { get; set; }
    }

    public class RouteMapRouteSummaryDto
    {
        public int RouteId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? BranchName { get; set; }
        public int StopCount { get; set; }
        /// <summary>Stops with any visit status other than "not visited" today.</summary>
        public int VisitedToday { get; set; }
        public decimal OutstandingTotal { get; set; }
        public decimal OverdueTotal { get; set; }
        public int OverdueCustomers { get; set; }
    }

    public class RouteMapOverviewDto
    {
        public string Date { get; set; } = string.Empty;
        public List<RouteMapRouteSummaryDto> Routes { get; set; } = new();
    }
}
