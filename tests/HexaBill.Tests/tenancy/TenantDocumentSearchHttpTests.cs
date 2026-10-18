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

/// <summary>
/// Searching company documents: only approved, current, unexpired, visible text is found; every hit names its source; replaced, expired
/// and deleted text disappears; another company and staff-without-visibility see nothing; files that cannot be read are stored but not searchable.
/// </summary>
[Collection("HttpIntegration")]
public class TenantDocumentSearchHttpTests
{
    private readonly HexaBillWebApplicationFactory _factory;
    private readonly TestAiControl _ai;

    public TenantDocumentSearchHttpTests(HexaBillWebApplicationFactory factory)
    {
        _factory = factory;
        _ai = factory.Services.GetRequiredService<TestAiControl>();
        _ai.ResetAll();
    }

    private HttpClient Owner(int tenantId = 1, string slug = "tenanta") => HttpIntegrationClient.Create(_factory, tenantId, slug);

    private HttpClient Staff(int tenantId = 1, string slug = "tenanta")
    {
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, BaseAddress = new Uri($"http://{slug}.hexabill.company") });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", TestJwtFactory.CreateAuthenticatedApiToken(tenantId, tenantId, slug, role: "Staff"));
        return client;
    }

    private static string Word() => "zq" + Guid.NewGuid().ToString("N")[..8];

    private static MultipartFormDataContent Form(byte[] data, string fileName, string title, string visibility = "OwnerOnly", Guid? documentId = null)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(data);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        form.Add(file, "File", fileName);
        form.Add(new StringContent(title), "Title");
        form.Add(new StringContent("Policy"), "DocType");
        form.Add(new StringContent(visibility), "Visibility");
        if (documentId != null) form.Add(new StringContent(documentId.ToString()!), "DocumentId");
        return form;
    }

    private static async Task<JsonElement> Data(HttpResponseMessage r) => (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");

    private async Task<(Guid doc, Guid version)> Upload(HttpClient client, string text, string fileName = "policy.txt", string visibility = "OwnerOnly", Guid? documentId = null, string? title = null)
    {
        var response = await client.PostAsync("/api/tenant-documents", Form(Encoding.UTF8.GetBytes(text), fileName, title ?? "Search " + Guid.NewGuid().ToString("N")[..6], visibility, documentId));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var d = await Data(response);
        return (d.GetProperty("id").GetGuid(), d.GetProperty("versions")[0].GetProperty("id").GetGuid());
    }

    private async Task<JsonElement> Approve(HttpClient client, Guid doc, Guid version)
    {
        var response = await client.PostAsync($"/api/tenant-documents/{doc}/versions/{version}/approve", null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await Data(response);
    }

    private async Task<JsonElement[]> Search(HttpClient client, string query)
    {
        var response = await client.PostAsJsonAsync("/api/assistant/tools/search_company_documents", new { query });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await Data(response)).GetProperty("data").EnumerateArray().ToArray();
    }

    private async Task<int> ChunkCount(Guid doc)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.SetRequestTenantScope(null, true);
        return await db.TenantDocumentChunks.IgnoreQueryFilters().CountAsync(c => c.DocumentId == doc);
    }

    [Fact]
    public async Task ApprovedText_IsFound_WithItsSource_ButNotBeforeApproval()
    {
        var word = Word();
        using var owner = Owner();
        var (doc, version) = await Upload(owner, $"Refund policy\n\nCustomers may return goods within {word} days of purchase.\n", title: "Refund policy");
        Assert.Empty(await Search(owner, word)); // waiting for review: not searchable
        var approved = await Approve(owner, doc, version);
        var v = approved.GetProperty("versions")[0];
        Assert.Equal("Searchable", v.GetProperty("searchStatus").GetString());

        var hits = await Search(owner, word);
        var hit = Assert.Single(hits);
        Assert.Equal("Refund policy", hit.GetProperty("title").GetString());
        Assert.Equal(1, hit.GetProperty("version").GetInt32());
        Assert.Matches("^lines? \\d", hit.GetProperty("location").GetString());
        Assert.Contains(word, hit.GetProperty("snippet").GetString());
        Assert.Equal(doc, hit.GetProperty("documentId").GetGuid());
    }

    [Fact]
    public async Task ANewApprovedVersion_ReplacesTheOldText()
    {
        var oldWord = Word();
        var newWord = Word();
        using var owner = Owner();
        var (doc, v1) = await Upload(owner, $"Handbook says {oldWord}.");
        await Approve(owner, doc, v1);
        Assert.Single(await Search(owner, oldWord));

        var (_, v2) = await Upload(owner, $"Handbook now says {newWord}.", documentId: doc);
        Assert.Single(await Search(owner, oldWord));   // v2 is only waiting for review: v1 stays the current text
        Assert.Empty(await Search(owner, newWord));

        await Approve(owner, doc, v2);
        Assert.Empty(await Search(owner, oldWord));     // replaced text can no longer be found
        var hit = Assert.Single(await Search(owner, newWord));
        Assert.Equal(2, hit.GetProperty("version").GetInt32());
        Assert.Equal(1, await ChunkCount(doc));
    }

    [Fact]
    public async Task DeletingTheDocument_RemovesItsText()
    {
        var word = Word();
        using var owner = Owner();
        var (doc, version) = await Upload(owner, $"Temporary rule {word}.");
        await Approve(owner, doc, version);
        Assert.Single(await Search(owner, word));
        Assert.Equal(HttpStatusCode.OK, (await owner.DeleteAsync($"/api/tenant-documents/{doc}")).StatusCode);
        Assert.Empty(await Search(owner, word));
        Assert.Equal(0, await ChunkCount(doc));
    }

    [Fact]
    public async Task Visibility_IsDecidedOnTheServer_ForEveryRole()
    {
        var ownerOnlyWord = Word();
        var sharedWord = Word();
        using var owner = Owner();
        var (a, av) = await Upload(owner, $"Salary bands {ownerOnlyWord}.", visibility: "OwnerOnly");
        var (b, bv) = await Upload(owner, $"Opening hours {sharedWord}.", visibility: "AllStaff");
        await Approve(owner, a, av);
        await Approve(owner, b, bv);
        using var staff = Staff();
        Assert.Single(await Search(owner, ownerOnlyWord));
        Assert.Empty(await Search(staff, ownerOnlyWord));
        Assert.Single(await Search(owner, sharedWord));
        Assert.Single(await Search(staff, sharedWord));
    }

    [Fact]
    public async Task AnotherCompany_NeverFindsThisCompanysText()
    {
        var word = Word();
        using var ownerA = Owner();
        var (doc, version) = await Upload(ownerA, $"Confidential supplier terms {word}.", visibility: "AllStaff");
        await Approve(ownerA, doc, version);
        Assert.Single(await Search(ownerA, word));
        using var ownerB = Owner(2, "tenantb");
        Assert.Empty(await Search(ownerB, word));
        // A forged company id in the request is refused, not obeyed.
        var forged = await ownerB.PostAsJsonAsync("/api/assistant/tools/search_company_documents", new { query = word, tenantId = 1 });
        Assert.Equal(HttpStatusCode.BadRequest, forged.StatusCode);
    }

    [Fact]
    public async Task AnExpiredVersion_IsNoLongerFound()
    {
        var word = Word();
        using var owner = Owner();
        var (doc, version) = await Upload(owner, $"Licence valid {word}.");
        await Approve(owner, doc, version);
        Assert.Single(await Search(owner, word));
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.SetRequestTenantScope(null, true);
            (await db.TenantDocumentVersions.IgnoreQueryFilters().FirstAsync(v => v.Id == version)).ExpiresOn = DateTime.UtcNow.AddDays(-1);
            await db.SaveChangesAsync();
        }
        Assert.Empty(await Search(owner, word));
    }

    [Fact]
    public async Task CsvRows_AreData_WithTheHeaderKeptAndTheRowsNamed_AndFormulasStayText()
    {
        var word = Word();
        using var owner = Owner();
        var csv = $"item,limit,note\nbags,10,ok\n=HYPERLINK(\"http://x\"),20,{word}\nboxes,30,fine\n";
        var (doc, version) = await Upload(owner, csv, "limits.csv");
        await Approve(owner, doc, version);
        var hit = Assert.Single(await Search(owner, word));
        Assert.Matches("^rows? \\d", hit.GetProperty("location").GetString());
        var snippet = hit.GetProperty("snippet").GetString()!;
        Assert.StartsWith("item,limit,note", snippet);   // header repeated so the row still says what its columns mean
        Assert.Contains("=HYPERLINK", snippet);            // kept as plain text, never evaluated
    }

    [Fact]
    public async Task APdfWithATextLayer_IsSearchable_ByPage()
    {
        var word = Word();
        using var owner = Owner();
        var pdf = MiniPdf.Build($"Trade licence number {word} is valid");
        var response = await owner.PostAsync("/api/tenant-documents", Form(pdf, "licence.pdf", "Trade licence pdf"));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var d = await Data(response);
        var id = d.GetProperty("id").GetGuid();
        var vid = d.GetProperty("versions")[0].GetProperty("id").GetGuid();
        var approved = await Approve(owner, id, vid);
        Assert.Equal("Searchable", approved.GetProperty("versions")[0].GetProperty("searchStatus").GetString());
        var hit = Assert.Single(await Search(owner, word));
        Assert.Equal("page 1", hit.GetProperty("location").GetString());
    }

    [Fact]
    public async Task ImagesAndUnreadableFiles_AreStoredAndApproved_ButSaySoPlainly_NotSearchable()
    {
        using var owner = Owner();
        var png = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0 };
        var response = await owner.PostAsync("/api/tenant-documents", Form(png, "scan.png", "Scanned licence"));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var d = await Data(response);
        var approved = await Approve(owner, d.GetProperty("id").GetGuid(), d.GetProperty("versions")[0].GetProperty("id").GetGuid());
        var v = approved.GetProperty("versions")[0];
        Assert.Equal("Approved", v.GetProperty("status").GetString());
        Assert.Equal("NotSearchable", v.GetProperty("searchStatus").GetString());
        Assert.Contains("OCR", v.GetProperty("searchNote").GetString());

        // A PDF with no text layer (a scan) behaves the same way, and never causes an error.
        var empty = Encoding.ASCII.GetBytes("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<<>>\n%%EOF");
        var pdfResponse = await owner.PostAsync("/api/tenant-documents", Form(empty, "scan.pdf", "Scanned pdf"));
        var pd = await Data(pdfResponse);
        var pdfApproved = await Approve(owner, pd.GetProperty("id").GetGuid(), pd.GetProperty("versions")[0].GetProperty("id").GetGuid());
        Assert.Equal("NotSearchable", pdfApproved.GetProperty("versions")[0].GetProperty("searchStatus").GetString());
    }

    [Fact]
    public async Task Reindex_RebuildsTheTextOfTheCurrentVersion()
    {
        var word = Word();
        using var owner = Owner();
        var (doc, version) = await Upload(owner, $"Rule {word}.");
        await Approve(owner, doc, version);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.SetRequestTenantScope(null, true);
            db.TenantDocumentChunks.RemoveRange(db.TenantDocumentChunks.IgnoreQueryFilters().Where(c => c.DocumentId == doc));
            await db.SaveChangesAsync();
        }
        Assert.Empty(await Search(owner, word));
        Assert.Equal(HttpStatusCode.OK, (await owner.PostAsync($"/api/tenant-documents/{doc}/reindex", null)).StatusCode);
        Assert.Single(await Search(owner, word));
        using var staff = Staff();
        Assert.Equal(HttpStatusCode.Forbidden, (await staff.PostAsync($"/api/tenant-documents/{doc}/reindex", null)).StatusCode);
        using var ownerB = Owner(2, "tenantb");
        Assert.Equal(HttpStatusCode.NotFound, (await ownerB.PostAsync($"/api/tenant-documents/{doc}/reindex", null)).StatusCode);
    }

    [Fact]
    public async Task TheAssistantChat_CanRouteToTheDocumentSearch_AndShowsCitedPassages()
    {
        var word = Word();
        using var owner = Owner();
        var (doc, version) = await Upload(owner, $"Return window is {word} days.", title: "Returns rule");
        await Approve(owner, doc, version);
        _ai.Good.Reply = $"{{\"tool\":\"search_company_documents\",\"query\":\"{word}\"}}";
        var response = await owner.PostAsJsonAsync("/api/assistant/chat", new { message = "what does our returns rule say?" });
        var data = await Data(response);
        Assert.Equal("tool", data.GetProperty("mode").GetString());
        Assert.Equal("search_company_documents", data.GetProperty("tool").GetString());
        var row = Assert.Single(data.GetProperty("result").GetProperty("data").EnumerateArray());
        Assert.Equal("Returns rule", row.GetProperty("title").GetString());
        Assert.Contains("Returns rule v1", data.GetProperty("result").GetProperty("sources")[0].GetProperty("label").GetString());
        // The model was never shown the document text.
        Assert.DoesNotContain(word, _ai.Good.LastSystem ?? "");
        Assert.Equal("what does our returns rule say?", _ai.Good.LastPrompt);
    }

    [Fact]
    public async Task HostileOrBrokenText_NeverBreaksApproval()
    {
        using var owner = Owner();
        var binaryish = new byte[2000];
        for (var i = 0; i < binaryish.Length; i++) binaryish[i] = (byte)(i % 3 == 0 ? 0 : 65);
        var response = await owner.PostAsync("/api/tenant-documents", Form(binaryish, "weird.txt", "Odd text file"));
        if (response.StatusCode != HttpStatusCode.Created) return; // the upload check may refuse binary data outright, which is also safe
        var d = await Data(response);
        var approved = await Approve(owner, d.GetProperty("id").GetGuid(), d.GetProperty("versions")[0].GetProperty("id").GetGuid());
        Assert.Contains(approved.GetProperty("versions")[0].GetProperty("searchStatus").GetString(), new[] { "Searchable", "NotSearchable" });
    }
}
