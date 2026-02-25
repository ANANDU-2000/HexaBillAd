/*
Purpose: Subscription Management Service
Author: AI Assistant
Date: 2026-02-11
*/
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions;
using Stripe;
using Stripe.Checkout;

namespace HexaBill.Api.Modules.Subscription
{
    public interface ISubscriptionService
    {
        Task<List<SubscriptionPlanDto>> GetPlansAsync();
        Task<SubscriptionPlanDto?> GetPlanByIdAsync(int planId);
        Task<SubscriptionDto?> GetTenantSubscriptionAsync(int tenantId);
        Task<SubscriptionDto> CreateSubscriptionAsync(int tenantId, int planId, BillingCycle billingCycle, SubscriptionStatus? initialStatus = null, string? paymentGatewaySessionId = null, string? paymentMethod = null);
        Task<SubscriptionDto> UpdateSubscriptionAsync(int subscriptionId, int? planId, BillingCycle? billingCycle);
        Task<bool> CancelSubscriptionAsync(int subscriptionId, string reason);
        Task<bool> RenewSubscriptionAsync(int subscriptionId);
        Task<bool> CheckSubscriptionStatusAsync(int tenantId);
        Task<bool> IsFeatureAllowedAsync(int tenantId, string feature);
        Task<SubscriptionLimitsDto> GetTenantLimitsAsync(int tenantId);
        Task<bool> CheckLimitAsync(int tenantId, string limitType, int currentUsage);
        Task<List<SubscriptionDto>> GetExpiringSubscriptionsAsync(int daysAhead = 7);
        Task<SubscriptionMetricsDto> GetPlatformMetricsAsync();
        /// <summary>Platform revenue report: MRR trend, new signups by month, churn. SystemAdmin only. (PRODUCTION_MASTER_TODO #45)</summary>
        Task<PlatformRevenueReportDto> GetPlatformRevenueReportAsync();
        /// <summary>Create a Stripe Checkout Session for subscription payment. Returns URL to redirect user to. (PRODUCTION_MASTER_TODO #43)</summary>
        Task<StripeCheckoutResult?> CreateStripeCheckoutSessionAsync(int tenantId, int planId, BillingCycle billingCycle, string successUrl, string cancelUrl);
        /// <summary>Activate subscription after successful Stripe payment (called from webhook).</summary>
        Task<bool> ActivateSubscriptionFromStripePaymentAsync(int tenantId, int planId, BillingCycle billingCycle, string stripeSessionId);
    }

    public class StripeCheckoutResult
    {
        public string Url { get; set; } = string.Empty;
        public string SessionId { get; set; } = string.Empty;
    }

    public class SubscriptionService : ISubscriptionService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<SubscriptionService> _logger;
        private readonly IConfiguration _configuration;

        public SubscriptionService(AppDbContext context, ILogger<SubscriptionService> logger, IConfiguration configuration)
        {
            _context = context;
            _logger = logger;
            _configuration = configuration;
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
            // Ensure status is up to date before returning
            await CheckSubscriptionStatusAsync(tenantId);

            var subscription = await _context.Subscriptions
                .Include(s => s.Plan)
                .Where(s => s.TenantId == tenantId)
                .OrderByDescending(s => s.CreatedAt)
                .FirstOrDefaultAsync();

            if (subscription == null) return null;

            return MapToDto(subscription);
        }

        public async Task<SubscriptionDto> CreateSubscriptionAsync(int tenantId, int planId, BillingCycle billingCycle, SubscriptionStatus? initialStatus = null, string? paymentGatewaySessionId = null, string? paymentMethod = null)
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

            var isPaidActivation = initialStatus == SubscriptionStatus.Active;
            var subStatus = isPaidActivation ? SubscriptionStatus.Active : SubscriptionStatus.Trial;
            var trialEndDate = isPaidActivation ? (DateTime?)null : DateTime.UtcNow.AddDays(plan.TrialDays);

            var subscription = new HexaBill.Api.Models.Subscription
            {
                TenantId = tenantId,
                PlanId = planId,
                Plan = plan, // Explicitly set navigation property
                Status = subStatus,
                BillingCycle = billingCycle,
                StartDate = DateTime.UtcNow,
                TrialEndDate = trialEndDate,
                NextBillingDate = isPaidActivation ? (billingCycle == BillingCycle.Monthly ? DateTime.UtcNow.AddMonths(1) : DateTime.UtcNow.AddYears(1)) : trialEndDate,
                Amount = billingCycle == BillingCycle.Monthly ? plan.MonthlyPrice : plan.YearlyPrice,
                Currency = plan.Currency,
                PaymentGatewaySubscriptionId = paymentGatewaySessionId,
                PaymentMethod = paymentMethod ?? (isPaidActivation ? "stripe" : null),
                CreatedAt = DateTime.UtcNow
            };

            _context.Subscriptions.Add(subscription);
            await _context.SaveChangesAsync();

            var tenant = await _context.Tenants.FindAsync(tenantId);
            if (tenant != null)
            {
                if (!isPaidActivation)
                {
                    tenant.Status = TenantStatus.Trial;
                    tenant.TrialEndDate = subscription.TrialEndDate;
                }
                else
                {
                    tenant.Status = TenantStatus.Active;
                    tenant.TrialEndDate = null;
                }
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

            // Start by assuming Active/Trial, then degrade if expired
            bool isSubscriptionValid = subscription.Status == SubscriptionStatus.Active || subscription.Status == SubscriptionStatus.Trial;

            // Check if trial expired
            if (subscription.Status == SubscriptionStatus.Trial && subscription.TrialEndDate.HasValue)
            {
                if (DateTime.UtcNow > subscription.TrialEndDate.Value)
                {
                    subscription.Status = SubscriptionStatus.Expired;
                    subscription.UpdatedAt = DateTime.UtcNow;
                    isSubscriptionValid = false;
                }
            }

            // Check if subscription expired
            if (subscription.ExpiresAt.HasValue && DateTime.UtcNow > subscription.ExpiresAt.Value)
            {
                subscription.Status = SubscriptionStatus.Expired;
                subscription.UpdatedAt = DateTime.UtcNow;
                isSubscriptionValid = false;
            }

            // Always sync Tenant status with Subscription status
            var tenant = await _context.Tenants.FindAsync(tenantId);
            if (tenant != null)
            {
                var targetStatus = subscription.Status switch
                {
                    SubscriptionStatus.Active => TenantStatus.Active,
                    SubscriptionStatus.Trial => TenantStatus.Trial,
                    SubscriptionStatus.Suspended => TenantStatus.Suspended,
                    SubscriptionStatus.PastDue => TenantStatus.Suspended,
                    SubscriptionStatus.Cancelled => TenantStatus.Expired,
                    SubscriptionStatus.Expired => TenantStatus.Expired,
                    _ => TenantStatus.Expired
                };

                if (tenant.Status != targetStatus)
                {
                    tenant.Status = targetStatus;
                    if (targetStatus == TenantStatus.Active)
                        tenant.TrialEndDate = null;
                    else if (targetStatus == TenantStatus.Trial)
                        tenant.TrialEndDate = subscription.TrialEndDate;
                }
            }

            // Save all tracked changes (subscription and/or tenant) - wrap to avoid failing read flows (e.g. GET tenant/2)
            if (_context.ChangeTracker.HasChanges())
            {
                try
                {
                    await _context.SaveChangesAsync();
                }
                catch (Microsoft.EntityFrameworkCore.DbUpdateException ex)
                {
                    _logger.LogWarning(ex, "CheckSubscriptionStatusAsync: SaveChanges failed for tenant {TenantId}. Inner: {Inner}", tenantId,
                        ex.InnerException?.Message ?? "none");
                    // Do not rethrow - allow GetTenantSubscription to return data; status sync will retry next request
                }
            }

            return isSubscriptionValid;
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

        public async Task<PlatformRevenueReportDto> GetPlatformRevenueReportAsync()
        {
            var now = DateTime.UtcNow;
            var thirtyDaysAgo = now.AddDays(-30);
            var months = new List<PlatformRevenueMonthDto>();
            for (var i = 11; i >= 0; i--)
            {
                var startOfMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(-i);
                var endOfMonth = startOfMonth.AddMonths(1).AddTicks(-1);

                var mrrAtMonth = await _context.Subscriptions
                    .AsNoTracking()
                    .Where(s => s.StartDate <= endOfMonth &&
                        (s.CancelledAt == null || s.CancelledAt > endOfMonth) &&
                        (s.ExpiresAt == null || s.ExpiresAt > endOfMonth))
                    .SumAsync(s => s.BillingCycle == BillingCycle.Monthly ? s.Amount : s.Amount / 12);

                var newSignupsInMonth = await _context.Tenants
                    .AsNoTracking()
                    .CountAsync(t => t.CreatedAt >= startOfMonth && t.CreatedAt <= endOfMonth);

                months.Add(new PlatformRevenueMonthDto
                {
                    Month = startOfMonth.ToString("yyyy-MM"),
                    Mrr = mrrAtMonth,
                    NewSignups = newSignupsInMonth
                });
            }

            var churnedLast30Days = await _context.Subscriptions
                .AsNoTracking()
                .CountAsync(s => (s.CancelledAt >= thirtyDaysAgo && s.CancelledAt <= now) ||
                    (s.ExpiresAt >= thirtyDaysAgo && s.ExpiresAt <= now));

            var currentActive = await _context.Subscriptions.CountAsync(s => s.Status == SubscriptionStatus.Active);
            var currentMrr = await _context.Subscriptions
                .Where(s => s.Status == SubscriptionStatus.Active)
                .SumAsync(s => s.BillingCycle == BillingCycle.Monthly ? s.Amount : s.Amount / 12);

            return new PlatformRevenueReportDto
            {
                MrrByMonth = months,
                CurrentMrr = currentMrr,
                CurrentActiveSubscriptions = currentActive,
                ChurnedLast30Days = churnedLast30Days,
                ChurnRatePercent = currentActive + churnedLast30Days > 0
                    ? (decimal)churnedLast30Days / (currentActive + churnedLast30Days) * 100
                    : 0
            };
        }

        public async Task<StripeCheckoutResult?> CreateStripeCheckoutSessionAsync(int tenantId, int planId, BillingCycle billingCycle, string successUrl, string cancelUrl)
        {
            var secretKey = _configuration["Stripe:SecretKey"];
            if (string.IsNullOrWhiteSpace(secretKey))
            {
                _logger.LogWarning("Stripe:SecretKey not configured; checkout session skipped.");
                return null;
            }

            var plan = await _context.SubscriptionPlans.FindAsync(planId);
            if (plan == null) return null;

            decimal amount = billingCycle == BillingCycle.Monthly ? plan.MonthlyPrice : plan.YearlyPrice;
            string currency = (plan.Currency ?? "AED").ToLowerInvariant();
            // Stripe expects amount in smallest unit (cents for USD, fils for AED - 100 fils = 1 AED)
            long unitAmount = (long)Math.Round(amount * 100, 0);
            if (unitAmount <= 0) unitAmount = 100;

            StripeConfiguration.ApiKey = secretKey;
            var options = new SessionCreateOptions
            {
                Mode = "payment",
                SuccessUrl = successUrl,
                CancelUrl = cancelUrl,
                Metadata = new Dictionary<string, string>
                {
                    { "tenantId", tenantId.ToString() },
                    { "planId", planId.ToString() },
                    { "billingCycle", billingCycle.ToString() }
                },
                LineItems = new List<SessionLineItemOptions>
                {
                    new SessionLineItemOptions
                    {
                        PriceData = new SessionLineItemPriceDataOptions
                        {
                            Currency = currency,
                            UnitAmount = unitAmount,
                            ProductData = new SessionLineItemPriceDataProductDataOptions
                            {
                                Name = plan.Name + (billingCycle == BillingCycle.Monthly ? " (Monthly)" : " (Yearly)"),
                                Description = plan.Description ?? "Subscription plan"
                            }
                        },
                        Quantity = 1
                    }
                }
            };

            var service = new SessionService();
            var session = await service.CreateAsync(options);
            return new StripeCheckoutResult { Url = session.Url ?? "", SessionId = session.Id };
        }

        public async Task<bool> ActivateSubscriptionFromStripePaymentAsync(int tenantId, int planId, BillingCycle billingCycle, string stripeSessionId)
        {
            try
            {
                _ = await CreateSubscriptionAsync(tenantId, planId, billingCycle, SubscriptionStatus.Active, stripeSessionId, "stripe");
                _logger.LogInformation("Subscription activated from Stripe payment for tenant {TenantId}, plan {PlanId}, session {SessionId}", tenantId, planId, stripeSessionId);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to activate subscription from Stripe for tenant {TenantId}, plan {PlanId}", tenantId, planId);
                return false;
            }
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

    public class PlatformRevenueReportDto
    {
        public List<PlatformRevenueMonthDto> MrrByMonth { get; set; } = new();
        public decimal CurrentMrr { get; set; }
        public int CurrentActiveSubscriptions { get; set; }
        public int ChurnedLast30Days { get; set; }
        public decimal ChurnRatePercent { get; set; }
    }

    public class PlatformRevenueMonthDto
    {
        public string Month { get; set; } = string.Empty;
        public decimal Mrr { get; set; }
        public int NewSignups { get; set; }
    }
}
