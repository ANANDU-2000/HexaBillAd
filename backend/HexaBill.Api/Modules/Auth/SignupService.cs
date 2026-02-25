/*
Purpose: Public Signup Service - Creates Tenant + Owner + Trial Subscription
Author: AI Assistant
Date: 2026-02-11
*/
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Subscription;
using Npgsql;

namespace HexaBill.Api.Modules.Auth
{
    public interface ISignupService
    {
        Task<SignupResponse> SignupAsync(SignupRequest request);
        Task<bool> VerifyEmailAsync(string token);
        Task<bool> ResendVerificationEmailAsync(string email);
        Task<Tenant> CreateTenantFromDemoAsync(CreateTenantFromDemoDto request);
    }

    public class CreateTenantFromDemoDto
    {
        public string CompanyName { get; set; } = string.Empty;
        public string ContactName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Country { get; set; } = "AE";
        public int PlanId { get; set; } = 1;
        public int TrialDays { get; set; } = 14;
    }

    public class SignupService : ISignupService
    {
        private readonly AppDbContext _context;
        private readonly ISubscriptionService _subscriptionService;
        private readonly ILogger<SignupService> _logger;

        public SignupService(
            AppDbContext context,
            ISubscriptionService subscriptionService,
            ILogger<SignupService> logger)
        {
            _context = context;
            _subscriptionService = subscriptionService;
            _logger = logger;
        }

        public async Task<SignupResponse> SignupAsync(SignupRequest request)
        {
            // Validate input
            if (string.IsNullOrWhiteSpace(request.Email))
                throw new InvalidOperationException("Email is required");

            if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
                throw new InvalidOperationException("Password must be at least 6 characters");

            if (string.IsNullOrWhiteSpace(request.CompanyName))
                throw new InvalidOperationException("Company name is required");

            // Normalize email
            var normalizedEmail = request.Email.Trim().ToLowerInvariant();

            // Check if email already exists
            var existingUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);

            if (existingUser != null)
            {
                throw new InvalidOperationException("Email already registered");
            }

            // Check if company name already exists
            var existingTenant = await _context.Tenants
                .FirstOrDefaultAsync(t => t.Name.ToLower() == request.CompanyName.Trim().ToLower());

            if (existingTenant != null)
            {
                throw new InvalidOperationException("Company name already taken");
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Step 1: Create Tenant
                var tenant = new Tenant
                {
                    Name = request.CompanyName.Trim(),
                    CompanyNameEn = request.CompanyName.Trim(),
                    Country = request.Country ?? "AE",
                    Currency = request.Currency ?? "AED",
                    VatNumber = request.VatNumber,
                    Email = normalizedEmail,
                    Phone = request.Phone,
                    Status = TenantStatus.Trial,
                    CreatedAt = DateTime.UtcNow,
                    TrialEndDate = DateTime.UtcNow.AddDays(14) // 14-day trial
                };

                _context.Tenants.Add(tenant);
                try
                {
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateException ex) when (ex.InnerException is PostgresException pgEx && pgEx.SqlState == "23505")
                {
                    // BUG #8 FIX: Handle concurrent signup race condition (unique violation on tenant name/email)
                    await transaction.RollbackAsync();
                    throw new InvalidOperationException("Company name or email already registered. Please try logging in instead.");
                }

                // Step 2: Create Owner User
                var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
                var ownerUser = new User
                {
                    Name = request.Name.Trim(),
                    Email = normalizedEmail,
                    PasswordHash = passwordHash,
                    Role = UserRole.Owner,
                    Phone = request.Phone,
                    TenantId = tenant.Id,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Users.Add(ownerUser);
                try
                {
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateException ex) when (ex.InnerException is PostgresException pgEx && pgEx.SqlState == "23505")
                {
                    // BUG #8 FIX: Handle concurrent signup race condition (unique violation)
                    // Two users registering with same email simultaneously both pass the check, then both try to insert
                    await transaction.RollbackAsync();
                    throw new InvalidOperationException("Email already registered. Please try logging in instead.");
                }

                // Step 3: Get default plan (Basic plan - ID 1, or create if doesn't exist)
                var defaultPlan = await _context.SubscriptionPlans
                    .OrderBy(p => p.MonthlyPrice)
                    .FirstOrDefaultAsync();

                if (defaultPlan == null)
                {
                    // Create default Basic plan if none exists
                    defaultPlan = new SubscriptionPlan
                    {
                        Name = "Basic",
                        Description = "Basic plan for small businesses",
                        MonthlyPrice = 99,
                        YearlyPrice = 990,
                        Currency = "AED",
                        MaxUsers = 5,
                        MaxInvoicesPerMonth = 100,
                        MaxCustomers = 500,
                        MaxProducts = 1000,
                        MaxStorageMB = 1024,
                        TrialDays = 14,
                        IsActive = true,
                        DisplayOrder = 1,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.SubscriptionPlans.Add(defaultPlan);
                    await _context.SaveChangesAsync();
                }

                // Step 4: Create Trial Subscription
                SubscriptionDto subscription;
                try
                {
                    subscription = await _subscriptionService.CreateSubscriptionAsync(
                        tenant.Id,
                        defaultPlan.Id,
                        BillingCycle.Monthly
                    );
                }
                catch (InvalidOperationException)
                {
                    // Subscription might already exist, continue
                    subscription = await _subscriptionService.GetTenantSubscriptionAsync(tenant.Id);
                    if (subscription == null)
                    {
                        throw new InvalidOperationException("Failed to create subscription");
                    }
                }

                // Step 5: Generate email verification token
                var verificationToken = Guid.NewGuid().ToString();
                // Store token in Settings table (temporary storage)
                var verificationSetting = new Setting
                {
                    Key = $"EMAIL_VERIFICATION_{normalizedEmail}",
                    TenantId = tenant.Id,
                    Value = verificationToken,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.Settings.Add(verificationSetting);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                // TODO: Send welcome email with verification link
                // For now, return token in response (remove in production)
                _logger.LogInformation("New tenant created: {TenantId}, Owner: {Email}", tenant.Id, normalizedEmail);

                return new SignupResponse
                {
                    Success = true,
                    Message = "Account created successfully. Please check your email to verify your account.",
                    TenantId = tenant.Id,
                    UserId = ownerUser.Id,
                    Email = normalizedEmail,
                    VerificationToken = verificationToken, // Remove in production
                    RequiresEmailVerification = true
                };
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Error during signup for {Email}", normalizedEmail);
                throw;
            }
        }

        public async Task<bool> VerifyEmailAsync(string token)
        {
            var setting = await _context.Settings
                .FirstOrDefaultAsync(s => s.Key.StartsWith("EMAIL_VERIFICATION_") && s.Value == token);

            if (setting == null)
            {
                return false;
            }

            // Extract email from key
            var email = setting.Key.Replace("EMAIL_VERIFICATION_", "").ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);

            if (user == null)
            {
                return false;
            }

            // Mark email as verified (add EmailVerified field to User model if needed)
            // For now, remove verification setting
            _context.Settings.Remove(setting);
            await _context.SaveChangesAsync();

            return true;
        }

        public async Task<bool> ResendVerificationEmailAsync(string email)
        {
            var normalizedEmail = email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);

            if (user == null)
            {
                return false;
            }

            // Generate new token
            var verificationToken = Guid.NewGuid().ToString();
            var existingSetting = await _context.Settings
                .FirstOrDefaultAsync(s => s.Key == $"EMAIL_VERIFICATION_{normalizedEmail}");

            if (existingSetting != null)
            {
                existingSetting.Value = verificationToken;
                existingSetting.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                var newSetting = new Setting
                {
                    Key = $"EMAIL_VERIFICATION_{normalizedEmail}",
                    TenantId = user.TenantId,
                    Value = verificationToken,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.Settings.Add(newSetting);
            }

            await _context.SaveChangesAsync();

            // TODO: Send verification email
            return true;
        }

        public async Task<Tenant> CreateTenantFromDemoAsync(CreateTenantFromDemoDto request)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var normalizedEmail = request.Email.Trim().ToLowerInvariant();
                var tenant = new Tenant
                {
                    Name = request.CompanyName.Trim(),
                    CompanyNameEn = request.CompanyName.Trim(),
                    Country = request.Country,
                    Currency = "AED",
                    Email = normalizedEmail,
                    Status = TenantStatus.Trial,
                    CreatedAt = DateTime.UtcNow,
                    TrialEndDate = DateTime.UtcNow.AddDays(request.TrialDays)
                };
                _context.Tenants.Add(tenant);
                await _context.SaveChangesAsync();

                var tempPassword = Guid.NewGuid().ToString("N")[..12];
                var passwordHash = BCrypt.Net.BCrypt.HashPassword(tempPassword);
                var ownerUser = new User
                {
                    Name = request.ContactName.Trim(),
                    Email = normalizedEmail,
                    PasswordHash = passwordHash,
                    Role = UserRole.Owner,
                    TenantId = tenant.Id,
                    CreatedAt = DateTime.UtcNow
                };
                _context.Users.Add(ownerUser);
                await _context.SaveChangesAsync();

                try
                {
                    await _subscriptionService.CreateSubscriptionAsync(tenant.Id, request.PlanId, BillingCycle.Monthly);
                }
                catch { }

                await transaction.CommitAsync();
                return tenant;
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }
    }

    public class SignupRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string CompanyName { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? Country { get; set; }
        public string? Currency { get; set; }
        public string? VatNumber { get; set; }
    }

    public class SignupResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public int TenantId { get; set; }
        public int UserId { get; set; }
        public string Email { get; set; } = string.Empty;
        public string? VerificationToken { get; set; } // Remove in production
        public bool RequiresEmailVerification { get; set; }
    }
}
