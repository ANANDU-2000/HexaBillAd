/*
 * Route runs: start and end a route, with the stop counts frozen at the end for reconciliation.
 * Callers have already been checked against the route (RouteScopedController); this service still scopes every query by tenant.
 */
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Modules.Branches
{
    public class RouteRunDto
    {
        public int Id { get; set; }
        public int RouteId { get; set; }
        public DateTime ServiceDate { get; set; }
        public DateTime StartedAt { get; set; }
        public int StartedByUserId { get; set; }
        public DateTime? EndedAt { get; set; }
        public string? EndNote { get; set; }
        public bool IsOpen { get; set; }
        public int StopsTotal { get; set; }
        public int StopsDelivered { get; set; }
        public int StopsFailed { get; set; }
        public int StopsSkipped { get; set; }
        public int StopsNotVisited { get; set; }
    }

    public class RouteRunStateDto
    {
        /// <summary>The open run, with live counts, or null.</summary>
        public RouteRunDto? Current { get; set; }
        /// <summary>The most recently ended run, or null.</summary>
        public RouteRunDto? Last { get; set; }
        /// <summary>False when the server's database has not been updated for runs yet; the driver can still record stops.</summary>
        public bool Available { get; set; } = true;
    }

    public interface IRouteRunService
    {
        Task<RouteRunStateDto> GetStateAsync(int routeId, int tenantId);
        /// <summary>Starts a run, or returns the one already open (idempotent). Null when the route does not exist.</summary>
        Task<RouteRunDto?> StartAsync(int routeId, int tenantId, int userId, DateTime serviceDate);
        /// <summary>Ends the open run and freezes the counts. Null when there is no open run.</summary>
        Task<RouteRunDto?> EndAsync(int routeId, int tenantId, int userId, string? note);
    }

    public class RouteRunService : IRouteRunService
    {
        /// <summary>A run left open longer than this is closed automatically the next time anyone starts the route.</summary>
        public static readonly TimeSpan StaleAfter = TimeSpan.FromHours(18);

        private readonly AppDbContext _db;

        public RouteRunService(AppDbContext db) => _db = db;

        public async Task<RouteRunStateDto> GetStateAsync(int routeId, int tenantId)
        {
            try
            {
                return await ReadStateAsync(routeId, tenantId);
            }
            catch (Exception ex) when (RouteService.IsRelationMissing42P01(ex))
            {
                return new RouteRunStateDto { Available = false };
            }
        }

        private async Task<RouteRunStateDto> ReadStateAsync(int routeId, int tenantId)
        {
            var open = await _db.RouteRuns.AsNoTracking()
                .FirstOrDefaultAsync(r => r.RouteId == routeId && r.TenantId == tenantId && r.EndedAt == null);
            var last = await _db.RouteRuns.AsNoTracking()
                .Where(r => r.RouteId == routeId && r.TenantId == tenantId && r.EndedAt != null)
                .OrderByDescending(r => r.EndedAt)
                .FirstOrDefaultAsync();
            RouteRunDto? current = null;
            if (open != null)
            {
                current = ToDto(open);
                ApplyCounts(current, await CountsAsync(routeId, tenantId, open.ServiceDate));
            }
            return new RouteRunStateDto { Current = current, Last = last == null ? null : ToDto(last) };
        }

        public async Task<RouteRunDto?> StartAsync(int routeId, int tenantId, int userId, DateTime serviceDate)
        {
            try
            {
                return await StartCoreAsync(routeId, tenantId, userId, serviceDate);
            }
            catch (Exception ex) when (RouteService.IsRelationMissing42P01(ex))
            {
                throw new InvalidOperationException(UnavailableMessage);
            }
        }

        public const string UnavailableMessage = "Starting and ending routes is not available until the server update is installed.";

        private async Task<RouteRunDto?> StartCoreAsync(int routeId, int tenantId, int userId, DateTime serviceDate)
        {
            if (!await _db.Routes.AnyAsync(r => r.Id == routeId && r.TenantId == tenantId)) return null;

            var open = await _db.RouteRuns.FirstOrDefaultAsync(r => r.RouteId == routeId && r.TenantId == tenantId && r.EndedAt == null);
            if (open != null && DateTime.UtcNow - open.StartedAt > StaleAfter)
            {
                await CloseAsync(open, userId, "Closed automatically: the previous run was never ended.");
                open = null;
            }
            if (open != null) return ToDto(open);

            var run = new RouteRun
            {
                TenantId = tenantId,
                RouteId = routeId,
                ServiceDate = DateTime.SpecifyKind(serviceDate.Date, DateTimeKind.Utc),
                StartedByUserId = userId,
                StartedAt = DateTime.UtcNow,
            };
            _db.RouteRuns.Add(run);
            Audit(tenantId, userId, "RouteRunStarted", $"route {routeId}");
            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                // Two taps at once: the unique open-run index let one through. Return the winner.
                _db.ChangeTracker.Clear();
                var winner = await _db.RouteRuns.AsNoTracking().FirstOrDefaultAsync(r => r.RouteId == routeId && r.TenantId == tenantId && r.EndedAt == null);
                if (winner == null) throw;
                return ToDto(winner);
            }
            return ToDto(run);
        }

        public async Task<RouteRunDto?> EndAsync(int routeId, int tenantId, int userId, string? note)
        {
            try
            {
                return await EndCoreAsync(routeId, tenantId, userId, note);
            }
            catch (Exception ex) when (RouteService.IsRelationMissing42P01(ex))
            {
                throw new InvalidOperationException(UnavailableMessage);
            }
        }

        private async Task<RouteRunDto?> EndCoreAsync(int routeId, int tenantId, int userId, string? note)
        {
            var open = await _db.RouteRuns.FirstOrDefaultAsync(r => r.RouteId == routeId && r.TenantId == tenantId && r.EndedAt == null);
            if (open == null) return null;
            var trimmed = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
            if (trimmed != null && trimmed.Length > 500) throw new ArgumentException("The note can be at most 500 characters.");
            await CloseAsync(open, userId, trimmed);
            return ToDto(open);
        }

        private async Task CloseAsync(RouteRun run, int userId, string? note)
        {
            var counts = await CountsAsync(run.RouteId, run.TenantId, run.ServiceDate);
            run.EndedAt = DateTime.UtcNow;
            run.EndedByUserId = userId;
            run.EndNote = note;
            run.StopsTotal = counts.total;
            run.StopsDelivered = counts.delivered;
            run.StopsFailed = counts.failed;
            run.StopsSkipped = counts.skipped;
            run.StopsNotVisited = counts.notVisited;
            Audit(run.TenantId, userId, "RouteRunEnded",
                $"route {run.RouteId}: {counts.delivered} delivered, {counts.failed} failed, {counts.skipped} skipped, {counts.notVisited} not visited of {counts.total}");
            await _db.SaveChangesAsync();
        }

        /// <summary>Latest visit per stop for the service day decides each stop's outcome.</summary>
        private async Task<(int total, int delivered, int failed, int skipped, int notVisited)> CountsAsync(int routeId, int tenantId, DateTime serviceDate)
        {
            var day = DateTime.SpecifyKind(serviceDate.Date, DateTimeKind.Utc);
            var customerIds = await _db.RouteCustomers.AsNoTracking().Where(rc => rc.RouteId == routeId).Select(rc => rc.CustomerId).ToListAsync();
            var visits = await _db.CustomerVisits.AsNoTracking()
                .Where(v => v.RouteId == routeId && v.TenantId == tenantId && v.VisitDate >= day && v.VisitDate < day.AddDays(1))
                .ToListAsync();
            var latest = visits.GroupBy(v => v.CustomerId).ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt).First().Status);
            int delivered = 0, failed = 0, skipped = 0;
            foreach (var id in customerIds)
            {
                if (!latest.TryGetValue(id, out var status)) continue;
                switch (status)
                {
                    case VisitStatus.Delivered:
                    case VisitStatus.PaymentCollected:
                    case VisitStatus.Visited:
                        delivered++; break;
                    case VisitStatus.Failed:
                    case VisitStatus.NotHome:
                        failed++; break;
                    case VisitStatus.Skipped:
                    case VisitStatus.Rescheduled:
                        skipped++; break;
                }
            }
            return (customerIds.Count, delivered, failed, skipped, customerIds.Count - delivered - failed - skipped);
        }

        private void Audit(int tenantId, int userId, string action, string details) =>
            _db.AuditLogs.Add(new AuditLog { TenantId = tenantId, OwnerId = tenantId, UserId = userId, Action = action, EntityType = "RouteRun", Details = details, CreatedAt = DateTime.UtcNow });

        private static RouteRunDto ToDto(RouteRun r) => new()
        {
            Id = r.Id, RouteId = r.RouteId, ServiceDate = r.ServiceDate, StartedAt = r.StartedAt, StartedByUserId = r.StartedByUserId,
            EndedAt = r.EndedAt, EndNote = r.EndNote, IsOpen = r.EndedAt == null,
            StopsTotal = r.StopsTotal, StopsDelivered = r.StopsDelivered, StopsFailed = r.StopsFailed, StopsSkipped = r.StopsSkipped, StopsNotVisited = r.StopsNotVisited,
        };

        private static void ApplyCounts(RouteRunDto dto, (int total, int delivered, int failed, int skipped, int notVisited) c)
        {
            dto.StopsTotal = c.total; dto.StopsDelivered = c.delivered; dto.StopsFailed = c.failed; dto.StopsSkipped = c.skipped; dto.StopsNotVisited = c.notVisited;
        }
    }
}
