using Microsoft.EntityFrameworkCore;

namespace HexaBill.Tests;

/// <summary>Serializes empty-database bootstrap only; concurrency tests still run concurrently.</summary>
internal static class PostgresTestSchema
{
    private static readonly SemaphoreSlim BootstrapLock = new(1, 1);

    public static async Task EnsureCreatedAsync(DbContext db)
    {
        await BootstrapLock.WaitAsync();
        try
        {
            await db.Database.EnsureCreatedAsync();
            // Tests may reuse a disposable PostgreSQL database created by an earlier checkout.
            // Keep the test schema current without treating EnsureCreated as migration rehearsal.
            if (db.Database.IsNpgsql())
                await db.Database.ExecuteSqlRawAsync(
                    "ALTER TABLE IF EXISTS \"VatReturnPeriods\" ADD COLUMN IF NOT EXISTS \"SnapshotHistoryJson\" text NULL");
        }
        finally { BootstrapLock.Release(); }
    }

    public static void EnsureCreated(DbContext db) => EnsureCreatedAsync(db).GetAwaiter().GetResult();
}
