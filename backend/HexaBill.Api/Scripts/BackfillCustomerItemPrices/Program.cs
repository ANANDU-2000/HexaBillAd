using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Npgsql;

// One-time backfill of CustomerItemPrices from latest SaleItems per customer+product.
// Usage (from repo root):
//   dotnet run --project backend/HexaBill.Api/Scripts/BackfillCustomerItemPrices -- --tenant 6 --dry-run
//   dotnet run --project backend/HexaBill.Api/Scripts/BackfillCustomerItemPrices -- --tenant 6 --execute

static Dictionary<string, string> LoadEnv(string path)
{
    var env = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    if (!File.Exists(path)) return env;
    foreach (var line in File.ReadAllLines(path))
    {
        var s = line.Trim();
        if (s.Length == 0 || s.StartsWith('#')) continue;
        var i = s.IndexOf('=');
        if (i <= 0) continue;
        var v = s[(i + 1)..].Trim();
        if (v.Length >= 2 && ((v.StartsWith('"') && v.EndsWith('"')) || (v.StartsWith("'") && v.EndsWith("'"))))
            v = v[1..^1];
        env[s[..i].Trim()] = v;
    }
    return env;
}

static string ConvertUrl(string url)
{
    var normalized = url.Replace("postgres://", "postgresql://", StringComparison.OrdinalIgnoreCase);
    var uri = new Uri(normalized);
    var userInfo = uri.UserInfo.Split(':', 2);
    var host = uri.Host;
    if (host.Contains("dpg-", StringComparison.OrdinalIgnoreCase)
        && !host.Contains("singapore-postgres.render.com", StringComparison.OrdinalIgnoreCase)
        && host.EndsWith("-a", StringComparison.Ordinal))
        host = host + ".singapore-postgres.render.com";
    return new NpgsqlConnectionStringBuilder
    {
        Host = host,
        Port = uri.Port > 0 ? uri.Port : 5432,
        Database = uri.AbsolutePath.Trim('/'),
        Username = Uri.UnescapeDataString(userInfo[0]),
        Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "",
        SslMode = SslMode.Require,
        TrustServerCertificate = true
    }.ConnectionString;
}

static string BuildConn(Dictionary<string, string> env)
{
    if (env.TryGetValue("DATABASE_URL_EXTERNAL", out var ext) && !string.IsNullOrWhiteSpace(ext))
        return ConvertUrl(ext);
    if (env.TryGetValue("DATABASE_URL", out var url) && !string.IsNullOrWhiteSpace(url))
        return ConvertUrl(url);
    throw new InvalidOperationException("No DATABASE_URL in .env");
}

var cwd = Directory.GetCurrentDirectory();
var apiDir = Path.Combine(cwd, "backend", "HexaBill.Api");
var envPath = Path.Combine(apiDir, ".env");
if (!File.Exists(envPath)) envPath = Path.Combine(cwd, ".env");
if (!File.Exists(envPath))
{
    Console.Error.WriteLine("Missing .env");
    return 1;
}

var argsList = args.ToList();
int GetInt(string name, int def = 0)
{
    var idx = argsList.FindIndex(a => string.Equals(a, name, StringComparison.OrdinalIgnoreCase));
    if (idx < 0 || idx + 1 >= argsList.Count) return def;
    return int.TryParse(argsList[idx + 1], out var v) ? v : def;
}

var tenantId = GetInt("--tenant", 6);
var execute = argsList.Any(a => string.Equals(a, "--execute", StringComparison.OrdinalIgnoreCase));
var dryRun = !execute;

var conn = BuildConn(LoadEnv(envPath));
var services = new ServiceCollection();
services.AddLogging(b => b.AddConsole().SetMinimumLevel(LogLevel.Information));
services.AddDbContext<AppDbContext>(o => o.UseNpgsql(conn));
await using var sp = services.BuildServiceProvider();
var db = sp.GetRequiredService<AppDbContext>();

// Latest non-deleted sale line per (CustomerId, ProductId)
var latest = await (
    from si in db.SaleItems.AsNoTracking()
    join s in db.Sales.AsNoTracking() on si.SaleId equals s.Id
    where s.TenantId == tenantId && !s.IsDeleted && s.CustomerId != null && si.UnitPrice >= 0
    group new { si, s } by new { CustomerId = s.CustomerId!.Value, si.ProductId } into g
    select new
    {
        g.Key.CustomerId,
        g.Key.ProductId,
        LastSaleDate = g.Max(x => x.s.InvoiceDate)
    }
).ToListAsync();

Console.WriteLine($"Tenant={tenantId} distinct customer+product pairs with sale history: {latest.Count} DryRun={dryRun}");

if (dryRun)
{
    Console.WriteLine("Dry-run only — no writes. Re-run with --execute to upsert.");
    return 0;
}

var now = DateTime.UtcNow;
var upserted = 0;
foreach (var row in latest)
{
    var line = await (
        from si in db.SaleItems
        join s in db.Sales on si.SaleId equals s.Id
        where s.TenantId == tenantId && !s.IsDeleted
              && s.CustomerId == row.CustomerId && si.ProductId == row.ProductId
              && s.InvoiceDate == row.LastSaleDate
        orderby s.Id descending, si.Id descending
        select new { si.UnitPrice, SaleId = s.Id, s.InvoiceDate }
    ).FirstOrDefaultAsync();
    if (line == null) continue;

    var existing = await db.CustomerItemPrices
        .FirstOrDefaultAsync(p => p.TenantId == tenantId && p.CustomerId == row.CustomerId && p.ProductId == row.ProductId);
    if (existing != null)
    {
        existing.LastUnitPrice = line.UnitPrice;
        existing.LastSaleId = line.SaleId;
        existing.LastSaleDate = line.InvoiceDate;
        existing.UpdatedAt = now;
    }
    else
    {
        db.CustomerItemPrices.Add(new HexaBill.Api.Models.CustomerItemPrice
        {
            TenantId = tenantId,
            CustomerId = row.CustomerId,
            ProductId = row.ProductId,
            LastUnitPrice = line.UnitPrice,
            LastSaleId = line.SaleId,
            LastSaleDate = line.InvoiceDate,
            UpdatedAt = now
        });
    }
    upserted++;
    if (upserted % 200 == 0)
        await db.SaveChangesAsync();
}
await db.SaveChangesAsync();
Console.WriteLine($"Upserted {upserted} CustomerItemPrice row(s).");
return 0;
