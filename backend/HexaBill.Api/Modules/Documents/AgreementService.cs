using HexaBill.Api.Models;
using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HexaBill.Api.Modules.Documents
{
    public interface IAgreementService
    {
        Task<List<AgreementDto>> ListAsync(int tenantId);
        Task<AgreementDto?> GetByIdAsync(int id, int tenantId);
        Task<AgreementDto> GetBlankPreviewAsync(int tenantId);
        Task<AgreementDto> CreateAsync(CreateAgreementRequest request, int userId, int tenantId);
        Task<AgreementDto?> UpdateAsync(int id, UpdateAgreementRequest request, int userId, int tenantId);
        Task<bool> DeleteAsync(int id, int userId, int tenantId);
    }

    public class AgreementService : IAgreementService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<AgreementService> _logger;

        public AgreementService(AppDbContext context, ILogger<AgreementService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<List<AgreementDto>> ListAsync(int tenantId)
        {
            try
            {
                var rows = await _context.Agreements.AsNoTracking()
                    .Where(a => a.TenantId == tenantId && !a.IsDeleted)
                    .OrderByDescending(a => a.CreatedAt)
                    .ToListAsync();
                return rows.Select(Map).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to list agreements for tenant {TenantId}", tenantId);
                throw;
            }
        }

        public async Task<AgreementDto?> GetByIdAsync(int id, int tenantId)
        {
            try
            {
                var a = await _context.Agreements.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId && !x.IsDeleted);
                return a == null ? null : Map(a);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get agreement {Id} for tenant {TenantId}", id, tenantId);
                throw;
            }
        }

        public Task<AgreementDto> GetBlankPreviewAsync(int tenantId)
        {
            _ = tenantId;
            return Task.FromResult(Map(new Agreement
            {
                AgreementNo = "(preview)",
                AgreementDate = ToUtcDate(null),
                Status = "Draft",
                TemplateVersion = AgreementTemplate.Version
            }));
        }

        public async Task<AgreementDto> CreateAsync(CreateAgreementRequest request, int userId, int tenantId)
        {
            try
            {
                var agreementNo = await GenerateAgreementNoAsync(tenantId);
                var entity = new Agreement
                {
                    OwnerId = tenantId,
                    TenantId = tenantId,
                    AgreementNo = agreementNo,
                    AgreementDate = ToUtcDate(request.AgreementDate),
                    SecondPartyName = request.SecondPartyName?.Trim(),
                    SecondPartyLicense = request.SecondPartyLicense?.Trim(),
                    SecondPartyAddress = request.SecondPartyAddress?.Trim(),
                    SecondPartyMobile = request.SecondPartyMobile?.Trim(),
                    TemplateVersion = AgreementTemplate.Version,
                    Status = NormalizeStatus(request.Status),
                    Notes = request.Notes,
                    CreatedBy = userId,
                    CreatedAt = DateTime.UtcNow
                };
                _context.Agreements.Add(entity);
                await _context.SaveChangesAsync();
                return Map(entity);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create agreement for tenant {TenantId}", tenantId);
                throw;
            }
        }

        public async Task<AgreementDto?> UpdateAsync(int id, UpdateAgreementRequest request, int userId, int tenantId)
        {
            try
            {
                var entity = await _context.Agreements
                    .FirstOrDefaultAsync(a => a.Id == id && a.TenantId == tenantId && !a.IsDeleted);
                if (entity == null) return null;

                entity.AgreementDate = request.AgreementDate.HasValue
                    ? ToUtcDate(request.AgreementDate)
                    : ToUtcDate(entity.AgreementDate);
                entity.SecondPartyName = request.SecondPartyName?.Trim();
                entity.SecondPartyLicense = request.SecondPartyLicense?.Trim();
                entity.SecondPartyAddress = request.SecondPartyAddress?.Trim();
                entity.SecondPartyMobile = request.SecondPartyMobile?.Trim();
                entity.Status = NormalizeStatus(request.Status);
                entity.Notes = request.Notes;
                entity.LastModifiedBy = userId;
                entity.LastModifiedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                return Map(entity);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update agreement {Id} for tenant {TenantId}", id, tenantId);
                throw;
            }
        }

        public async Task<bool> DeleteAsync(int id, int userId, int tenantId)
        {
            try
            {
                var entity = await _context.Agreements
                    .FirstOrDefaultAsync(a => a.Id == id && a.TenantId == tenantId && !a.IsDeleted);
                if (entity == null) return false;
                entity.IsDeleted = true;
                entity.DeletedBy = userId;
                entity.DeletedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to delete agreement {Id} for tenant {TenantId}", id, tenantId);
                throw;
            }
        }

        private async Task<string> GenerateAgreementNoAsync(int tenantId)
        {
            var existing = await _context.Agreements
                .Where(a => a.TenantId == tenantId && !a.IsDeleted)
                .Select(a => a.AgreementNo)
                .ToListAsync();
            var max = 0;
            foreach (var no in existing)
            {
                var digits = no.StartsWith("AGR-", StringComparison.OrdinalIgnoreCase) ? no.Substring(4) : no;
                if (int.TryParse(digits, out var n) && n > max) max = n;
            }
            return $"AGR-{max + 1}";
        }

        private static string NormalizeStatus(string? status)
            => string.Equals(status, "Final", StringComparison.OrdinalIgnoreCase) ? "Final" : "Draft";

        /// <summary>Npgsql timestamptz rejects Unspecified Kind from .Date — always store UTC midnight.</summary>
        private static DateTime ToUtcDate(DateTime? value)
        {
            var d = value ?? DateTime.UtcNow;
            return new DateTime(d.Year, d.Month, d.Day, 0, 0, 0, DateTimeKind.Utc);
        }

        private static AgreementDto Map(Agreement a)
        {
            var secondDisplay = string.IsNullOrWhiteSpace(a.SecondPartyName) ? "________________" : a.SecondPartyName.Trim();
            return new AgreementDto
            {
                Id = a.Id,
                AgreementNo = a.AgreementNo,
                AgreementDate = a.AgreementDate,
                SecondPartyName = a.SecondPartyName,
                SecondPartyLicense = a.SecondPartyLicense,
                SecondPartyAddress = a.SecondPartyAddress,
                SecondPartyMobile = a.SecondPartyMobile,
                TemplateVersion = string.IsNullOrWhiteSpace(a.TemplateVersion) ? AgreementTemplate.Version : a.TemplateVersion,
                Status = a.Status,
                Notes = a.Notes,
                CreatedAt = a.CreatedAt,
                FirstPartyName = AgreementTemplate.FirstPartyName,
                FirstPartyLicense = AgreementTemplate.FirstPartyLicense,
                FirstPartyAddress = AgreementTemplate.FirstPartyAddress,
                FirstPartyMobile = AgreementTemplate.FirstPartyMobile,
                FirstPartyEmail = AgreementTemplate.Email,
                FirstPartyWebsite = AgreementTemplate.Website,
                FirstPartyPhones = AgreementTemplate.FooterPhones,
                FooterAddress = AgreementTemplate.FooterAddress,
                WhereasText = AgreementTemplate.Whereas(secondDisplay),
                Clauses = AgreementTemplate.BuildClauses().ToList()
            };
        }
    }

    /// <summary>Verbatim Zayoga Business Development Agreement text (v1) from signed sample.</summary>
    public static class AgreementTemplate
    {
        public const string Version = "v1";
        public const string Title = "BUSINESS DEVELOPMENT AGREEMENT";

        public const string FirstPartyName = "ZAYOGA GENERAL TRADING SOLE PROPRIETORSHIP LLC";
        public const string FirstPartyLicense = "CN-4937175";
        public const string FirstPartyAddress = "ABUDHABI UAE";
        public const string FirstPartyMobile = "+971564525130";
        public const string Email = "info@zayoga.ae";
        public const string Website = "www.zayoga.ae";
        public const string FooterAddress = "OFFICE M14,AL SAWARI TOWER B,KHALIDIYA ABUDHABI UAE";
        public const string FooterPhones = "TEL- 022450340, 0564525130,0547595982";

        public static string Whereas(string secondPartyDisplayName) =>
            $"Whereas, {FirstPartyName} is a licensed Ice popsicles and Sip up Distributors based in UAE an {secondPartyDisplayName} is Licensed trader selling products directly to the customers, both parties agreed on the following points:";

        public static IReadOnlyList<string> BuildClauses() => new[]
        {
            $"{FirstPartyName} will provide frozen items that meets all applicable food safety and quality standards.",
            "will purchase these items based on the following terms and conditions: -",
            "Second party to sell popsicles in outlet.",
            "Display Support: The First party will provide freezer to the second party and they agreed to provide space in outlet to generate a good business for both parties.",
            "Return Policy: there is no return policy for the items once items delivered unless there is no damage and in case of nonmoving, items should return with good condition which is able to sell at least two months before expiry.",
            "The first party retains the ownership of the freezer and may request the return of the same, second party shall comply with such request."
        };

        /// <summary>Legacy alias used by older call sites.</summary>
        public static IReadOnlyList<string> Clauses => BuildClauses();
    }
}
