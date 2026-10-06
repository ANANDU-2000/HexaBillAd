using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.Text.Json;
using HexaBill.Api.Modules.SuperAdmin;

// Local browser fixtures only. EnsureCreated intentionally does NOT certify the migration chain.
var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES")
    ?? throw new InvalidOperationException("Set a dedicated local HEXABILL_TEST_POSTGRES.");
var cs = new NpgsqlConnectionStringBuilder(connection);
var receiptFixtureMode = args.Contains("--receipt-snapshot-fixtures", StringComparer.Ordinal);
if (receiptFixtureMode && (cs.Database?.StartsWith("hexabill_codex_browser_receipts_", StringComparison.Ordinal) != true
    || args.Contains("--rotate-password", StringComparer.Ordinal)))
    throw new InvalidOperationException("Refused: receipt snapshot fixtures require a new dedicated receipt-test database, without rotation.");
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
if (args.Contains("--rotate-password", StringComparer.Ordinal))
{
    var expectedSlugs = new[] { "gulfharvest-test", "frozenhub1-test", "frozenhub2-test", "zayogya-test" };
    var tenants = await db.Tenants.ToListAsync();
    var users = await db.Users.ToListAsync();
    var expectedEmails = expectedSlugs.Select(s => $"owner@{s}.hexabill.local").Append("admin@hexabill.local").ToHashSet();
    if (tenants.Count != 4 || tenants.Any(t => !expectedSlugs.Contains(t.Subdomain) || t.FeaturesJson != "[]")
        || users.Count != 5 || users.Any(u => !expectedEmails.Contains(u.Email) || !u.Name.StartsWith("Synthetic ", StringComparison.Ordinal)))
        throw new InvalidOperationException("Refused: password rotation is limited to the untouched synthetic fixture accounts.");
    var rotatedHash = BCrypt.Net.BCrypt.HashPassword(password);
    foreach (var user in users) user.PasswordHash = rotatedHash;
    await db.SaveChangesAsync();
    Console.WriteLine("Synthetic runtime credential rotated; financial records unchanged.");
    return;
}
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
    var receiptSnapshotTenant = receiptFixtureMode && slug == "gulfharvest-test";
    var tenant = new Tenant { Name = $"Synthetic {slug}", Subdomain = slug, Status = TenantStatus.Active,
        FeaturesJson = receiptSnapshotTenant ? JsonSerializer.Serialize(new[] { TenantFeatureFlags.ReceiptSnapshots }) : "[]" };
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
        Name = receiptSnapshotTenant
            ? "ZZ-TEST receipt customer - عميل تجريبي - പരീക്ഷണ ഉപഭോക്താവ് - " + new string('L', 80)
            : $"ZZ-TEST {slug} equal receipts", TenantId = tenant.Id, OwnerId = tenant.Id,
        CreatedAt = now, UpdatedAt = now, Balance = 105, PendingBalance = 105,
        TotalSales = 205, TotalPayments = 100
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
    var unpaidInvoices = new List<Sale>();
    foreach (var (suffix, total) in new[] { ("002", 40m), ("003", 60m) })
    {
        var vat = Math.Round(total * 5m / 105m, 2, MidpointRounding.AwayFromZero);
        var unpaid = new Sale
        {
            TenantId = tenant.Id, OwnerId = tenant.Id, CustomerId = customer.Id,
            InvoiceNo = $"ZZ-TEST-{slug}-{suffix}", InvoiceDate = now, Subtotal = total - vat,
            VatTotal = vat, GrandTotal = total, TotalAmount = total, PaidAmount = 0,
            PaymentStatus = SalePaymentStatus.Pending, CreatedBy = owner.Id,
            VatScenario = "Standard", CreatedAt = now,
            Items = new List<SaleItem>
            {
                new() { ProductId = product.Id, Qty = 1, UnitType = "PCS", UnitPrice = total - vat, LineTotal = total - vat, VatAmount = vat }
            }
        };
        db.Sales.Add(unpaid);
        unpaidInvoices.Add(unpaid);
    }
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
        saleId = sale.Id, unpaidSaleIds = unpaidInvoices.Select(s => s.Id).ToArray(), productId = product.Id,
        paymentIds = payments.Select(p => p.Id).ToArray(), flags = receiptSnapshotTenant ? "receipt_snapshots (synthetic opt-in)" : "OFF" });
}
Console.WriteLine(JsonSerializer.Serialize(new { syntheticOnly = true, migrationProof = false,
    coverage = "Minimal money-safety browser fixtures; not the full release seed matrix", tenants = report }, new JsonSerializerOptions { WriteIndented = true }));
