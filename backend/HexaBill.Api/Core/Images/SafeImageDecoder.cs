using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;

namespace HexaBill.Api.Core.Images;

/// <summary>
/// Constrained decode policy for tenant supplied or persisted image bytes.
/// Accepts only raster formats supported by the upload contract and skips metadata,
/// including ICC profiles, because these assets only need their pixels.
/// </summary>
internal static class SafeImageDecoder
{
    internal const long MaxPixelCount = 4_000_000;

    private static DecoderOptions CreateOptions() => new()
    {
        SkipMetadata = true,
        MaxFrames = 1
    };

    internal static async Task<Image> LoadAsync(Stream stream, CancellationToken cancellationToken)
    {
        EnsureSeekable(stream);
        EnsureSupportedSignature(stream);

        var options = CreateOptions();
        var info = await Image.IdentifyAsync(options, stream, cancellationToken);
        ValidateDimensions(info.Width, info.Height);

        stream.Position = 0;
        return await Image.LoadAsync(options, stream, cancellationToken);
    }

    internal static Image Load(ReadOnlyMemory<byte> encoded)
    {
        using var stream = new MemoryStream(encoded.ToArray(), writable: false);
        EnsureSupportedSignature(stream);

        var options = CreateOptions();
        var info = Image.Identify(options, stream);
        ValidateDimensions(info.Width, info.Height);

        stream.Position = 0;
        return Image.Load(options, stream);
    }

    internal static ImageInfo Identify(ReadOnlyMemory<byte> encoded)
    {
        using var stream = new MemoryStream(encoded.ToArray(), writable: false);
        EnsureSupportedSignature(stream);
        var info = Image.Identify(CreateOptions(), stream);
        ValidateDimensions(info.Width, info.Height);
        return info;
    }

    internal static void ValidateDimensions(int width, int height)
    {
        if (width <= 0 || height <= 0 || (long)width * height > MaxPixelCount)
            throw new InvalidDataException("Image dimensions exceed the supported limit.");
    }

    private static void EnsureSeekable(Stream stream)
    {
        ArgumentNullException.ThrowIfNull(stream);
        if (!stream.CanSeek)
            throw new InvalidDataException("Image input must be seekable for validation.");
        stream.Position = 0;
    }

    private static void EnsureSupportedSignature(Stream stream)
    {
        EnsureSeekable(stream);
        Span<byte> header = stackalloc byte[12];
        var read = stream.Read(header);
        stream.Position = 0;
        if (!IsSupportedSignature(header[..read]))
            throw new InvalidDataException("Only PNG, JPEG, and WebP images are supported.");
    }

    private static bool IsSupportedSignature(ReadOnlySpan<byte> header)
    {
        var png = header.Length >= 8 && header[0] == 0x89 && header[1] == 0x50 &&
            header[2] == 0x4E && header[3] == 0x47 && header[4] == 0x0D &&
            header[5] == 0x0A && header[6] == 0x1A && header[7] == 0x0A;
        var jpeg = header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF;
        var webp = header.Length >= 12 && header[0] == 0x52 && header[1] == 0x49 &&
            header[2] == 0x46 && header[3] == 0x46 && header[8] == 0x57 &&
            header[9] == 0x45 && header[10] == 0x42 && header[11] == 0x50;
        return png || jpeg || webp;
    }
}
