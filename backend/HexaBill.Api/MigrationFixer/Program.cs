// Run production migration (Expenses/ExpenseCategories/InvoiceTemplates TenantId).
// Usage: set DATABASE_URL=postgresql://user:pass@host/db then: dotnet run
using Npgsql;

var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
if (string.IsNullOrWhiteSpace(databaseUrl))
{
    Console.WriteLine("ERROR: Set DATABASE_URL environment variable (e.g. postgresql://user:pass@host/db)");
    Environment.Exit(1);
}

var connectionString = "";
try
{
    var cleanUrl = databaseUrl.Trim().TrimEnd('?');
    var uri = new Uri(cleanUrl);
    var dbPort = uri.Port > 0 ? uri.Port : 5432;
    var userInfo = uri.UserInfo ?? "";
    var firstColon = userInfo.IndexOf(':');
    var username = firstColon >= 0 ? userInfo.Substring(0, firstColon) : userInfo;
    var password = firstColon >= 0 ? userInfo.Substring(firstColon + 1) : "";
    connectionString = $"Host={uri.Host};Port={dbPort};Database={uri.AbsolutePath.TrimStart('/')};Username={username};Password={password};SSL Mode=Require;Trust Server Certificate=true";
}
catch (Exception ex)
{
    Console.WriteLine("ERROR: Invalid DATABASE_URL: " + ex.Message);
    Environment.Exit(1);
}

var scriptPath = Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Scripts", "RUN_ON_RENDER_PSQL.sql");
if (!File.Exists(scriptPath))
    scriptPath = Path.Combine(Directory.GetCurrentDirectory(), "Scripts", "RUN_ON_RENDER_PSQL.sql");
if (!File.Exists(scriptPath))
    scriptPath = Path.Combine(Directory.GetCurrentDirectory(), "..", "Scripts", "RUN_ON_RENDER_PSQL.sql");
if (!File.Exists(scriptPath))
{
    Console.WriteLine("ERROR: RUN_ON_RENDER_PSQL.sql not found. Run from backend/HexaBill.Api or backend/HexaBill.Api/MigrationFixer");
    Environment.Exit(1);
}

var sql = await File.ReadAllTextAsync(scriptPath);
// Remove single-line comments and empty lines for cleaner execution
var lines = sql.Split('\n').Where(l => !l.TrimStart().StartsWith("--")).ToArray();
var sqlClean = string.Join("\n", lines);

Console.WriteLine("Connecting to database...");
await using var conn = new NpgsqlConnection(connectionString);
await conn.OpenAsync();
Console.WriteLine("Running migration (6b, 7, 8)...");
await using (var cmd = new NpgsqlCommand(sqlClean, conn))
{
    cmd.CommandTimeout = 60;
    await cmd.ExecuteNonQueryAsync();
}
Console.WriteLine("Done. Restart your HexaBill API on Render.");
