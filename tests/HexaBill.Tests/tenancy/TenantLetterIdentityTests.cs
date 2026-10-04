using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Documents;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Tests;

public class TenantLetterIdentityTests
{
    [Fact]
    public async Task LicenseField_NeverFallsBackToVatTrn()
    {
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.SetRequestTenantScope(null, true);
        db.Tenants.Add(new Tenant { Id = 10, Name = "Fixture", Subdomain = "fixture", VatNumber = "123456789012345" });
        db.Settings.Add(new Setting { TenantId = 10, OwnerId = 10, Key = "COMPANY_TRN", Value = "123456789012345" });
        db.Settings.Add(new Setting { TenantId = 10, OwnerId = 10, Key = "COMPANY_NAME_EN", Value = "Fixture Trading" });
        await db.SaveChangesAsync();

        var identity = await TenantLetterIdentityLoader.LoadAsync(db, 10);
        Assert.Equal("", identity.License);
        Assert.Equal("Fixture Trading", identity.CompanyName);
    }

    [Fact]
    public async Task LicenseField_UsesCompanyLicenseOnly()
    {
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.SetRequestTenantScope(null, true);
        db.Tenants.Add(new Tenant { Id = 11, Name = "Fixture", Subdomain = "fixture2" });
        db.Settings.Add(new Setting { TenantId = 11, OwnerId = 11, Key = "COMPANY_LICENSE", Value = "CN-0000001" });
        db.Settings.Add(new Setting { TenantId = 11, OwnerId = 11, Key = "COMPANY_TRN", Value = "123456789012345" });
        await db.SaveChangesAsync();

        var identity = await TenantLetterIdentityLoader.LoadAsync(db, 11);
        Assert.Equal("CN-0000001", identity.License);
    }
}
