using System.Text.Json;
using System.Text.Json.Serialization;

namespace HexaBill.Api.Shared.Serialization
{
    /// <summary>
    /// Treats JSON empty string "" as null for DateTime? (avoids bind failures from date inputs).
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
                    return dt;
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
}
