namespace HexaBill.Api.Modules.Reports;

public sealed class VatCalculationException : Exception
{
    public VatCalculationException(string correlationId, Exception innerException)
        : base("VAT management report calculation failed.", innerException)
    {
        CorrelationId = correlationId;
    }

    public string CorrelationId { get; }
}
