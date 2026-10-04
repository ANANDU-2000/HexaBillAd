using Microsoft.EntityFrameworkCore;

namespace HexaBill.Tests;

/// <summary>Serializes empty-database bootstrap only; concurrency tests still run concurrently.</summary>
internal static class PostgresTestSchema
{
    private static readonly SemaphoreSlim BootstrapLock = new(1, 1);

    public static async Task EnsureCreatedAsync(DbContext db)
    {
        await BootstrapLock.WaitAsync();
        try { await db.Database.EnsureCreatedAsync(); }
        finally { BootstrapLock.Release(); }
    }

    public static void EnsureCreated(DbContext db) => EnsureCreatedAsync(db).GetAwaiter().GetResult();
}
