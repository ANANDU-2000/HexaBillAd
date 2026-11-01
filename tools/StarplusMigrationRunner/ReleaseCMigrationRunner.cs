using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using Npgsql;
using NpgsqlTypes;

namespace StarplusMigrationRunner
{
    public static class ReleaseCMigrationRunner
    {
        private static string UnescapePg(string field)
        {
            if (field == "\\N") return null;
            var sb = new StringBuilder(field.Length);
            for (int i = 0; i < field.Length; i++)
            {
                if (field[i] == '\\' && i + 1 < field.Length)
                {
                    i++;
                    switch (field[i])
                    {
                        case 'n': sb.Append('\n'); break;
                        case 'r': sb.Append('\r'); break;
                        case 't': sb.Append('\t'); break;
                        case '\\': sb.Append('\\'); break;
                        default: sb.Append(field[i]); break;
                    }
                }
                else
                {
                    sb.Append(field[i]);
                }
            }
            return sb.ToString();
        }

        private static string[] SplitTsv(string line)
        {
            var parts = line.Split('\t');
            for (int i = 0; i < parts.Length; i++)
            {
                parts[i] = UnescapePg(parts[i]);
            }
            return parts;
        }

        private static decimal ParseDec(string s, decimal dflt = 0m)
        {
            if (string.IsNullOrWhiteSpace(s)) return dflt;
            return decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var v) ? v : dflt;
        }

        private static int ParseInt(string s, int dflt = 0)
        {
            if (string.IsNullOrWhiteSpace(s)) return dflt;
            return int.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var v) ? v : dflt;
        }

        private static int? ParseNullableInt(string s)
        {
            if (string.IsNullOrWhiteSpace(s)) return null;
            return int.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var v) ? v : (int?)null;
        }

        private static bool ParseBool(string s, bool dflt = false)
        {
            if (string.IsNullOrWhiteSpace(s)) return dflt;
            return s.Equals("t", StringComparison.OrdinalIgnoreCase) || s.Equals("true", StringComparison.OrdinalIgnoreCase) || s == "1";
        }

        private static DateTime ParseDt(string s)
        {
            if (string.IsNullOrWhiteSpace(s)) return DateTime.UtcNow;
            if (DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal, out var dt))
            {
                return DateTime.SpecifyKind(dt, DateTimeKind.Utc);
            }
            return DateTime.UtcNow;
        }

        public static async Task EnsureTablesAsync(NpgsqlConnection conn, string schema)
        {
            await using var cmd = new NpgsqlCommand($@"
                CREATE SCHEMA IF NOT EXISTS ""{schema}"";

                -- 1. LegacyExpenseCategories
                CREATE TABLE IF NOT EXISTS ""{schema}"".""LegacyExpenseCategories"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""TenantId"" INT NOT NULL DEFAULT 20,
                    ""SourceCategoryId"" INT NOT NULL,
                    ""Name"" VARCHAR(100) NOT NULL,
                    ""ColorCode"" VARCHAR(7) NOT NULL,
                    ""IsActive"" BOOLEAN NOT NULL,
                    ""CreatedAt"" TIMESTAMPTZ NOT NULL,
                    ""DefaultVatRate"" NUMERIC(5,4) NOT NULL DEFAULT 0,
                    ""DefaultTaxType"" VARCHAR(20) NOT NULL DEFAULT 'Standard',
                    ""DefaultIsTaxClaimable"" BOOLEAN NOT NULL DEFAULT FALSE,
                    ""DefaultIsEntertainment"" BOOLEAN NOT NULL DEFAULT FALSE,
                    ""VatDefaultLocked"" BOOLEAN NOT NULL DEFAULT FALSE,
                    CONSTRAINT ""UQ_{schema}_LegacyExpenseCats"" UNIQUE (""TenantId"", ""SourceCategoryId"")
                );

                -- 2. LegacyExpenses
                CREATE TABLE IF NOT EXISTS ""{schema}"".""LegacyExpenses"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""TenantId"" INT NOT NULL DEFAULT 20,
                    ""SourceExpenseId"" INT NOT NULL,
                    ""SourceCategoryId"" INT NOT NULL,
                    ""CategoryName"" VARCHAR(100),
                    ""Amount"" NUMERIC(18,2) NOT NULL,
                    ""Date"" TIMESTAMPTZ NOT NULL,
                    ""Note"" VARCHAR(500),
                    ""CreatedBy"" INT NOT NULL DEFAULT 1,
                    ""CreatedAt"" TIMESTAMPTZ NOT NULL,
                    ""VatRate"" NUMERIC(5,4),
                    ""VatAmount"" NUMERIC(18,2),
                    ""TotalAmount"" NUMERIC(18,2),
                    ""TaxType"" VARCHAR(20),
                    ""IsTaxClaimable"" BOOLEAN,
                    ""IsEntertainment"" BOOLEAN,
                    ""SourceSystem"" VARCHAR(50) NOT NULL DEFAULT 'Starplus',
                    CONSTRAINT ""UQ_{schema}_LegacyExpenses"" UNIQUE (""TenantId"", ""SourceSystem"", ""SourceExpenseId"")
                );
                CREATE INDEX IF NOT EXISTS ""IX_{schema}_LegacyExpenses_Tenant_Date"" ON ""{schema}"".""LegacyExpenses"" (""TenantId"", ""Date"");

                -- 3. LegacyPurchases
                CREATE TABLE IF NOT EXISTS ""{schema}"".""LegacyPurchases"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""TenantId"" INT NOT NULL DEFAULT 20,
                    ""SourcePurchaseId"" INT NOT NULL,
                    ""SourceSystem"" VARCHAR(50) NOT NULL DEFAULT 'Starplus',
                    ""SupplierName"" VARCHAR(200) NOT NULL,
                    ""InvoiceNo"" VARCHAR(100) NOT NULL,
                    ""ExternalReference"" VARCHAR(200),
                    ""ExpenseCategory"" VARCHAR(100),
                    ""PurchaseDate"" TIMESTAMPTZ NOT NULL,
                    ""TotalAmount"" NUMERIC(18,2) NOT NULL,
                    ""InvoiceFilePath"" TEXT,
                    ""InvoiceFileName"" TEXT,
                    ""CreatedBy"" INT NOT NULL DEFAULT 1,
                    ""CreatedAt"" TIMESTAMPTZ NOT NULL,
                    ""Subtotal"" NUMERIC(18,2),
                    ""VatTotal"" NUMERIC(18,2),
                    CONSTRAINT ""UQ_{schema}_LegacyPurchases"" UNIQUE (""TenantId"", ""SourceSystem"", ""SourcePurchaseId"")
                );
                CREATE INDEX IF NOT EXISTS ""IX_{schema}_LegacyPurchases_Tenant_Date"" ON ""{schema}"".""LegacyPurchases"" (""TenantId"", ""PurchaseDate"");
                CREATE INDEX IF NOT EXISTS ""IX_{schema}_LegacyPurchases_Tenant_Supplier"" ON ""{schema}"".""LegacyPurchases"" (""TenantId"", ""SupplierName"");

                -- 4. LegacyPurchaseItems
                CREATE TABLE IF NOT EXISTS ""{schema}"".""LegacyPurchaseItems"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""TenantId"" INT NOT NULL DEFAULT 20,
                    ""SourceItemId"" INT NOT NULL,
                    ""SourcePurchaseId"" INT NOT NULL,
                    ""SourceProductId"" INT NOT NULL,
                    ""DestinationProductId"" INT,
                    ""UnitType"" VARCHAR(20) NOT NULL,
                    ""Qty"" NUMERIC(18,2) NOT NULL,
                    ""UnitCost"" NUMERIC(18,2) NOT NULL,
                    ""LineTotal"" NUMERIC(18,2) NOT NULL,
                    ""UnitCostExclVat"" NUMERIC(18,2),
                    ""VatAmount"" NUMERIC(18,2),
                    CONSTRAINT ""UQ_{schema}_LegacyPurchaseItems"" UNIQUE (""TenantId"", ""SourceItemId"")
                );
                CREATE INDEX IF NOT EXISTS ""IX_{schema}_LegacyPurchaseItems_Tenant_Pur"" ON ""{schema}"".""LegacyPurchaseItems"" (""TenantId"", ""SourcePurchaseId"");

                -- 5. LegacyInventoryTransactions
                CREATE TABLE IF NOT EXISTS ""{schema}"".""LegacyInventoryTransactions"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""TenantId"" INT NOT NULL DEFAULT 20,
                    ""SourceTransactionId"" INT NOT NULL,
                    ""SourceProductId"" INT NOT NULL,
                    ""DestinationProductId"" INT,
                    ""ChangeQty"" NUMERIC(18,2) NOT NULL,
                    ""TransactionType"" TEXT NOT NULL,
                    ""RefId"" INT,
                    ""Reason"" TEXT,
                    ""CreatedAt"" TIMESTAMPTZ NOT NULL,
                    CONSTRAINT ""UQ_{schema}_LegacyInvTx"" UNIQUE (""TenantId"", ""SourceTransactionId"")
                );
                CREATE INDEX IF NOT EXISTS ""IX_{schema}_LegacyInvTx_Prod"" ON ""{schema}"".""LegacyInventoryTransactions"" (""TenantId"", ""SourceProductId"");

                -- 6. LegacyInvoiceVersions
                CREATE TABLE IF NOT EXISTS ""{schema}"".""LegacyInvoiceVersions"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""TenantId"" INT NOT NULL DEFAULT 20,
                    ""SourceVersionId"" INT NOT NULL,
                    ""SourceSaleId"" INT NOT NULL,
                    ""VersionNumber"" INT NOT NULL,
                    ""CreatedById"" INT NOT NULL,
                    ""CreatedAt"" TIMESTAMPTZ NOT NULL,
                    ""DataJson"" TEXT NOT NULL,
                    ""EditReason"" VARCHAR(500),
                    ""DiffSummary"" VARCHAR(1000),
                    CONSTRAINT ""UQ_{schema}_LegacyInvVer"" UNIQUE (""TenantId"", ""SourceVersionId"")
                );
                CREATE INDEX IF NOT EXISTS ""IX_{schema}_LegacyInvVer_Sale"" ON ""{schema}"".""LegacyInvoiceVersions"" (""TenantId"", ""SourceSaleId"");

                -- 7. LegacyPaymentReceipts
                CREATE TABLE IF NOT EXISTS ""{schema}"".""LegacyPaymentReceipts"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""TenantId"" INT NOT NULL DEFAULT 20,
                    ""SourceReceiptId"" INT NOT NULL,
                    ""ReceiptNumber"" VARCHAR(30) NOT NULL,
                    ""GeneratedAt"" TIMESTAMPTZ NOT NULL,
                    ""GeneratedByUserId"" INT NOT NULL,
                    ""PdfStoragePath"" VARCHAR(500),
                    CONSTRAINT ""UQ_{schema}_LegacyPayRec"" UNIQUE (""TenantId"", ""SourceReceiptId"")
                );

                -- 8. LegacyPaymentReceiptPayments
                CREATE TABLE IF NOT EXISTS ""{schema}"".""LegacyPaymentReceiptPayments"" (
                    ""Id"" SERIAL PRIMARY KEY,
                    ""TenantId"" INT NOT NULL DEFAULT 20,
                    ""SourceReceiptPaymentId"" INT NOT NULL,
                    ""PaymentReceiptId"" INT NOT NULL,
                    ""PaymentId"" INT NOT NULL,
                    CONSTRAINT ""UQ_{schema}_LegacyPayRecPay"" UNIQUE (""TenantId"", ""SourceReceiptPaymentId"")
                );
            ", conn);
            await cmd.ExecuteNonQueryAsync();
            Console.WriteLine($"[SCHEMA] Successfully ensured 8 Release C tables in schema '{schema}'.");
        }

        public static async Task<int> RunMigrationAsync(NpgsqlConnection conn, string dataDir, string schema, int tenantId, bool isRehearsal)
        {
            Console.WriteLine($"\n=======================================================");
            Console.WriteLine($"[RELEASE C] Starting migration for Tenant {tenantId} into schema '{schema}' (Rehearsal: {isRehearsal})");
            Console.WriteLine($"=======================================================");

            await EnsureTablesAsync(conn, schema);

            // Fetch Product Mappings from LegacyProducts
            var prodMap = new Dictionary<int, int>();
            try
            {
                await using var pCmd = new NpgsqlCommand($@"SELECT ""SourceProductId"", ""DestinationProductId"" FROM ""public"".""LegacyProducts"" WHERE ""TenantId"" = {tenantId} AND ""DestinationProductId"" IS NOT NULL;", conn);
                await using var pReader = await pCmd.ExecuteReaderAsync();
                while (await pReader.ReadAsync())
                {
                    prodMap[pReader.GetInt32(0)] = pReader.GetInt32(1);
                }
                Console.WriteLine($"[LOOKUP] Loaded {prodMap.Count} product mappings from public.LegacyProducts.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[WARN] Could not load product mappings: {ex.Message}");
            }

            await using var tx = await conn.BeginTransactionAsync();

            try
            {
                // 1. ExpenseCategories (3661.dat)
                var catMap = new Dictionary<int, string>();
                var catsFile = Path.Combine(dataDir, "3661.dat");
                if (File.Exists(catsFile))
                {
                    var catRows = 0;
                    using var sr = new StreamReader(catsFile, Encoding.UTF8);
                    string line;
                    while ((line = await sr.ReadLineAsync()) != null)
                    {
                        if (line == "\\.") break;
                        var parts = SplitTsv(line);
                        if (parts.Length < 10) continue;

                        var srcCatId = ParseInt(parts[0]);
                        var name = parts[1];
                        var color = parts[2];
                        var active = ParseBool(parts[3], true);
                        var created = ParseDt(parts[4]);
                        var vatRate = ParseDec(parts[5]);
                        var taxType = parts[6] ?? "Standard";
                        var claimable = ParseBool(parts[7]);
                        var ent = ParseBool(parts[8]);
                        var locked = ParseBool(parts[9]);

                        catMap[srcCatId] = name;

                        await using var insCmd = new NpgsqlCommand($@"
                            INSERT INTO ""{schema}"".""LegacyExpenseCategories""
                            (""TenantId"", ""SourceCategoryId"", ""Name"", ""ColorCode"", ""IsActive"", ""CreatedAt"", ""DefaultVatRate"", ""DefaultTaxType"", ""DefaultIsTaxClaimable"", ""DefaultIsEntertainment"", ""VatDefaultLocked"")
                            VALUES (@t, @srcId, @name, @color, @act, @created, @vatRate, @taxType, @claim, @ent, @locked)
                            ON CONFLICT (""TenantId"", ""SourceCategoryId"") DO UPDATE
                            SET ""Name"" = EXCLUDED.""Name"", ""ColorCode"" = EXCLUDED.""ColorCode"";
                        ", conn, tx);
                        insCmd.Parameters.AddWithValue("t", tenantId);
                        insCmd.Parameters.AddWithValue("srcId", srcCatId);
                        insCmd.Parameters.AddWithValue("name", name ?? "");
                        insCmd.Parameters.AddWithValue("color", color ?? "#888888");
                        insCmd.Parameters.AddWithValue("act", active);
                        insCmd.Parameters.AddWithValue("created", created);
                        insCmd.Parameters.AddWithValue("vatRate", vatRate);
                        insCmd.Parameters.AddWithValue("taxType", taxType);
                        insCmd.Parameters.AddWithValue("claim", claimable);
                        insCmd.Parameters.AddWithValue("ent", ent);
                        insCmd.Parameters.AddWithValue("locked", locked);
                        await insCmd.ExecuteNonQueryAsync();
                        catRows++;
                    }
                    Console.WriteLine($"[STAGE 1/8] Migrated {catRows} ExpenseCategories.");
                }

                // 2. Expenses (3674.dat) - Batch insert
                var expFile = Path.Combine(dataDir, "3674.dat");
                decimal expSum = 0;
                if (File.Exists(expFile))
                {
                    var expList = new List<string[]>();
                    using (var sr = new StreamReader(expFile, Encoding.UTF8))
                    {
                        string line;
                        while ((line = await sr.ReadLineAsync()) != null)
                        {
                            if (line == "\\.") break;
                            var parts = SplitTsv(line);
                            if (parts.Length >= 7) expList.Add(parts);
                        }
                    }

                    for (int b = 0; b < expList.Count; b += 100)
                    {
                        var chunk = expList.GetRange(b, Math.Min(100, expList.Count - b));
                        var sb = new StringBuilder();
                        sb.Append($@"
                            INSERT INTO ""{schema}"".""LegacyExpenses""
                            (""TenantId"", ""SourceExpenseId"", ""SourceCategoryId"", ""CategoryName"", ""Amount"", ""Date"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""VatRate"", ""VatAmount"", ""TotalAmount"", ""TaxType"", ""IsTaxClaimable"", ""IsEntertainment"")
                            VALUES ");
                        await using var cmd = new NpgsqlCommand();
                        cmd.Connection = conn;
                        cmd.Transaction = tx;

                        for (int i = 0; i < chunk.Count; i++)
                        {
                            var parts = chunk[i];
                            var srcExpId = ParseInt(parts[0]);
                            var catId = ParseInt(parts[1]);
                            var amt = ParseDec(parts[2]);
                            var dt = ParseDt(parts[3]);
                            var note = parts[4];
                            var createdBy = ParseInt(parts[5], 1);
                            var created = ParseDt(parts[6]);
                            decimal? vatRate = parts.Length > 7 && parts[7] != null ? ParseDec(parts[7]) : null;
                            decimal? vatAmt = parts.Length > 8 && parts[8] != null ? ParseDec(parts[8]) : null;
                            decimal? totAmt = parts.Length > 9 && parts[9] != null ? ParseDec(parts[9]) : amt;
                            var taxType = parts.Length > 10 ? parts[10] : null;
                            bool? claimable = parts.Length > 11 && parts[11] != null ? ParseBool(parts[11]) : null;
                            bool? ent = parts.Length > 12 && parts[12] != null ? ParseBool(parts[12]) : null;

                            expSum += amt;
                            catMap.TryGetValue(catId, out var catName);

                            if (i > 0) sb.Append(", ");
                            sb.Append($"(@t{i}, @src{i}, @cat{i}, @cn{i}, @amt{i}, @dt{i}, @nt{i}, @cb{i}, @ca{i}, @vr{i}, @va{i}, @tot{i}, @tt{i}, @tc{i}, @te{i})");

                            cmd.Parameters.AddWithValue($"t{i}", tenantId);
                            cmd.Parameters.AddWithValue($"src{i}", srcExpId);
                            cmd.Parameters.AddWithValue($"cat{i}", catId);
                            cmd.Parameters.AddWithValue($"cn{i}", (object)catName ?? DBNull.Value);
                            cmd.Parameters.AddWithValue($"amt{i}", amt);
                            cmd.Parameters.AddWithValue($"dt{i}", dt);
                            cmd.Parameters.AddWithValue($"nt{i}", (object)note ?? DBNull.Value);
                            cmd.Parameters.AddWithValue($"cb{i}", createdBy);
                            cmd.Parameters.AddWithValue($"ca{i}", created);
                            cmd.Parameters.AddWithValue($"vr{i}", (object)vatRate ?? DBNull.Value);
                            cmd.Parameters.AddWithValue($"va{i}", (object)vatAmt ?? DBNull.Value);
                            cmd.Parameters.AddWithValue($"tot{i}", (object)totAmt ?? amt);
                            cmd.Parameters.AddWithValue($"tt{i}", (object)taxType ?? DBNull.Value);
                            cmd.Parameters.AddWithValue($"tc{i}", (object)claimable ?? DBNull.Value);
                            cmd.Parameters.AddWithValue($"te{i}", (object)ent ?? DBNull.Value);
                        }

                        sb.Append(@"
                            ON CONFLICT (""TenantId"", ""SourceSystem"", ""SourceExpenseId"") DO UPDATE
                            SET ""Amount"" = EXCLUDED.""Amount"", ""TotalAmount"" = EXCLUDED.""TotalAmount"";");
                        cmd.CommandText = sb.ToString();
                        await cmd.ExecuteNonQueryAsync();
                    }
                    Console.WriteLine($"[STAGE 2/8] Migrated {expList.Count} Expenses (Sum: AED {expSum:N2}).");
                }

                // 3. Purchases (3680.dat) - Batch insert
                var purFile = Path.Combine(dataDir, "3680.dat");
                decimal purSum = 0;
                if (File.Exists(purFile))
                {
                    var purList = new List<string[]>();
                    using (var sr = new StreamReader(purFile, Encoding.UTF8))
                    {
                        string line;
                        while ((line = await sr.ReadLineAsync()) != null)
                        {
                            if (line == "\\.") break;
                            var parts = SplitTsv(line);
                            if (parts.Length >= 7) purList.Add(parts);
                        }
                    }

                    for (int b = 0; b < purList.Count; b += 100)
                    {
                        var chunk = purList.GetRange(b, Math.Min(100, purList.Count - b));
                        var sb = new StringBuilder();
                        sb.Append($@"
                            INSERT INTO ""{schema}"".""LegacyPurchases""
                            (""TenantId"", ""SourcePurchaseId"", ""SupplierName"", ""InvoiceNo"", ""ExternalReference"", ""ExpenseCategory"", ""PurchaseDate"", ""TotalAmount"", ""InvoiceFilePath"", ""InvoiceFileName"", ""CreatedBy"", ""CreatedAt"", ""Subtotal"", ""VatTotal"")
                            VALUES ");
                        await using var cmd = new NpgsqlCommand();
                        cmd.Connection = conn;
                        cmd.Transaction = tx;

                        for (int i = 0; i < chunk.Count; i++)
                        {
                            var parts = chunk[i];
                            var srcPurId = ParseInt(parts[0]);
                            var suppName = parts[1] ?? "";
                            var invNo = parts[2] ?? "";
                            var extRef = parts[3];
                            var expCat = parts[4];
                            var purDt = ParseDt(parts[5]);
                            var totAmt = ParseDec(parts[6]);
                            var filePath = parts.Length > 7 ? parts[7] : null;
                            var fileName = parts.Length > 8 ? parts[8] : null;
                            var cBy = parts.Length > 9 ? ParseInt(parts[9], 1) : 1;
                            var cAt = parts.Length > 10 ? ParseDt(parts[10]) : purDt;
                            decimal? subtotal = parts.Length > 11 && parts[11] != null ? ParseDec(parts[11]) : null;
                            decimal? vatTotal = parts.Length > 12 && parts[12] != null ? ParseDec(parts[12]) : null;

                            purSum += totAmt;

                            if (i > 0) sb.Append(", ");
                            sb.Append($"(@t{i}, @src{i}, @supp{i}, @inv{i}, @ext{i}, @cat{i}, @dt{i}, @tot{i}, @fp{i}, @fn{i}, @cb{i}, @ca{i}, @sub{i}, @vat{i})");

                            cmd.Parameters.AddWithValue($"t{i}", tenantId);
                            cmd.Parameters.AddWithValue($"src{i}", srcPurId);
                            cmd.Parameters.AddWithValue($"supp{i}", suppName);
                            cmd.Parameters.AddWithValue($"inv{i}", invNo);
                            cmd.Parameters.AddWithValue($"ext{i}", (object)extRef ?? DBNull.Value);
                            cmd.Parameters.AddWithValue($"cat{i}", (object)expCat ?? DBNull.Value);
                            cmd.Parameters.AddWithValue($"dt{i}", purDt);
                            cmd.Parameters.AddWithValue($"tot{i}", totAmt);
                            cmd.Parameters.AddWithValue($"fp{i}", (object)filePath ?? DBNull.Value);
                            cmd.Parameters.AddWithValue($"fn{i}", (object)fileName ?? DBNull.Value);
                            cmd.Parameters.AddWithValue($"cb{i}", cBy);
                            cmd.Parameters.AddWithValue($"ca{i}", cAt);
                            cmd.Parameters.AddWithValue($"sub{i}", (object)subtotal ?? DBNull.Value);
                            cmd.Parameters.AddWithValue($"vat{i}", (object)vatTotal ?? DBNull.Value);
                        }

                        sb.Append(@"
                            ON CONFLICT (""TenantId"", ""SourceSystem"", ""SourcePurchaseId"") DO UPDATE
                            SET ""TotalAmount"" = EXCLUDED.""TotalAmount"";");
                        cmd.CommandText = sb.ToString();
                        await cmd.ExecuteNonQueryAsync();
                    }
                    Console.WriteLine($"[STAGE 3/8] Migrated {purList.Count} Purchases (Sum: AED {purSum:N2}).");
                }

                // 4. PurchaseItems (3684.dat) - Batch insert
                var pItemsFile = Path.Combine(dataDir, "3684.dat");
                if (File.Exists(pItemsFile))
                {
                    var itemList = new List<string[]>();
                    using (var sr = new StreamReader(pItemsFile, Encoding.UTF8))
                    {
                        string line;
                        while ((line = await sr.ReadLineAsync()) != null)
                        {
                            if (line == "\\.") break;
                            var parts = SplitTsv(line);
                            if (parts.Length >= 7) itemList.Add(parts);
                        }
                    }

                    for (int b = 0; b < itemList.Count; b += 100)
                    {
                        var chunk = itemList.GetRange(b, Math.Min(100, itemList.Count - b));
                        var sb = new StringBuilder();
                        sb.Append($@"
                            INSERT INTO ""{schema}"".""LegacyPurchaseItems""
                            (""TenantId"", ""SourceItemId"", ""SourcePurchaseId"", ""SourceProductId"", ""DestinationProductId"", ""UnitType"", ""Qty"", ""UnitCost"", ""LineTotal"", ""UnitCostExclVat"", ""VatAmount"")
                            VALUES ");
                        await using var cmd = new NpgsqlCommand();
                        cmd.Connection = conn;
                        cmd.Transaction = tx;

                        for (int i = 0; i < chunk.Count; i++)
                        {
                            var parts = chunk[i];
                            var srcItemId = ParseInt(parts[0]);
                            var srcPurId = ParseInt(parts[1]);
                            var srcProdId = ParseInt(parts[2]);
                            var unitType = parts[3] ?? "CRTN";
                            var qty = ParseDec(parts[4]);
                            var unitCost = ParseDec(parts[5]);
                            var lineTot = ParseDec(parts[6]);
                            decimal? costExcl = parts.Length > 7 && parts[7] != null ? ParseDec(parts[7]) : null;
                            decimal? vatAmt = parts.Length > 8 && parts[8] != null ? ParseDec(parts[8]) : null;

                            prodMap.TryGetValue(srcProdId, out var destProdId);

                            if (i > 0) sb.Append(", ");
                            sb.Append($"(@t{i}, @src{i}, @pur{i}, @prod{i}, @dest{i}, @unit{i}, @qty{i}, @uc{i}, @lt{i}, @uce{i}, @va{i})");

                            cmd.Parameters.AddWithValue($"t{i}", tenantId);
                            cmd.Parameters.AddWithValue($"src{i}", srcItemId);
                            cmd.Parameters.AddWithValue($"pur{i}", srcPurId);
                            cmd.Parameters.AddWithValue($"prod{i}", srcProdId);
                            cmd.Parameters.AddWithValue($"dest{i}", destProdId > 0 ? (object)destProdId : DBNull.Value);
                            cmd.Parameters.AddWithValue($"unit{i}", unitType);
                            cmd.Parameters.AddWithValue($"qty{i}", qty);
                            cmd.Parameters.AddWithValue($"uc{i}", unitCost);
                            cmd.Parameters.AddWithValue($"lt{i}", lineTot);
                            cmd.Parameters.AddWithValue($"uce{i}", (object)costExcl ?? DBNull.Value);
                            cmd.Parameters.AddWithValue($"va{i}", (object)vatAmt ?? DBNull.Value);
                        }

                        sb.Append(@"
                            ON CONFLICT (""TenantId"", ""SourceItemId"") DO UPDATE
                            SET ""LineTotal"" = EXCLUDED.""LineTotal"";");
                        cmd.CommandText = sb.ToString();
                        await cmd.ExecuteNonQueryAsync();
                    }
                    Console.WriteLine($"[STAGE 4/8] Migrated {itemList.Count} PurchaseItems.");
                }

                // 5. InventoryTransactions (3668.dat) - Batch insert
                var invTxFile = Path.Combine(dataDir, "3668.dat");
                if (File.Exists(invTxFile))
                {
                    var txList = new List<string[]>();
                    using (var sr = new StreamReader(invTxFile, Encoding.UTF8))
                    {
                        string line;
                        while ((line = await sr.ReadLineAsync()) != null)
                        {
                            if (line == "\\.") break;
                            var parts = SplitTsv(line);
                            if (parts.Length >= 7) txList.Add(parts);
                        }
                    }

                    for (int b = 0; b < txList.Count; b += 150)
                    {
                        var chunk = txList.GetRange(b, Math.Min(150, txList.Count - b));
                        var sb = new StringBuilder();
                        sb.Append($@"
                            INSERT INTO ""{schema}"".""LegacyInventoryTransactions""
                            (""TenantId"", ""SourceTransactionId"", ""SourceProductId"", ""DestinationProductId"", ""ChangeQty"", ""TransactionType"", ""RefId"", ""Reason"", ""CreatedAt"")
                            VALUES ");
                        await using var cmd = new NpgsqlCommand();
                        cmd.Connection = conn;
                        cmd.Transaction = tx;

                        for (int i = 0; i < chunk.Count; i++)
                        {
                            var parts = chunk[i];
                            var srcTxId = ParseInt(parts[0]);
                            var srcProdId = ParseInt(parts[1]);
                            var changeQty = ParseDec(parts[2]);
                            var txType = parts[3] ?? "Unknown";
                            var refId = ParseNullableInt(parts[4]);
                            var reason = parts[5];
                            var created = ParseDt(parts[6]);

                            prodMap.TryGetValue(srcProdId, out var destProdId);

                            if (i > 0) sb.Append(", ");
                            sb.Append($"(@t{i}, @src{i}, @prod{i}, @dest{i}, @cq{i}, @tt{i}, @rf{i}, @rs{i}, @ca{i})");

                            cmd.Parameters.AddWithValue($"t{i}", tenantId);
                            cmd.Parameters.AddWithValue($"src{i}", srcTxId);
                            cmd.Parameters.AddWithValue($"prod{i}", srcProdId);
                            cmd.Parameters.AddWithValue($"dest{i}", destProdId > 0 ? (object)destProdId : DBNull.Value);
                            cmd.Parameters.AddWithValue($"cq{i}", changeQty);
                            cmd.Parameters.AddWithValue($"tt{i}", txType);
                            cmd.Parameters.AddWithValue($"rf{i}", (object)refId ?? DBNull.Value);
                            cmd.Parameters.AddWithValue($"rs{i}", (object)reason ?? DBNull.Value);
                            cmd.Parameters.AddWithValue($"ca{i}", created);
                        }

                        sb.Append(@" ON CONFLICT (""TenantId"", ""SourceTransactionId"") DO NOTHING;");
                        cmd.CommandText = sb.ToString();
                        await cmd.ExecuteNonQueryAsync();
                    }
                    Console.WriteLine($"[STAGE 5/8] Migrated {txList.Count} InventoryTransactions.");
                }

                // 6. InvoiceVersions (3688.dat) - Batch insert
                var verFile = Path.Combine(dataDir, "3688.dat");
                if (File.Exists(verFile))
                {
                    var verList = new List<string[]>();
                    using (var sr = new StreamReader(verFile, Encoding.UTF8))
                    {
                        string line;
                        while ((line = await sr.ReadLineAsync()) != null)
                        {
                            if (line == "\\.") break;
                            var parts = SplitTsv(line);
                            if (parts.Length >= 6) verList.Add(parts);
                        }
                    }

                    for (int b = 0; b < verList.Count; b += 50)
                    {
                        var chunk = verList.GetRange(b, Math.Min(50, verList.Count - b));
                        var sb = new StringBuilder();
                        sb.Append($@"
                            INSERT INTO ""{schema}"".""LegacyInvoiceVersions""
                            (""TenantId"", ""SourceVersionId"", ""SourceSaleId"", ""VersionNumber"", ""CreatedById"", ""CreatedAt"", ""DataJson"", ""EditReason"", ""DiffSummary"")
                            VALUES ");
                        await using var cmd = new NpgsqlCommand();
                        cmd.Connection = conn;
                        cmd.Transaction = tx;

                        for (int i = 0; i < chunk.Count; i++)
                        {
                            var parts = chunk[i];
                            var srcVerId = ParseInt(parts[0]);
                            var srcSaleId = ParseInt(parts[1]);
                            var verNum = ParseInt(parts[2]);
                            var createdById = ParseInt(parts[3], 1);
                            var created = ParseDt(parts[4]);
                            var json = parts[5] ?? "{}";
                            var reason = parts.Length > 6 ? parts[6] : null;
                            var diff = parts.Length > 7 ? parts[7] : null;

                            if (i > 0) sb.Append(", ");
                            sb.Append($"(@t{i}, @src{i}, @sale{i}, @vn{i}, @cb{i}, @ca{i}, @js{i}, @rs{i}, @df{i})");

                            cmd.Parameters.AddWithValue($"t{i}", tenantId);
                            cmd.Parameters.AddWithValue($"src{i}", srcVerId);
                            cmd.Parameters.AddWithValue($"sale{i}", srcSaleId);
                            cmd.Parameters.AddWithValue($"vn{i}", verNum);
                            cmd.Parameters.AddWithValue($"cb{i}", createdById);
                            cmd.Parameters.AddWithValue($"ca{i}", created);
                            cmd.Parameters.AddWithValue($"js{i}", json);
                            cmd.Parameters.AddWithValue($"rs{i}", (object)reason ?? DBNull.Value);
                            cmd.Parameters.AddWithValue($"df{i}", (object)diff ?? DBNull.Value);
                        }

                        sb.Append(@" ON CONFLICT (""TenantId"", ""SourceVersionId"") DO NOTHING;");
                        cmd.CommandText = sb.ToString();
                        await cmd.ExecuteNonQueryAsync();
                    }
                    Console.WriteLine($"[STAGE 6/8] Migrated {verList.Count} InvoiceVersions.");
                }

                // 7. PaymentReceipts (3701.dat)
                var recFile = Path.Combine(dataDir, "3701.dat");
                if (File.Exists(recFile))
                {
                    var recRows = 0;
                    using var sr = new StreamReader(recFile, Encoding.UTF8);
                    string line;
                    while ((line = await sr.ReadLineAsync()) != null)
                    {
                        if (line == "\\.") break;
                        var parts = SplitTsv(line);
                        if (parts.Length < 4) continue;

                        var srcRecId = ParseInt(parts[0]);
                        var recNum = parts[1] ?? "";
                        var genAt = ParseDt(parts[2]);
                        var genBy = ParseInt(parts[3], 1);
                        var pdfPath = parts.Length > 4 ? parts[4] : null;

                        await using var insCmd = new NpgsqlCommand($@"
                            INSERT INTO ""{schema}"".""LegacyPaymentReceipts""
                            (""TenantId"", ""SourceReceiptId"", ""ReceiptNumber"", ""GeneratedAt"", ""GeneratedByUserId"", ""PdfStoragePath"")
                            VALUES (@t, @srcId, @num, @genAt, @genBy, @pdf)
                            ON CONFLICT (""TenantId"", ""SourceReceiptId"") DO NOTHING;
                        ", conn, tx);
                        insCmd.Parameters.AddWithValue("t", tenantId);
                        insCmd.Parameters.AddWithValue("srcId", srcRecId);
                        insCmd.Parameters.AddWithValue("num", recNum);
                        insCmd.Parameters.AddWithValue("genAt", genAt);
                        insCmd.Parameters.AddWithValue("genBy", genBy);
                        insCmd.Parameters.AddWithValue("pdf", (object)pdfPath ?? DBNull.Value);
                        await insCmd.ExecuteNonQueryAsync();
                        recRows++;
                    }
                    Console.WriteLine($"[STAGE 7/8] Migrated {recRows} PaymentReceipts.");
                }

                // 8. PaymentReceiptPayments (3703.dat)
                var recPayFile = Path.Combine(dataDir, "3703.dat");
                if (File.Exists(recPayFile))
                {
                    var recPayRows = 0;
                    using var sr = new StreamReader(recPayFile, Encoding.UTF8);
                    string line;
                    while ((line = await sr.ReadLineAsync()) != null)
                    {
                        if (line == "\\.") break;
                        var parts = SplitTsv(line);
                        if (parts.Length < 3) continue;

                        var srcId = ParseInt(parts[0]);
                        var recId = ParseInt(parts[1]);
                        var payId = ParseInt(parts[2]);

                        await using var insCmd = new NpgsqlCommand($@"
                            INSERT INTO ""{schema}"".""LegacyPaymentReceiptPayments""
                            (""TenantId"", ""SourceReceiptPaymentId"", ""PaymentReceiptId"", ""PaymentId"")
                            VALUES (@t, @srcId, @recId, @payId)
                            ON CONFLICT (""TenantId"", ""SourceReceiptPaymentId"") DO NOTHING;
                        ", conn, tx);
                        insCmd.Parameters.AddWithValue("t", tenantId);
                        insCmd.Parameters.AddWithValue("srcId", srcId);
                        insCmd.Parameters.AddWithValue("recId", recId);
                        insCmd.Parameters.AddWithValue("payId", payId);
                        await insCmd.ExecuteNonQueryAsync();
                        recPayRows++;
                    }
                    Console.WriteLine($"[STAGE 8/8] Migrated {recPayRows} PaymentReceiptPayments.");
                }

                await tx.CommitAsync();
                Console.WriteLine($"\n[SUCCESS] Release C transaction committed cleanly into schema '{schema}'!");

                // Audit checks
                await AuditChecksAsync(conn, schema, tenantId);
                return 0;
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                Console.WriteLine($"[RELEASE C ERROR] Rolled back: {ex.Message}");
                return 1;
            }
        }

        public static async Task AuditChecksAsync(NpgsqlConnection conn, string schema, int tenantId)
        {
            Console.WriteLine($"\n=== AUDITING RELEASE C TABLES IN '{schema}' (Tenant {tenantId}) ===");

            await CheckCountAsync(conn, schema, "LegacyExpenseCategories", tenantId, 10);
            await CheckCountAsync(conn, schema, "LegacyExpenses", tenantId, 242);
            await CheckCountAsync(conn, schema, "LegacyPurchases", tenantId, 1563);
            await CheckCountAsync(conn, schema, "LegacyPurchaseItems", tenantId, 7217);
            await CheckCountAsync(conn, schema, "LegacyInventoryTransactions", tenantId, 23237);
            await CheckCountAsync(conn, schema, "LegacyInvoiceVersions", tenantId, 1592);
            await CheckCountAsync(conn, schema, "LegacyPaymentReceipts", tenantId, 40);
            await CheckCountAsync(conn, schema, "LegacyPaymentReceiptPayments", tenantId, 172);

            // Sum of purchases
            await using (var cmd = new NpgsqlCommand($@"SELECT SUM(""TotalAmount"") FROM ""{schema}"".""LegacyPurchases"" WHERE ""TenantId"" = {tenantId};", conn))
            {
                var purSum = Convert.ToDecimal(await cmd.ExecuteScalarAsync());
                var expPur = 3520385.92m;
                var pass = Math.Abs(purSum - expPur) < 0.05m;
                Console.WriteLine($"[CHECK] LegacyPurchases Sum: AED {purSum:N2} (Expected: AED {expPur:N2}) -> {(pass ? "PASS" : "FAIL")}");
            }

            // Sum of expenses
            await using (var cmd = new NpgsqlCommand($@"SELECT SUM(""Amount"") FROM ""{schema}"".""LegacyExpenses"" WHERE ""TenantId"" = {tenantId};", conn))
            {
                var expSum = Convert.ToDecimal(await cmd.ExecuteScalarAsync());
                var expExp = 14239.00m;
                var pass = Math.Abs(expSum - expExp) < 0.05m;
                Console.WriteLine($"[CHECK] LegacyExpenses Sum: AED {expSum:N2} (Expected: AED {expExp:N2}) -> {(pass ? "PASS" : "FAIL")}");
            }
        }

        private static async Task CheckCountAsync(NpgsqlConnection conn, string schema, string table, int tenantId, int expected)
        {
            await using var cmd = new NpgsqlCommand($@"SELECT COUNT(*) FROM ""{schema}"".""{table}"" WHERE ""TenantId"" = {tenantId};", conn);
            var cnt = Convert.ToInt32(await cmd.ExecuteScalarAsync());
            var pass = cnt == expected;
            Console.WriteLine($"[CHECK] {table}: {cnt} (Expected: {expected}) -> {(pass ? "PASS" : "FAIL")}");
        }
    }
}
