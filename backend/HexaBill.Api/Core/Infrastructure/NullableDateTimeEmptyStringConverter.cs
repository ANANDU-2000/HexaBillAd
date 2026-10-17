using System.Text.Json;
using System.Text.Json.Serialization;
using HexaBill.Api.Core.Authorization;

namespace HexaBill.Api.Core.Infrastructure
{
    /// <summary>
    /// Treats JSON empty string "" as null for DateTime? (avoids bind failures from date inputs).
    /// Dates are returned with Kind=Utc, because Npgsql rejects Unspecified for timestamptz.
    /// </summary>
    public sealed class NullableDateTimeEmptyStringConverter : JsonConverter<DateTime?>
    {
        public override DateTime? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.Null)
                return null;

            if (reader.TokenType == JsonTokenType.String)
            {
                var s = reader.GetString();
                if (string.IsNullOrWhiteSpace(s))
                    return null;
                if (DateTime.TryParse(s, null, System.Globalization.DateTimeStyles.RoundtripKind, out var dt))
                    return dt.ToUtcKind();
                throw new JsonException($"Invalid date value: '{s}'");
            }

            if (reader.TokenType == JsonTokenType.Number && reader.TryGetInt64(out var unixMs))
                return DateTimeOffset.FromUnixTimeMilliseconds(unixMs).UtcDateTime;

            throw new JsonException($"Unexpected token {reader.TokenType} for DateTime?");
        }

        public override void Write(Utf8JsonWriter writer, DateTime? value, JsonSerializerOptions options)
        {
            if (value.HasValue)
                writer.WriteStringValue(value.Value.ToString("O"));
            else
                writer.WriteNullValue();
        }
    }

    /// <summary>Same rule for non-nullable DateTime in JSON bodies: always Kind=Utc (plain dates are read as UTC dates).</summary>
    public sealed class UtcDateTimeJsonConverter : JsonConverter<DateTime>
    {
        public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.String)
            {
                var s = reader.GetString();
                if (DateTime.TryParse(s, null, System.Globalization.DateTimeStyles.RoundtripKind, out var dt))
                    return dt.ToUtcKind();
                throw new JsonException($"Invalid date value: '{s}'");
            }
            if (reader.TokenType == JsonTokenType.Number && reader.TryGetInt64(out var unixMs))
                return DateTimeOffset.FromUnixTimeMilliseconds(unixMs).UtcDateTime;
            throw new JsonException($"Unexpected token {reader.TokenType} for DateTime");
        }

        public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
            => writer.WriteStringValue(value.ToString("O"));
    }
}
