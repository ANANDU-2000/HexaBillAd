using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using HexaBill.Api.Data;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HexaBill.Tests;

/// <summary>Company documents: validated upload, owner approval, isolation between companies, safe download, delete.</summary>
[Collection("HttpIntegration")]
public class TenantDocumentsHttpTests
{
    private readonly HexaBillWebApplicationFactory _factory;

    public TenantDocumentsHttpTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    private HttpClient Owner(int tenantId, string slug) => HttpIntegrationClient.Create(_factory, tenantId, slug);

    private HttpClient Staff(int tenantId, string slug)
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            BaseAddress = new Uri($"http://{slug}.hexabill.company"),
        });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer", TestJwtFactory.CreateAuthenticatedApiToken(tenantId, tenantId, slug, role: "Staff"));
        return client;
    }

    private static byte[] Pdf(string marker = "x") => Encoding.ASCII.GetBytes("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n% " + marker + "\ntrailer<<>>\n%%EOF");
    private static byte[] Png() => new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0 };
    private static string Unique() => "Doc " + Guid.NewGuid().ToString("N")[..8];

    private static MultipartFormDataContent Form(byte[] data, string fileName, string? title = null, string? docType = "Licence",
        string? visibility = "OwnerOnly", Guid? documentId = null, string? contentType = "application/octet-stream")
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(data);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType ?? "application/octet-stream");
        form.Add(file, "File", fileName);
        if (title != null) form.Add(new StringContent(title), "Title");
        if (docType != null) form.Add(new StringContent(docType), "DocType");
        if (visibility != null) form.Add(new StringContent(visibility), "Visibility");
        if (documentId != null) form.Add(new StringContent(documentId.ToString()!), "DocumentId");
        return form;
    }

    private static async Task<JsonElement> Data(HttpResponseMessage r) => (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");

    private async Task<(Guid doc, Guid version)> Upload(HttpClient client, byte[]? data = null, string fileName = "licence.pdf", string? visibility = "OwnerOnly", string? title = null)
    {
        var response = await client.PostAsync("/api/tenant-documents", Form(data ?? Pdf(), fileName, title ?? Unique(), visibility: visibility));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var d = await Data(response);
        return (d.GetProperty("id").GetGuid(), d.GetProperty("versions")[0].GetProperty("id").GetGuid());
    }

    private async Task Approve(HttpClient client, Guid doc, Guid version) =>
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync($"/api/tenant-documents/{doc}/versions/{version}/approve", null)).StatusCode);

    [Fact]
    public async Task Upload_StoresMetadata_ServerChoosesTheType_AndWaitsForReview()
    {
        using var owner = Owner(1, "tenanta");
        var data = Pdf("meta");
        // The browser claims image/png and a path-like name; neither is trusted.
        var response = await owner.PostAsync("/api/tenant-documents", Form(data, @"C:\temp\..\licence.pdf", "Trade licence", contentType: "image/png"));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var d = await Data(response);
        var v = d.GetProperty("versions")[0];
        Assert.Equal("application/pdf", v.GetProperty("contentType").GetString());
        Assert.Equal("licence.pdf", v.GetProperty("fileName").GetString());
        Assert.Equal("NeedsReview", v.GetProperty("status").GetString());
        Assert.Equal(1, v.GetProperty("versionNumber").GetInt32());
        Assert.Equal(data.Length, v.GetProperty("sizeBytes").GetInt64());
        Assert.Equal(64, v.GetProperty("sha256").GetString()!.Length);
        Assert.Equal(JsonValueKind.Null, d.GetProperty("currentVersionId").ValueKind);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var id = d.GetProperty("id").GetGuid();
        var key = (await db.TenantDocumentVersions.IgnoreQueryFilters().AsNoTracking().FirstAsync(x => x.DocumentId == id)).StorageKey;
        Assert.StartsWith("tenants/1/documents/", key);
        Assert.EndsWith("/original.pdf", key);
        Assert.DoesNotContain("licence", key);
    }

    public static IEnumerable<object[]> BadFiles()
    {
        yield return new object[] { "empty.pdf", Array.Empty<byte>(), "Choose a file" };
        yield return new object[] { "evil.exe", new byte[] { (byte)'M', (byte)'Z', 0x90, 0 }, "executable" };
        yield return new object[] { "renamed.pdf", new byte[] { (byte)'M', (byte)'Z', 0x90, 0 }, "executable" };
        yield return new object[] { "pack.zip", new byte[] { 0x50, 0x4B, 0x03, 0x04, 0, 0 }, "Archives" };
        yield return new object[] { "sheet.docx", new byte[] { 0x50, 0x4B, 0x03, 0x04, 0, 0 }, "Office" };
        yield return new object[] { "fake.pdf", Encoding.ASCII.GetBytes("hello, not a pdf"), "not a PDF" };
        yield return new object[] { "fake.png", Encoding.ASCII.GetBytes("hello, not a png"), "not a PNG" };
        yield return new object[] { "secret.pdf", Encoding.ASCII.GetBytes("%PDF-1.7\n<</Encrypt 5 0 R>>"), "Password" };
        yield return new object[] { "script.pdf", Encoding.ASCII.GetBytes("%PDF-1.7\n<</S/JavaScript/JS(app.alert(1))>>"), "scripts" };
        yield return new object[] { "bin.txt", new byte[] { (byte)'a', 0, (byte)'b' }, "binary" };
        yield return new object[] { "latin.csv", new byte[] { 0xE9, 0xE8, 0xFF }, "UTF-8" };
        yield return new object[] { "noext", Encoding.ASCII.GetBytes("hello"), "not supported" };
        yield return new object[] { "page.html", Encoding.ASCII.GetBytes("<script>1</script>"), "not supported" };
    }

    [Theory]
    [MemberData(nameof(BadFiles))]
    public async Task Upload_RefusesUnsafeOrUnsupportedFiles_WithAReason_AndStoresNothing(string name, byte[] data, string reasonFragment)
    {
        using var owner = Owner(1, "tenanta");
        using var scope = _factory.Services.CreateScope();
        var before = await scope.ServiceProvider.GetRequiredService<AppDbContext>().TenantDocumentVersions.IgnoreQueryFilters().CountAsync();
        var response = await owner.PostAsync("/api/tenant-documents", Form(data, name, Unique()));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var message = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("message").GetString()!;
        Assert.Contains(reasonFragment, message, StringComparison.OrdinalIgnoreCase);
        var after = await _factory.Services.CreateScope().ServiceProvider.GetRequiredService<AppDbContext>().TenantDocumentVersions.IgnoreQueryFilters().CountAsync();
        Assert.Equal(before, after);
    }

    [Fact]
    public async Task Upload_RefusesOversizedFiles_AndTooManyCsvRows()
    {
        using var owner = Owner(1, "tenanta");
        var bigPng = new byte[10 * 1024 * 1024 + 1];
        Array.Copy(Png(), bigPng, 12);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PostAsync("/api/tenant-documents", Form(bigPng, "big.png", Unique()))).StatusCode);

        var csv = Encoding.UTF8.GetBytes(string.Concat(Enumerable.Repeat("a,b\n", 10_001)));
        var response = await owner.PostAsync("/api/tenant-documents", Form(csv, "rows.csv", Unique()));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("10,000", (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("message").GetString());

        var ok = Encoding.UTF8.GetBytes("name,phone\nعلي,050\n");
        Assert.Equal(HttpStatusCode.Created, (await owner.PostAsync("/api/tenant-documents", Form(ok, "ok.csv", Unique()))).StatusCode);
    }

    [Fact]
    public async Task Upload_ValidatesTitleTypeAndVisibility()
    {
        using var owner = Owner(1, "tenanta");
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PostAsync("/api/tenant-documents", Form(Pdf(), "a.pdf", " "))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PostAsync("/api/tenant-documents", Form(Pdf(), "a.pdf", Unique(), docType: "Secret"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PostAsync("/api/tenant-documents", Form(Pdf(), "a.pdf", Unique(), visibility: "Everyone"))).StatusCode);
    }

    [Fact]
    public async Task Staff_CannotUploadApproveOrDelete()
    {
        using var owner = Owner(1, "tenanta");
        using var staff = Staff(1, "tenanta");
        Assert.Equal(HttpStatusCode.Forbidden, (await staff.PostAsync("/api/tenant-documents", Form(Pdf(), "a.pdf", Unique()))).StatusCode);
        var (doc, version) = await Upload(owner, visibility: "AllStaff");
        Assert.Equal(HttpStatusCode.Forbidden, (await staff.PostAsync($"/api/tenant-documents/{doc}/versions/{version}/approve", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await staff.DeleteAsync($"/api/tenant-documents/{doc}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await owner.GetAsync($"/api/tenant-documents/{doc}")).StatusCode); // still there
    }

    [Fact]
    public async Task Staff_SeeOnlyApprovedDocumentsSharedWithAllStaff()
    {
        using var owner = Owner(1, "tenanta");
        using var staff = Staff(1, "tenanta");
        var (shared, sharedV) = await Upload(owner, Pdf("shared"), visibility: "AllStaff", title: Unique());
        var (priv, privV) = await Upload(owner, Pdf("priv"), visibility: "OwnerOnly", title: Unique());

        // Nothing is visible to staff before approval, not even a shared document.
        Assert.Equal(HttpStatusCode.NotFound, (await staff.GetAsync($"/api/tenant-documents/{shared}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await staff.GetAsync($"/api/tenant-documents/{shared}/download")).StatusCode);

        await Approve(owner, shared, sharedV);
        await Approve(owner, priv, privV);

        var list = await Data(await staff.GetAsync("/api/tenant-documents"));
        var ids = list.EnumerateArray().Select(x => x.GetProperty("id").GetGuid()).ToList();
        Assert.Contains(shared, ids);
        Assert.DoesNotContain(priv, ids);
        Assert.Equal(HttpStatusCode.NotFound, (await staff.GetAsync($"/api/tenant-documents/{priv}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await staff.GetAsync($"/api/tenant-documents/{priv}/download")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await staff.GetAsync($"/api/tenant-documents/{shared}/download")).StatusCode);
    }

    [Fact]
    public async Task Download_IsAnAttachment_WithSafeHeaders_AndTheExactBytes()
    {
        using var owner = Owner(1, "tenanta");
        var data = Pdf("bytes");
        var (doc, version) = await Upload(owner, data, "my licence.pdf");
        await Approve(owner, doc, version);
        var response = await owner.GetAsync($"/api/tenant-documents/{doc}/download");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(data, await response.Content.ReadAsByteArrayAsync());
        Assert.Equal("application/pdf", response.Content.Headers.ContentType!.MediaType);
        Assert.Equal("attachment", response.Content.Headers.ContentDisposition!.DispositionType);
        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Contains("no-store", response.Headers.GetValues("Cache-Control").Single());
        Assert.Contains("private", response.Headers.GetValues("Cache-Control").Single());
    }

    [Fact]
    public async Task AnotherCompany_CannotSeeDownloadApproveVersionOrDelete_AndListsStayApart()
    {
        using var a = Owner(1, "tenanta");
        using var b = Owner(2, "tenantb");
        var (doc, version) = await Upload(a, title: Unique());
        await Approve(a, doc, version);

        Assert.Equal(HttpStatusCode.NotFound, (await b.GetAsync($"/api/tenant-documents/{doc}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await b.GetAsync($"/api/tenant-documents/{doc}/download")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await b.GetAsync($"/api/tenant-documents/{doc}/download?versionId={version}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await b.PostAsync($"/api/tenant-documents/{doc}/versions/{version}/approve", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await b.DeleteAsync($"/api/tenant-documents/{doc}")).StatusCode);
        // Adding a version to someone else's document must not work either.
        Assert.Equal(HttpStatusCode.NotFound, (await b.PostAsync("/api/tenant-documents", Form(Pdf("intruder"), "x.pdf", documentId: doc))).StatusCode);

        var list = await Data(await b.GetAsync("/api/tenant-documents"));
        Assert.DoesNotContain(list.EnumerateArray(), x => x.GetProperty("id").GetGuid() == doc);
        // Still intact for the owner.
        Assert.Equal(HttpStatusCode.OK, (await a.GetAsync($"/api/tenant-documents/{doc}/download")).StatusCode);
    }

    [Fact]
    public async Task ForgedTenantParameters_AreIgnored()
    {
        using var a = Owner(1, "tenanta");
        using var b = Owner(2, "tenantb");
        var (doc, version) = await Upload(a, title: Unique());
        await Approve(a, doc, version);
        Assert.Equal(HttpStatusCode.NotFound, (await b.GetAsync($"/api/tenant-documents/{doc}?tenantId=1")).StatusCode);
        var form = Form(Pdf("forged"), "f.pdf", Unique());
        form.Add(new StringContent("1"), "TenantId");
        var created = await b.PostAsync("/api/tenant-documents", form);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var id = (await Data(created)).GetProperty("id").GetGuid();
        using var scope = _factory.Services.CreateScope();
        var row = await scope.ServiceProvider.GetRequiredService<AppDbContext>().TenantDocuments.IgnoreQueryFilters().AsNoTracking().FirstAsync(d => d.Id == id);
        Assert.Equal(2, row.TenantId);
    }

    [Fact]
    public async Task NewVersion_NeedsApproval_AndApprovalSupersedesTheOldOne()
    {
        using var owner = Owner(1, "tenanta");
        using var staff = Staff(1, "tenanta");
        var first = Pdf("v1");
        var second = Pdf("v2 changed");
        var (doc, v1) = await Upload(owner, first, visibility: "AllStaff");
        await Approve(owner, doc, v1);

        var response = await owner.PostAsync("/api/tenant-documents", Form(second, "licence-2025.pdf", documentId: doc));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var d = await Data(response);
        Assert.Equal(2, d.GetProperty("versions").GetArrayLength());
        var v2 = d.GetProperty("versions")[0];
        Assert.Equal(2, v2.GetProperty("versionNumber").GetInt32());
        Assert.Equal("NeedsReview", v2.GetProperty("status").GetString());
        // Until approved, readers still get the old approved file.
        Assert.Equal(first, await (await staff.GetAsync($"/api/tenant-documents/{doc}/download")).Content.ReadAsByteArrayAsync());
        // Staff cannot ask for the unapproved version.
        Assert.Equal(HttpStatusCode.NotFound, (await staff.GetAsync($"/api/tenant-documents/{doc}/download?versionId={v2.GetProperty("id").GetGuid()}")).StatusCode);

        await Approve(owner, doc, v2.GetProperty("id").GetGuid());
        Assert.Equal(second, await (await staff.GetAsync($"/api/tenant-documents/{doc}/download")).Content.ReadAsByteArrayAsync());
        var after = await Data(await owner.GetAsync($"/api/tenant-documents/{doc}"));
        var statuses = after.GetProperty("versions").EnumerateArray().ToDictionary(x => x.GetProperty("versionNumber").GetInt32(), x => x.GetProperty("status").GetString());
        Assert.Equal("Superseded", statuses[1]);
        Assert.Equal("Approved", statuses[2]);
        // The old version stays available to the owner for audit.
        Assert.Equal(first, await (await owner.GetAsync($"/api/tenant-documents/{doc}/download?versionId={v1}")).Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task Approve_IsRefusedForAnExpiredVersion_AndTheNoApprovedVersionDownloadIs404()
    {
        using var owner = Owner(1, "tenanta");
        var form = Form(Pdf("expired"), "old.pdf", Unique());
        form.Add(new StringContent(DateTime.UtcNow.AddDays(-2).ToString("o")), "ExpiresOn");
        var created = await owner.PostAsync("/api/tenant-documents", form);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var d = await Data(created);
        var doc = d.GetProperty("id").GetGuid();
        var v = d.GetProperty("versions")[0].GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.NotFound, (await owner.GetAsync($"/api/tenant-documents/{doc}/download")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await owner.PostAsync($"/api/tenant-documents/{doc}/versions/{v}/approve", null)).StatusCode);
    }

    [Fact]
    public async Task Delete_RemovesTheDocument_FromEveryReader_AndEmptiesTheStoredFile()
    {
        using var owner = Owner(1, "tenanta");
        using var staff = Staff(1, "tenanta");
        var (doc, version) = await Upload(owner, visibility: "AllStaff");
        await Approve(owner, doc, version);
        string key;
        using (var scope = _factory.Services.CreateScope())
            key = (await scope.ServiceProvider.GetRequiredService<AppDbContext>().TenantDocumentVersions.IgnoreQueryFilters().AsNoTracking().FirstAsync(x => x.Id == version)).StorageKey;

        Assert.Equal(HttpStatusCode.OK, (await owner.DeleteAsync($"/api/tenant-documents/{doc}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.GetAsync($"/api/tenant-documents/{doc}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.GetAsync($"/api/tenant-documents/{doc}/download")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await staff.GetAsync($"/api/tenant-documents/{doc}/download")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.PostAsync($"/api/tenant-documents/{doc}/versions/{version}/approve", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.DeleteAsync($"/api/tenant-documents/{doc}")).StatusCode);
        var list = await Data(await owner.GetAsync("/api/tenant-documents"));
        Assert.DoesNotContain(list.EnumerateArray(), x => x.GetProperty("id").GetGuid() == doc);

        using var s2 = _factory.Services.CreateScope();
        var bytes = await s2.ServiceProvider.GetRequiredService<HexaBill.Api.Core.Storage.IStorageService>().ReadBytesAsync(key);
        Assert.Empty(bytes);
    }

    [Fact]
    public async Task UploadsAndDownloads_AreAudited_WithoutFileNamesOrContent()
    {
        using var owner = Owner(1, "tenanta");
        var (doc, version) = await Upload(owner, fileName: "very-private-name.pdf");
        await Approve(owner, doc, version);
        await owner.GetAsync($"/api/tenant-documents/{doc}/download");
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var rows = await db.AuditLogs.IgnoreQueryFilters().Where(a => a.Action.StartsWith("TenantDocument") && a.Details!.Contains(doc.ToString("N"))).ToListAsync();
        Assert.Contains(rows, r => r.Action == "TenantDocumentUploaded");
        Assert.Contains(rows, r => r.Action == "TenantDocumentApproved");
        Assert.Contains(rows, r => r.Action == "TenantDocumentDownloaded");
        Assert.All(rows, r => Assert.DoesNotContain("very-private-name", r.Details));
    }

    [Fact]
    public async Task Unauthenticated_IsRefused()
    {
        using var anon = _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, BaseAddress = new Uri("http://tenanta.hexabill.company") });
        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.GetAsync("/api/tenant-documents")).StatusCode);
    }
}
