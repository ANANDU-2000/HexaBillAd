using Npgsql;

// Run from repo root: dotnet run --project backend\HexaBill.Api\Scripts\RunSql
var cwd = Directory.GetCurrentDirectory();
var apiDir = Path.Combine(cwd, "backend", "HexaBill.Api");
var envPath = Path.Combine(apiDir, ".env");
var sqlPath = Path.Combine(apiDir, "Scripts", "Ensure_SupplierLedgerCredits.sql");
if (!File.Exists(envPath) && File.Exists(Path.Combine(cwd, ".env")))
{
    apiDir = cwd;
    envPath = Path.Combine(cwd, ".env");
    sqlPath = Path.Combine(cwd, "backend", "HexaBill.Api", "Scripts", "Ensure_SupplierLedgerCredits.sql");
}

if (!File.Exists(envPath))
{
    Console.Error.WriteLine("Not found: " + envPath);
    return 1;
}
if (!File.Exists(sqlPath))
{
    Console.Error.WriteLine("Not found: " + sqlPath);
    return 1;
}

var env = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
foreach (var line in File.ReadAllLines(envPath))
{
    var s = line.Trim();
    if (s.Length == 0 || s.StartsWith('#')) continue;
    var i = s.IndexOf('=');
    if (i > 0)
    {
        var v = s[(i + 1)..].Trim();
        if (v.Length >= 2 && ((v.StartsWith('"') && v.EndsWith('"')) || (v.StartsWith("'") && v.EndsWith("'"))))
            v = v[1..^1];
        env[s[..i].Trim()] = v;
    }
}

string connStr;
var host = env.GetValueOrDefault("DB_HOST_EXTERNAL") ?? env.GetValueOrDefault("DB_HOST_INTERNAL");
var port = env.GetValueOrDefault("DB_PORT") ?? "5432";
var db = env.GetValueOrDefault("DB_NAME");
var user = env.GetValueOrDefault("DB_USER");
var pass = env.GetValueOrDefault("DB_PASSWORD");
if (!string.IsNullOrEmpty(host) && !string.IsNullOrEmpty(db) && !string.IsNullOrEmpty(user) && !string.IsNullOrEmpty(pass))
{
    var sb = new NpgsqlConnectionStringBuilder { Host = host, Port = int.Parse(port), Database = db, Username = user, Password = pass };
    connStr = sb.ConnectionString;
}
else
{
    connStr = env.GetValueOrDefault("DATABASE_URL_EXTERNAL") ?? env.GetValueOrDefault("DATABASE_URL") ?? "";
    if (string.IsNullOrWhiteSpace(connStr))
    {
        Console.Error.WriteLine("Missing DB_HOST_EXTERNAL, DB_NAME, DB_USER, DB_PASSWORD or DATABASE_URL in .env");
        return 1;
    }
    if (connStr.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase) || connStr.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase))
    {
        try
        {
            var uri = new Uri(connStr);
            var seg = uri.AbsolutePath.TrimStart('/');
            var builder = new NpgsqlConnectionStringBuilder
            {
                Host = uri.Host,
                Port = uri.Port > 0 ? uri.Port : 5432,
                Database = string.IsNullOrEmpty(seg) ? "postgres" : seg,
                Username = uri.UserInfo?.Split(':')[0],
                Password = uri.UserInfo?.Contains(':') == true ? string.Join(":", uri.UserInfo.Split(':').Skip(1)) : null
            };
            connStr = builder.ConnectionString;
        }
        catch
        {
            Console.Error.WriteLine("Could not parse DATABASE_URL as URI. Use DB_HOST_EXTERNAL, DB_NAME, DB_USER, DB_PASSWORD in .env instead.");
            return 1;
        }
    }
}

var sql = File.ReadAllText(sqlPath);
var statements = sql
    .Split('\n')
    .Where(l => !l.TrimStart().StartsWith("--"))
    .Aggregate("", (a, b) => a + "\n" + b)
    .Split(';', StringSplitOptions.RemoveEmptyEntries)
    .Select(s => s.Trim())
    .Where(s => s.Length > 0)
    .ToList();

try
{
    await using var conn = new NpgsqlConnection(connStr);
    await conn.OpenAsync();
    foreach (var stmt in statements)
    {
        if (stmt.StartsWith("SELECT", StringComparison.OrdinalIgnoreCase))
        {
            await using var cmd = new NpgsqlCommand(stmt + ";", conn);
            await using var r = await cmd.ExecuteReaderAsync();
            if (await r.ReadAsync())
                Console.WriteLine(r.GetString(0));
        }
        else
        {
            await using var cmd = new NpgsqlCommand(stmt + ";", conn);
            await cmd.ExecuteNonQueryAsync();
        }
    }
    Console.WriteLine("Done. SupplierLedgerCredits table ensured.");
    return 0;
}
catch (Exception ex)
{
    Console.Error.WriteLine(ex.Message);
    return 1;
}
