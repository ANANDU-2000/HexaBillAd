namespace HexaBill.Api.Shared.Exceptions;

/// <summary>Thrown when a transaction date falls within a locked VAT return period.</summary>
public class VatPeriodLockedException : InvalidOperationException
{
    public VatPeriodLockedException(string message) : base(message) { }
}
