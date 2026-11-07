namespace HexaBill.Api.Modules.Customers
{
    /// <summary>Counts for the customer list tabs, over the same scope as the list.</summary>
    public class CustomerFilterCounts
    {
        public int All { get; set; }
        public int Outstanding { get; set; }
        public int Active { get; set; }
        public int Overdue { get; set; }
        public int Inactive { get; set; }
    }

    /// <summary>
    /// Natural, case-insensitive ordering: digit runs compare by numeric value, so "Shop 2" sorts before "Shop 10".
    /// Leading zeros are ignored ("007" equals "7") and ties fall back to ordinal order so the result is stable.
    /// </summary>
    public sealed class NaturalStringComparer : IComparer<string>
    {
        public static readonly NaturalStringComparer Instance = new();

        public int Compare(string? x, string? y)
        {
            if (ReferenceEquals(x, y)) return 0;
            if (x == null) return -1;
            if (y == null) return 1;
            int i = 0, j = 0;
            while (i < x.Length && j < y.Length)
            {
                if (char.IsDigit(x[i]) && char.IsDigit(y[j]))
                {
                    int si = i, sj = j;
                    while (si < x.Length && x[si] == (char)48) si++;
                    while (sj < y.Length && y[sj] == (char)48) sj++;
                    int ei = si, ej = sj;
                    while (ei < x.Length && char.IsDigit(x[ei])) ei++;
                    while (ej < y.Length && char.IsDigit(y[ej])) ej++;
                    int lenX = ei - si, lenY = ej - sj;
                    if (lenX != lenY) return lenX < lenY ? -1 : 1;
                    int numeric = string.CompareOrdinal(x, si, y, sj, lenX);
                    if (numeric != 0) return numeric < 0 ? -1 : 1;
                    i = ei; j = ej;
                }
                else
                {
                    int c = char.ToUpperInvariant(x[i]).CompareTo(char.ToUpperInvariant(y[j]));
                    if (c != 0) return c < 0 ? -1 : 1;
                    i++; j++;
                }
            }
            if (i < x.Length) return 1;
            if (j < y.Length) return -1;
            return string.CompareOrdinal(x, y);
        }
    }
}
