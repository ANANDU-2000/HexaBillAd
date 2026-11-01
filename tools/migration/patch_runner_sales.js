const fs = require('fs');
const file = 'tools/StarplusMigrationRunner/Program.cs';
let content = fs.readFileSync(file, 'utf8');

const target = 'else if (mode == "sync-mappings")';
const addition = `else if (mode == "inspect-all-sales")
                {
                    Console.WriteLine("[INSPECT ALL SALES] All Sales in public.Sales for Tenant 20 (including deleted):");
                    await using var cmd = new NpgsqlCommand(@"
                        SELECT ""Id"", ""InvoiceNo"", ""InvoiceDate"", ""CreatedAt"", ""CustomerId"", ""GrandTotal"", ""IsDeleted"", ""ExternalReference""
                        FROM ""public"".""Sales""
                        WHERE ""TenantId"" = 20
                        ORDER BY ""InvoiceDate"" ASC, ""CreatedAt"" ASC, ""Id"" ASC;
                    ", conn);
                    await using var reader = await cmd.ExecuteReaderAsync();
                    int count = 0;
                    while (await reader.ReadAsync())
                    {
                        count++;
                        Console.WriteLine($"{count}. ID: {reader["Id"]} | Inv: {reader["InvoiceNo"]} | Date: {reader["InvoiceDate"]} | Total: {reader["GrandTotal"]} | Deleted: {reader["IsDeleted"]} | Ref: {reader["ExternalReference"]}");
                    }
                    Console.WriteLine($"Total: {count} rows");
                    return 0;
                }
                `;

if (!content.includes('inspect-all-sales')) {
  content = content.replace(target, addition + target);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Added inspect-all-sales mode');
}

