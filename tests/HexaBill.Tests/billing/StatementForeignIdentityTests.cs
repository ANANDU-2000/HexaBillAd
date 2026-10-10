using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Customers;
using Microsoft.EntityFrameworkCore;
using UglyToad.PdfPig;

namespace HexaBill.Tests;

/// <summary>Printed documents must never fall back to another business's identity.</summary>
// Serialized: these tests read or set process-wide environment (DATA_PATH, ASPNETCORE_ENVIRONMENT) used by PDF/TRN code.
[Collection("HttpIntegration")]
public sealed class StatementForeignIdentityTests
{
    private const int Tenant = 70001;

    [Fact]
    public async Task CustomerStatement_TenantWithoutAddress_DoesNotPrintForeignAddress()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        await using var _ = db;
        db.SetRequestTenantScope(null, isPlatformScope: true);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        db.Tenants.Add(new Tenant { Id = Tenant, Name = "Synthetic FrozenHub2", Subdomain = "fh2-synthetic", Country = "AE", Currency = "AED" });
        db.Settings.Add(new Setting { Key = "COMPANY_NAME_EN", TenantId = Tenant, OwnerId = Tenant, Value = "Synthetic FrozenHub2 LLC" });
        db.Customers.Add(new Customer { Id = 1, TenantId = Tenant, OwnerId = Tenant, Name = "Walk-in Synthetic" });
        await db.SaveChangesAsync();

        var pdf = await new CustomerService(db).GenerateCustomerStatementAsync(1, new DateTime(2025, 1, 1), new DateTime(2025, 3, 31), Tenant);

        using var doc = PdfDocument.Open(pdf);
        var text = string.Join("\n", doc.GetPages().Select(p => p.Text));
        Assert.Contains("Synthetic FrozenHub2 LLC", text);
        Assert.DoesNotContain("Mussafah", text);
    }
}
