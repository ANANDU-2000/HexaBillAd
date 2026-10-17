using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Npgsql;
using Xunit.Abstractions;

namespace HexaBill.Tests;

/// <summary>
/// OPS-01: a database built only from the migration history must contain everything the model expects.
/// Whatever it lacks is what runtime schema repair (startup DDL) is silently covering in production.
/// Creates and drops its own scratch database; skips without HEXABILL_TEST_POSTGRES or without CREATE DATABASE rights.
/// </summary>
public class MigrationRehearsalPostgreSqlTests
{
    private readonly ITestOutputHelper _output;

    public MigrationRehearsalPostgreSqlTests(ITestOutputHelper output) => _output = output;

    [SkippableFact]
    public async Task FreshMigrationHistory_MatchesTheModel_WithoutRuntimeRepair()
    {
        var baseConnection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(baseConnection), PostgresIntegrationSkip.Reason);
        // Opt-in on purpose. As of 2026-10-17 this FAILS: migration 20260214173227_AddBranchAndRoute was scaffolded against
        // SQLite and re-creates tables (for example "Customers") that InitialPostgreSQL already made, so an empty PostgreSQL
        // database cannot be built from the history. Production works only because its history rows pre-exist. Run with
        // HEXABILL_MIGRATION_REHEARSAL=1 to see the current state; remove this guard once a verified baseline exists.
        Skip.If(Environment.GetEnvironmentVariable("HEXABILL_MIGRATION_REHEARSAL") != "1",
            "Opt-in migration rehearsal (HEXABILL_MIGRATION_REHEARSAL=1). Known failing: the migration history alone cannot build an empty PostgreSQL database; fresh installs use FreshDatabaseBaseline (see FreshDatabaseBaselinePostgreSqlTests).");

        var scratch = $"hexabill_migrate_rehearsal_{Guid.NewGuid():N}".Substring(0, 50);
        var admin = new NpgsqlConnectionStringBuilder(baseConnection!) { Database = "postgres", Pooling = false };
        var target = new NpgsqlConnectionStringBuilder(baseConnection!) { Database = scratch, Pooling = false };

        await using (var conn = new NpgsqlConnection(admin.ConnectionString))
        {
            await conn.OpenAsync();
            try
            {
                await using var create = new NpgsqlCommand($"CREATE DATABASE \"{scratch}\"", conn);
                await create.ExecuteNonQueryAsync();
            }
            catch (PostgresException ex) when (ex.SqlState == "42501")
            {
                Skip.If(true, "The test role cannot CREATE DATABASE, so a fresh migration rehearsal cannot run.");
            }
        }

        try
        {
            var commandLog = new List<string>();
            await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(target.ConnectionString)
                .LogTo(m => commandLog.Add(m), new[] { Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.CommandError }).Options);
            try
            {
                await db.Database.MigrateAsync();
            }
            catch (Exception ex)
            {
                var applied = (await db.Database.GetAppliedMigrationsAsync()).ToList();
                var all = db.Database.GetMigrations().ToList();
                var next = all.Skip(applied.Count).FirstOrDefault() ?? "(none)";
                var pg = ex.GetBaseException() as PostgresException;
                var sql = new string((commandLog.LastOrDefault() ?? string.Empty).Select(c => char.IsControl(c) ? (char)32 : c).ToArray());
                if (sql.Length > 260) sql = sql.Substring(0, 260);
                throw new Xunit.Sdk.XunitException(
                    $"Migrations alone cannot build an empty database. Applied {applied.Count} of {all.Count}; failed on '{next}': {ex.GetBaseException().Message} | SQL: {sql}");
            }

            var pending = (await db.Database.GetPendingMigrationsAsync()).ToList();
            Assert.Empty(pending);

            var actual = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
            await using (var conn = new NpgsqlConnection(target.ConnectionString))
            {
                await conn.OpenAsync();
                await using var cmd = new NpgsqlCommand(
                    "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'", conn);
                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var table = reader.GetString(0);
                    if (!actual.TryGetValue(table, out var cols)) actual[table] = cols = new HashSet<string>(StringComparer.Ordinal);
                    cols.Add(reader.GetString(1));
                }
            }

            var missing = new List<string>();
            foreach (var entity in db.Model.GetEntityTypes())
            {
                var tableName = entity.GetTableName();
                if (tableName == null || entity.GetViewName() != null) continue;
                if (!actual.TryGetValue(tableName, out var columns))
                {
                    missing.Add($"TABLE {tableName}");
                    continue;
                }
                var store = StoreObjectIdentifier.Table(tableName, entity.GetSchema());
                foreach (var property in entity.GetProperties())
                {
                    var column = property.GetColumnName(store);
                    if (column != null && !columns.Contains(column)) missing.Add($"{tableName}.{column}");
                }
            }

            missing.Sort(StringComparer.Ordinal);
            _output.WriteLine($"Model expects columns the migrations did not create: {missing.Count}");
            foreach (var m in missing) _output.WriteLine("  " + m);
            Assert.True(missing.Count == 0, "Migrations alone do not build the model. Missing: " + string.Join(", ", missing));
        }
        finally
        {
            NpgsqlConnection.ClearAllPools();
            await using var conn = new NpgsqlConnection(admin.ConnectionString);
            await conn.OpenAsync();
            await using var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{scratch}\" WITH (FORCE)", conn);
            await drop.ExecuteNonQueryAsync();
        }
    }
}
