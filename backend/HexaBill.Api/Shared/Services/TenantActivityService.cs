/*
 * Tenant Activity Service - In-memory request count per tenant for SuperAdmin Live Activity
 * Tracks API calls per tenant in last 60 minutes. Thread-safe.
 * Data is held in process memory only: activity resets on server restart/deploy.
 * UI shows "Activity resets on server restart." Optionally persist last N minutes to DB later.
 */
using System.Collections.Concurrent;

namespace HexaBill.Api.Shared.Services
{
    public interface ITenantActivityService
    {
        void RecordRequest(int tenantId);
        List<TenantActivityDto> GetTopTenantsByRequestsLast60Min(int limit = 10);
        /// <summary>Get request count for a single tenant in the last 60 minutes.</summary>
        (int RequestCount, DateTime? LastActiveAt) GetRequestCountForTenantLast60Min(int tenantId);
    }

    public class TenantActivityDto
    {
        public int TenantId { get; set; }
        public string TenantName { get; set; } = string.Empty;
        public int RequestCount { get; set; }
        public DateTime LastActiveAt { get; set; }
        public bool IsHighVolume => RequestCount > 500;
    }

    public class TenantActivityService : ITenantActivityService
    {
        private readonly ConcurrentQueue<(int TenantId, DateTime At)> _requests = new();
        private readonly ConcurrentDictionary<int, DateTime> _lastActive = new();
        private readonly ILogger<TenantActivityService> _logger;
        private DateTime _lastTrim = DateTime.UtcNow;

        public TenantActivityService(ILogger<TenantActivityService> logger)
        {
            _logger = logger;
        }

        public void RecordRequest(int tenantId)
        {
            if (tenantId <= 0) return; // Skip SystemAdmin
            var now = DateTime.UtcNow;
            _requests.Enqueue((tenantId, now));
            _lastActive.AddOrUpdate(tenantId, now, (_, __) => now);

            if ((now - _lastTrim).TotalMinutes >= 5)
            {
                TrimOldEntries();
                _lastTrim = now;
            }
        }

        private void TrimOldEntries()
        {
            var cutoff = DateTime.UtcNow.AddMinutes(-65);
            var toKeep = new List<(int, DateTime)>();
            while (_requests.TryDequeue(out var item))
            {
                if (item.At > cutoff)
                    toKeep.Add(item);
            }
            foreach (var item in toKeep)
                _requests.Enqueue(item);
        }

        public List<TenantActivityDto> GetTopTenantsByRequestsLast60Min(int limit = 10)
        {
            var cutoff = DateTime.UtcNow.AddMinutes(-60);
            var counts = new ConcurrentDictionary<int, (int Count, DateTime Last)>();

            foreach (var (tenantId, at) in _requests)
            {
                if (at <= cutoff) continue;
                counts.AddOrUpdate(tenantId,
                    (1, at),
                    (_, t) => (t.Count + 1, at > t.Last ? at : t.Last));
            }

            return counts
                .OrderByDescending(x => x.Value.Count)
                .Take(limit)
                .Select(x => new TenantActivityDto
                {
                    TenantId = x.Key,
                    TenantName = "", // Filled by controller from DB
                    RequestCount = x.Value.Count,
                    LastActiveAt = x.Value.Last
                })
                .ToList();
        }

        public (int RequestCount, DateTime? LastActiveAt) GetRequestCountForTenantLast60Min(int tenantId)
        {
            if (tenantId <= 0) return (0, null);
            var cutoff = DateTime.UtcNow.AddMinutes(-60);
            int count = 0;
            DateTime? last = null;
            foreach (var (tid, at) in _requests)
            {
                if (tid != tenantId || at <= cutoff) continue;
                count++;
                if (!last.HasValue || at > last) last = at;
            }
            return (count, last);
        }
    }
}
