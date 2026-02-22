/*
 * Shared check for Sales.BranchId/RouteId column existence (PostgreSQL production may lack these).
 * Cached to avoid repeated information_schema queries.
 */
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;

namespace HexaBill.Api.Shared.Services
{
    public class SalesSchemaService : ISalesSchemaService
    {
        private readonly AppDbContext _context;
        private static bool? _cached;
        private static DateTime? _cacheTime;
        private static readonly TimeSpan CacheExpiry = TimeSpan.FromMinutes(5);
        private static readonly object _lock = new object();

        public SalesSchemaService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<bool> SalesHasBranchIdAndRouteIdAsync()
        {
            lock (_lock)
            {
                if (_cached.HasValue && _cacheTime.HasValue && (DateTime.UtcNow - _cacheTime.Value) < CacheExpiry)
                    return _cached.Value;
            }

            bool hasColumns = false;
            if (_context.Database.IsNpgsql())
            {
                try
                {
                    var conn = _context.Database.GetDbConnection();
                    var wasOpen = conn.State == System.Data.ConnectionState.Open;
                    if (!wasOpen) await conn.OpenAsync();
                    try
                    {
                        using var cmd = conn.CreateCommand();
                        // PostgreSQL: column_name can be 'BranchId' (quoted) or 'branchid' (lowercase) - check case-insensitively
                        cmd.CommandText = @"
                            SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Sales' AND LOWER(column_name)='branchid')
                            AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Sales' AND LOWER(column_name)='routeid')";
                        var result = await cmd.ExecuteScalarAsync();
                        hasColumns = result is bool b && b;
                    }
                    finally
                    {
                        if (!wasOpen) await conn.CloseAsync();
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"⚠️ SalesSchemaService: could not check Sales columns: {ex.Message}");
                    hasColumns = false;
                }
            }
            else
            {
                hasColumns = true; // SQLite / other: assume columns exist
            }

            lock (_lock)
            {
                _cached = hasColumns;
                _cacheTime = DateTime.UtcNow;
            }
            return hasColumns;
        }
    }
}
