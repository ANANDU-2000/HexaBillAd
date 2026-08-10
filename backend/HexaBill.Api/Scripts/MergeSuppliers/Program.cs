using HexaBill.Api.Data;
using HexaBill.Api.Modules.Purchases;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Npgsql;

// Usage (from repo root):
//   dotnet run --project backend/HexaBill.Api/Scripts/MergeSuppliers -- --tenant 6 --survivor 7 --losers 1,5 --dry-run --expected-net 89863.17
//   dotnet run --project backend/HexaBill.Api/Scripts/MergeSuppliers -- --tenant 6 --survivor 7 --losers 1,5 --execute --confirm MERGE --expected-net 89863.17

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
    // Local/MigrationFixer pattern: rewrite internal Render host to external
    if (host.Contains("dpg-", StringComparison.OrdinalIgnoreCase)
        && !host.Contains("singapore-postgres.render.com", StringComparison.OrdinalIgnoreCase)
        && host.EndsWith("-a", StringComparison.Ordinal))
    {
        host = host + ".singapore-postgres.render.com";
    }
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
    var host = env.GetValueOrDefault("DB_HOST_EXTERNAL") ?? env.GetValueOrDefault("DB_HOST_INTERNAL");
    var port = env.GetValueOrDefault("DB_PORT") ?? "5432";
    var db = env.GetValueOrDefault("DB_NAME");
    var user = env.GetValueOrDefault("DB_USER");
    var pass = env.GetValueOrDefault("DB_PASSWORD");
    if (string.IsNullOrEmpty(host) || string.IsNullOrEmpty(db) || string.IsNullOrEmpty(user) || string.IsNullOrEmpty(pass))
        throw new InvalidOperationException("No database connection in .env");
    if (host.Contains("dpg-", StringComparison.OrdinalIgnoreCase)
        && !host.Contains("singapore-postgres.render.com", StringComparison.OrdinalIgnoreCase)
        && !host.Contains(".", StringComparison.Ordinal))
        host = host + ".singapore-postgres.render.com";
    return new NpgsqlConnectionStringBuilder
    {
        Host = host,
        Port = int.Parse(port),
        Database = db,
        Username = user,
        Password = pass,
        SslMode = SslMode.Require,
        TrustServerCertificate = true
    }.ConnectionString;
}

var cwd = Directory.GetCurrentDirectory();
var apiDir = Path.Combine(cwd, "backend", "HexaBill.Api");
var envPath = Path.Combine(apiDir, ".env");
if (!File.Exists(envPath)) envPath = Path.Combine(cwd, ".env");
if (!File.Exists(envPath))
{
    Console.Error.WriteLine("Missing .env at " + envPath);
    return 1;
}

var argsList = args.ToList();
int GetInt(string name, int def = 0)
{
    var idx = argsList.FindIndex(a => string.Equals(a, name, StringComparison.OrdinalIgnoreCase));
    if (idx < 0 || idx + 1 >= argsList.Count) return def;
    return int.TryParse(argsList[idx + 1], out var v) ? v : def;
}
string GetStr(string name, string def = "")
{
    var idx = argsList.FindIndex(a => string.Equals(a, name, StringComparison.OrdinalIgnoreCase));
    if (idx < 0 || idx + 1 >= argsList.Count) return def;
    return argsList[idx + 1];
}

var tenantId = GetInt("--tenant", 6);
var survivorId = GetInt("--survivor");
var losersRaw = GetStr("--losers");
var execute = argsList.Any(a => string.Equals(a, "--execute", StringComparison.OrdinalIgnoreCase));
var dryRun = !execute;
var confirm = GetStr("--confirm");
decimal? expectedNet = null;
var expectedRaw = GetStr("--expected-net");
if (!string.IsNullOrWhiteSpace(expectedRaw) && decimal.TryParse(expectedRaw, System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var en))
    expectedNet = en;

if (survivorId <= 0 || string.IsNullOrWhiteSpace(losersRaw))
{
    Console.Error.WriteLine("Required: --survivor <id> --losers <id,id> [--dry-run|--execute] [--tenant 6] [--expected-net 89863.17] [--confirm MERGE]");
    return 1;
}

if (execute && !string.Equals(confirm, SupplierMergeService.ConfirmTokenValue, StringComparison.Ordinal))
{
    Console.Error.WriteLine("Execute requires --confirm MERGE");
    return 1;
}

var loserIds = losersRaw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .Select(int.Parse).ToList();

var env = LoadEnv(envPath);
var conn = BuildConn(env);

if (execute)
    Environment.SetEnvironmentVariable("FEATURE_FLAGS__SUPPLIER_MERGE", "true");

var services = new ServiceCollection();
services.AddLogging(b => b.AddConsole().SetMinimumLevel(LogLevel.Information));
var configDict = new Dictionary<string, string?>
{
    ["ConnectionStrings:DefaultConnection"] = conn,
    ["FeatureFlags:SupplierMerge"] = execute ? "true" : "false"
};
var config = new ConfigurationBuilder().AddInMemoryCollection(configDict!).Build();
services.AddSingleton<IConfiguration>(config);
services.AddDbContext<AppDbContext>(o => o.UseNpgsql(conn));
services.AddScoped<ISupplierService, SupplierService>();
services.AddScoped<ISupplierMergeService, SupplierMergeService>();

await using var sp = services.BuildServiceProvider();
var db = sp.GetRequiredService<AppDbContext>();
var actingUserId = await db.Users.AsNoTracking()
    .Where(u => u.TenantId == tenantId)
    .OrderBy(u => u.Id)
    .Select(u => u.Id)
    .FirstOrDefaultAsync();
var merge = sp.GetRequiredService<ISupplierMergeService>();
Console.WriteLine($"Tenant={tenantId} Survivor={survivorId} Losers=[{string.Join(",", loserIds)}] DryRun={dryRun} ExpectedNet={expectedNet} ActingUser={actingUserId}");
var result = await merge.MergeAsync(tenantId, survivorId, loserIds, dryRun, actingUserId, expectedNet);
Console.WriteLine(result.Message);
Console.WriteLine($"Success={result.Success} Predicted={result.PredictedSurvivorBalance} After={result.SurvivorBalanceAfter}");
foreach (var kv in result.VariantBalancesBefore)
    Console.WriteLine($"  Before[{kv.Key}] = {kv.Value:F2}");
foreach (var kv in result.RowsMoved)
    Console.WriteLine($"  {kv.Key}: {kv.Value}");
foreach (var w in result.Warnings) Console.WriteLine("WARN: " + w);
foreach (var e in result.Errors) Console.Error.WriteLine("ERR: " + e);
return result.Success ? 0 : 2;
