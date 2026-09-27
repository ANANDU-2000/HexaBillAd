using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Subscription;

namespace HexaBill.Tests;

public class StaffLimitTests
{
    [Fact]
    public async Task CheckLimitAsync_RejectsAnotherUserWhenActiveCountReachesMaxUsers()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("StaffLimit_" + Guid.NewGuid())
            .Options;
        await using var context = new AppDbContext(options);
        context.SetRequestTenantScope(null, isPlatformScope: true);
        await context.Database.EnsureCreatedAsync();
        context.Tenants.Add(new Tenant { Id = 1, Name = "Tenant 1", Subdomain = "tenant-1", Country = "AE", Currency = "AED" });
        context.SubscriptionPlans.Add(new SubscriptionPlan { Id = 1, Name = "Basic", Currency = "AED", MaxUsers = 5 });
        context.Subscriptions.Add(new Subscription
        {
            TenantId = 1,
            PlanId = 1,
            Status = SubscriptionStatus.Active,
            Currency = "AED",
            ExpiresAt = DateTime.UtcNow.AddYears(1)
        });
        await context.SaveChangesAsync();

        var service = new SubscriptionService(context, NullLogger<SubscriptionService>.Instance, new ConfigurationBuilder().Build());
        Assert.True(await service.CheckLimitAsync(1, "users", 4));
        Assert.False(await service.CheckLimitAsync(1, "users", 5));
    }
}
