using System;
using System.IO;
using Npgsql;

// Never hardcode production credentials. Use DATABASE_URL or HEXABILL_DB.
var connStr = Environment.GetEnvironmentVariable("DATABASE_URL")
    ?? Environment.GetEnvironmentVariable("HEXABILL_DB")
    ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");

if (string.IsNullOrWhiteSpace(connStr))
{
    Console.Error.WriteLine("ERROR: Set DATABASE_URL (or HEXABILL_DB) before running this script.");
    return 1;
}

if (connStr.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
    || connStr.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
{
    var uri = new Uri(connStr);
    var userInfo = uri.UserInfo.Split(':', 2);
    var username = Uri.UnescapeDataString(userInfo[0]);
    var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
    var dbPort = uri.Port > 0 ? uri.Port : 5432;
    connStr = $"Host={uri.Host};Port={dbPort};Database={uri.AbsolutePath.TrimStart('/')};Username={username};Password={password};SSL Mode=Require";
}

var baseDir = AppContext.BaseDirectory;
var sqlPath = Path.Combine(baseDir, "..", "..", "HexaBill.Api", "Scripts", "CREATE_ZAYOGA_TENANT.sql");
if (!File.Exists(sqlPath))
{
    sqlPath = Path.Combine(Directory.GetCurrentDirectory(), "..", "HexaBill.Api", "Scripts", "CREATE_ZAYOGA_TENANT.sql");
}
if (!File.Exists(sqlPath))
{
    Console.WriteLine("ERROR: CREATE_ZAYOGA_TENANT.sql not found");
    return 1;
}

var sql = File.ReadAllText(sqlPath);

await using var conn = new NpgsqlConnection(connStr);
await conn.OpenAsync();

await using var cmd = new NpgsqlCommand(sql, conn);
conn.Notification += (_, e) => Console.WriteLine(e.Payload);
await cmd.ExecuteNonQueryAsync();

{
    await using var q1 = new NpgsqlCommand(@"SELECT ""Id"", ""Name"", ""Email"", ""VatNumber"" FROM ""Tenants"" WHERE ""Email"" = 'info@zayoga.ae'", conn);
    await using var r1 = await q1.ExecuteReaderAsync();
    if (await r1.ReadAsync())
    {
        Console.WriteLine("\n=== ZAYOGA TENANT CREATED ===");
        Console.WriteLine($"Tenant Id: {r1.GetInt32(0)}");
        Console.WriteLine($"Name: {r1.GetString(1)}");
        Console.WriteLine($"Email: {r1.GetString(2)}");
        Console.WriteLine($"TRN: {r1.GetString(3)}");
    }
}
{
    await using var q2 = new NpgsqlCommand(@"SELECT ""Id"", ""Name"", ""Email"", ""TenantId"" FROM ""Users"" WHERE ""Email"" = 'info@zayoga.ae' ORDER BY ""Id"" DESC LIMIT 1", conn);
    await using var r2 = await q2.ExecuteReaderAsync();
    if (await r2.ReadAsync())
    {
        Console.WriteLine($"\nOwner User Id: {r2.GetInt32(0)}");
        Console.WriteLine($"TenantId: {r2.GetInt32(3)}");
    }
}

Console.WriteLine("\nOwner credentials are defined in CREATE_ZAYOGA_TENANT.sql. Do not print passwords. Client must change password on first login.");
return 0;
