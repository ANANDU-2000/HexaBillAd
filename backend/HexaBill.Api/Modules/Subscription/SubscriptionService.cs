/*
Purpose: Subscription Management Service
Author: AI Assistant
Date: 2026-02-11
*/
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions;

namespace HexaBill.Api.Modules.Subscription
{
    public interface ISubscriptionService
    {
        Task<List<SubscriptionPlanDto>> GetPlansAsync();
        Task<SubscriptionPlanDto?> GetPlanByIdAsync(int planId);
        Task<SubscriptionDto?> GetTenantSubscriptionAsync(int tenantId);
        Task<SubscriptionDto> CreateSubscriptionAsync(int tenantId, int planId, BillingCycle billingCycle);
        Task<SubscriptionDto> UpdateSubscriptionAsync(int subscriptionId, int? planId, BillingCycle? billingCycle);
        Task<bool> CancelSubscriptionAsync(int subscriptionId, string reason);
        Task<bool> RenewSubscriptionAsync(int subscriptionId);
        Task<bool> CheckSubscriptionStatusAsync(int tenantId);
        Task<bool> IsFeatureAllowedAsync(int tenantId, string feature);
        Task<SubscriptionLimitsDto> GetTenantLimitsAsync(int tenantId);
        Task<bool> CheckLimitAsync(int tenantId, string limitType, int currentUsage);
        Task<List<SubscriptionDto>> GetExpiringSubscriptionsAsync(int daysAhead = 7);
        Task<SubscriptionMetricsDto> GetPlatformMetricsAsync();
    }

    public class SubscriptionService : ISubscriptionService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<SubscriptionService> _logger;

        public SubscriptionService(AppDbContext context, ILogger<SubscriptionService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<List<SubscriptionPlanDto>> GetPlansAsync()
        {
            var plans = await _context.SubscriptionPlans
                .Where(p => p.IsActive)
                .OrderBy(p => p.DisplayOrder)
                .ThenBy(p => (double)p.MonthlyPrice)
                .Select(p => new SubscriptionPlanDto
                {
                    Id = p.Id,
                    Name = p.Name,
                    Description = p.Description,
                    MonthlyPrice = p.MonthlyPrice,
                    YearlyPrice = p.YearlyPrice,
                    Currency = p.Currency,
                    MaxUsers = p.MaxUsers,
                    MaxInvoicesPerMonth = p.MaxInvoicesPerMonth,
                    MaxCustomers = p.MaxCustomers,
                    MaxProducts = p.MaxProducts,
                    MaxStorageMB = p.MaxStorageMB,
                    HasAdvancedReports = p.HasAdvancedReports,
                    HasApiAccess = p.HasApiAccess,
                    HasWhiteLabel = p.HasWhiteLabel,
                    HasPrioritySupport = p.HasPrioritySupport,
                    HasCustomBranding = p.HasCustomBranding,
                    TrialDays = p.TrialDays
                })
                .ToListAsync();

            return plans;
        }

        public async Task<SubscriptionPlanDto?> GetPlanByIdAsync(int planId)
        {
            var plan = await _context.SubscriptionPlans.FindAsync(planId);
            if (plan == null || !plan.IsActive) return null;

            return new SubscriptionPlanDto
            {
                Id = plan.Id,
                Name = plan.Name,
                Description = plan.Description,
                MonthlyPrice = plan.MonthlyPrice,
                YearlyPrice = plan.YearlyPrice,
                Currency = plan.Currency,
                MaxUsers = plan.MaxUsers,
                MaxInvoicesPerMonth = plan.MaxInvoicesPerMonth,
                MaxCustomers = plan.MaxCustomers,
                MaxProducts = plan.MaxProducts,
                MaxStorageMB = plan.MaxStorageMB,
                HasAdvancedReports = plan.HasAdvancedReports,
                HasApiAccess = plan.HasApiAccess,
                HasWhiteLabel = plan.HasWhiteLabel,
                HasPrioritySupport = plan.HasPrioritySupport,
                HasCustomBranding = plan.HasCustomBranding,
                TrialDays = plan.TrialDays
            };
        }

        public async Task<SubscriptionDto?> GetTenantSubscriptionAsync(int tenantId)
        {
            var subscription = await _context.Subscriptions
                .Include(s => s.Plan)
                .Where(s => s.TenantId == tenantId)
                .OrderByDescending(s => s.CreatedAt)
                .FirstOrDefaultAsync();

            if (subscription == null) return null;

            return MapToDto(subscription);
        }

        public async Task<SubscriptionDto> CreateSubscriptionAsync(int tenantId, int planId, BillingCycle billingCycle)
        {
            var plan = await _context.SubscriptionPlans.FindAsync(planId);
            if (plan == null)
                throw new InvalidOperationException($"Plan with ID {planId} not found");

            // Check if tenant already has an active subscription
            var existingSubscription = await _context.Subscriptions
                .Where(s => s.TenantId == tenantId && 
                           (s.Status == SubscriptionStatus.Active || s.Status == SubscriptionStatus.Trial))
                .FirstOrDefaultAsync();

            if (existingSubscription != null)
            {
                throw new InvalidOperationException("Tenant already has an active subscription");
            }

            var subscription = new HexaBill.Api.Models.Subscription
            {
                TenantId = tenantId,
                PlanId = planId,
                Plan = plan, // Explicitly set navigation property
                Status = SubscriptionStatus.Trial,
                BillingCycle = billingCycle,
                StartDate = DateTime.UtcNow,
                TrialEndDate = DateTime.UtcNow.AddDays(plan.TrialDays),
                Amount = billingCycle == BillingCycle.Monthly ? plan.MonthlyPrice : plan.YearlyPrice,
                Currency = plan.Currency,
                CreatedAt = DateTime.UtcNow
            };

            _context.Subscriptions.Add(subscription);
            await _context.SaveChangesAsync();

            // Update tenant status
            var tenant = await _context.Tenants.FindAsync(tenantId);
            if (tenant != null)
            {
                tenant.Status = TenantStatus.Trial;
                tenant.TrialEndDate = subscription.TrialEndDate;
                await _context.SaveChangesAsync();
            }

            return MapToDto(subscription);
        }

        public async Task<SubscriptionDto> UpdateSubscriptionAsync(int subscriptionId, int? planId, BillingCycle? billingCycle)
        {
            var subscription = await _context.Subscriptions
                .Include(s => s.Plan)
                .FirstOrDefaultAsync(s => s.Id == subscriptionId);

            if (subscription == null)
                throw new InvalidOperationException($"Subscription with ID {subscriptionId} not found");

            if (planId.HasValue)
            {
                var newPlan = await _context.SubscriptionPlans.FindAsync(planId.Value);
                if (newPlan == null)
                    throw new InvalidOperationException($"Plan with ID {planId.Value} not found");

                subscription.PlanId = planId.Value;
                subscription.Plan = newPlan;
            }

            if (billingCycle.HasValue)
            {
                subscription.BillingCycle = billingCycle.Value;
            }

            // Recalculate amount
            subscription.Amount = subscription.BillingCycle == BillingCycle.Monthly
                ? subscription.Plan.MonthlyPrice
                : subscription.Plan.YearlyPrice;

            subscription.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return MapToDto(subscription);
        }

        public async Task<bool> CancelSubscriptionAsync(int subscriptionId, string reason)
        {
            var subscription = await _context.Subscriptions.FindAsync(subscriptionId);
            if (subscription == null) return false;

            subscription.Status = SubscriptionStatus.Cancelled;
            subscription.CancelledAt = DateTime.UtcNow;
            subscription.CancellationReason = reason;
            subscription.UpdatedAt = DateTime.UtcNow;

            // Set expiration date
            subscription.ExpiresAt = DateTime.UtcNow.AddDays(30); // Grace period

            await _context.SaveChangesAsync();

            // Update tenant status
            var tenant = await _context.Tenants.FindAsync(subscription.TenantId);
            if (tenant != null)
            {
                tenant.Status = TenantStatus.Expired;
                await _context.SaveChangesAsync();
            }

            return true;
        }

        public async Task<bool> RenewSubscriptionAsync(int subscriptionId)
        {
            var subscription = await _context.Subscriptions
                .Include(s => s.Plan)
                .FirstOrDefaultAsync(s => s.Id == subscriptionId);

            if (subscription == null) return false;

            // Calculate next billing date
            var nextBillingDate = subscription.BillingCycle == BillingCycle.Monthly
                ? DateTime.UtcNow.AddMonths(1)
                : DateTime.UtcNow.AddYears(1);

            subscription.Status = SubscriptionStatus.Active;
            subscription.NextBillingDate = nextBillingDate;
            subscription.EndDate = nextBillingDate;
            subscription.ExpiresAt = null;
            subscription.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Update tenant status
            var tenant = await _context.Tenants.FindAsync(subscription.TenantId);
            if (tenant != null)
            {
                tenant.Status = TenantStatus.Active;
                tenant.TrialEndDate = null;
                await _context.SaveChangesAsync();
            }

            return true;
        }

        public async Task<bool> CheckSubscriptionStatusAsync(int tenantId)
        {
            var subscription = await _context.Subscriptions
                .Where(s => s.TenantId == tenantId)
                .OrderByDescending(s => s.CreatedAt)
                .FirstOrDefaultAsync();

            if (subscription == null) return false;

            // Check if trial expired
            if (subscription.Status == SubscriptionStatus.Trial && subscription.TrialEndDate.HasValue)
            {
                if (DateTime.UtcNow > subscription.TrialEndDate.Value)
                {
                    subscription.Status = SubscriptionStatus.Expired;
                    subscription.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();

                    // Update tenant status
                    var tenant = await _context.Tenants.FindAsync(tenantId);
                    if (tenant != null)
                    {
                        tenant.Status = TenantStatus.Expired;
                        await _context.SaveChangesAsync();
                    }

                    return false;
                }
            }

            // Check if subscription expired
            if (subscription.ExpiresAt.HasValue && DateTime.UtcNow > subscription.ExpiresAt.Value)
            {
                subscription.Status = SubscriptionStatus.Expired;
                subscription.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                var tenant = await _context.Tenants.FindAsync(tenantId);
                if (tenant != null)
                {
                    tenant.Status = TenantStatus.Expired;
                    await _context.SaveChangesAsync();
                }

                return false;
            }

            return subscription.Status == SubscriptionStatus.Active || subscription.Status == SubscriptionStatus.Trial;
        }

        public async Task<bool> IsFeatureAllowedAsync(int tenantId, string feature)
        {
            var subscription = await GetTenantSubscriptionAsync(tenantId);
            if (subscription == null) return false;

            return feature switch
            {
                "advanced_reports" => subscription.Plan.HasAdvancedReports,
                "api_access" => subscription.Plan.HasApiAccess,
                "white_label" => subscription.Plan.HasWhiteLabel,
                "priority_support" => subscription.Plan.HasPrioritySupport,
                "custom_branding" => subscription.Plan.HasCustomBranding,
                _ => false
            };
        }

        public async Task<SubscriptionLimitsDto> GetTenantLimitsAsync(int tenantId)
        {
            var subscription = await GetTenantSubscriptionAsync(tenantId);
            if (subscription == null)
            {
                // Return default limits (free tier)
                return new SubscriptionLimitsDto
                {
                    MaxUsers = 1,
                    MaxInvoicesPerMonth = 50,
                    MaxCustomers = 100,
                    MaxProducts = 200,
                    MaxStorageMB = 512
                };
            }

            return new SubscriptionLimitsDto
            {
                MaxUsers = subscription.Plan.MaxUsers,
                MaxInvoicesPerMonth = subscription.Plan.MaxInvoicesPerMonth,
                MaxCustomers = subscription.Plan.MaxCustomers,
                MaxProducts = subscription.Plan.MaxProducts,
                MaxStorageMB = subscription.Plan.MaxStorageMB
            };
        }

        public async Task<bool> CheckLimitAsync(int tenantId, string limitType, int currentUsage)
        {
            var limits = await GetTenantLimitsAsync(tenantId);
            
            var limit = limitType switch
            {
                "users" => limits.MaxUsers,
                "invoices" => limits.MaxInvoicesPerMonth,
                "customers" => limits.MaxCustomers,
                "products" => limits.MaxProducts,
                _ => -1
            };

            // -1 means unlimited
            if (limit == -1) return true;

            return currentUsage < limit;
        }

        public async Task<List<SubscriptionDto>> GetExpiringSubscriptionsAsync(int daysAhead = 7)
        {
            var cutoffDate = DateTime.UtcNow.AddDays(daysAhead);

            var subscriptions = await _context.Subscriptions
                .Include(s => s.Plan)
                .Where(s => (s.Status == SubscriptionStatus.Active || s.Status == SubscriptionStatus.Trial) &&
                           s.TrialEndDate.HasValue && s.TrialEndDate <= cutoffDate ||
                           s.ExpiresAt.HasValue && s.ExpiresAt <= cutoffDate)
                .ToListAsync();

            return subscriptions.Select(MapToDto).ToList();
        }

        public async Task<SubscriptionMetricsDto> GetPlatformMetricsAsync()
        {
            var totalSubscriptions = await _context.Subscriptions.CountAsync();
            var activeSubscriptions = await _context.Subscriptions.CountAsync(s => s.Status == SubscriptionStatus.Active);
            var trialSubscriptions = await _context.Subscriptions.CountAsync(s => s.Status == SubscriptionStatus.Trial);
            var expiredSubscriptions = await _context.Subscriptions.CountAsync(s => s.Status == SubscriptionStatus.Expired);

            // Calculate MRR (Monthly Recurring Revenue)
            var mrr = await _context.Subscriptions
                .Where(s => s.Status == SubscriptionStatus.Active)
                .SumAsync(s => s.BillingCycle == BillingCycle.Monthly ? s.Amount : s.Amount / 12);

            // Calculate ARR (Annual Recurring Revenue)
            var arr = await _context.Subscriptions
                .Where(s => s.Status == SubscriptionStatus.Active)
                .SumAsync(s => s.BillingCycle == BillingCycle.Yearly ? s.Amount : s.Amount * 12);

            return new SubscriptionMetricsDto
            {
                TotalSubscriptions = totalSubscriptions,
                ActiveSubscriptions = activeSubscriptions,
                TrialSubscriptions = trialSubscriptions,
                ExpiredSubscriptions = expiredSubscriptions,
                MonthlyRecurringRevenue = mrr,
                AnnualRecurringRevenue = arr
            };
        }

        private SubscriptionDto MapToDto(HexaBill.Api.Models.Subscription subscription)
        {
            return new SubscriptionDto
            {
                Id = subscription.Id,
                TenantId = subscription.TenantId,
                Plan = new SubscriptionPlanDto
                {
                    Id = subscription.Plan.Id,
                    Name = subscription.Plan.Name,
                    Description = subscription.Plan.Description,
                    MonthlyPrice = subscription.Plan.MonthlyPrice,
                    YearlyPrice = subscription.Plan.YearlyPrice,
                    Currency = subscription.Plan.Currency,
                    MaxUsers = subscription.Plan.MaxUsers,
                    MaxInvoicesPerMonth = subscription.Plan.MaxInvoicesPerMonth,
                    MaxCustomers = subscription.Plan.MaxCustomers,
                    MaxProducts = subscription.Plan.MaxProducts,
                    MaxStorageMB = subscription.Plan.MaxStorageMB,
                    HasAdvancedReports = subscription.Plan.HasAdvancedReports,
                    HasApiAccess = subscription.Plan.HasApiAccess,
                    HasWhiteLabel = subscription.Plan.HasWhiteLabel,
                    HasPrioritySupport = subscription.Plan.HasPrioritySupport,
                    HasCustomBranding = subscription.Plan.HasCustomBranding,
                    TrialDays = subscription.Plan.TrialDays
                },
                Status = subscription.Status.ToString(),
                BillingCycle = subscription.BillingCycle.ToString(),
                StartDate = subscription.StartDate,
                EndDate = subscription.EndDate,
                TrialEndDate = subscription.TrialEndDate,
                ExpiresAt = subscription.ExpiresAt,
                NextBillingDate = subscription.NextBillingDate,
                Amount = subscription.Amount,
                Currency = subscription.Currency
            };
        }
    }

    // DTOs
    public class SubscriptionPlanDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public decimal MonthlyPrice { get; set; }
        public decimal YearlyPrice { get; set; }
        public string Currency { get; set; } = "AED";
        public int MaxUsers { get; set; }
        public int MaxInvoicesPerMonth { get; set; }
        public int MaxCustomers { get; set; }
        public int MaxProducts { get; set; }
        public long MaxStorageMB { get; set; }
        public bool HasAdvancedReports { get; set; }
        public bool HasApiAccess { get; set; }
        public bool HasWhiteLabel { get; set; }
        public bool HasPrioritySupport { get; set; }
        public bool HasCustomBranding { get; set; }
        public int TrialDays { get; set; }
    }

    public class SubscriptionDto
    {
        public int Id { get; set; }
        public int TenantId { get; set; }
        public SubscriptionPlanDto Plan { get; set; } = new();
        public string Status { get; set; } = string.Empty;
        public string BillingCycle { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public DateTime? TrialEndDate { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public DateTime? NextBillingDate { get; set; }
        public decimal Amount { get; set; }
        public string Currency { get; set; } = "AED";
    }

    public class SubscriptionLimitsDto
    {
        public int MaxUsers { get; set; }
        public int MaxInvoicesPerMonth { get; set; }
        public int MaxCustomers { get; set; }
        public int MaxProducts { get; set; }
        public long MaxStorageMB { get; set; }
    }

    public class SubscriptionMetricsDto
    {
        public int TotalSubscriptions { get; set; }
        public int ActiveSubscriptions { get; set; }
        public int TrialSubscriptions { get; set; }
        public int ExpiredSubscriptions { get; set; }
        public decimal MonthlyRecurringRevenue { get; set; }
        public decimal AnnualRecurringRevenue { get; set; }
    }
}
