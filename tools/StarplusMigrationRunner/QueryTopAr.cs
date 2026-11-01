using System;
using System.Threading.Tasks;
using Npgsql;

namespace StarplusMigrationRunner
{
    public static class QueryTopAr
    {
        public static async Task RunAsync(NpgsqlConnection conn, int tenantId)
        {
            await using var cmd = new NpgsqlCommand(@"
                SELECT o.""SourceCustomerId"", c.""Name"" as ""CustomerName"", o.""OpeningBalance"", o.""DestinationCustomerId"", o.""ReconciledInvoicesCount""
                FROM ""public"".""LegacyOpeningReceivables"" o
                LEFT JOIN ""public"".""LegacyCustomers"" c ON c.""TenantId"" = o.""TenantId"" AND c.""SourceCustomerId"" = o.""SourceCustomerId""
                WHERE o.""TenantId"" = @tenantId
                ORDER BY o.""OpeningBalance"" DESC
                LIMIT 5;
            ", conn);
            cmd.Parameters.AddWithValue("tenantId", tenantId);

            await using var reader = await cmd.ExecuteReaderAsync();
            Console.WriteLine("[TOP 5 OPENING RECEIVABLES]");
            while (await reader.ReadAsync())
            {
                Console.WriteLine($"  Customer {reader["SourceCustomerId"]}: '{reader["CustomerName"]}' -> OpeningBalance: AED {reader["OpeningBalance"]}, DestId: {reader["DestinationCustomerId"]}, ReconciledInvoices: {reader["ReconciledInvoicesCount"]}");
            }
        }
    }
}
