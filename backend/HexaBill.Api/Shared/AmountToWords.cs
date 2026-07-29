/*
Purpose: Shared Gulf AED amount-to-words (Dirhams/Fils) — single source for invoices, receipts, salary certificates
*/
namespace HexaBill.Api.Shared
{
    public static class AmountToWords
    {
        /// <summary>Full Gulf style: "One Thousand Two Hundred Dirhams Only" (+ Fils when needed).</summary>
        public static string Dirhams(decimal amount)
        {
            try
            {
                if (amount == 0) return "Zero Dirhams Only";

                var integerPart = (long)Math.Floor(Math.Abs(amount));
                var decimalPart = (int)Math.Round((Math.Abs(amount) - integerPart) * 100);
                var words = Integer(integerPart);

                if (decimalPart > 0)
                    words += $" and {Integer(decimalPart)} Fils";

                words += " Dirhams Only";
                if (amount < 0) words = "Minus " + words;
                return words;
            }
            catch
            {
                return amount.ToString("0.00") + " AED";
            }
        }

        /// <summary>Integer words only, uppercase — for salary certificate {WORDS} style.</summary>
        public static string IntegerUpper(decimal amount)
        {
            var n = (long)Math.Floor(Math.Abs(amount));
            var words = Integer(n);
            if (amount < 0) words = "Minus " + words;
            return words.ToUpperInvariant();
        }

        public static string Integer(long number)
        {
            if (number == 0) return "Zero";

            if (number < 0)
                return "Minus " + Integer(Math.Abs(number));

            var words = "";

            if ((number / 1000000000) > 0)
            {
                words += Integer(number / 1000000000) + " Billion ";
                number %= 1000000000;
            }

            if ((number / 1000000) > 0)
            {
                words += Integer(number / 1000000) + " Million ";
                number %= 1000000;
            }

            if ((number / 1000) > 0)
            {
                words += Integer(number / 1000) + " Thousand ";
                number %= 1000;
            }

            if ((number / 100) > 0)
            {
                words += Integer(number / 100) + " Hundred ";
                number %= 100;
            }

            if (number > 0)
            {
                var units = new[]
                {
                    "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
                    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
                };
                var tens = new[]
                {
                    "Zero", "Ten", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
                };

                if (number < 20)
                    words += units[number];
                else
                {
                    words += tens[number / 10];
                    if ((number % 10) > 0)
                        words += " " + units[number % 10];
                }
            }

            return words.Trim();
        }
    }
}
