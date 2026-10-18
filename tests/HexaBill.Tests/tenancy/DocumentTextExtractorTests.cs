using System.Text;
using HexaBill.Api.Modules.TenantDocuments;

namespace HexaBill.Tests;

/// <summary>Builds a small, valid, uncompressed one-page PDF with a text layer (exact offsets and lengths).</summary>
internal static class MiniPdf
{
    public static byte[] Build(params string[] pageTexts)
    {
        var objects = new List<string>();
        var pageIds = new List<int>();
        // 1 catalog, 2 pages, 3 font, then per page: page object and content stream.
        objects.Add("<< /Type /Catalog /Pages 2 0 R >>");
        objects.Add("PAGES");
        objects.Add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
        foreach (var text in pageTexts)
        {
            var pageId = objects.Count + 1;
            var contentId = pageId + 1;
            pageIds.Add(pageId);
            objects.Add($"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {contentId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>");
            var stream = $"BT /F1 12 Tf 72 700 Td ({text.Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)")}) Tj ET";
            objects.Add($"<< /Length {Encoding.ASCII.GetByteCount(stream)} >>\nstream\n{stream}\nendstream");
        }
        objects[1] = $"<< /Type /Pages /Kids [{string.Join(' ', pageIds.Select(i => $"{i} 0 R"))}] /Count {pageIds.Count} >>";
        var sb = new StringBuilder("%PDF-1.4\n");
        var offsets = new List<int>();
        for (var i = 0; i < objects.Count; i++)
        {
            offsets.Add(sb.Length);
            sb.Append($"{i + 1} 0 obj\n{objects[i]}\nendobj\n");
        }
        var xref = sb.Length;
        sb.Append($"xref\n0 {objects.Count + 1}\n0000000000 65535 f \n");
        foreach (var o in offsets) sb.Append($"{o:D10} 00000 n \n");
        sb.Append($"trailer\n<< /Size {objects.Count + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF");
        return Encoding.ASCII.GetBytes(sb.ToString());
    }
}

public class DocumentTextExtractorTests
{
    [Fact]
    public void Pdf_WithATextLayer_IsReadPageByPage()
    {
        var result = DocumentTextExtractor.Extract("application/pdf", MiniPdf.Build("Trade licence TL-778 expires 2027", "Second page about fire safety"));
        Assert.True(result.Supported, result.Note);
        Assert.Equal(new[] { "page 1", "page 2" }, result.Chunks.Select(c => c.Location).ToArray());
        Assert.Contains("TL-778", result.Chunks[0].Text);
        Assert.Contains("fire safety", result.Chunks[1].Text);
    }

    [Fact]
    public void Pdf_WithoutText_OrDamaged_IsNotSearchable_AndNeverThrows()
    {
        var noText = DocumentTextExtractor.Extract("application/pdf", MiniPdf.Build(""));
        Assert.False(noText.Supported);
        Assert.Contains("scan", noText.Note);
        var damaged = DocumentTextExtractor.Extract("application/pdf", Encoding.ASCII.GetBytes("%PDF-1.4\nthis is not really a pdf"));
        Assert.False(damaged.Supported);
        Assert.NotEmpty(damaged.Note!);
    }

    [Fact]
    public void Images_AreNeverRead()
    {
        var result = DocumentTextExtractor.Extract("image/png", new byte[] { 1, 2, 3 });
        Assert.False(result.Supported);
        Assert.Contains("OCR", result.Note);
    }

    [Fact]
    public void LongText_IsSplitIntoBoundedChunks_WithLineNumbers()
    {
        var text = string.Join("\n", Enumerable.Range(1, 400).Select(i => $"Line number {i} of a long policy text that keeps going."));
        var result = DocumentTextExtractor.Extract("text/plain", Encoding.UTF8.GetBytes(text));
        Assert.True(result.Supported);
        Assert.True(result.Chunks.Count > 5);
        Assert.All(result.Chunks, c => Assert.True(c.Text.Length <= DocumentTextExtractor.MaxChunkChars + 60));
        Assert.StartsWith("lines 1-", result.Chunks[0].Location);
        Assert.True(result.Chunks.Count <= DocumentTextExtractor.MaxChunks);
    }

    [Fact]
    public void Csv_RepeatsTheHeaderInEveryChunk()
    {
        var rows = string.Join("\n", Enumerable.Range(1, 300).Select(i => $"item{i},{i * 3},some note for row {i} to make it longer"));
        var result = DocumentTextExtractor.Extract("text/csv", Encoding.UTF8.GetBytes("name,qty,note\n" + rows));
        Assert.True(result.Supported);
        Assert.All(result.Chunks, c => Assert.StartsWith("name,qty,note", c.Text));
        Assert.StartsWith("rows 2-", result.Chunks[0].Location);
    }

    [Fact]
    public void ControlCharacters_AreRemovedFromPassages()
    {
        var result = DocumentTextExtractor.Extract("text/plain", Encoding.UTF8.GetBytes("Hello\u0007 world\t\tagain\u001b[31m red"));
        Assert.True(result.Supported);
        Assert.DoesNotContain('\u0007', result.Chunks[0].Text);
        Assert.DoesNotContain('\u001b', result.Chunks[0].Text);
        Assert.DoesNotContain("  ", result.Chunks[0].Text);
    }

    [Fact]
    public void EmptyOrBinaryText_IsNotSearchable()
    {
        Assert.False(DocumentTextExtractor.Extract("text/plain", Encoding.UTF8.GetBytes("   \n\n  ")).Supported);
        var binary = new byte[1000];
        Assert.False(DocumentTextExtractor.Extract("text/plain", binary).Supported);
    }
}
