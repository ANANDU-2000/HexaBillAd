using System.Text.Json;
using HexaBill.Api.Core.Infrastructure;

namespace HexaBill.Tests;

/// <summary>
/// Npgsql rejects Kind=Unspecified for timestamptz. A browser sends a plain yyyy-MM-dd in JSON bodies, so every
/// DateTime read from a body must come out as Kind=Utc, whatever offset (or none) the client sent.
/// </summary>
public class JsonDateKindTests
{
    private sealed class Body { public DateTime Day { get; set; } public DateTime? MaybeDay { get; set; } }

    private static JsonSerializerOptions Options()
    {
        var o = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        o.Converters.Add(new NullableDateTimeEmptyStringConverter());
        o.Converters.Add(new UtcDateTimeJsonConverter());
        return o;
    }

    [Theory]
    [InlineData("2026-10-01")]
    [InlineData("2026-10-01T00:00:00")]
    [InlineData("2026-10-01T00:00:00Z")]
    [InlineData("2026-10-01T04:00:00+04:00")]
    public void BodyDates_AreAlwaysUtcKind(string text)
    {
        var body = JsonSerializer.Deserialize<Body>($"{{\"day\":\"{text}\",\"maybeDay\":\"{text}\"}}", Options())!;
        Assert.Equal(DateTimeKind.Utc, body.Day.Kind);
        Assert.Equal(DateTimeKind.Utc, body.MaybeDay!.Value.Kind);
        Assert.Equal(new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc), body.Day);
    }

    [Fact]
    public void EmptyAndNull_StillMeanNoDate_AndGarbageIsRejected()
    {
        Assert.Null(JsonSerializer.Deserialize<Body>("{\"day\":\"2026-10-01\",\"maybeDay\":\"\"}", Options())!.MaybeDay);
        Assert.Null(JsonSerializer.Deserialize<Body>("{\"day\":\"2026-10-01\",\"maybeDay\":null}", Options())!.MaybeDay);
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<Body>("{\"day\":\"not a date\"}", Options()));
    }
}
