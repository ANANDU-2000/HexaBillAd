using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.Text.Json;

// Local browser fixtures only. EnsureCreated intentionally does NOT certify the migration chain.
var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES")
    ?? throw new InvalidOperationException("Set a dedicated local HEXABILL_TEST_POSTGRES.");
var cs = new NpgsqlConnectionStringBuilder(connection);
if (cs.Host is not ("127.0.0.1" or "localhost" or "::1")
    || cs.Database?.StartsWith("hexabill_codex_browser_", StringComparison.Ordinal) != true
    || Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") != "Development")
    throw new InvalidOperationException("Refused: synthetic seed requires Development, loopback and a hexabill_codex_browser_ database.");
var password = Environment.GetEnvironmentVariable("HEXABILL_SYNTHETIC_PASSWORD");
if (string.IsNullOrWhiteSpace(password) || password.Length < 12)
    throw new InvalidOperationException("Supply a synthetic password at runtime; it is never logged or saved.");

await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection).Options);
db.SetRequestTenantScope(null, true);
await db.Database.EnsureCreatedAsync();
if (await db.Users.AnyAsync() || await db.Tenants.AnyAsync())
    throw new InvalidOperationException("Refused: fixtures require an empty dedicated database; no existing records are changed.");
var now = DateTime.UtcNow;
var hash = BCrypt.Net.BCrypt.HashPassword(password);
db.Users.Add(new User
{
    Name = "Synthetic platform admin", Email = "admin@hexabill.local", PasswordHash = hash,
    Role = UserRole.Owner, IsPlatformAdmin = true, CreatedAt = now
});
await db.SaveChangesAsync();

var report = new List<object>();
foreach (var slug in new[] { "gulfharvest-test", "frozenhub1-test", "frozenhub2-test", "zayogya-test" })
{
    var tenant = new Tenant { Name = $"Synthetic {slug}", Subdomain = slug, Status = TenantStatus.Active, FeaturesJson = "[]" };
    db.Tenants.Add(tenant);
    await db.SaveChangesAsync();
    var owner = new User
    {
        Name = $"Synthetic owner {slug}", Email = $"owner@{slug}.hexabill.local", PasswordHash = hash,
        Role = UserRole.Owner, TenantId = tenant.Id, OwnerId = tenant.Id, CreatedAt = now
    };
    db.Users.Add(owner);
    await db.SaveChangesAsync();
    var customer = new Customer
    {
        Name = $"ZZ-TEST {slug} equal receipts", TenantId = tenant.Id, OwnerId = tenant.Id,
        CreatedAt = now, UpdatedAt = now, Balance = 5, PendingBalance = 5,
        TotalSales = 105, TotalPayments = 100
    };
    var product = new Product
    {
        TenantId = tenant.Id, OwnerId = tenant.Id, NameEn = $"ZZ-TEST {slug} product",
        Sku = $"ZZ-TEST-{slug}", UnitType = "PCS", CostPrice = 20, SellPrice = 100,
        ConversionToBase = 1, StockQty = 100, CreatedAt = now, UpdatedAt = now
    };
    db.Customers.Add(customer);
    db.Products.Add(product);
    await db.SaveChangesAsync();
    var sale = new Sale
    {
        TenantId = tenant.Id, OwnerId = tenant.Id, CustomerId = customer.Id,
        InvoiceNo = $"ZZ-TEST-{slug}-001", InvoiceDate = now, Subtotal = 100,
        VatTotal = 5, GrandTotal = 105, TotalAmount = 105, PaidAmount = 100,
        PaymentStatus = SalePaymentStatus.Partial, CreatedBy = owner.Id,
        VatScenario = "Standard", CreatedAt = now,
        Items = new List<SaleItem>
        {
            new() { ProductId = product.Id, Qty = 1, UnitType = "PCS", UnitPrice = 100, LineTotal = 100, VatAmount = 5 }
        }
    };
    db.Sales.Add(sale);
    await db.SaveChangesAsync();
    var payments = Enumerable.Range(1, 2).Select(i => new Payment
    {
        TenantId = tenant.Id, OwnerId = tenant.Id, CustomerId = customer.Id, SaleId = sale.Id,
        Amount = 50, Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED,
        CreatedBy = owner.Id, PaymentDate = now.AddMinutes(i), CreatedAt = now.AddMinutes(i),
        Reference = $"ZZ-TEST-independent-receipt-{i}"
    }).ToList();
    db.Payments.AddRange(payments);
    foreach (var (key, value) in new Dictionary<string, string>
    {
        ["COMPANY_NAME_EN"] = $"Synthetic {slug}", ["COMPANY_TRN"] = "",
        ["CURRENCY"] = "AED", ["VAT_PERCENT"] = "5"
    })
        db.Settings.Add(new Setting { TenantId = tenant.Id, OwnerId = tenant.Id, Key = key, Value = value, UpdatedAt = now });
    await db.SaveChangesAsync();
    report.Add(new { slug, tenantId = tenant.Id, ownerId = owner.Id, customerId = customer.Id,
        saleId = sale.Id, productId = product.Id, paymentIds = payments.Select(p => p.Id).ToArray(), flags = "OFF" });
}
Console.WriteLine(JsonSerializer.Serialize(new { syntheticOnly = true, migrationProof = false,
    coverage = "Minimal money-safety browser fixtures; not the full release seed matrix", tenants = report }, new JsonSerializerOptions { WriteIndented = true }));
