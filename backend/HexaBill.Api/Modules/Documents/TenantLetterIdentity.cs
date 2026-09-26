using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Modules.Documents
{
    /// <summary>
    /// Company identity for agreements and salary certificates.
    /// Zayoga stationery stays on the Zayoga tenant. Every other tenant uses its own settings.
    /// </summary>
    public sealed record TenantLetterIdentity(
        bool UseZayogaStationery,
        string CompanyName,
        string Phone,
        string Email,
        string Address,
        string License);

    public static class TenantLetterIdentityLoader
    {
        public static async Task<TenantLetterIdentity> LoadAsync(AppDbContext context, int tenantId)
        {
            var tenant = await context.Tenants.AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == tenantId);
            var rows = await context.Settings.AsNoTracking()
                .Where(s => s.TenantId == tenantId)
                .ToListAsync();

            string Value(string key) =>
                rows.FirstOrDefault(s => string.Equals(s.Key, key, StringComparison.OrdinalIgnoreCase))?.Value?.Trim()
                ?? string.Empty;

            var companyName = FirstNonEmpty(Value("COMPANY_NAME_EN"), tenant?.CompanyNameEn, tenant?.Name);
            var useZayoga =
                ContainsZayoga(tenant?.Name) ||
                ContainsZayoga(tenant?.CompanyNameEn) ||
                ContainsZayoga(tenant?.Email) ||
                ContainsZayoga(companyName);

            if (useZayoga)
            {
                return new TenantLetterIdentity(
                    true,
                    AgreementTemplate.FirstPartyName,
                    AgreementTemplate.FirstPartyMobile,
                    AgreementTemplate.Email,
                    AgreementTemplate.FooterAddress,
                    AgreementTemplate.FirstPartyLicense);
            }

            return new TenantLetterIdentity(
                false,
                companyName,
                FirstNonEmpty(Value("COMPANY_PHONE"), tenant?.Phone),
                FirstNonEmpty(Value("COMPANY_EMAIL"), tenant?.Email),
                FirstNonEmpty(Value("COMPANY_ADDRESS"), tenant?.Address),
                FirstNonEmpty(Value("COMPANY_LICENSE"), Value("COMPANY_TRN"), tenant?.VatNumber));
        }

        private static bool ContainsZayoga(string? value) =>
            !string.IsNullOrWhiteSpace(value) &&
            value.Contains("ZAYOGA", StringComparison.OrdinalIgnoreCase);

        private static string FirstNonEmpty(params string?[] values) =>
            values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v))?.Trim() ?? string.Empty;
    }
}
