using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;

namespace HexaBill.Tests;

/// <summary>
/// OPS-01 baseline: an EMPTY PostgreSQL database is built from the current model and its migrations are recorded as applied;
/// a database that has any table is never touched. Uses scratch databases it creates and drops; skips without
/// HEXABILL_TEST_POSTGRES or without CREATE DATABASE rights.
/// </summary>
public class FreshDatabaseBaselinePostgreSqlTests
{
    [Theory]
    [InlineData("Development", null, true)]
    [InlineData("Production", null, false)]
    [InlineData("Production", "false", false)]
    [InlineData("Production", "true", true)]
    [InlineData(null, "TRUE", true)]
    [InlineData(null, null, false)]
    public void Baseline_IsOffInProduction_UnlessExplicitlyEnabled(string? environment, string? flag, bool expected) =>
        Assert.Equal(expected, FreshDatabaseBaseline.IsEnabled(environment, flag));

    private sealed class Scratch : IAsyncDisposable
    {
        private readonly NpgsqlConnectionStringBuilder _admin;
        public string Name { get; }
        public string ConnectionString { get; }

        private Scratch(NpgsqlConnectionStringBuilder admin, string name, string connectionString) { _admin = admin; Name = name; ConnectionString = connectionString; }

        public static async Task<Scratch> CreateAsync()
        {
            var baseConnection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
            Skip.If(string.IsNullOrWhiteSpace(baseConnection), PostgresIntegrationSkip.Reason);
            var name = $"hexabill_baseline_{Guid.NewGuid():N}".Substring(0, 48);
            var admin = new NpgsqlConnectionStringBuilder(baseConnection!) { Database = "postgres", Pooling = false };
            var target = new NpgsqlConnectionStringBuilder(baseConnection!) { Database = name, Pooling = false };
            await using var conn = new NpgsqlConnection(admin.ConnectionString);
            await conn.OpenAsync();
            try
            {
                await using var create = new NpgsqlCommand($"CREATE DATABASE \"{name}\"", conn);
                await create.ExecuteNonQueryAsync();
            }
            catch (PostgresException ex) when (ex.SqlState == "42501")
            {
                Skip.If(true, "The test role cannot CREATE DATABASE.");
            }
            return new Scratch(admin, name, target.ConnectionString);
        }

        public AppDbContext Context() => new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(ConnectionString).Options);

        public async Task ExecAsync(string sql)
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, conn);
            await cmd.ExecuteNonQueryAsync();
        }

        public async Task<long> ScalarAsync(string sql)
        {
            await using var conn = new NpgsqlConnection(ConnectionString);
            await conn.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, conn);
            return Convert.ToInt64(await cmd.ExecuteScalarAsync());
        }

        public async ValueTask DisposeAsync()
        {
            NpgsqlConnection.ClearAllPools();
            await using var conn = new NpgsqlConnection(_admin.ConnectionString);
            await conn.OpenAsync();
            await using var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{Name}\" WITH (FORCE)", conn);
            await drop.ExecuteNonQueryAsync();
        }
    }

    [SkippableFact]
    public async Task EmptyDatabase_GetsACompleteSchema_AllMigrationsRecorded_NothingPending()
    {
        await using var scratch = await Scratch.CreateAsync();
        await using var db = scratch.Context();

        Assert.True(await FreshDatabaseBaseline.IsEmptyAsync(db));
        Assert.True(await FreshDatabaseBaseline.ApplyIfEmptyAsync(db, NullLogger.Instance));

        var all = db.Database.GetMigrations().ToList();
        Assert.NotEmpty(all);
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
        Assert.Equal(all.Count, (await db.Database.GetAppliedMigrationsAsync()).Count());

        // Every table and column the model expects exists.
        var missing = new List<string>();
        var actual = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
        await using (var conn = new NpgsqlConnection(scratch.ConnectionString))
        {
            await conn.OpenAsync();
            await using var cmd = new NpgsqlCommand("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'", conn);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var table = reader.GetString(0);
                if (!actual.TryGetValue(table, out var cols)) actual[table] = cols = new HashSet<string>(StringComparer.Ordinal);
                cols.Add(reader.GetString(1));
            }
        }
        foreach (var entity in db.Model.GetEntityTypes())
        {
            var tableName = entity.GetTableName();
            if (tableName == null || entity.GetViewName() != null) continue;
            if (!actual.TryGetValue(tableName, out var columns)) { missing.Add($"TABLE {tableName}"); continue; }
            var store = StoreObjectIdentifier.Table(tableName, entity.GetSchema());
            foreach (var property in entity.GetProperties())
            {
                var column = property.GetColumnName(store);
                if (column != null && !columns.Contains(column)) missing.Add($"{tableName}.{column}");
            }
        }
        Assert.True(missing.Count == 0, "Missing after baseline: " + string.Join(", ", missing));

        // Migrate afterwards has nothing to do and does not fail.
        await db.Database.MigrateAsync();
        Assert.Equal(all.Count, await scratch.ScalarAsync("SELECT count(*) FROM \"__EFMigrationsHistory\""));
    }

    [SkippableFact]
    public async Task SecondRun_ChangesNothing()
    {
        await using var scratch = await Scratch.CreateAsync();
        await using var db = scratch.Context();
        Assert.True(await FreshDatabaseBaseline.ApplyIfEmptyAsync(db, NullLogger.Instance));
        var tables = await scratch.ScalarAsync("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'");
        var history = await scratch.ScalarAsync("SELECT count(*) FROM \"__EFMigrationsHistory\"");

        Assert.False(await FreshDatabaseBaseline.ApplyIfEmptyAsync(db, NullLogger.Instance));
        Assert.Equal(tables, await scratch.ScalarAsync("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'"));
        Assert.Equal(history, await scratch.ScalarAsync("SELECT count(*) FROM \"__EFMigrationsHistory\""));
    }

    [SkippableFact]
    public async Task DatabaseWithAnyTable_IsNeverTouched_AndNoHistoryIsFabricated()
    {
        await using var scratch = await Scratch.CreateAsync();
        await scratch.ExecAsync("CREATE TABLE \"SomeoneElsesData\" (\"Id\" integer PRIMARY KEY)");
        await using var db = scratch.Context();

        Assert.False(await FreshDatabaseBaseline.IsEmptyAsync(db));
        Assert.False(await FreshDatabaseBaseline.ApplyIfEmptyAsync(db, NullLogger.Instance));
        Assert.Equal(1, await scratch.ScalarAsync("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'"));
        Assert.Equal(0, await scratch.ScalarAsync("SELECT count(*) FROM information_schema.tables WHERE table_name = '__EFMigrationsHistory'"));
    }
}
