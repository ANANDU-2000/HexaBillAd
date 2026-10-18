using System.Security.Cryptography;
using HexaBill.Api.Core.Storage;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Modules.TenantDocuments;

/// <summary>Who is asking. Always built from the signed-in user, never from the request body.</summary>
public sealed record DocumentCaller(int TenantId, int UserId, bool CanManage);

public sealed class DocumentException : Exception
{
    public int StatusCode { get; }
    public DocumentException(int statusCode, string message) : base(message) => StatusCode = statusCode;
}

public sealed record DocumentVersionView(Guid Id, int VersionNumber, string FileName, string ContentType, long SizeBytes,
    string Sha256, string Status, DateTime? ExpiresOn, DateTime UploadedAt, DateTime? ReviewedAt);

public sealed record DocumentView(Guid Id, string Title, string DocType, string Visibility, string Status, Guid? CurrentVersionId,
    DateTime UpdatedAt, IReadOnlyList<DocumentVersionView> Versions);

public sealed record DocumentDownload(byte[] Bytes, string ContentType, string FileName);

/// <summary>
/// Company documents: validated upload, versions, owner approval, authorised download, delete.
/// Not built yet: text extraction, search/retrieval, malware scanning, expiry reminders, UI.
/// Uploading never trains or calls any model, and nothing here is read by the assistant yet.
/// </summary>
public sealed class TenantDocumentService
{
    public static readonly string[] DocTypes = { "Licence", "Policy", "Manual", "Other" };
    public static readonly string[] Visibilities = { "OwnerOnly", "AllStaff" };
    private const int MaxVersionsPerDocument = 20;
    private const int MaxActiveDocuments = 200;

    private readonly AppDbContext _db;
    private readonly IStorageService _storage;

    public TenantDocumentService(AppDbContext db, IStorageService storage)
    {
        _db = db;
        _storage = storage;
    }

    public sealed class UploadRequest
    {
        public Guid? DocumentId { get; set; }
        public string? Title { get; set; }
        public string? DocType { get; set; }
        public string? Visibility { get; set; }
        public DateTime? ExpiresOn { get; set; }
        public string? FileName { get; set; }
        public byte[] Data { get; set; } = Array.Empty<byte>();
    }

    public async Task<DocumentView> UploadAsync(DocumentCaller caller, UploadRequest req, CancellationToken ct)
    {
        RequireManage(caller);
        var check = TenantDocumentFileCheck.Check(req.FileName, req.Data);
        if (!check.Ok) throw new DocumentException(400, check.Reason ?? "The file was not accepted.");

        var now = DateTime.UtcNow;
        TenantDocument doc;
        int versionNumber;
        if (req.DocumentId is { } existingId)
        {
            doc = await _db.TenantDocuments.FirstOrDefaultAsync(d => d.Id == existingId && d.TenantId == caller.TenantId && d.Status == "Active", ct)
                ?? throw new DocumentException(404, "Document not found.");
            versionNumber = (await _db.TenantDocumentVersions.Where(v => v.TenantId == caller.TenantId && v.DocumentId == doc.Id).MaxAsync(v => (int?)v.VersionNumber, ct) ?? 0) + 1;
            if (versionNumber > MaxVersionsPerDocument) throw new DocumentException(409, $"A document can have at most {MaxVersionsPerDocument} versions.");
        }
        else
        {
            var title = (req.Title ?? string.Empty).Trim();
            if (title.Length is < 2 or > 200) throw new DocumentException(400, "Give the document a title of 2 to 200 characters.");
            var docType = DocTypes.FirstOrDefault(t => t.Equals(req.DocType ?? "Other", StringComparison.OrdinalIgnoreCase));
            if (docType == null) throw new DocumentException(400, "Document type must be Licence, Policy, Manual or Other.");
            var visibility = Visibilities.FirstOrDefault(v => v.Equals(req.Visibility ?? "OwnerOnly", StringComparison.OrdinalIgnoreCase));
            if (visibility == null) throw new DocumentException(400, "Visibility must be OwnerOnly or AllStaff.");
            if (await _db.TenantDocuments.CountAsync(d => d.TenantId == caller.TenantId && d.Status == "Active", ct) >= MaxActiveDocuments)
                throw new DocumentException(409, "The company has reached the document limit. Delete old documents first.");
            doc = new TenantDocument
            {
                Id = Guid.NewGuid(), TenantId = caller.TenantId, Title = title, DocType = docType, Visibility = visibility,
                Status = "Active", CreatedByUserId = caller.UserId, CreatedAt = now, UpdatedAt = now
            };
            _db.TenantDocuments.Add(doc);
            versionNumber = 1;
        }

        var versionId = Guid.NewGuid();
        // Key is built only from server-generated ids and a fixed extension from the allow-list.
        var key = $"tenants/{caller.TenantId}/documents/{doc.Id:N}/{versionId:N}/original{check.Extension}";
        var version = new TenantDocumentVersion
        {
            Id = versionId, TenantId = caller.TenantId, DocumentId = doc.Id, VersionNumber = versionNumber,
            OriginalFileName = TenantDocumentFileCheck.CleanFileName(req.FileName), ContentType = check.ContentType!,
            SizeBytes = req.Data.LongLength, Sha256 = Convert.ToHexString(SHA256.HashData(req.Data)).ToLowerInvariant(),
            StorageKey = key, Status = "NeedsReview", ExpiresOn = req.ExpiresOn?.ToUniversalTime(),
            UploadedByUserId = caller.UserId, UploadedAt = now
        };
        _db.TenantDocumentVersions.Add(version);
        doc.UpdatedAt = now;
        AddAudit(caller, "TenantDocumentUploaded", $"document={doc.Id:N}; version={versionNumber}; bytes={req.Data.Length}");

        // Store first: if the database save then fails, an unreferenced object is left but no row points at a missing file.
        await _storage.UploadAsync(key, req.Data, check.ContentType!);
        await _db.SaveChangesAsync(ct);
        return await GetAsync(caller, doc.Id, ct);
    }

    public async Task<IReadOnlyList<DocumentView>> ListAsync(DocumentCaller caller, CancellationToken ct)
    {
        var docs = await _db.TenantDocuments.AsNoTracking()
            .Where(d => d.TenantId == caller.TenantId && d.Status == "Active")
            .OrderByDescending(d => d.UpdatedAt).Take(MaxActiveDocuments).ToListAsync(ct);
        var ids = docs.Select(d => d.Id).ToList();
        var versions = await _db.TenantDocumentVersions.AsNoTracking()
            .Where(v => v.TenantId == caller.TenantId && ids.Contains(v.DocumentId) && v.Status != "Deleted").ToListAsync(ct);
        return docs.Where(d => CanSee(caller, d))
            .Select(d => ToView(d, versions.Where(v => v.DocumentId == d.Id).ToList(), caller)).ToList();
    }

    public async Task<DocumentView> GetAsync(DocumentCaller caller, Guid id, CancellationToken ct)
    {
        var doc = await _db.TenantDocuments.AsNoTracking().FirstOrDefaultAsync(d => d.Id == id && d.TenantId == caller.TenantId && d.Status == "Active", ct);
        if (doc == null || !CanSee(caller, doc)) throw new DocumentException(404, "Document not found.");
        var versions = await _db.TenantDocumentVersions.AsNoTracking()
            .Where(v => v.TenantId == caller.TenantId && v.DocumentId == id && v.Status != "Deleted").ToListAsync(ct);
        return ToView(doc, versions, caller);
    }

    /// <summary>Owner or admin approves a version; it becomes the current one and the previous approved version is superseded.</summary>
    public async Task<DocumentView> ApproveAsync(DocumentCaller caller, Guid documentId, Guid versionId, CancellationToken ct)
    {
        RequireManage(caller);
        var doc = await _db.TenantDocuments.FirstOrDefaultAsync(d => d.Id == documentId && d.TenantId == caller.TenantId && d.Status == "Active", ct)
            ?? throw new DocumentException(404, "Document not found.");
        var version = await _db.TenantDocumentVersions.FirstOrDefaultAsync(v => v.Id == versionId && v.DocumentId == documentId && v.TenantId == caller.TenantId, ct)
            ?? throw new DocumentException(404, "Version not found.");
        if (version.Status == "Approved") return await GetAsync(caller, documentId, ct);
        if (version.Status != "NeedsReview") throw new DocumentException(409, "Only a version that needs review can be approved.");
        if (version.ExpiresOn is { } exp && exp < DateTime.UtcNow) throw new DocumentException(409, "This version has already expired. Upload a current one.");

        var now = DateTime.UtcNow;
        foreach (var old in await _db.TenantDocumentVersions.Where(v => v.TenantId == caller.TenantId && v.DocumentId == documentId && v.Status == "Approved").ToListAsync(ct))
            old.Status = "Superseded";
        version.Status = "Approved";
        version.ReviewedByUserId = caller.UserId;
        version.ReviewedAt = now;
        doc.CurrentVersionId = version.Id;
        doc.UpdatedAt = now;
        AddAudit(caller, "TenantDocumentApproved", $"document={documentId:N}; version={version.VersionNumber}");
        await _db.SaveChangesAsync(ct);
        return await GetAsync(caller, documentId, ct);
    }

    /// <summary>
    /// Returns the bytes of one version. Managers may open any version; everyone else only the approved current version of a
    /// document shared with all staff. Missing, other-company and not-allowed all look the same (404).
    /// </summary>
    public async Task<DocumentDownload> DownloadAsync(DocumentCaller caller, Guid documentId, Guid? versionId, CancellationToken ct)
    {
        var doc = await _db.TenantDocuments.AsNoTracking().FirstOrDefaultAsync(d => d.Id == documentId && d.TenantId == caller.TenantId && d.Status == "Active", ct);
        if (doc == null || !CanSee(caller, doc)) throw new DocumentException(404, "Document not found.");
        var wanted = versionId ?? doc.CurrentVersionId;
        if (wanted == null) throw new DocumentException(404, "This document has no approved version yet.");
        var version = await _db.TenantDocumentVersions.AsNoTracking().FirstOrDefaultAsync(v => v.Id == wanted && v.DocumentId == documentId && v.TenantId == caller.TenantId && v.Status != "Deleted", ct);
        if (version == null) throw new DocumentException(404, "Version not found.");
        if (!caller.CanManage && !(version.Status == "Approved" && doc.CurrentVersionId == version.Id)) throw new DocumentException(404, "Version not found.");
        // The stored key was built by this service; refuse anything that is not under this company's own prefix.
        if (!version.StorageKey.StartsWith($"tenants/{caller.TenantId}/documents/", StringComparison.Ordinal)) throw new DocumentException(404, "Version not found.");
        byte[] bytes;
        try { bytes = await _storage.ReadBytesAsync(version.StorageKey); }
        catch (FileNotFoundException) { throw new DocumentException(404, "The file is no longer available."); }
        AddAudit(caller, "TenantDocumentDownloaded", $"document={documentId:N}; version={version.VersionNumber}");
        await _db.SaveChangesAsync(ct);
        return new DocumentDownload(bytes, version.ContentType, version.OriginalFileName);
    }

    /// <summary>
    /// Removes the document from lists, download and (later) retrieval, and overwrites the stored file with an empty one.
    /// Backups taken earlier may still hold the content until they expire.
    /// </summary>
    public async Task DeleteAsync(DocumentCaller caller, Guid documentId, CancellationToken ct)
    {
        RequireManage(caller);
        var doc = await _db.TenantDocuments.FirstOrDefaultAsync(d => d.Id == documentId && d.TenantId == caller.TenantId && d.Status == "Active", ct)
            ?? throw new DocumentException(404, "Document not found.");
        var versions = await _db.TenantDocumentVersions.Where(v => v.TenantId == caller.TenantId && v.DocumentId == documentId && v.Status != "Deleted").ToListAsync(ct);
        var now = DateTime.UtcNow;
        doc.Status = "Deleted";
        doc.DeletedAt = now;
        doc.UpdatedAt = now;
        doc.CurrentVersionId = null;
        foreach (var v in versions) v.Status = "Deleted";
        AddAudit(caller, "TenantDocumentDeleted", $"document={documentId:N}; versions={versions.Count}");
        await _db.SaveChangesAsync(ct);
        foreach (var v in versions)
        {
            try { await _storage.UploadAsync(v.StorageKey, Array.Empty<byte>(), "application/octet-stream"); }
            catch { /* the row is already deleted and unreachable; a leftover object is cleaned up by the storage retention job to come */ }
        }
    }

    private static void RequireManage(DocumentCaller caller)
    {
        if (!caller.CanManage) throw new DocumentException(403, "Only the owner or an admin can manage company documents.");
    }

    private static bool CanSee(DocumentCaller caller, TenantDocument doc) =>
        caller.CanManage || (doc.Visibility == "AllStaff" && doc.CurrentVersionId != null);

    private static DocumentView ToView(TenantDocument d, List<TenantDocumentVersion> versions, DocumentCaller caller)
    {
        var visible = caller.CanManage ? versions : versions.Where(v => v.Id == d.CurrentVersionId && v.Status == "Approved").ToList();
        return new DocumentView(d.Id, d.Title, d.DocType, d.Visibility, d.Status, d.CurrentVersionId, d.UpdatedAt,
            visible.OrderByDescending(v => v.VersionNumber).Select(v =>
                new DocumentVersionView(v.Id, v.VersionNumber, v.OriginalFileName, v.ContentType, v.SizeBytes, v.Sha256, v.Status, v.ExpiresOn, v.UploadedAt, v.ReviewedAt)).ToList());
    }

    private void AddAudit(DocumentCaller caller, string action, string details) =>
        _db.AuditLogs.Add(new AuditLog { TenantId = caller.TenantId, OwnerId = caller.TenantId, UserId = caller.UserId, Action = action, Details = details, CreatedAt = DateTime.UtcNow });
}
