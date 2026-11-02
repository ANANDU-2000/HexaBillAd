using System;

namespace HexaBill.Api.Core.Infrastructure
{
    /// <summary>
    /// Business-day boundaries for the UAE (Asia/Dubai, UTC+4, no daylight saving).
    /// A business date D covers the instants [D 00:00 Dubai, D+1 00:00 Dubai), returned here as UTC
    /// so they can be compared directly with timestamptz columns.
    /// Use inclusive start / exclusive end everywhere; never add a day to an already exclusive end.
    /// </summary>
    public static class BusinessDateRange
    {
        public static readonly TimeSpan DubaiOffset = TimeSpan.FromHours(4);

        /// <summary>First instant (UTC) of the Dubai business date. Any time-of-day on the input is ignored.</summary>
        public static DateTime StartUtc(DateTime businessDate) =>
            DateTime.SpecifyKind(businessDate.Date - DubaiOffset, DateTimeKind.Utc);

        /// <summary>First instant (UTC) after the Dubai business date (exclusive upper bound).</summary>
        public static DateTime EndExclusiveUtc(DateTime businessDate) =>
            DateTime.SpecifyKind(businessDate.Date.AddDays(1) - DubaiOffset, DateTimeKind.Utc);

        /// <summary>The Dubai business date that a stored UTC instant falls on.</summary>
        public static DateTime BusinessDateOf(DateTime utcInstant)
        {
            var utc = utcInstant.Kind == DateTimeKind.Utc ? utcInstant : DateTime.SpecifyKind(utcInstant, DateTimeKind.Utc);
            return (utc + DubaiOffset).Date;
        }
    }
}
