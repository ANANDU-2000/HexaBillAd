using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace HexaBill.Api.Modules.Assistant;

/// <summary>
/// Reads the fields a model proposed for a new customer or expense and keeps only values that look right for each field. This is a
/// convenience for typing, not a decision: every value is shown to the person in the normal form, reviewed by the server's own
/// validation, and confirmed by the person. Unknown fields are ignored; a field that does not fit is dropped and reported.
/// Digits written in Malayalam, Arabic-Indic or other scripts are turned into 0-9 so amounts and phone numbers keep their meaning.
/// </summary>
internal static class SuggestionParser
{
    private static readonly Regex Email = new(@"^[^@\s]{1,64}@[^@\s]{1,120}\.[^@\s]{2,}$", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public static SuggestedForm? Parse(string kind, JsonElement fields)
    {
        var accepted = new Dictionary<string, string>(StringComparer.Ordinal);
        var dropped = new List<string>();
        void Take(string field, string? value, bool ok)
        {
            if (string.IsNullOrWhiteSpace(value)) return;
            if (ok) accepted[field] = value!; else dropped.Add(field);
        }

        if (kind == "new_customer")
        {
            var name = Text(fields, "name", 120);
            if (name == null || name.Length < 2) return null; // a customer without a name is not worth a suggestion
            accepted["name"] = name;
            var phone = Phone(Text(fields, "phone", 40));
            Take("phone", Text(fields, "phone", 40), phone != null);
            if (phone != null) accepted["phone"] = phone;
            var email = Text(fields, "email", 120);
            Take("email", email, email != null && Email.IsMatch(email));
            Take("address", Text(fields, "address", 200), true);
            var trn = Digits(Text(fields, "trn", 30));
            Take("trn", Text(fields, "trn", 30), trn != null && trn.Length is >= 10 and <= 20);
            if (trn != null && trn.Length is >= 10 and <= 20) accepted["trn"] = trn;
        }
        else if (kind == "new_expense")
        {
            var amount = Amount(fields, "amount");
            if (amount != null) accepted["amount"] = amount.Value.ToString("0.##", CultureInfo.InvariantCulture); else if (fields.TryGetProperty("amount", out _)) dropped.Add("amount");
            var date = Text(fields, "date", 20);
            var normalizedDate = date == null ? null : NormalizeDigits(date);
            var okDate = normalizedDate != null && DateTime.TryParseExact(normalizedDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d) && d.Year >= 2000 && d <= DateTime.UtcNow.Date.AddDays(1);
            Take("date", date, okDate);
            if (okDate) accepted["date"] = normalizedDate!;
            Take("categoryName", Text(fields, "categoryName", 80), true);
            Take("note", Text(fields, "note", 500), true);
            if (accepted.Count == 0) return null;
        }
        else
        {
            return null;
        }
        return new SuggestedForm(kind, accepted, dropped);
    }

    private static string? Text(JsonElement fields, string name, int max)
    {
        if (!fields.TryGetProperty(name, out var v)) return null;
        var raw = v.ValueKind switch { JsonValueKind.String => v.GetString(), JsonValueKind.Number => v.GetRawText(), _ => null };
        if (raw == null) return null;
        var sb = new StringBuilder(raw.Length);
        foreach (var ch in raw) sb.Append(char.IsControl(ch) ? ' ' : ch);
        var clean = string.Join(' ', sb.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries));
        if (clean.Length == 0) return null;
        return clean.Length > max ? clean[..max].Trim() : clean;
    }

    /// <summary>Digits in any script become 0-9, and the usual Arabic decimal and thousands marks become '.' and nothing.</summary>
    internal static string NormalizeDigits(string value)
    {
        var sb = new StringBuilder(value.Length);
        foreach (var ch in value)
        {
            if (ch is >= '0' and <= '9') sb.Append(ch);
            else if (char.IsDigit(ch)) sb.Append((char)('0' + (int)char.GetNumericValue(ch)));
            else if (ch == '٫') sb.Append('.');
            else if (ch is '٬' or ',') continue;
            else sb.Append(ch);
        }
        return sb.ToString();
    }

    private static string? Phone(string? value)
    {
        if (value == null) return null;
        var normalized = NormalizeDigits(value).Trim();
        // Words, symbols or letters mean this is not just a number.
        if (normalized.Any(c => !(char.IsAsciiDigit(c) || c is '+' or ' ' or '-' or '(' or ')'))) return null;
        var digits = normalized.Count(char.IsAsciiDigit);
        return digits is >= 6 and <= 15 ? normalized : null;
    }

    private static string? Digits(string? value) => value == null ? null : new string(NormalizeDigits(value).Where(char.IsAsciiDigit).ToArray());

    private static decimal? Amount(JsonElement fields, string name)
    {
        if (!fields.TryGetProperty(name, out var v)) return null;
        string? raw = v.ValueKind switch { JsonValueKind.Number => v.GetRawText(), JsonValueKind.String => v.GetString(), _ => null };
        if (raw == null) return null;
        var normalized = NormalizeDigits(raw).Replace(" ", string.Empty);
        if (normalized.StartsWith('-') || normalized.StartsWith('(')) return null; // a negative amount is never an expense
        // A leading currency word or symbol is not part of the number.
        normalized = Regex.Replace(normalized, @"^[^\d\.]+|[^\d\.]+$", string.Empty);
        if (!decimal.TryParse(normalized, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var amount)) return null;
        return amount > 0 && amount <= 99_999_999.99m ? Math.Round(amount, 2, MidpointRounding.AwayFromZero) : null;
    }
}
