namespace HexaBill.Api.Models;

public class TenantVatBasisHistory
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public VatCalculationBasis Basis { get; set; }
    public DateTime EffectiveFrom { get; set; }
    public int SetByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
}
