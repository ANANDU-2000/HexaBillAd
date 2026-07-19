/*
Purpose: Feature-flag helper for Quotes & Agreements module
Flag key: Feature_QuotesAgreements — off by default (missing/false)
*/
using HexaBill.Api.Modules.SuperAdmin;

namespace HexaBill.Api.Modules.Documents
{
    public static class DocumentsFeature
    {
        public const string FlagKey = "Feature_QuotesAgreements";

        public static async Task<bool> IsEnabledAsync(ISettingsService settings, int tenantId)
        {
            var raw = await settings.GetSettingValueAsync(tenantId, FlagKey);
            // Explicit false/0/no disables. Missing key = enabled for greenfield (opt-out).
            // Removal plan: drop this check after Quotes/Agreements are stable in production (~60 days).
            if (string.IsNullOrWhiteSpace(raw)) return true;
            return !(raw.Equals("false", StringComparison.OrdinalIgnoreCase)
                || raw.Equals("0", StringComparison.OrdinalIgnoreCase)
                || raw.Equals("no", StringComparison.OrdinalIgnoreCase));
        }
    }
}
