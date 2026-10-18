using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Branches;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

/// <summary>
/// Visit and delivery updates must work with the production database policy. Program.cs enables Npgsql
/// EnableRetryOnFailure, and that strategy rejects a transaction the code opens itself, so this uses the same policy.
/// </summary>
public class DeliveryStatesPostgreSqlTests
{
    [SkippableFact]
    public async Task DeliveryStates_AreSaved_UnderTheProductionRetryPolicy_OnPostgreSql()
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(connection), PostgresIntegrationSkip.Reason);
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connection!, npgsql =>
            {
                npgsql.CommandTimeout(30);
                npgsql.EnableRetryOnFailure(maxRetryCount: 3, maxRetryDelay: TimeSpan.FromSeconds(5), errorCodesToAdd: null);
            })
            .Options;
        await using var db = new AppDbContext(options);
        db.SetRequestTenantScope(null, true);
        await PostgresTestSchema.EnsureCreatedAsync(db);

        var t = 4_000_000 + Random.Shared.Next(1, 100_000_000);
        var now = DateTime.UtcNow;
        db.Tenants.Add(new Tenant { Id = t, Name = "Synthetic delivery states", Subdomain = $"delivery-{t}" });
        await db.SaveChangesAsync();
        db.Users.Add(new User { Id = t, TenantId = t, OwnerId = t, Name = "Fixture driver", Email = $"delivery-{t}@example.test", PasswordHash = "fixture", Role = UserRole.Staff, CreatedAt = now });
        var branch = new Branch { TenantId = t, Name = "Synthetic branch", CreatedAt = now };
        var customer = new Customer { TenantId = t, OwnerId = t, Name = "Synthetic delivery customer", CreatedAt = now, UpdatedAt = now };
        db.Branches.Add(branch);
        db.Customers.Add(customer);
        await db.SaveChangesAsync();
        var route = new HexaBill.Api.Models.Route { TenantId = t, BranchId = branch.Id, Name = "Synthetic route", CreatedAt = now };
        db.Routes.Add(route);
        await db.SaveChangesAsync();
        db.RouteCustomers.Add(new RouteCustomer { RouteId = route.Id, CustomerId = customer.Id, AssignedAt = now });
        await db.SaveChangesAsync();

        db.SetRequestTenantScope(t, false);
        var service = new RouteService(db, new SalesSchemaService(db), new ConfigurationBuilder().Build(), NullLogger<RouteService>.Instance);
        // The browser sends a plain yyyy-MM-dd, which arrives as Kind=Unspecified; Npgsql rejects that for timestamptz unless the code fixes it.
        var day = DateTime.SpecifyKind(DateTime.UtcNow.Date.AddDays(-30), DateTimeKind.Unspecified);

        var arrived = await service.UpdateCustomerVisitAsync(route.Id, customer.Id, new UpdateCustomerVisitRequest { VisitDate = day, Status = "Arrived" }, t, t);
        Assert.Equal("Arrived", arrived!.Status);
        var failed = await service.UpdateCustomerVisitAsync(route.Id, customer.Id, new UpdateCustomerVisitRequest { VisitDate = day, Status = "Failed", Notes = "Gate locked, nobody answered" }, t, t);
        Assert.Equal("Failed", failed!.Status);
        Assert.Equal("Gate locked, nobody answered", failed.Notes);
        var delivered = await service.UpdateCustomerVisitAsync(route.Id, customer.Id, new UpdateCustomerVisitRequest { VisitDate = day, Status = "Delivered" }, t, t);
        Assert.Equal("Delivered", delivered!.Status);

        // One row per route, customer and day, updated in place.
        db.ChangeTracker.Clear();
        var rows = await db.CustomerVisits.AsNoTracking().Where(v => v.RouteId == route.Id).ToListAsync();
        var row = Assert.Single(rows);
        Assert.Equal(VisitStatus.Delivered, row.Status);
        Assert.NotNull(row.ReachedAt);

        // With the stop-location flag on, a visit GPS fix is stored on the visit and never fills the empty shop pin.
        var located = new RouteService(db, new SalesSchemaService(db),
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["FeatureFlags:CustomerStopLocation"] = "true" }).Build(),
            NullLogger<RouteService>.Instance);
        var fixDay = day.AddDays(-1);
        var withFix = await located.UpdateCustomerVisitAsync(route.Id, customer.Id,
            new UpdateCustomerVisitRequest { VisitDate = fixDay, Status = "Arrived", Latitude = 25.2m, Longitude = 55.3m }, t, t, allowSavedPinUpdate: true);
        Assert.Equal(25.2m, withFix!.Latitude);
        db.ChangeTracker.Clear();
        var afterFix = await db.Customers.AsNoTracking().FirstAsync(c => c.Id == customer.Id);
        Assert.Null(afterFix.MainLatitude);
        Assert.Null(afterFix.MainLongitude);

        // A customer who is not on the route cannot get a visit.
        var stranger = new Customer { TenantId = t, OwnerId = t, Name = "Not on the route", CreatedAt = now, UpdatedAt = now };
        db.Customers.Add(stranger);
        await db.SaveChangesAsync();
        Assert.Null(await service.UpdateCustomerVisitAsync(route.Id, stranger.Id, new UpdateCustomerVisitRequest { VisitDate = day, Status = "Delivered" }, t, t));

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.UpdateCustomerVisitAsync(route.Id, customer.Id, new UpdateCustomerVisitRequest { VisitDate = day, Status = "Skipped" }, t, t));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.UpdateCustomerVisitAsync(route.Id, customer.Id, new UpdateCustomerVisitRequest { VisitDate = day, Status = "42" }, t, t));
    }
}
