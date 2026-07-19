/*
Purpose: Agreement CRUD — fixed clause template; Second Party fields only
Feature flag: Feature_QuotesAgreements
*/
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.SuperAdmin;

namespace HexaBill.Api.Modules.Documents
{
    public interface IAgreementService
    {
        Task<List<AgreementDto>> ListAsync(int tenantId);
        Task<AgreementDto?> GetByIdAsync(int id, int tenantId);
        Task<AgreementDto> CreateAsync(CreateAgreementRequest request, int userId, int tenantId);
        Task<AgreementDto?> UpdateAsync(int id, UpdateAgreementRequest request, int userId, int tenantId);
        Task<bool> DeleteAsync(int id, int userId, int tenantId);
        Task<AgreementDto> GetBlankPreviewAsync(int tenantId);
    }

    public class AgreementService : IAgreementService
    {
        public const string DefaultLicense = "CN-4937175";
        public const string TemplateVersion = "v1";

        private readonly AppDbContext _context;
        private readonly ISettingsService _settings;
        private readonly ILogger<AgreementService> _logger;

        public AgreementService(AppDbContext context, ISettingsService settings, ILogger<AgreementService> logger)
        {
            _context = context;
            _settings = settings;
            _logger = logger;
        }

        public async Task<List<AgreementDto>> ListAsync(int tenantId)
        {
            var list = await _context.Agreements
                .AsNoTracking()
                .Where(a => a.TenantId == tenantId && !a.IsDeleted)
                .OrderByDescending(a => a.AgreementDate)
                .ThenByDescending(a => a.Id)
                .ToListAsync();
            var first = await LoadFirstPartyAsync(tenantId);
            return list.Select(a => Map(a, first)).ToList();
        }

        public async Task<AgreementDto?> GetByIdAsync(int id, int tenantId)
        {
            var a = await _context.Agreements
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId && !x.IsDeleted);
            if (a == null) return null;
            return Map(a, await LoadFirstPartyAsync(tenantId));
        }

        public async Task<AgreementDto> GetBlankPreviewAsync(int tenantId)
        {
            var first = await LoadFirstPartyAsync(tenantId);
            return new AgreementDto
            {
                AgreementNo = "",
                AgreementDate = DateTime.UtcNow.Date,
                TemplateVersion = TemplateVersion,
                Status = "Draft",
                FirstPartyName = first.Name,
                FirstPartyLicense = first.License,
                FirstPartyAddress = first.Address,
                FirstPartyMobile = first.Mobile,
                FirstPartyEmail = first.Email,
                FirstPartyWebsite = first.Website,
                FirstPartyPhones = first.Phones
            };
        }

        public async Task<AgreementDto> CreateAsync(CreateAgreementRequest request, int userId, int tenantId)
        {
            try
            {
                var nextNo = await GenerateAgreementNoAsync(tenantId);
                var entity = new Agreement
                {
                    OwnerId = tenantId,
                    TenantId = tenantId,
                    AgreementNo = nextNo,
                    AgreementDate = request.AgreementDate?.Date ?? DateTime.UtcNow.Date,
                    SecondPartyName = request.SecondPartyName?.Trim(),
                    SecondPartyLicense = request.SecondPartyLicense?.Trim(),
                    SecondPartyAddress = request.SecondPartyAddress?.Trim(),
                    SecondPartyMobile = request.SecondPartyMobile?.Trim(),
                    TemplateVersion = TemplateVersion,
                    Status = NormalizeStatus(request.Status),
                    Notes = request.Notes,
                    CreatedBy = userId,
                    CreatedAt = DateTime.UtcNow
                };
                _context.Agreements.Add(entity);
                await _context.SaveChangesAsync();
                _logger.LogInformation("Agreement {No} created for tenant {TenantId}", nextNo, tenantId);
                return Map(entity, await LoadFirstPartyAsync(tenantId));
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

                entity.AgreementDate = request.AgreementDate?.Date ?? entity.AgreementDate;
                entity.SecondPartyName = request.SecondPartyName?.Trim();
                entity.SecondPartyLicense = request.SecondPartyLicense?.Trim();
                entity.SecondPartyAddress = request.SecondPartyAddress?.Trim();
                entity.SecondPartyMobile = request.SecondPartyMobile?.Trim();
                entity.Status = NormalizeStatus(request.Status);
                entity.Notes = request.Notes;
                entity.LastModifiedBy = userId;
                entity.LastModifiedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                return Map(entity, await LoadFirstPartyAsync(tenantId));
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

        private async Task<(string Name, string License, string Address, string Mobile, string Email, string Website, string Phones)>
            LoadFirstPartyAsync(int tenantId)
        {
            var dict = await _settings.GetOwnerSettingsAsync(tenantId);
            var name = dict.GetValueOrDefault("COMPANY_NAME_EN", "HexaBill");
            var license = dict.GetValueOrDefault("COMPANY_LICENSE", DefaultLicense);
            if (string.IsNullOrWhiteSpace(license)) license = DefaultLicense;
            var address = dict.GetValueOrDefault("COMPANY_ADDRESS", "Abu Dhabi, UAE");
            var mobile = dict.GetValueOrDefault("COMPANY_PHONE", "");
            var email = dict.GetValueOrDefault("COMPANY_EMAIL", "");
            var website = dict.GetValueOrDefault("COMPANY_WEBSITE", "");
            var phones = dict.GetValueOrDefault("COMPANY_PHONES", mobile);
            return (name, license, address, mobile, email, website, phones);
        }

        private static string NormalizeStatus(string? status)
            => string.Equals(status, "Final", StringComparison.OrdinalIgnoreCase) ? "Final" : "Draft";

        private static AgreementDto Map(Agreement a, (string Name, string License, string Address, string Mobile, string Email, string Website, string Phones) first)
            => new()
            {
                Id = a.Id,
                AgreementNo = a.AgreementNo,
                AgreementDate = a.AgreementDate,
                SecondPartyName = a.SecondPartyName,
                SecondPartyLicense = a.SecondPartyLicense,
                SecondPartyAddress = a.SecondPartyAddress,
                SecondPartyMobile = a.SecondPartyMobile,
                TemplateVersion = a.TemplateVersion,
                Status = a.Status,
                Notes = a.Notes,
                CreatedAt = a.CreatedAt,
                FirstPartyName = first.Name,
                FirstPartyLicense = first.License,
                FirstPartyAddress = first.Address,
                FirstPartyMobile = first.Mobile,
                FirstPartyEmail = first.Email,
                FirstPartyWebsite = first.Website,
                FirstPartyPhones = first.Phones
            };
    }

    /// <summary>Fixed Business Development Agreement clause text (v1).</summary>
    public static class AgreementTemplate
    {
        public const string Title = "BUSINESS DEVELOPMENT AGREEMENT";

        public static string Whereas(string firstName, string secondName) =>
            $"Whereas the First Party ({firstName}) is a licensed Ice popsicles and Sip up Distributors and the Second Party ({(string.IsNullOrWhiteSpace(secondName) ? "________________" : secondName)}) is a Licensed trader.";

        public static readonly string[] Clauses =
        {
            "The First Party will provide frozen items meeting food safety and quality standards.",
            "The Second Party will purchase and sell popsicles in their outlet.",
            "The First Party will provide a freezer to the Second Party; the Second Party agrees to provide space in the outlet.",
            "There is no return policy for the items once items delivered unless there is damage; and in case of nonmoving, items should return with good condition which is able to sell at least two months before expiry.",
            "The First Party retains ownership of the freezer and may request its return; the Second Party shall comply."
        };
    }
}
