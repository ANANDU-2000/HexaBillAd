using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Tests;

// AI layer Phase 0: the business audit trail is append-only through the ORM. Neither application code nor an AI
// tool path can edit or delete a saved audit row via SaveChanges.
public class AuditLogImmutabilityTests
{
    private static async Task<(AppDbContext db, string name)> NewDbAsync()
    {
        var name = "AuditImm_" + Guid.NewGuid();
        var db = Open(name);
        await db.Database.EnsureCreatedAsync();
        return (db, name);
    }

    private static AppDbContext Open(string name)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(name)
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        var db = new AppDbContext(options);
        db.SetRequestTenantScope(5, isPlatformScope: false);
        return db;
    }

    private static AuditLog NewRow() => new()
    {
        TenantId = 5,
        OwnerId = 5,
        UserId = 1,
        Action = "AI_TOOL_RUN",
        Details = "original",
        CreatedAt = DateTime.UtcNow
    };

    [Fact]
    public async Task Append_IsAllowed()
    {
        var (db, name) = await NewDbAsync();
        await using var _ = db;
        db.AuditLogs.Add(NewRow());
        await db.SaveChangesAsync();

        await using var read = Open(name);
        Assert.Equal(1, await read.AuditLogs.CountAsync());
    }

    [Fact]
    public async Task EditingSavedRow_IsRejectedAndNotPersisted()
    {
        var (db, name) = await NewDbAsync();
        await using var _ = db;
        var row = NewRow();
        db.AuditLogs.Add(row);
        await db.SaveChangesAsync();

        row.Details = "tampered";
        row.Action = "NOTHING_HAPPENED";
        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());

        await using var read = Open(name);
        var saved = await read.AuditLogs.SingleAsync();
        Assert.Equal("original", saved.Details);
        Assert.Equal("AI_TOOL_RUN", saved.Action);
    }

    [Fact]
    public async Task DeletingSavedRow_IsRejectedAndNotPersisted()
    {
        var (db, name) = await NewDbAsync();
        await using var _ = db;
        var row = NewRow();
        db.AuditLogs.Add(row);
        await db.SaveChangesAsync();

        db.AuditLogs.Remove(row);
        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());

        await using var read = Open(name);
        Assert.Equal(1, await read.AuditLogs.CountAsync());
    }

    [Fact]
    public async Task SynchronousSave_AlsoRejectsEdits()
    {
        var (db, _) = await NewDbAsync();
        await using var __ = db;
        var row = NewRow();
        db.AuditLogs.Add(row);
        db.SaveChanges();

        row.Details = "tampered";
        Assert.Throws<InvalidOperationException>(() => db.SaveChanges());
    }
}
