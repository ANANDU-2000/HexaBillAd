namespace HexaBill.Api.Models
{
    /// <summary>
    /// How much AI one company used on one UTC day: call count and tokens, nothing else. It is the shared budget that every
    /// API instance checks, so a restart or a second instance cannot reset a company's daily limit. No prompts, answers or keys.
    /// </summary>
    public class AiUsageDaily
    {
        public int Id { get; set; }
        public int TenantId { get; set; }
        public DateOnly Day { get; set; }
        public int Calls { get; set; }
        public int Tokens { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
