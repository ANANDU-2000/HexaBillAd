using System.Text;

namespace HexaBill.Api.Modules.TenantDocuments;

/// <summary>Result of checking an uploaded file. On success the server-chosen type is used, never the browser's.</summary>
public sealed record FileCheckResult(bool Ok, string? Extension, string? ContentType, string? Reason);

/// <summary>
/// Accepts PDF, PNG, JPEG, WebP, CSV and plain text only, by extension AND content. Limits are product defaults
/// (20 MB documents, 10 MB images), not existing platform limits. This is a type and sanity check; it is NOT a malware scan.
/// </summary>
public static class TenantDocumentFileCheck
{
    public const long MaxDocumentBytes = 20L * 1024 * 1024;
    public const long MaxImageBytes = 10L * 1024 * 1024;
    public const int MaxCsvRows = 10_000;

    private static readonly Dictionary<string, (string Mime, bool Image)> Allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        [".pdf"] = ("application/pdf", false),
        [".png"] = ("image/png", true),
        [".jpg"] = ("image/jpeg", true),
        [".jpeg"] = ("image/jpeg", true),
        [".webp"] = ("image/webp", true),
        [".csv"] = ("text/csv", false),
        [".txt"] = ("text/plain", false),
    };

    public static string SupportedFormats => "PDF, PNG, JPEG, WebP, CSV or plain text";

    public static FileCheckResult Check(string? fileName, byte[] data)
    {
        if (data.Length == 0) return Fail("The file is empty.");
        var name = Path.GetFileName((fileName ?? string.Empty).Replace('\\', '/'));
        var ext = Path.GetExtension(name);

        // Say what is wrong in plain words for the formats people most often try.
        var sniffed = SniffUnsupported(data);
        if (sniffed != null) return Fail(sniffed);

        if (string.IsNullOrEmpty(ext) || !Allowed.TryGetValue(ext, out var kind))
            return Fail($"This file type is not supported. Upload a {SupportedFormats} file.");

        if (data.LongLength > (kind.Image ? MaxImageBytes : MaxDocumentBytes))
            return Fail(kind.Image ? "Images can be at most 10 MB." : "Documents can be at most 20 MB.");

        switch (ext.ToLowerInvariant())
        {
            case ".pdf":
                if (!StartsWith(data, "%PDF-")) return Fail("The file is named .pdf but is not a PDF.");
                var pdf = CheckPdf(data);
                if (pdf != null) return Fail(pdf);
                break;
            case ".png":
                if (!(data.Length >= 8 && data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 && data[4] == 0x0D && data[5] == 0x0A && data[6] == 0x1A && data[7] == 0x0A))
                    return Fail("The file is named .png but is not a PNG image.");
                break;
            case ".jpg":
            case ".jpeg":
                if (!(data.Length >= 3 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF))
                    return Fail("The file is named .jpg but is not a JPEG image.");
                break;
            case ".webp":
                if (!(data.Length >= 12 && StartsWith(data, "RIFF") && data[8] == 'W' && data[9] == 'E' && data[10] == 'B' && data[11] == 'P'))
                    return Fail("The file is named .webp but is not a WebP image.");
                break;
            case ".csv":
            case ".txt":
                var text = CheckText(data, ext.Equals(".csv", StringComparison.OrdinalIgnoreCase));
                if (text != null) return Fail(text);
                break;
        }

        return new FileCheckResult(true, ext.ToLowerInvariant(), kind.Mime, null);
    }

    /// <summary>Display name only: no path parts, no control characters, bounded length.</summary>
    public static string CleanFileName(string? fileName)
    {
        var name = Path.GetFileName((fileName ?? string.Empty).Replace('\\', '/'));
        var cleaned = new string(name.Where(c => !char.IsControl(c)).ToArray()).Trim();
        if (cleaned.Length == 0) cleaned = "document";
        return cleaned.Length > 200 ? cleaned[..200] : cleaned;
    }

    private static FileCheckResult Fail(string reason) => new(false, null, null, reason);

    private static bool StartsWith(byte[] d, string ascii)
    {
        if (d.Length < ascii.Length) return false;
        for (var i = 0; i < ascii.Length; i++) if (d[i] != ascii[i]) return false;
        return true;
    }

    private static string? SniffUnsupported(byte[] d)
    {
        if (d.Length >= 4 && d[0] == 0x50 && d[1] == 0x4B && (d[2] == 0x03 || d[2] == 0x05) ) return "Archives and Office files (ZIP, DOCX, XLSX) are not supported yet. Export to PDF or CSV.";
        if (d.Length >= 2 && d[0] == 'M' && d[1] == 'Z') return "Programs and executable files are not accepted.";
        if (d.Length >= 4 && d[0] == 0x7F && d[1] == 'E' && d[2] == 'L' && d[3] == 'F') return "Programs and executable files are not accepted.";
        if (d.Length >= 6 && d[0] == 0x37 && d[1] == 0x7A && d[2] == 0xBC && d[3] == 0xAF) return "Archives are not supported.";
        if (d.Length >= 4 && d[0] == 'R' && d[1] == 'a' && d[2] == 'r' && d[3] == '!') return "Archives are not supported.";
        if (d.Length >= 2 && d[0] == 0x1F && d[1] == 0x8B) return "Archives are not supported.";
        if (d.Length >= 8 && d[0] == 0xD0 && d[1] == 0xCF && d[2] == 0x11 && d[3] == 0xE0) return "Old Word and Excel files are not supported. Export to PDF or CSV.";
        return null;
    }

    /// <summary>Heuristic byte search: rejects encrypted PDFs and PDFs with launch or script actions.</summary>
    private static string? CheckPdf(byte[] d)
    {
        var latin = Encoding.Latin1.GetString(d);
        if (latin.Contains("/Encrypt", StringComparison.Ordinal)) return "Password-protected PDFs are not supported. Remove the password and upload again.";
        if (latin.Contains("/JavaScript", StringComparison.Ordinal) || latin.Contains("/JS", StringComparison.Ordinal) || latin.Contains("/Launch", StringComparison.Ordinal) || latin.Contains("/EmbeddedFile", StringComparison.Ordinal))
            return "PDFs with scripts, launch actions or embedded files are not accepted.";
        return null;
    }

    private static string? CheckText(byte[] d, bool csv)
    {
        if (Array.IndexOf(d, (byte)0) >= 0) return "The file contains binary data and is not a text file.";
        string text;
        try { text = new UTF8Encoding(false, true).GetString(d); }
        catch (DecoderFallbackException) { return "The file is not valid UTF-8 text. Save it as UTF-8 and upload again."; }
        if (csv)
        {
            var rows = 0;
            foreach (var c in text) if (c == '\n') rows++;
            if (rows > MaxCsvRows) return $"CSV files can have at most {MaxCsvRows:N0} rows.";
        }
        return null;
    }
}
