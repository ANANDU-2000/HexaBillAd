using System;
using System.IO;
using Npgsql;

var connStr = "Host=dpg-d68jhpk9c44c73ft047g-a.singapore-postgres.render.com;Port=5432;Database=hexabill;Username=hexabill_user;Password=KGYtLyUd2AwcKSiC1LW6VsTGn6PIJnxQ;SSL Mode=Require";

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

// Get created tenant and user
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

Console.WriteLine("\n--- LOGIN CREDENTIALS (share with client via WhatsApp/email) ---");
Console.WriteLine("Email: info@zayoga.ae");
Console.WriteLine("Password: Zayoga@2026");
Console.WriteLine("CLIENT MUST CHANGE PASSWORD ON FIRST LOGIN");
return 0;
