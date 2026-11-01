using HexaBill.Api.Core.Images;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;

namespace HexaBill.Tests.security;

public sealed class SafeImageDecoderTests
{
    [Fact]
    public void RejectsTiffBeforeInvokingImageDecoder()
    {
        var tiffHeader = new byte[] { 0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };

        Assert.Throws<InvalidDataException>(() => SafeImageDecoder.Identify(tiffHeader));
    }

    [Theory]
    [InlineData(2001, 2000)]
    [InlineData(0, 1)]
    [InlineData(1, 0)]
    public void RejectsUnsupportedDecodedDimensions(int width, int height)
    {
        Assert.Throws<InvalidDataException>(() => SafeImageDecoder.ValidateDimensions(width, height));
    }

    [Fact]
    public void LoadsAllowedPngWithBoundedDimensions()
    {
        using var source = new Image<Rgba32>(4, 3, new Rgba32(12, 34, 56, 255));
        using var encoded = new MemoryStream();
        source.SaveAsPng(encoded);

        using var decoded = SafeImageDecoder.Load(encoded.ToArray());

        Assert.Equal(4, decoded.Width);
        Assert.Equal(3, decoded.Height);
    }

    [Fact]
    public async Task LoadsAllowedPngAsynchronouslyForUploadServices()
    {
        using var source = new Image<Rgba32>(4, 3, new Rgba32(12, 34, 56, 255));
        using var encoded = new MemoryStream();
        source.SaveAsPng(encoded);
        await using var input = new MemoryStream(encoded.ToArray(), writable: false);

        using var decoded = await SafeImageDecoder.LoadAsync(input, CancellationToken.None);

        Assert.Equal(4, decoded.Width);
        Assert.Equal(3, decoded.Height);
    }
}
