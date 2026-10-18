/*
 * Live driver position, opt-in and short-lived.
 *  - Off unless FeatureFlags:LiveDriverLocation is true.
 *  - Only an assigned driver, only while a run is open, only after the driver pressed Share (consent travels with the first update).
 *  - One row per route and driver, overwritten; no trail. Deleted when the driver stops or the run ends; ignored once expired.
 *  - Coordinates are never written to logs or audit rows.
 */
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Modules.Branches
{
    public class ShareLocationRequest
    {
        public decimal Latitude { get; set; }
        public decimal Longitude { get; set; }
        public decimal? AccuracyMeters { get; set; }
        /// <summary>Random id the driver's screen makes when they press Share.</summary>
        public string? SessionId { get; set; }
        /// <summary>True only on the update sent right after the driver agreed to share.</summary>
        public bool Consent { get; set; }
    }

    public class DriverLocationDto
    {
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public decimal Latitude { get; set; }
        public decimal Longitude { get; set; }
        public decimal? AccuracyMeters { get; set; }
        public DateTime UpdatedAt { get; set; }
        public int AgeSeconds { get; set; }
        /// <summary>No update for a while (phone asleep, no signal, screen closed); the position may be old.</summary>
        public bool IsStale { get; set; }
    }

    public enum ShareStatus { Ok, NotEnabled, NoOpenRun, NotAssigned, ConsentRequired, TooSoon, Invalid }

    public class ShareResult
    {
        public ShareStatus Status { get; set; }
        public string? Message { get; set; }
        public int RetryAfterSeconds { get; set; }
    }

    public interface IDriverLocationService
    {
        bool IsEnabled();
        Task<ShareResult> ShareAsync(int routeId, int tenantId, int userId, ShareLocationRequest request);
        Task<bool> StopAsync(int routeId, int tenantId, int userId);
        /// <summary>Positions still valid for the route. seeAll false returns only the caller's own.</summary>
        Task<List<DriverLocationDto>> ListAsync(int routeId, int tenantId, int callerUserId, bool seeAll);
    }

    public class DriverLocationService : IDriverLocationService
    {
        public const int StaleAfterSeconds = 90;

        private readonly AppDbContext _db;
        private readonly IConfiguration _config;

        public DriverLocationService(AppDbContext db, IConfiguration config)
        {
            _db = db;
            _config = config;
        }

        public bool IsEnabled()
        {
            var env = Environment.GetEnvironmentVariable("FeatureFlags__LiveDriverLocation");
            if (!string.IsNullOrWhiteSpace(env) && bool.TryParse(env, out var fromEnv)) return fromEnv;
            return _config.GetValue<bool>("FeatureFlags:LiveDriverLocation", false);
        }

        private int MinSeconds => Math.Max(0, _config.GetValue("LiveLocation:MinSecondsBetweenUpdates", 5));
        private int ExpiryMinutes => Math.Clamp(_config.GetValue("LiveLocation:ExpiryMinutes", 10), 1, 60);

        public async Task<ShareResult> ShareAsync(int routeId, int tenantId, int userId, ShareLocationRequest request)
        {
            if (!IsEnabled()) return new ShareResult { Status = ShareStatus.NotEnabled, Message = "Live location is not switched on for this company." };

            var assigned = await _db.RouteStaff.AnyAsync(rs => rs.RouteId == routeId && rs.UserId == userId && rs.Route.TenantId == tenantId)
                || await _db.Routes.AnyAsync(r => r.Id == routeId && r.TenantId == tenantId && r.AssignedStaffId == userId);
            if (!assigned) return new ShareResult { Status = ShareStatus.NotAssigned, Message = "Only a driver assigned to this route can share a location." };

            var run = await _db.RouteRuns.AsNoTracking().FirstOrDefaultAsync(r => r.RouteId == routeId && r.TenantId == tenantId && r.EndedAt == null);
            if (run == null) return new ShareResult { Status = ShareStatus.NoOpenRun, Message = "Start the route before sharing your location." };

            var session = (request.SessionId ?? "").Trim();
            if (session.Length < 8 || session.Length > 64) return Invalid("The sharing session is not valid. Press Share again.");
            var lat = request.Latitude;
            var lng = request.Longitude;
            if (Math.Abs(lat) > 90 || Math.Abs(lng) > 180 || (lat == 0 && lng == 0)) return Invalid("That is not a valid position.");
            if (request.AccuracyMeters is < 0 or > 100000) return Invalid("That accuracy is not valid.");

            var now = DateTime.UtcNow;
            var row = await _db.DriverLocationCurrents.FirstOrDefaultAsync(r => r.RouteId == routeId && r.TenantId == tenantId && r.UserId == userId);
            var sameSession = row != null && row.SessionId == session && row.RunId == run.Id && row.ExpiresAt > now;
            if (!sameSession && !request.Consent)
                return new ShareResult { Status = ShareStatus.ConsentRequired, Message = "Location is only shared after you press Share on this route." };

            if (sameSession && MinSeconds > 0 && (now - row!.UpdatedAt).TotalSeconds < MinSeconds)
                return new ShareResult { Status = ShareStatus.TooSoon, RetryAfterSeconds = MinSeconds, Message = "Updates are too frequent." };

            var accuracy = request.AccuracyMeters.HasValue ? Math.Round(request.AccuracyMeters.Value, 1) : (decimal?)null;
            if (row == null)
            {
                row = new DriverLocationCurrent { TenantId = tenantId, RouteId = routeId, UserId = userId };
                _db.DriverLocationCurrents.Add(row);
            }
            if (!sameSession)
            {
                row.SessionId = session;
                row.RunId = run.Id;
                row.ConsentAt = now;
                _db.AuditLogs.Add(new AuditLog { TenantId = tenantId, OwnerId = tenantId, UserId = userId, Action = "LocationSharingStarted", EntityType = "Route", EntityId = routeId, Details = $"run {run.Id}", CreatedAt = now });
            }
            row.Latitude = Math.Round(lat, 6);
            row.Longitude = Math.Round(lng, 6);
            row.AccuracyMeters = accuracy;
            row.UpdatedAt = now;
            row.ExpiresAt = now.AddMinutes(ExpiryMinutes);
            await _db.SaveChangesAsync();
            return new ShareResult { Status = ShareStatus.Ok };
        }

        private static ShareResult Invalid(string message) => new() { Status = ShareStatus.Invalid, Message = message };

        public async Task<bool> StopAsync(int routeId, int tenantId, int userId)
        {
            var row = await _db.DriverLocationCurrents.FirstOrDefaultAsync(r => r.RouteId == routeId && r.TenantId == tenantId && r.UserId == userId);
            if (row == null) return false;
            _db.DriverLocationCurrents.Remove(row);
            _db.AuditLogs.Add(new AuditLog { TenantId = tenantId, OwnerId = tenantId, UserId = userId, Action = "LocationSharingStopped", EntityType = "Route", EntityId = routeId, Details = $"run {row.RunId}", CreatedAt = DateTime.UtcNow });
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<List<DriverLocationDto>> ListAsync(int routeId, int tenantId, int callerUserId, bool seeAll)
        {
            if (!IsEnabled()) return new List<DriverLocationDto>();
            var now = DateTime.UtcNow;
            var query = _db.DriverLocationCurrents.AsNoTracking()
                .Where(r => r.RouteId == routeId && r.TenantId == tenantId && r.ExpiresAt > now);
            if (!seeAll) query = query.Where(r => r.UserId == callerUserId);
            var rows = await query.ToListAsync();
            var names = await _db.Users.AsNoTracking().Where(u => rows.Select(r => r.UserId).Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Name);
            return rows.Select(r =>
            {
                var age = (int)Math.Max(0, (now - r.UpdatedAt).TotalSeconds);
                return new DriverLocationDto
                {
                    UserId = r.UserId,
                    UserName = names.TryGetValue(r.UserId, out var n) ? n : "Driver",
                    Latitude = r.Latitude,
                    Longitude = r.Longitude,
                    AccuracyMeters = r.AccuracyMeters,
                    UpdatedAt = r.UpdatedAt,
                    AgeSeconds = age,
                    IsStale = age > StaleAfterSeconds,
                };
            }).OrderBy(d => d.UserName).ToList();
        }
    }
}
