/*
 * Validates uploaded file content using magic bytes (not only Content-Type / extension).
 */
namespace HexaBill.Api.Shared.Security
{
    public static class FileContentSignatureValidator
    {
        private const int HeaderReadSize = 16;

        public static async Task EnsureRasterImageAsync(IFormFile file, CancellationToken cancellationToken = default)
        {
            if (file.Length == 0)
                throw new ArgumentException("No file provided");

            var buf = new byte[HeaderReadSize];
            await using var stream = file.OpenReadStream();
            var n = await stream.ReadAsync(buf.AsMemory(0, HeaderReadSize), cancellationToken);
            if (n < 3)
                throw new ArgumentException("Invalid or empty file.");

            if (IsJpeg(buf)) return;
            if (IsPng(buf, n)) return;
            if (IsGif(buf, n)) return;
            if (IsWebP(buf, n)) return;

            throw new ArgumentException("File content does not match a supported image format (JPEG, PNG, GIF, WebP).");
        }

        /// <summary>Images (raster) or PDF, Word (.doc/.docx) by file signature.</summary>
        public static async Task EnsureInvoiceAttachmentAsync(IFormFile file, CancellationToken cancellationToken = default)
        {
            if (file.Length == 0)
                throw new ArgumentException("No file provided");

            var buf = new byte[HeaderReadSize];
            await using var stream = file.OpenReadStream();
            var n = await stream.ReadAsync(buf.AsMemory(0, HeaderReadSize), cancellationToken);
            if (n < 4)
                throw new ArgumentException("Invalid or empty file.");

            if (IsJpeg(buf) || IsPng(buf, n) || IsGif(buf, n) || IsWebP(buf, n)) return;
            if (IsPdf(buf, n)) return;
            if (IsZipOfficeDoc(buf, n)) return;
            if (IsLegacyWordDoc(buf, n)) return;

            throw new ArgumentException("File content does not match allowed types (image, PDF, Word).");
        }

        private static bool IsJpeg(byte[] b) => b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF;

        private static bool IsPng(byte[] b, int n) =>
            n >= 8 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47 && b[4] == 0x0D && b[5] == 0x0A && b[6] == 0x1A && b[7] == 0x0A;

        private static bool IsGif(byte[] b, int n) =>
            n >= 6 && b[0] == 0x47 && b[1] == 0x49 && b[2] == 0x46 && b[3] == 0x38 && (b[4] == 0x37 || b[4] == 0x39) && b[5] == 0x61;

        private static bool IsWebP(byte[] b, int n)
        {
            if (n < 12) return false;
            if (b[0] != (byte)'R' || b[1] != (byte)'I' || b[2] != (byte)'F' || b[3] != (byte)'F') return false;
            return b[8] == (byte)'W' && b[9] == (byte)'E' && b[10] == (byte)'B' && b[11] == (byte)'P';
        }

        private static bool IsPdf(byte[] b, int n) =>
            n >= 5 && b[0] == (byte)'%' && b[1] == (byte)'P' && b[2] == (byte)'D' && b[3] == (byte)'F' && b[4] == (byte)'-';

        private static bool IsZipOfficeDoc(byte[] b, int n) =>
            n >= 4 && b[0] == 0x50 && b[1] == 0x4B && b[2] == 0x03 && b[3] == 0x04;

        private static bool IsLegacyWordDoc(byte[] b, int n) =>
            n >= 8 && b[0] == 0xD0 && b[1] == 0xCF && b[2] == 0x11 && b[3] == 0xE0 && b[4] == 0xA1 && b[5] == 0xB1 && b[6] == 0x1A && b[7] == 0xE1;
    }
}
