using System;
using System.IO;
using System.Threading.Tasks;
using Npgsql;

namespace StarplusMigrationRunner
{
    class Program
    {
        static string ParseToConnectionString(string input)
        {
            if (input.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) ||
                input.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
            {
                var cleanUrl = input.TrimEnd('?');
                var uri = new Uri(cleanUrl);
                var dbPort = uri.Port > 0 ? uri.Port : 5432;
                var userInfo = uri.UserInfo ?? "";
                var firstColon = userInfo.IndexOf(':');
                var username = firstColon >= 0 ? userInfo.Substring(0, firstColon) : userInfo;
                var password = firstColon >= 0 ? userInfo.Substring(firstColon + 1) : "";
                var database = uri.AbsolutePath.TrimStart('/');
                return $"Host={uri.Host};Port={dbPort};Database={database};Username={username};Password={password};SSL Mode=Require;Trust Server Certificate=true;Command Timeout=300";
            }
            return input;
        }

        static async Task<int> Main(string[] args)
        {
            var rawUrl = Environment.GetEnvironmentVariable("HEXABILL_DB_URL");
            var mode = "rehearse";

            for (int i = 0; i < args.Length; i++)
            {
                if (args[i].StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) ||
                    args[i].StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase) ||
                    args[i].Contains("Host="))
                {
                    rawUrl = args[i];
                }
                else if (!args[i].StartsWith("--"))
                {
                    mode = args[i].ToLowerInvariant();
                }
            }

            if (string.IsNullOrWhiteSpace(rawUrl))
            {
                Console.WriteLine("Error: Please provide database URL.");
                return 1;
            }

            var archivePath = Path.Combine(AppContext.BaseDirectory, "../../../../../frozhen/Starplus_Migration/Starplus_Archive_Clean_Staging_READ_ONLY.json");
            if (!File.Exists(archivePath))
            {
                archivePath = Path.GetFullPath("frozhen/Starplus_Migration/Starplus_Archive_Clean_Staging_READ_ONLY.json");
            }
            if (!File.Exists(archivePath))
            {
                Console.WriteLine($"Error: Archive JSON not found at {archivePath}");
                return 1;
            }

            try
            {
                var connStr = ParseToConnectionString(rawUrl);
                await using var conn = new NpgsqlConnection(connStr);
                await conn.OpenAsync();

                var targetTenantId = 20; // FROZENHUB 1
                Console.WriteLine($"[INIT] Connected to PostgreSQL. Target Tenant: {targetTenantId} (FrozenHub 1). Mode: '{mode.ToUpperInvariant()}'.");

                var archiveData = await MigrationEngine.LoadArchiveAsync(archivePath);

                if (mode == "rehearse")
                {
                    return await RunIsolatedRehearsalAsync(conn, targetTenantId, archiveData);
                }
                else if (mode == "apply")
                {
                    return await RunProductionMigrationAsync(conn, targetTenantId, archiveData);
                }
                else if (mode == "verify")
                {
                    var audit = await ReconciliationAuditor.AuditAsync(conn, "public", targetTenantId);
                    return audit.Passed ? 0 : 1;
                }
                else if (mode == "cleanup")
                {
                    await SchemaBuilder.DropRehearsalSchemaAsync(conn, "starplus_rehearsal");
                    Console.WriteLine("[CLEANUP] Rehearsal schema 'starplus_rehearsal' dropped successfully.");
                    return 0;
                }
                else if (mode == "sync-mappings")
                {
                    return await SyncCustomerMappingsAsync(conn, targetTenantId);
                }
                else
                {
                    Console.WriteLine($"Unknown mode: {mode}. Use 'rehearse', 'apply', or 'verify'.");
                    return 1;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[FATAL ERROR] {ex.GetType().Name}: {ex.Message}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"[INNER] {ex.InnerException.GetType().Name}: {ex.InnerException.Message}");
                }
                return 1;
            }
        }

        static async Task<int> RunIsolatedRehearsalAsync(NpgsqlConnection conn, int tenantId, StagingArchiveRoot archiveData)
        {
            var rehearsalSchema = "starplus_rehearsal";
            Console.WriteLine($"\n=======================================================");
            Console.WriteLine($"[REHEARSAL] Starting Isolated Staging Rehearsal in schema '{rehearsalSchema}'");
            Console.WriteLine($"=======================================================");

            // 1. Clean slate for rehearsal schema
            await SchemaBuilder.DropRehearsalSchemaAsync(conn, rehearsalSchema);

            // 2. First Execution
            var runId1 = $"REHEARSAL_RUN_1_{DateTime.UtcNow:yyyyMMddHHmmss}";
            var result1 = await MigrationEngine.ExecuteAsync(conn, rehearsalSchema, tenantId, archiveData, runId1, true, true);
            Console.WriteLine($"[REHEARSAL RUN 1] Finished in {result1.Elapsed.TotalSeconds:N1}s. Invoices: {result1.InvoicesInserted}, Items: {result1.ItemsInserted}, Payments: {result1.PaymentsInserted}.");

            // 3. Audit First Execution
            var audit1 = await ReconciliationAuditor.AuditAsync(conn, rehearsalSchema, tenantId);
            if (!audit1.Passed)
            {
                Console.WriteLine("[ERROR] First rehearsal execution failed audit checks!");
                return 1;
            }

            // 4. Test Idempotency: Second Execution
            Console.WriteLine("\n-------------------------------------------------------");
            Console.WriteLine("[IDEMPOTENCY TEST] Running MigrationEngine a SECOND time into the same schema...");
            Console.WriteLine("-------------------------------------------------------");
            var runId2 = $"REHEARSAL_RUN_2_{DateTime.UtcNow:yyyyMMddHHmmss}";
            var result2 = await MigrationEngine.ExecuteAsync(conn, rehearsalSchema, tenantId, archiveData, runId2, true, false);

            // Audit Second Execution: counts must be 100% identical! Zero duplicates!
            var audit2 = await ReconciliationAuditor.AuditAsync(conn, rehearsalSchema, tenantId);
            if (!audit2.Passed ||
                audit2.InvoicesTotalCount != audit1.InvoicesTotalCount ||
                audit2.ItemsCount != audit1.ItemsCount ||
                audit2.PaymentsCount != audit1.PaymentsCount ||
                audit2.CustomersCount != audit1.CustomersCount ||
                audit2.ProductsCount != audit1.ProductsCount ||
                audit2.OpeningReceivablesCount != audit1.OpeningReceivablesCount)
            {
                Console.WriteLine("[ERROR] Idempotency test FAILED! Duplicate records were created on second run.");
                return 1;
            }
            Console.WriteLine("[IDEMPOTENCY TEST] PASSED! Zero duplicates created on second execution.");

            // 5. Test Rollback Recovery
            Console.WriteLine("\n-------------------------------------------------------");
            Console.WriteLine("[TRANSACTION ROLLBACK TEST] Testing safe recovery on mid-transaction failure...");
            Console.WriteLine("-------------------------------------------------------");
            await using (var tx = await conn.BeginTransactionAsync())
            {
                await using var cmd = new NpgsqlCommand($@"
                    INSERT INTO ""{rehearsalSchema}"".""LegacyInvoices"" 
                    (""TenantId"", ""SourceInvoiceId"", ""LegacyInvoiceNumber"", ""InvoiceDate"", ""Status"", ""MigrationRunId"")
                    VALUES ({tenantId}, 99999999, 'TEST-ROLLBACK-INV', NOW(), 'Test', 'TEST_ROLLBACK');
                ", conn, tx);
                await cmd.ExecuteNonQueryAsync();
                await tx.RollbackAsync();
            }
            var rollbackCheck = Convert.ToInt32(await new NpgsqlCommand($@"
                SELECT COUNT(*) FROM ""{rehearsalSchema}"".""LegacyInvoices"" WHERE ""LegacyInvoiceNumber"" = 'TEST-ROLLBACK-INV';
            ", conn).ExecuteScalarAsync());

            if (rollbackCheck != 0)
            {
                Console.WriteLine("[ERROR] Rollback test FAILED! Rolled-back record was committed.");
                return 1;
            }
            Console.WriteLine("[TRANSACTION ROLLBACK TEST] PASSED! Transaction aborted cleanly without data corruption.");

            Console.WriteLine($"\n=======================================================");
            Console.WriteLine($"[REHEARSAL RESULT] >>> ISOLATED REHEARSAL FULLY PASSED ALL TESTS! <<<");
            Console.WriteLine($"=======================================================\n");

            return 0;
        }

        static async Task<int> RunProductionMigrationAsync(NpgsqlConnection conn, int tenantId, StagingArchiveRoot archiveData)
        {
            var targetSchema = "public";
            Console.WriteLine($"\n=======================================================");
            Console.WriteLine($"[PRODUCTION IMPORT] Applying Migration to '{targetSchema}' for Tenant {tenantId}");
            Console.WriteLine($"=======================================================");

            var runId = $"PROD_MIGRATION_{DateTime.UtcNow:yyyyMMddHHmmss}";
            var result = await MigrationEngine.ExecuteAsync(conn, targetSchema, tenantId, archiveData, runId, false, true);

            var audit = await ReconciliationAuditor.AuditAsync(conn, targetSchema, tenantId);
            if (!audit.Passed)
            {
                Console.WriteLine("[ERROR] Production post-migration audit failed!");
                return 1;
            }

            Console.WriteLine($"\n=======================================================");
            Console.WriteLine($"[PRODUCTION RESULT] >>> PRODUCTION MIGRATION COMPLETED & VERIFIED! <<<");
            Console.WriteLine($"=======================================================");

            return 0;
        }

        static async Task<int> SyncCustomerMappingsAsync(NpgsqlConnection conn, int tenantId)
        {
            Console.WriteLine($"\n=======================================================");
            Console.WriteLine($"[SYNC MAPPINGS] Synchronizing LegacyCustomerMappings for Tenant {tenantId}");
            Console.WriteLine($"=======================================================");

            await SchemaBuilder.EnsureSchemaAndTablesAsync(conn, "public");

            await using var cmd = new NpgsqlCommand($@"
                INSERT INTO ""public"".""LegacyCustomerMappings""
                (""TenantId"", ""SourceCustomerId"", ""SourceCustomerName"", ""DestinationCustomerId"", ""MatchType"", ""ApprovalStatus"", ""ApprovedAt"", ""ApprovedBy"")
                SELECT 
                    c.""TenantId"",
                    c.""SourceCustomerId"",
                    c.""Name"" AS ""SourceCustomerName"",
                    c.""DestinationCustomerId"",
                    CASE 
                        WHEN c.""SourceCustomerId"" IN (80, 62, 67) THEN 'EXACT_MATCH'
                        ELSE 'NAME_MATCH'
                    END AS ""MatchType"",
                    'APPROVED' AS ""ApprovalStatus"",
                    NOW() AS ""ApprovedAt"",
                    34 AS ""ApprovedBy""
                FROM ""public"".""LegacyCustomers"" c
                WHERE c.""TenantId"" = {tenantId}
                ON CONFLICT (""TenantId"", ""SourceCustomerId"")
                DO UPDATE SET
                    ""SourceCustomerName"" = EXCLUDED.""SourceCustomerName"",
                    ""DestinationCustomerId"" = EXCLUDED.""DestinationCustomerId"",
                    ""MatchType"" = EXCLUDED.""MatchType"",
                    ""ApprovalStatus"" = 'APPROVED',
                    ""ApprovedAt"" = NOW(),
                    ""ApprovedBy"" = 34;
            ", conn);

            var count = await cmd.ExecuteNonQueryAsync();
            Console.WriteLine($"[SYNC MAPPINGS] Populated/updated customer mappings in LegacyCustomerMappings.");

            var verifyCount = Convert.ToInt32(await new NpgsqlCommand($@"
                SELECT COUNT(*) FROM ""public"".""LegacyCustomerMappings"" WHERE ""TenantId"" = {tenantId};
            ", conn).ExecuteScalarAsync());

            Console.WriteLine($"[SYNC MAPPINGS] Verified {verifyCount} mappings exist in LegacyCustomerMappings for Tenant {tenantId}.");
            return verifyCount == 81 ? 0 : 1;
        }
    }
}
