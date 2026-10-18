using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.TenantDocuments;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Tests;

/// <summary>The document search query on real PostgreSQL: only current, approved, unexpired, visible passages of the caller's own company.</summary>
public class TenantDocumentSearchPostgreSqlTests
{
    [SkippableFact]
    public async Task Search_ReturnsOnlyCurrentApprovedVisibleText_OfTheCallersCompany_OnPostgreSql()
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(connection), PostgresIntegrationSkip.Reason);
        var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection!).Options;
        await using var db = new AppDbContext(options);
        db.SetRequestTenantScope(null, true);
        await PostgresTestSchema.EnsureCreatedAsync(db);

        var a = 6_000_000 + Random.Shared.Next(1, 90_000_000);
        var b = a + 1;
        var now = DateTime.UtcNow;
        db.Tenants.AddRange(new Tenant { Id = a, Name = "Docs A", Subdomain = $"docsa-{a}" }, new Tenant { Id = b, Name = "Docs B", Subdomain = $"docsb-{b}" });
        await db.SaveChangesAsync();

        Guid Add(int tenant, string title, string visibility, string versionStatus, bool current, DateTime? expires, string text, string location = "page 1")
        {
            var doc = new TenantDocument { Id = Guid.NewGuid(), TenantId = tenant, Title = title, DocType = "Policy", Visibility = visibility, Status = "Active", CreatedByUserId = 1, CreatedAt = now, UpdatedAt = now };
            var ver = new TenantDocumentVersion
            {
                Id = Guid.NewGuid(), TenantId = tenant, DocumentId = doc.Id, VersionNumber = 1, OriginalFileName = "f.txt", ContentType = "text/plain", SizeBytes = 1,
                Sha256 = new string('0', 64), StorageKey = $"tenants/{tenant}/documents/x", Status = versionStatus, ExpiresOn = expires, UploadedByUserId = 1, UploadedAt = now, SearchStatus = "Searchable",
            };
            if (current) doc.CurrentVersionId = ver.Id;
            db.TenantDocuments.Add(doc);
            db.TenantDocumentVersions.Add(ver);
            db.TenantDocumentChunks.Add(new TenantDocumentChunk { Id = Guid.NewGuid(), TenantId = tenant, DocumentId = doc.Id, VersionId = ver.Id, ChunkIndex = 0, Location = location, Text = text, CreatedAt = now });
            return doc.Id;
        }

        var word = "pgword" + Guid.NewGuid().ToString("N")[..8];
        var shared = Add(a, "Shared", "AllStaff", "Approved", true, null, $"The {word} rule applies");
        Add(a, "OwnerOnly", "OwnerOnly", "Approved", true, null, $"Salary {word} bands");
        Add(a, "Old version", "AllStaff", "Superseded", false, null, $"Outdated {word} text");
        Add(a, "Expired", "AllStaff", "Approved", true, now.AddDays(-1), $"Expired {word} licence");
        Add(a, "Waiting", "AllStaff", "NeedsReview", false, null, $"Draft {word} text");
        Add(b, "Other company", "AllStaff", "Approved", true, null, $"Their {word} secret");
        await db.SaveChangesAsync();

        var search = new TenantDocumentSearch(db);
        var owner = await search.SearchAsync(new DocumentCaller(a, 1, true), word, 10, default);
        Assert.Equal(new[] { "OwnerOnly", "Shared" }, owner.Select(h => h.Title).OrderBy(t => t).ToArray());
        var staff = await search.SearchAsync(new DocumentCaller(a, 2, false), word, 10, default);
        Assert.Equal(new[] { shared }, staff.Select(h => h.DocumentId).ToArray());
        var other = await search.SearchAsync(new DocumentCaller(b, 3, true), word, 10, default);
        Assert.Equal(new[] { "Other company" }, other.Select(h => h.Title).ToArray());
        Assert.Empty(await search.SearchAsync(new DocumentCaller(0, 1, true), word, 10, default));
        Assert.Empty(await search.SearchAsync(new DocumentCaller(a, 1, true), "the of and", 10, default)); // only stop words: nothing to search for
    }
}
