using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Modules.TenantDocuments;

/// <summary>One cited passage. Document, version and location let a person open the source and check it.</summary>
public sealed record DocumentHit(Guid DocumentId, string Title, string DocType, int VersionNumber, string Location, string Snippet, double Score);

/// <summary>
/// Search over the text of APPROVED, CURRENT, unexpired document versions the caller may see. Scope comes from the signed-in
/// user: the company, the role and each document's visibility are checked on the server on every search; nothing is taken from
/// the browser or a model. Plain term matching, no model: results are quoted passages, never generated text.
/// </summary>
public sealed class TenantDocumentSearch
{
    public const int MaxCandidateChunks = 4000;
    private static readonly HashSet<string> Stop = new(StringComparer.OrdinalIgnoreCase)
    {
        "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are", "what", "does", "do", "our", "my", "we", "it", "this", "that", "with", "about", "say", "says",
    };

    private readonly AppDbContext _db;

    public TenantDocumentSearch(AppDbContext db) => _db = db;

    public static IReadOnlyList<string> Terms(string? query) =>
        (query ?? string.Empty).ToLowerInvariant()
            .Split(new[] { ' ', '\t', '\n', ',', '.', ';', ':', '?', '!', '"', '\'', '(', ')', '/', '\\', '-', '_' }, StringSplitOptions.RemoveEmptyEntries)
            .Where(t => t.Length >= 2 && !Stop.Contains(t)).Distinct().Take(8).ToList();

    public async Task<IReadOnlyList<DocumentHit>> SearchAsync(DocumentCaller caller, string query, int limit, CancellationToken ct)
    {
        if (caller.TenantId <= 0) return Array.Empty<DocumentHit>();
        var terms = Terms(query);
        if (terms.Count == 0) return Array.Empty<DocumentHit>();
        var now = DateTime.UtcNow;

        // Only the current approved version of each active document, not expired, visible to this caller.
        var rows = await (
            from c in _db.TenantDocumentChunks.AsNoTracking()
            join d in _db.TenantDocuments.AsNoTracking() on c.DocumentId equals d.Id
            join v in _db.TenantDocumentVersions.AsNoTracking() on c.VersionId equals v.Id
            where c.TenantId == caller.TenantId && d.TenantId == caller.TenantId && v.TenantId == caller.TenantId
                  && d.Status == "Active" && d.CurrentVersionId == v.Id && v.Status == "Approved"
                  && (v.ExpiresOn == null || v.ExpiresOn >= now)
                  && (caller.CanManage || d.Visibility == "AllStaff")
            orderby c.DocumentId, c.ChunkIndex
            select new { c.DocumentId, d.Title, d.DocType, v.VersionNumber, c.Location, c.Text }
        ).Take(MaxCandidateChunks).ToListAsync(ct);

        var hits = new List<DocumentHit>();
        foreach (var r in rows)
        {
            var lower = r.Text.ToLowerInvariant();
            double score = 0;
            var firstAt = -1;
            foreach (var term in terms)
            {
                var count = 0;
                for (var i = lower.IndexOf(term, StringComparison.Ordinal); i >= 0; i = lower.IndexOf(term, i + term.Length, StringComparison.Ordinal))
                {
                    if (count == 0 && (firstAt < 0 || i < firstAt)) firstAt = i;
                    count++;
                }
                if (count > 0) score += 1 + Math.Log(1 + count);
            }
            if (score <= 0) continue;
            // Matching more of the distinct terms matters more than repeating one.
            hits.Add(new DocumentHit(r.DocumentId, r.Title, r.DocType, r.VersionNumber, r.Location, Snippet(r.Text, firstAt), Math.Round(score, 3)));
        }
        return hits.OrderByDescending(h => h.Score).ThenBy(h => h.Title, StringComparer.Ordinal).ThenBy(h => h.Location, StringComparer.Ordinal)
            .Take(Math.Clamp(limit, 1, 10)).ToList();
    }

    private static string Snippet(string text, int at)
    {
        const int window = 320;
        if (text.Length <= window) return text;
        var start = Math.Max(0, (at < 0 ? 0 : at) - 80);
        var piece = text.Substring(start, Math.Min(window, text.Length - start)).Trim();
        return (start > 0 ? "… " : string.Empty) + piece + (start + window < text.Length ? " …" : string.Empty);
    }
}
