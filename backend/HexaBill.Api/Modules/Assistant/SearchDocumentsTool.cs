using System.Text.Json;
using HexaBill.Api.Modules.TenantDocuments;

namespace HexaBill.Api.Modules.Assistant;

/// <summary>
/// Search the company's APPROVED documents (licences, policies, manuals). Read-only and deterministic: the answer is a list of
/// quoted passages, each with its document, version and page, row or line, so a person can open the source. Visibility is decided on
/// the server from the caller's role and each document's setting; staff never get passages from owner-only documents.
/// </summary>
public sealed class SearchDocumentsTool : IAssistantTool
{
    private readonly TenantDocumentSearch _search;
    public SearchDocumentsTool(TenantDocumentSearch search) => _search = search;

    public string Name => "search_company_documents";
    public string Description => "Search the company's approved documents (licences, policies, manuals) and quote the matching passages with their source.";
    public IReadOnlyList<string> Arguments { get; } = new[] { "query", "limit" };
    public bool AllowedFor(AssistantCaller caller) => caller.TenantId > 0;

    public async Task<AssistantToolResult> RunAsync(AssistantCaller caller, JsonElement args, CancellationToken ct)
    {
        var query = ToolArgs.Text(args, "query", 2, 60);
        var limit = ToolArgs.Limit(args, 5, 10);
        var asOf = DateTime.UtcNow;
        var hits = await _search.SearchAsync(new DocumentCaller(caller.TenantId, caller.UserId, caller.IsOwnerOrAdmin), query, limit, ct);
        var rows = hits.Select(h => new Dictionary<string, object?>
        {
            ["id"] = $"{h.DocumentId:N}:{h.VersionNumber}:{h.Location}",
            ["documentId"] = h.DocumentId,
            ["title"] = h.Title,
            ["docType"] = h.DocType,
            ["version"] = h.VersionNumber,
            ["location"] = h.Location,
            ["snippet"] = h.Snippet,
        }).ToList();
        var sources = hits.Select(h => new AssistantSource("document", h.DocumentId.ToString("N"), $"{h.Title} v{h.VersionNumber}, {h.Location}", asOf)).ToList();
        return new AssistantToolResult(Name, rows, sources, asOf);
    }
}
