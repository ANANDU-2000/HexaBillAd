/*
Purpose: Salary Certificate CRUD — fixed Zayoga body template; dynamic employee fields only
*/
using HexaBill.Api.Models;
using HexaBill.Api.Data;
using HexaBill.Api.Shared;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HexaBill.Api.Modules.Documents
{
    public interface ISalaryCertificateService
    {
        Task<List<SalaryCertificateDto>> ListAsync(int tenantId);
        Task<SalaryCertificateDto?> GetByIdAsync(int id, int tenantId);
        Task<SalaryCertificateDto> GetBlankPreviewAsync(int tenantId);
        Task<SalaryCertificateDto> CreateAsync(CreateSalaryCertificateRequest request, int userId, int tenantId);
        Task<SalaryCertificateDto?> UpdateAsync(int id, UpdateSalaryCertificateRequest request, int userId, int tenantId);
        Task<bool> DeleteAsync(int id, int userId, int tenantId);
    }

    public class SalaryCertificateService : ISalaryCertificateService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<SalaryCertificateService> _logger;

        public SalaryCertificateService(AppDbContext context, ILogger<SalaryCertificateService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<List<SalaryCertificateDto>> ListAsync(int tenantId)
        {
            try
            {
                var rows = await _context.SalaryCertificates.AsNoTracking()
                    .Where(a => a.TenantId == tenantId && !a.IsDeleted)
                    .OrderByDescending(a => a.CreatedAt)
                    .ToListAsync();
                return rows.Select(Map).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to list salary certificates for tenant {TenantId}", tenantId);
                throw;
            }
        }

        public async Task<SalaryCertificateDto?> GetByIdAsync(int id, int tenantId)
        {
            try
            {
                var a = await _context.SalaryCertificates.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId && !x.IsDeleted);
                return a == null ? null : Map(a);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get salary certificate {Id} for tenant {TenantId}", id, tenantId);
                throw;
            }
        }

        public Task<SalaryCertificateDto> GetBlankPreviewAsync(int tenantId)
        {
            _ = tenantId;
            return Task.FromResult(Map(new SalaryCertificate
            {
                CertificateNo = "(preview)",
                CertificateDate = ToUtcDate(null),
                Status = "Draft",
                SignatoryName = SalaryCertificateTemplate.DefaultSignatoryName,
                SignatoryTitle = SalaryCertificateTemplate.DefaultSignatoryTitle
            }));
        }

        public async Task<SalaryCertificateDto> CreateAsync(CreateSalaryCertificateRequest request, int userId, int tenantId)
        {
            try
            {
                var certificateNo = await GenerateCertificateNoAsync(tenantId);
                var entity = new SalaryCertificate
                {
                    OwnerId = tenantId,
                    TenantId = tenantId,
                    CertificateNo = certificateNo,
                    CertificateDate = ToUtcDate(request.CertificateDate),
                    Recipient = request.Recipient?.Trim(),
                    EmployeeName = request.EmployeeName?.Trim(),
                    PassportNumber = request.PassportNumber?.Trim(),
                    EmployeeNationality = request.EmployeeNationality?.Trim(),
                    JoiningDate = request.JoiningDate.HasValue ? ToUtcDate(request.JoiningDate) : null,
                    Designation = request.Designation?.Trim(),
                    MonthlySalary = request.MonthlySalary,
                    MonthlySalaryWords = ResolveSalaryWords(request.MonthlySalary, request.MonthlySalaryWords),
                    EmployeePhone = request.EmployeePhone?.Trim(),
                    SignatoryName = string.IsNullOrWhiteSpace(request.SignatoryName)
                        ? SalaryCertificateTemplate.DefaultSignatoryName
                        : request.SignatoryName.Trim(),
                    SignatoryTitle = string.IsNullOrWhiteSpace(request.SignatoryTitle)
                        ? SalaryCertificateTemplate.DefaultSignatoryTitle
                        : request.SignatoryTitle.Trim(),
                    Status = NormalizeStatus(request.Status),
                    Notes = request.Notes,
                    CreatedBy = userId,
                    CreatedAt = DateTime.UtcNow
                };
                _context.SalaryCertificates.Add(entity);
                await _context.SaveChangesAsync();
                return Map(entity);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create salary certificate for tenant {TenantId}", tenantId);
                throw;
            }
        }

        public async Task<SalaryCertificateDto?> UpdateAsync(int id, UpdateSalaryCertificateRequest request, int userId, int tenantId)
        {
            try
            {
                var entity = await _context.SalaryCertificates
                    .FirstOrDefaultAsync(a => a.Id == id && a.TenantId == tenantId && !a.IsDeleted);
                if (entity == null) return null;

                entity.CertificateDate = request.CertificateDate.HasValue
                    ? ToUtcDate(request.CertificateDate)
                    : ToUtcDate(entity.CertificateDate);
                entity.Recipient = request.Recipient?.Trim();
                entity.EmployeeName = request.EmployeeName?.Trim();
                entity.PassportNumber = request.PassportNumber?.Trim();
                entity.EmployeeNationality = request.EmployeeNationality?.Trim();
                entity.JoiningDate = request.JoiningDate.HasValue ? ToUtcDate(request.JoiningDate) : null;
                entity.Designation = request.Designation?.Trim();
                entity.MonthlySalary = request.MonthlySalary;
                entity.MonthlySalaryWords = ResolveSalaryWords(request.MonthlySalary, request.MonthlySalaryWords);
                entity.EmployeePhone = request.EmployeePhone?.Trim();
                entity.SignatoryName = string.IsNullOrWhiteSpace(request.SignatoryName)
                    ? SalaryCertificateTemplate.DefaultSignatoryName
                    : request.SignatoryName.Trim();
                entity.SignatoryTitle = string.IsNullOrWhiteSpace(request.SignatoryTitle)
                    ? SalaryCertificateTemplate.DefaultSignatoryTitle
                    : request.SignatoryTitle.Trim();
                entity.Status = NormalizeStatus(request.Status);
                entity.Notes = request.Notes;
                entity.LastModifiedBy = userId;
                entity.LastModifiedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                return Map(entity);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update salary certificate {Id} for tenant {TenantId}", id, tenantId);
                throw;
            }
        }

        public async Task<bool> DeleteAsync(int id, int userId, int tenantId)
        {
            try
            {
                var entity = await _context.SalaryCertificates
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
                _logger.LogError(ex, "Failed to delete salary certificate {Id} for tenant {TenantId}", id, tenantId);
                throw;
            }
        }

        private async Task<string> GenerateCertificateNoAsync(int tenantId)
        {
            var existing = await _context.SalaryCertificates
                .Where(a => a.TenantId == tenantId && !a.IsDeleted)
                .Select(a => a.CertificateNo)
                .ToListAsync();
            var max = 0;
            foreach (var no in existing)
            {
                var digits = no.StartsWith("SC-", StringComparison.OrdinalIgnoreCase) ? no.Substring(3) : no;
                if (int.TryParse(digits, out var n) && n > max) max = n;
            }
            return $"SC-{max + 1}";
        }

        private static string NormalizeStatus(string? status)
            => string.Equals(status, "Final", StringComparison.OrdinalIgnoreCase) ? "Final" : "Draft";

        /// <summary>Auto-fill Gulf uppercase words from salary when words blank.</summary>
        internal static string? ResolveSalaryWords(decimal? salary, string? words)
        {
            var trimmed = words?.Trim();
            if (!string.IsNullOrWhiteSpace(trimmed) && trimmed != "________________")
                return trimmed;
            if (!salary.HasValue || salary.Value < 0)
                return trimmed;
            return AmountToWords.IntegerUpper(salary.Value);
        }

        private static DateTime ToUtcDate(DateTime? value)
        {
            var d = value ?? DateTime.UtcNow;
            return new DateTime(d.Year, d.Month, d.Day, 0, 0, 0, DateTimeKind.Utc);
        }

        private static SalaryCertificateDto Map(SalaryCertificate a)
        {
            return new SalaryCertificateDto
            {
                Id = a.Id,
                CertificateNo = a.CertificateNo,
                CertificateDate = a.CertificateDate,
                Recipient = a.Recipient,
                EmployeeName = a.EmployeeName,
                PassportNumber = a.PassportNumber,
                EmployeeNationality = a.EmployeeNationality,
                JoiningDate = a.JoiningDate,
                Designation = a.Designation,
                MonthlySalary = a.MonthlySalary,
                MonthlySalaryWords = a.MonthlySalaryWords,
                EmployeePhone = a.EmployeePhone,
                SignatoryName = string.IsNullOrWhiteSpace(a.SignatoryName)
                    ? SalaryCertificateTemplate.DefaultSignatoryName
                    : a.SignatoryName,
                SignatoryTitle = string.IsNullOrWhiteSpace(a.SignatoryTitle)
                    ? SalaryCertificateTemplate.DefaultSignatoryTitle
                    : a.SignatoryTitle,
                Status = a.Status,
                Notes = a.Notes,
                CreatedAt = a.CreatedAt,
                CompanyName = SalaryCertificateTemplate.CompanyName,
                CompanyPhone = SalaryCertificateTemplate.CompanyPhone,
                CompanyEmail = SalaryCertificateTemplate.Email,
                CompanyWebsite = SalaryCertificateTemplate.Website,
                FooterAddress = SalaryCertificateTemplate.FooterAddress,
                SubjectLine = SalaryCertificateTemplate.SubjectLine,
                BodyText = SalaryCertificateTemplate.BuildBody(a)
            };
        }
    }

    /// <summary>Verbatim Zayoga Salary Certificate body text from signed sample.</summary>
    public static class SalaryCertificateTemplate
    {
        public const string CompanyName = "ZAYOGA GENERAL TRADING SOLE PROPRIETORSHIP LLC";
        public const string CompanyPhone = "+971 56 452 5130";
        public const string Email = "info@zayoga.ae";
        public const string Website = "www.zayoga.ae";
        public const string FooterAddress = "ROOM2102 FLOOR21 ADCP TOWER A ELECTRA STREET";
        public const string SubjectLine = "Sub: SALARY CERTIFICATE";
        public const string DefaultSignatoryName = "Sudheesh Thampi";
        public const string DefaultSignatoryTitle = "Manager";

        private const string Blank = "________________";

        public static string BuildBody(SalaryCertificate a)
        {
            var name = BlankIfEmpty(a.EmployeeName);
            var nationality = BlankIfEmpty(a.EmployeeNationality);
            var passport = BlankIfEmpty(a.PassportNumber);
            var joining = a.JoiningDate.HasValue ? a.JoiningDate.Value.ToString("dd-MM-yyyy") : Blank;
            var designation = BlankIfEmpty(a.Designation);
            var salaryNum = a.MonthlySalary.HasValue ? a.MonthlySalary.Value.ToString("0") : Blank;
            var salaryWords = SalaryCertificateService.ResolveSalaryWords(a.MonthlySalary, a.MonthlySalaryWords)
                ?? Blank;
            if (string.IsNullOrWhiteSpace(salaryWords)) salaryWords = Blank;

            return
                $"This is to certify that {name} {nationality} nationality holding passport number {passport} " +
                $"is working with us since {joining} as {designation} And drawing a monthly salary " +
                $"{salaryNum}{{{salaryWords}}} inclusive of all allowances. Please note that this letter is only " +
                "issued upon the request of the above-mentioned employee and does not in no way and under no " +
                "circumstances constitute any financial responsibility guarantee and/or liability towards the " +
                "payment of any loan amount(S) to you from our part.";
        }

        private static string BlankIfEmpty(string? value)
            => string.IsNullOrWhiteSpace(value) ? Blank : value.Trim();
    }
}
