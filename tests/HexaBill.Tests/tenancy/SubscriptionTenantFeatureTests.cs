using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Subscription;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

public class SubscriptionTenantFeatureTests
{
    [Fact]
    public async Task IsFeatureAllowedAsync_HonorsTenantFeaturesJson_WhenNotOnPlan()
    {
        await using var db = await DatabaseAsync();
        var service = new SubscriptionService(db, NullLogger<SubscriptionService>.Instance, new ConfigurationBuilder().Build());
        var allowed = await service.IsFeatureAllowedAsync(10, TenantFeatureFlags.SettlementAdjustments);
        Assert.True(allowed);
    }

    [Fact]
    public async Task IsFeatureAllowedAsync_ReturnsFalse_WhenFeatureNotInJson()
    {
        await using var db = await DatabaseAsync(includeSettlementFlag: false);
        var service = new SubscriptionService(db, NullLogger<SubscriptionService>.Instance, new ConfigurationBuilder().Build());
        var allowed = await service.IsFeatureAllowedAsync(10, TenantFeatureFlags.SettlementAdjustments);
        Assert.False(allowed);
    }

    private static async Task<AppDbContext> DatabaseAsync(bool includeSettlementFlag = true)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("SubscriptionTenantFeature_" + Guid.NewGuid())
            .Options);
        db.SetRequestTenantScope(10, false);
        var features = includeSettlementFlag ? """["settlement_adjustments"]""" : "[]";
        db.Tenants.Add(new Tenant { Id = 10, Name = "Feature tenant", Subdomain = "feat", FeaturesJson = features });
        db.SubscriptionPlans.Add(new SubscriptionPlan
        {
            Id = 1,
            Name = "Basic",
            IsActive = true,
            MonthlyPrice = 0,
            YearlyPrice = 0,
            Currency = "AED",
            MaxUsers = 5,
            MaxInvoicesPerMonth = 1000,
            MaxCustomers = 1000,
            MaxProducts = 1000,
            MaxStorageMB = 1024,
            DisplayOrder = 1
        });
        db.Subscriptions.Add(new Subscription
        {
            Id = 1,
            TenantId = 10,
            PlanId = 1,
            Status = SubscriptionStatus.Active,
            BillingCycle = BillingCycle.Monthly,
            Currency = "AED",
            StartDate = DateTime.UtcNow.AddMonths(-1),
            EndDate = DateTime.UtcNow.AddMonths(1),
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        return db;
    }
}
