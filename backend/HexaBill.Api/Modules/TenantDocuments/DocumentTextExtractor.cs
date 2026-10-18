using System.Text;
using UglyToad.PdfPig;

namespace HexaBill.Api.Modules.TenantDocuments;

/// <summary>One searchable piece of a document and where it came from, so an answer can point at its source.</summary>
public sealed record TextChunk(string Location, string Text);

public sealed record ExtractionResult(bool Supported, IReadOnlyList<TextChunk> Chunks, string? Note)
{
    public static ExtractionResult Unsupported(string note) => new(false, Array.Empty<TextChunk>(), note);
}

/// <summary>
/// Turns an approved document version into searchable text, locally and deterministically. No network, no model, no OCR.
/// Plain text and CSV are read as data (nothing is executed). PDFs are read only when they carry a text layer; scanned PDFs and
/// images need an OCR provider that has not been chosen, so they are stored and approved but NOT searchable, and the screen says so.
/// Everything extracted is untrusted content: it is shown only as quoted snippets and is never given to a model as instructions.
/// </summary>
public static class DocumentTextExtractor
{
    public const int MaxChunkChars = 1200;
    public const int MaxChunks = 300;
    public const int MaxPdfPages = 200;

    public static ExtractionResult Extract(string contentType, byte[] data)
    {
        try
        {
            return contentType switch
            {
                "text/plain" => FromText(data),
                "text/csv" => FromCsv(data),
                "application/pdf" => FromPdf(data),
                _ => ExtractionResult.Unsupported("Images are stored but not searchable yet: reading text from pictures needs an OCR service that has not been chosen."),
            };
        }
        catch (Exception)
        {
            // A damaged or hostile file must never break approval; it simply is not searchable.
            return ExtractionResult.Unsupported("The text in this file could not be read, so it is not searchable.");
        }
    }

    private static string Decode(byte[] data)
    {
        var text = Encoding.UTF8.GetString(data);
        if (text.Count(c => c == '\0') > data.Length / 100) throw new InvalidDataException("binary");
        return text.Replace("\r\n", "\n").Replace('\r', '\n');
    }

    private static ExtractionResult FromText(byte[] data)
    {
        var lines = Decode(data).Split('\n');
        var chunks = new List<TextChunk>();
        var buffer = new StringBuilder();
        int startLine = 1;
        void Flush(int endLine)
        {
            var text = Clean(buffer.ToString());
            if (text.Length > 0 && chunks.Count < MaxChunks)
                chunks.Add(new TextChunk(startLine == endLine ? $"line {startLine}" : $"lines {startLine}-{endLine}", text));
            buffer.Clear();
        }
        for (var i = 0; i < lines.Length; i++)
        {
            if (buffer.Length == 0) startLine = i + 1;
            if (buffer.Length + lines[i].Length + 1 > MaxChunkChars && buffer.Length > 0) { Flush(i); startLine = i + 1; }
            buffer.Append(lines[i]).Append('\n');
            // A blank line after enough text ends a paragraph chunk.
            if (string.IsNullOrWhiteSpace(lines[i]) && buffer.Length > MaxChunkChars / 3) Flush(i + 1);
        }
        Flush(lines.Length);
        return Finish(chunks);
    }

    /// <summary>Rows are data: the header is repeated in every chunk so a hit still says what each column means.</summary>
    private static ExtractionResult FromCsv(byte[] data)
    {
        var lines = Decode(data).Split('\n').Where(l => !string.IsNullOrWhiteSpace(l)).ToList();
        if (lines.Count == 0) return ExtractionResult.Unsupported("The file has no rows.");
        var header = lines[0];
        var chunks = new List<TextChunk>();
        var buffer = new StringBuilder();
        int first = 2, last = 1;
        void Flush()
        {
            if (buffer.Length > 0 && chunks.Count < MaxChunks) chunks.Add(new TextChunk(first == last ? $"row {first}" : $"rows {first}-{last}", Clean(header + "\n" + buffer)));
            buffer.Clear();
        }
        for (var i = 1; i < lines.Count; i++)
        {
            var row = i + 1; // row number as a person counts it, header being row 1
            if (buffer.Length + lines[i].Length + header.Length + 1 > MaxChunkChars && buffer.Length > 0) { Flush(); }
            if (buffer.Length == 0) first = row;
            buffer.Append(lines[i]).Append('\n');
            last = row;
        }
        Flush();
        return Finish(chunks);
    }

    private static ExtractionResult FromPdf(byte[] data)
    {
        using var pdf = PdfDocument.Open(data, new ParsingOptions { UseLenientParsing = true, SkipMissingFonts = true });
        var chunks = new List<TextChunk>();
        var pages = 0;
        foreach (var page in pdf.GetPages())
        {
            if (++pages > MaxPdfPages) break;
            var text = Clean(page.Text);
            for (var offset = 0; offset < text.Length && chunks.Count < MaxChunks; offset += MaxChunkChars)
            {
                var part = text.Substring(offset, Math.Min(MaxChunkChars, text.Length - offset)).Trim();
                if (part.Length > 0) chunks.Add(new TextChunk($"page {page.Number}", part));
            }
        }
        if (chunks.Sum(c => c.Text.Length) < 20)
            return ExtractionResult.Unsupported("This PDF has no readable text (it may be a scan), so it is not searchable. Scanned documents need an OCR service that has not been chosen.");
        return Finish(chunks);
    }

    private static ExtractionResult Finish(List<TextChunk> chunks) =>
        chunks.Count == 0 ? ExtractionResult.Unsupported("No text was found, so the file is not searchable.") : new ExtractionResult(true, chunks, null);

    /// <summary>Collapses control characters and runs of blanks so snippets are tidy and cannot carry markup tricks.</summary>
    internal static string Clean(string value)
    {
        var sb = new StringBuilder(value.Length);
        var lastSpace = false;
        foreach (var ch in value)
        {
            var c = ch == '\n' ? '\n' : char.IsControl(ch) ? ' ' : ch;
            if (c == ' ' || c == '\t') { if (!lastSpace) sb.Append(' '); lastSpace = true; }
            else { sb.Append(c); lastSpace = false; }
        }
        return sb.ToString().Trim();
    }
}
