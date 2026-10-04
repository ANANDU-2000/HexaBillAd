using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HexaBill.Tests;

public class TenantCompanySettingsTests
{
    private static AppDbContext Database()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.SetRequestTenantScope(null, true);
        return db;
    }

    private static SettingsService Service(AppDbContext db) => new(db, new HttpContextAccessor {
        HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(
            new[] { new Claim(ClaimTypes.NameIdentifier, "7") }, "test")) }
    });

    [Theory]
    [InlineData("123")]
    [InlineData("1234567890123456")]
    [InlineData("١٢٣٤٥٦٧٨٩٠١٢٣٤٥")]
    [InlineData("12345678901234A")]
    public async Task InvalidVatRejectsEntireUpdateBeforeWrites(string trn)
    {
        await using var db = Database();
        await Assert.ThrowsAsync<ArgumentException>(() => Service(db).UpdateOwnerSettingsBulkAsync(10,
            new() { ["COMPANY_NAME_EN"] = "Must not save", ["vat_trn"] = trn }));
        Assert.Empty(db.Settings);
        Assert.Empty(db.AuditLogs);
    }

    [Fact]
    public async Task SharedVatAllowed_ChangesAndVersionsRemainTenantSpecific_WithAudit()
    {
        await using var db = Database();
        var service = Service(db);
        foreach (var tenant in new[] { 10, 20 })
            await service.UpdateOwnerSettingsBulkAsync(tenant, new() {
                ["vat_trn"] = "123456789012345", ["COMPANY_NAME_EN"] = "Shared legal name",
                ["corporate_tax_trn"] = "CORPORATE-ONLY"
            });
        var before = await service.GetCompanySettingsAsync(20);
        await service.UpdateOwnerSettingAsync(10, "vat_trn", "543210987654321");
        var a = await service.GetCompanySettingsAsync(10);
        var b = await service.GetCompanySettingsAsync(20);
        Assert.Equal("543210987654321", a.VatNumber);
        Assert.Equal("123456789012345", b.VatNumber);
        Assert.Equal("CORPORATE-ONLY", a.CorporateTaxTrn);
        Assert.Equal(before.SettingsVersion, b.SettingsVersion);
        Assert.NotEqual(a.SettingsVersion, b.SettingsVersion);
        var audit = db.AuditLogs.OrderBy(x => x.Id).Last();
        Assert.Equal(10, audit.TenantId);
        Assert.Equal(7, audit.UserId);
        Assert.Contains("123456789012345", audit.OldValues!);
        Assert.Contains("543210987654321", audit.NewValues!);
    }

    [Fact]
    public async Task EmptyVatNeverFallsBackToCorporateTaxOrAnotherTenant()
    {
        await using var db = Database();
        var service = Service(db);
        await service.UpdateOwnerSettingsBulkAsync(10, new() {
            ["vat_trn"] = "", ["corporate_tax_trn"] = "123456789012345"
        });
        var settings = await service.GetCompanySettingsAsync(10);
        Assert.Equal("", settings.VatNumber);
        Assert.Equal("", settings.LegalNameEn);
        Assert.Equal("", settings.Mobile);
        Assert.Equal("", settings.LegalNameAr);
        Assert.Equal("", new CompanySettings().VatNumber);
    }

    [Fact]
    public async Task ConflictingLegacyOwnerCannotExposeForeignSetting_EvenWhenTracked()
    {
        await using var db = Database();
        db.Settings.Add(new Setting { Key = "COMPANY_TRN", OwnerId = 10, TenantId = 20, Value = "123456789012345" });
        await db.SaveChangesAsync();
        db.SetRequestTenantScope(10, false);
        var service = Service(db);
        Assert.Equal("", (await service.GetCompanySettingsAsync(10)).VatNumber);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.GetCompanySettingsAsync(20));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.UpdateOwnerSettingAsync(20, "vat_trn", ""));
    }

    [Fact]
    public async Task ConflictingAliasesRejected_SecretsRedactedInAudit()
    {
        await using var db = Database();
        var service = Service(db);
        await Assert.ThrowsAsync<ArgumentException>(() => service.UpdateOwnerSettingsBulkAsync(10,
            new() { ["vat_trn"] = "123456789012345", ["COMPANY_TRN"] = "543210987654321" }));
        await service.UpdateOwnerSettingAsync(10, "CLOUD_BACKUP_CLIENT_SECRET", "private-test-value");
        Assert.DoesNotContain("private-test-value", db.AuditLogs.Single().NewValues!);
        Assert.Contains("redacted", db.AuditLogs.Single().NewValues!);
    }

    [Theory]
    [InlineData("LOGO_STORAGE_KEY", "tenants/20/logos/private.png")]
    [InlineData("LOGO_STORAGE_KEY", "tenants/10/logos/../../20/logos/private.png")]
    [InlineData("LOGO_STORAGE_KEY", "tenants/10/logos/..\\..\\20\\logos\\private.png")]
    [InlineData("STAMP_STORAGE_KEY", "tenants/20/stamps/private.png")]
    [InlineData("SIGNATURE_STORAGE_KEY", "tenants/20/signatures/private.png")]
    public async Task ForeignOrTraversalImageKey_CannotBeResolvedForDocuments(string key, string value)
    {
        await using var db = Database();
        db.Settings.Add(new Setting { TenantId = 10, OwnerId = 10, Key = key, Value = value });
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service(db).GetCompanySettingsAsync(10));
    }
}
