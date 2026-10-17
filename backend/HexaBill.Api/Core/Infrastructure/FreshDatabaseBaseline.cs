using System.Reflection;
using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace HexaBill.Api.Core.Infrastructure;

/// <summary>
/// Baseline for FRESH installs. The migration history cannot build an empty PostgreSQL database (an early migration was
/// scaffolded against SQLite and recreates tables that the first one already made), so an empty database is built straight
/// from the current model and every migration in the assembly is recorded as applied.
///
/// Safety rules, all enforced here:
/// - PostgreSQL only.
/// - Acts only when the database has NO tables at all (apart from the history table). An existing database, even a partly
///   built or damaged one, is never touched, and migration history is never fabricated for it.
/// - It is off unless the caller turns it on (see <see cref="IsEnabled"/>), so production keeps its explicit, approved
///   migration path.
/// </summary>
public static class FreshDatabaseBaseline
{
    public const string EnvironmentVariable = "HEXABILL_BASELINE_EMPTY_DB";

    /// <summary>On in Development; elsewhere only when HEXABILL_BASELINE_EMPTY_DB is "true".</summary>
    public static bool IsEnabled(string? aspNetEnvironment, string? flag) =>
        string.Equals(flag, "true", StringComparison.OrdinalIgnoreCase)
        || string.Equals(aspNetEnvironment, "Development", StringComparison.OrdinalIgnoreCase);

    public static async Task<bool> IsEmptyAsync(AppDbContext db, CancellationToken ct = default)
    {
        var conn = db.Database.GetDbConnection();
        var wasClosed = conn.State != System.Data.ConnectionState.Open;
        if (wasClosed) await conn.OpenAsync(ct);
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT count(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name <> '__EFMigrationsHistory'";
            var count = Convert.ToInt64(await cmd.ExecuteScalarAsync(ct));
            return count == 0;
        }
        finally
        {
            if (wasClosed) await conn.CloseAsync();
        }
    }

    /// <summary>Builds the schema and records the migrations when the database is empty. Returns true only if it did.</summary>
    public static async Task<bool> ApplyIfEmptyAsync(AppDbContext db, ILogger logger, CancellationToken ct = default)
    {
        if (!db.Database.IsNpgsql()) return false;
        if (!await IsEmptyAsync(db, ct)) return false;

        logger.LogWarning("Database has no tables: building the schema from the current model and recording {Count} migrations as applied.", db.Database.GetMigrations().Count());
        await db.Database.EnsureCreatedAsync(ct);

        var history = db.GetService<IHistoryRepository>();
        await db.Database.ExecuteSqlRawAsync(history.GetCreateIfNotExistsScript(), ct);
        var productVersion = (typeof(DbContext).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "9.0.0").Split('+')[0];
        foreach (var migrationId in db.Database.GetMigrations())
            await db.Database.ExecuteSqlRawAsync(history.GetInsertScript(new HistoryRow(migrationId, productVersion)), ct);
        return true;
    }
}
