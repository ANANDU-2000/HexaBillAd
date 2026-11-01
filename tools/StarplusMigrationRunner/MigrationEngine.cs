using System;
using System.Collections.Generic;
using System.Data;
using System.Globalization;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Npgsql;

namespace StarplusMigrationRunner
{
    public class MigrationResult
    {
        public string RunId { get; set; } = string.Empty;
        public int CustomersInserted { get; set; }
        public int ProductsInserted { get; set; }
        public int InvoicesInserted { get; set; }
        public int ItemsInserted { get; set; }
        public int PaymentsInserted { get; set; }
        public decimal TotalOutstanding { get; set; }
        public TimeSpan Elapsed { get; set; }
    }

    public static class MigrationEngine
    {
        private static readonly Dictionary<int, int> KnownCustomerMatches = new()
        {
            { 62, 131 }, // ISHAKALI RESTAURANT
            { 80, 132 }, // GOLDEN EXPRESS RESTAURANT
            { 67, 133 }  // SASAL NAKEL RESTAURANT
        };

        private static readonly Dictionary<int, int> KnownProductMatches = new()
        {
            { 30, 141 },
            { 56, 170 },
            { 200, 139 },
            { 279, 169 },
            { 245, 138 },
            { 276, 140 },
            { 272, 166 },
            { 298, 140 }
        };

        public static decimal ParseDecimal(string? val)
        {
            if (string.IsNullOrWhiteSpace(val)) return 0m;
            return decimal.Parse(val, NumberStyles.Any, CultureInfo.InvariantCulture);
        }

        public static DateTime ParseDate(string? val)
        {
            if (string.IsNullOrWhiteSpace(val)) return DateTime.UtcNow;
            if (DateTime.TryParse(val, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var dt))
                return dt;
            return DateTime.SpecifyKind(DateTime.Parse(val), DateTimeKind.Utc);
        }

        public static async Task<StagingArchiveRoot> LoadArchiveAsync(string archivePath)
        {
            Console.WriteLine($"[INFO] Loading staging JSON from: {archivePath}");
            var json = await File.ReadAllTextAsync(archivePath);
            var data = JsonSerializer.Deserialize<StagingArchiveRoot>(json)
                ?? throw new InvalidOperationException("Failed to deserialize staging archive.");
            Console.WriteLine($"[INFO] Staging JSON loaded: {data.Customers.Count} customers, {data.Products.Count} products, {data.UnattributedInvoices.Count} unattributed invoices.");
            return data;
        }

        public static async Task<MigrationResult> ExecuteAsync(
            NpgsqlConnection conn, 
            string schemaName, 
            int tenantId, 
            StagingArchiveRoot data, 
            string runId, 
            bool isRehearsal,
            bool ensureCustomersInTargetTable = false)
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            Console.WriteLine($"\n=======================================================");
            Console.WriteLine($"[START] Executing Migration (Schema: '{schemaName}', Tenant: {tenantId}, RunId: '{runId}', Rehearsal: {isRehearsal})");
            Console.WriteLine($"=======================================================");

            await SchemaBuilder.EnsureSchemaAndTablesAsync(conn, schemaName);

            await using var tx = await conn.BeginTransactionAsync();

            try
            {
                // Record migration start
                await using (var cmd = new NpgsqlCommand($@"
                    INSERT INTO ""{schemaName}"".""MigrationRuns"" 
                    (""Id"", ""TenantId"", ""SourceSystem"", ""Status"", ""StartedAt"")
                    VALUES (@id, @tid, 'Starplus', @status, NOW())
                    ON CONFLICT (""Id"") DO UPDATE SET ""Status"" = @status, ""StartedAt"" = NOW();
                ", conn, tx))
                {
                    cmd.Parameters.AddWithValue("id", runId);
                    cmd.Parameters.AddWithValue("tid", tenantId);
                    cmd.Parameters.AddWithValue("status", isRehearsal ? "REHEARSAL_RUNNING" : "MIGRATING");
                    await cmd.ExecuteNonQueryAsync();
                }

                // 1. Process Customers
                Console.WriteLine("\n[STAGE 1/6] Migrating 81 Customers...");
                var customerIdMapping = new Dictionary<int, int>();
                var targetCustTable = schemaName == "public" ? "\"public\".\"Customers\"" : $"\"{schemaName}\".\"Customers\"";

                if (schemaName != "public")
                {
                    await using (var cmd = new NpgsqlCommand($@"
                        CREATE TABLE IF NOT EXISTS ""{schemaName}"".""Customers"" (
                            ""Id"" SERIAL PRIMARY KEY,
                            ""TenantId"" INT NOT NULL,
                            ""OwnerId"" INT NOT NULL DEFAULT 20,
                            ""Name"" VARCHAR(255) NOT NULL,
                            ""CustomerType"" INT NOT NULL DEFAULT 0,
                            ""Phone"" VARCHAR(50),
                            ""Email"" VARCHAR(100),
                            ""Trn"" VARCHAR(50),
                            ""Address"" TEXT,
                            ""CreditLimit"" NUMERIC(18,2) NOT NULL DEFAULT 0,
                            ""TotalSales"" NUMERIC(18,2) NOT NULL DEFAULT 0,
                            ""TotalPayments"" NUMERIC(18,2) NOT NULL DEFAULT 0,
                            ""PendingBalance"" NUMERIC(18,2) NOT NULL DEFAULT 0,
                            ""Balance"" NUMERIC(18,2) NOT NULL DEFAULT 0,
                            ""CreatedAt"" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            ""UpdatedAt"" TIMESTAMPTZ NOT NULL DEFAULT NOW()
                        );
                    ", conn, tx))
                    {
                        await cmd.ExecuteNonQueryAsync();
                    }
                }

                // Known matches
                foreach (var kvp in KnownCustomerMatches)
                {
                    customerIdMapping[kvp.Key] = kvp.Value;
                }

                // Query any already-persisted customer mappings from this schema
                try
                {
                    await using var mapCmd = new NpgsqlCommand($@"
                        SELECT ""SourceCustomerId"", ""DestinationCustomerId"" 
                        FROM ""{schemaName}"".""LegacyCustomers"" 
                        WHERE ""TenantId"" = @tid AND ""DestinationCustomerId"" IS NOT NULL;
                    ", conn, tx);
                    mapCmd.Parameters.AddWithValue("tid", tenantId);
                    await using var mapReader = await mapCmd.ExecuteReaderAsync();
                    while (await mapReader.ReadAsync())
                    {
                        var srcId = mapReader.GetInt32(0);
                        var dstId = mapReader.GetInt32(1);
                        customerIdMapping[srcId] = dstId;
                    }
                }
                catch { /* table may not exist yet on initial run */ }

                if (ensureCustomersInTargetTable)
                {
                    foreach (var sc in data.Customers)
                    {
                        if (!customerIdMapping.ContainsKey(sc.SourceCustomerId))
                        {
                            await using var findCmd = new NpgsqlCommand($@"
                                SELECT ""Id"" FROM {targetCustTable} 
                                WHERE ""TenantId"" = @tid AND LOWER(""Name"") = LOWER(@name)
                                LIMIT 1;
                            ", conn, tx);
                            findCmd.Parameters.AddWithValue("tid", tenantId);
                            findCmd.Parameters.AddWithValue("name", sc.Name.Trim());
                            var existingId = await findCmd.ExecuteScalarAsync();

                            if (existingId != null && existingId != DBNull.Value)
                            {
                                customerIdMapping[sc.SourceCustomerId] = Convert.ToInt32(existingId);
                            }
                            else
                            {
                                await using var insertCustCmd = new NpgsqlCommand($@"
                                    INSERT INTO {targetCustTable} 
                                    (""TenantId"", ""OwnerId"", ""Name"", ""CustomerType"", ""Phone"", ""Email"", ""Trn"", ""Address"", ""CreditLimit"", ""TotalSales"", ""TotalPayments"", ""PendingBalance"", ""Balance"", ""CreatedAt"", ""UpdatedAt"")
                                    VALUES (@tid, 34, @name, 0, @phone, @email, @trn, @addr, 0, 0, 0, 0, 0, NOW(), NOW())
                                    RETURNING ""Id"";
                                ", conn, tx);
                                insertCustCmd.Parameters.AddWithValue("tid", tenantId);
                                insertCustCmd.Parameters.AddWithValue("name", sc.Name.Trim());
                                insertCustCmd.Parameters.AddWithValue("phone", (object?)sc.Phone ?? DBNull.Value);
                                insertCustCmd.Parameters.AddWithValue("email", (object?)sc.Email ?? DBNull.Value);
                                insertCustCmd.Parameters.AddWithValue("trn", (object?)sc.Trn ?? DBNull.Value);
                                insertCustCmd.Parameters.AddWithValue("addr", (object?)sc.Address ?? DBNull.Value);
                                var newId = await insertCustCmd.ExecuteScalarAsync();
                                customerIdMapping[sc.SourceCustomerId] = Convert.ToInt32(newId);
                            }
                        }
                    }
                }

                // Batch Insert into LegacyCustomers
                var custInserted = 0;
                var custSql = new StringBuilder();
                custSql.Append($@"
                    INSERT INTO ""{schemaName}"".""LegacyCustomers"" (
                        ""TenantId"", ""SourceCustomerId"", ""SourceSystem"", ""Name"", ""Phone"", ""Email"", ""Address"", ""Trn"",
                        ""DestinationCustomerId"", ""InvoiceCount"", ""DeletedInvoiceCount"", ""UnpaidInvoiceCount"",
                        ""UnpaidInvoiceAmount"", ""LedgerCachedPendingBalance"", ""LedgerCachedBalance"", ""ApprovedOpeningBalance"", ""CreatedAt""
                    ) VALUES ");

                await using var custBatchCmd = new NpgsqlCommand();
                custBatchCmd.Connection = conn;
                custBatchCmd.Transaction = tx;

                for (int i = 0; i < data.Customers.Count; i++)
                {
                    var sc = data.Customers[i];
                    var destId = customerIdMapping.TryGetValue(sc.SourceCustomerId, out var dId) ? (int?)dId : null;
                    if (i > 0) custSql.Append(", ");
                    custSql.Append($"(@tid{i}, @scid{i}, 'Starplus', @name{i}, @phone{i}, @email{i}, @addr{i}, @trn{i}, @destid{i}, @invcount{i}, @delcount{i}, @unpaidcount{i}, @unpaidamt{i}, @cachedpending{i}, @cachedbal{i}, @approvedopening{i}, NOW())");

                    custBatchCmd.Parameters.AddWithValue($"tid{i}", tenantId);
                    custBatchCmd.Parameters.AddWithValue($"scid{i}", sc.SourceCustomerId);
                    custBatchCmd.Parameters.AddWithValue($"name{i}", sc.Name);
                    custBatchCmd.Parameters.AddWithValue($"phone{i}", (object?)sc.Phone ?? DBNull.Value);
                    custBatchCmd.Parameters.AddWithValue($"email{i}", (object?)sc.Email ?? DBNull.Value);
                    custBatchCmd.Parameters.AddWithValue($"addr{i}", (object?)sc.Address ?? DBNull.Value);
                    custBatchCmd.Parameters.AddWithValue($"trn{i}", (object?)sc.Trn ?? DBNull.Value);
                    custBatchCmd.Parameters.AddWithValue($"destid{i}", (object?)destId ?? DBNull.Value);
                    custBatchCmd.Parameters.AddWithValue($"invcount{i}", sc.InvoiceCount);
                    custBatchCmd.Parameters.AddWithValue($"delcount{i}", sc.DeletedInvoiceCount);
                    custBatchCmd.Parameters.AddWithValue($"unpaidcount{i}", sc.UnpaidInvoiceCount);
                    custBatchCmd.Parameters.AddWithValue($"unpaidamt{i}", ParseDecimal(sc.UnpaidInvoiceAmount));
                    custBatchCmd.Parameters.AddWithValue($"cachedpending{i}", ParseDecimal(sc.LedgerCachedPendingBalance));
                    custBatchCmd.Parameters.AddWithValue($"cachedbal{i}", ParseDecimal(sc.LedgerCachedBalance));
                    custBatchCmd.Parameters.AddWithValue($"approvedopening{i}", ParseDecimal(sc.UnpaidInvoiceAmount));
                }

                custSql.Append(@"
                    ON CONFLICT (""TenantId"", ""SourceSystem"", ""SourceCustomerId"") DO UPDATE SET
                        ""Name"" = EXCLUDED.""Name"",
                        ""DestinationCustomerId"" = EXCLUDED.""DestinationCustomerId"",
                        ""UnpaidInvoiceAmount"" = EXCLUDED.""UnpaidInvoiceAmount"",
                        ""ApprovedOpeningBalance"" = EXCLUDED.""ApprovedOpeningBalance"";
                ");

                custBatchCmd.CommandText = custSql.ToString();
                await custBatchCmd.ExecuteNonQueryAsync();
                custInserted = data.Customers.Count;
                Console.WriteLine($"[STAGE 1/6] Completed: {custInserted} customers saved in LegacyCustomers.");

                // 2. Process Products (Batch insert)
                Console.WriteLine("\n[STAGE 2/6] Migrating 283 Products...");
                var prodInserted = 0;
                var prodBatchSize = 100;
                for (int b = 0; b < data.Products.Count; b += prodBatchSize)
                {
                    var chunk = data.Products.GetRange(b, Math.Min(prodBatchSize, data.Products.Count - b));
                    var prodSql = new StringBuilder();
                    prodSql.Append($@"
                        INSERT INTO ""{schemaName}"".""LegacyProducts"" (
                            ""TenantId"", ""SourceProductId"", ""SourceSystem"", ""Sku"", ""NameEn"", ""NameAr"", ""UnitType"",
                            ""ConversionToBase"", ""CostPrice"", ""SellPrice"", ""StockQtyLegacy"", ""Barcode"", ""DestinationProductId"", ""CreatedAt""
                        ) VALUES ");

                    await using var prodCmd = new NpgsqlCommand();
                    prodCmd.Connection = conn;
                    prodCmd.Transaction = tx;

                    for (int i = 0; i < chunk.Count; i++)
                    {
                        var sp = chunk[i];
                        var destId = KnownProductMatches.TryGetValue(sp.SourceProductId, out var dpId) ? (int?)dpId : null;
                        if (i > 0) prodSql.Append(", ");
                        prodSql.Append($"(@tid{i}, @spid{i}, 'Starplus', @sku{i}, @nameen{i}, @namear{i}, @unit{i}, @conv{i}, @cost{i}, @sell{i}, @stock{i}, @barcode{i}, @destid{i}, NOW())");

                        prodCmd.Parameters.AddWithValue($"tid{i}", tenantId);
                        prodCmd.Parameters.AddWithValue($"spid{i}", sp.SourceProductId);
                        prodCmd.Parameters.AddWithValue($"sku{i}", sp.Sku);
                        prodCmd.Parameters.AddWithValue($"nameen{i}", sp.Name);
                        prodCmd.Parameters.AddWithValue($"namear{i}", (object?)sp.NameAr ?? DBNull.Value);
                        prodCmd.Parameters.AddWithValue($"unit{i}", sp.UnitType);
                        prodCmd.Parameters.AddWithValue($"conv{i}", ParseDecimal(sp.ConversionToBase));
                        prodCmd.Parameters.AddWithValue($"cost{i}", ParseDecimal(sp.CostPrice));
                        prodCmd.Parameters.AddWithValue($"sell{i}", ParseDecimal(sp.SellPrice));
                        prodCmd.Parameters.AddWithValue($"stock{i}", ParseDecimal(sp.StockQtyLegacy));
                        prodCmd.Parameters.AddWithValue($"barcode{i}", (object?)sp.Barcode ?? DBNull.Value);
                        prodCmd.Parameters.AddWithValue($"destid{i}", (object?)destId ?? DBNull.Value);
                    }

                    prodSql.Append(@"
                        ON CONFLICT (""TenantId"", ""SourceSystem"", ""SourceProductId"") DO UPDATE SET
                            ""NameEn"" = EXCLUDED.""NameEn"",
                            ""DestinationProductId"" = EXCLUDED.""DestinationProductId"";
                    ");

                    prodCmd.CommandText = prodSql.ToString();
                    await prodCmd.ExecuteNonQueryAsync();
                    prodInserted += chunk.Count;
                }
                Console.WriteLine($"[STAGE 2/6] Completed: {prodInserted} products saved in LegacyProducts.");

                // 3. Process Invoices (all 5,098 customer invoices + 11 unattributed = 5,109 total)
                Console.WriteLine("\n[STAGE 3/6] Migrating 5,109 Invoices...");
                var allInvoices = new List<StagingInvoice>();
                foreach (var c in data.Customers)
                {
                    allInvoices.AddRange(c.Invoices);
                }
                allInvoices.AddRange(data.UnattributedInvoices);

                Console.WriteLine($"[INFO] Total invoices collected: {allInvoices.Count}");

                var invoiceIdMap = new Dictionary<int, int>();
                var invBatchSize = 100;

                for (int b = 0; b < allInvoices.Count; b += invBatchSize)
                {
                    var chunk = allInvoices.GetRange(b, Math.Min(invBatchSize, allInvoices.Count - b));
                    var invSql = new StringBuilder();
                    invSql.Append($@"
                        INSERT INTO ""{schemaName}"".""LegacyInvoices"" (
                            ""TenantId"", ""SourceInvoiceId"", ""SourceSystem"", ""LegacyInvoiceNumber"", ""LegacyIssuer"", ""SourceLegalTaxId"",
                            ""InvoiceDate"", ""DueDate"", ""SourceCustomerId"", ""CustomerName"", ""DestinationCustomerId"", ""Status"",
                            ""IsDeleted"", ""IsFinalized"", ""IsLocked"", ""Subtotal"", ""VatTotal"", ""Discount"", ""RoundOff"",
                            ""GrandTotal"", ""TotalAmount"", ""PaidAmount"", ""OutstandingCalculated"", ""ReportedAsPending"",
                            ""HasLineItems"", ""ItemsCount"", ""PaymentsCount"", ""SourceExternalReference"", ""MigrationRunId"", ""CreatedAt""
                        ) VALUES ");

                    await using var invCmd = new NpgsqlCommand();
                    invCmd.Connection = conn;
                    invCmd.Transaction = tx;

                    for (int i = 0; i < chunk.Count; i++)
                    {
                        var inv = chunk[i];
                        var destCustId = inv.SourceCustomerId.HasValue && customerIdMapping.TryGetValue(inv.SourceCustomerId.Value, out var dcId) ? (int?)dcId : null;
                        if (i > 0) invSql.Append(", ");
                        invSql.Append($"(@tid{i}, @siid{i}, 'Starplus', @invno{i}, @issuer{i}, @taxid{i}, @invdate{i}, @duedate{i}, @scid{i}, @custname{i}, @destcustid{i}, @status{i}, @isdel{i}, @isfin{i}, @islock{i}, @subtotal{i}, @vattotal{i}, @disc{i}, @roundoff{i}, @grandtotal{i}, @totamt{i}, @paidamt{i}, @outstanding{i}, @repstatus{i}, @hasitems{i}, @itemscount{i}, @pmtscount{i}, @extref{i}, @runid{i}, NOW())");

                        invCmd.Parameters.AddWithValue($"tid{i}", tenantId);
                        invCmd.Parameters.AddWithValue($"siid{i}", inv.SourceInvoiceId);
                        invCmd.Parameters.AddWithValue($"invno{i}", inv.LegacyInvoiceNumber);
                        invCmd.Parameters.AddWithValue($"issuer{i}", inv.LegacyIssuer);
                        invCmd.Parameters.AddWithValue($"taxid{i}", inv.SourceLegalTaxId);
                        invCmd.Parameters.AddWithValue($"invdate{i}", ParseDate(inv.InvoiceDate));
                        invCmd.Parameters.AddWithValue($"duedate{i}", string.IsNullOrEmpty(inv.DueDate) ? DBNull.Value : ParseDate(inv.DueDate));
                        invCmd.Parameters.AddWithValue($"scid{i}", (object?)inv.SourceCustomerId ?? DBNull.Value);
                        invCmd.Parameters.AddWithValue($"custname{i}", (object?)inv.CustomerName ?? DBNull.Value);
                        invCmd.Parameters.AddWithValue($"destcustid{i}", (object?)destCustId ?? DBNull.Value);
                        invCmd.Parameters.AddWithValue($"status{i}", inv.Status);
                        invCmd.Parameters.AddWithValue($"isdel{i}", inv.IsDeleted);
                        invCmd.Parameters.AddWithValue($"isfin{i}", inv.IsFinalized);
                        invCmd.Parameters.AddWithValue($"islock{i}", inv.IsLocked);
                        invCmd.Parameters.AddWithValue($"subtotal{i}", ParseDecimal(inv.Subtotal));
                        invCmd.Parameters.AddWithValue($"vattotal{i}", ParseDecimal(inv.VatTotal));
                        invCmd.Parameters.AddWithValue($"disc{i}", ParseDecimal(inv.Discount));
                        invCmd.Parameters.AddWithValue($"roundoff{i}", ParseDecimal(inv.RoundOff));
                        invCmd.Parameters.AddWithValue($"grandtotal{i}", ParseDecimal(inv.GrandTotal));
                        invCmd.Parameters.AddWithValue($"totamt{i}", ParseDecimal(inv.TotalAmount));
                        invCmd.Parameters.AddWithValue($"paidamt{i}", ParseDecimal(inv.PaidAmount));
                        invCmd.Parameters.AddWithValue($"outstanding{i}", ParseDecimal(inv.OutstandingCalculated));
                        invCmd.Parameters.AddWithValue($"repstatus{i}", inv.ReportedAsPending20261031);
                        invCmd.Parameters.AddWithValue($"hasitems{i}", inv.Items.Count > 0);
                        invCmd.Parameters.AddWithValue($"itemscount{i}", inv.Items.Count);
                        invCmd.Parameters.AddWithValue($"pmtscount{i}", inv.Payments.Count);
                        invCmd.Parameters.AddWithValue($"extref{i}", (object?)inv.SourceExternalReference ?? DBNull.Value);
                        invCmd.Parameters.AddWithValue($"runid{i}", runId);
                    }

                    invSql.Append(@"
                        ON CONFLICT (""TenantId"", ""SourceSystem"", ""SourceInvoiceId"") DO UPDATE SET
                            ""PaidAmount"" = EXCLUDED.""PaidAmount"",
                            ""OutstandingCalculated"" = EXCLUDED.""OutstandingCalculated"",
                            ""Status"" = EXCLUDED.""Status"",
                            ""ReportedAsPending"" = EXCLUDED.""ReportedAsPending"",
                            ""DestinationCustomerId"" = EXCLUDED.""DestinationCustomerId""
                        RETURNING ""Id"", ""SourceInvoiceId"";
                    ");

                    invCmd.CommandText = invSql.ToString();
                    await using var reader = await invCmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        invoiceIdMap[reader.GetInt32(1)] = reader.GetInt32(0);
                    }

                    if ((b + chunk.Count) % 1000 == 0 || (b + chunk.Count) == allInvoices.Count)
                    {
                        Console.WriteLine($"  -> Invoices progress: {b + chunk.Count} / {allInvoices.Count}");
                    }
                }
                Console.WriteLine($"[STAGE 3/6] Completed: {allInvoices.Count} invoices saved in LegacyInvoices.");

                // 4. Process Invoice Items (Batch insert)
                Console.WriteLine("\n[STAGE 4/6] Migrating 10,627 Invoice Items...");
                var allItems = new List<(int legacyInvId, StagingItem item)>();
                foreach (var inv in allInvoices)
                {
                    if (invoiceIdMap.TryGetValue(inv.SourceInvoiceId, out var legacyInvId))
                    {
                        foreach (var item in inv.Items)
                        {
                            allItems.Add((legacyInvId, item));
                        }
                    }
                }

                Console.WriteLine($"[INFO] Total items to insert: {allItems.Count}");
                var itemBatchSize = 150;
                for (int b = 0; b < allItems.Count; b += itemBatchSize)
                {
                    var chunk = allItems.GetRange(b, Math.Min(itemBatchSize, allItems.Count - b));
                    var itemSql = new StringBuilder();
                    itemSql.Append($@"
                        INSERT INTO ""{schemaName}"".""LegacyInvoiceItems"" (
                            ""TenantId"", ""LegacyInvoiceId"", ""SourceItemId"", ""SourceSystem"", ""SourceProductId"", ""DestinationProductId"",
                            ""Sku"", ""ProductName"", ""UnitType"", ""Quantity"", ""UnitPrice"", ""Discount"", ""VatAmount"", ""LineTotal"", ""CreatedAt""
                        ) VALUES ");

                    await using var itemCmd = new NpgsqlCommand();
                    itemCmd.Connection = conn;
                    itemCmd.Transaction = tx;

                    for (int i = 0; i < chunk.Count; i++)
                    {
                        var (legInvId, item) = chunk[i];
                        var destProdId = item.SourceProductId.HasValue && KnownProductMatches.TryGetValue(item.SourceProductId.Value, out var dpId) ? (int?)dpId : null;
                        if (i > 0) itemSql.Append(", ");
                        itemSql.Append($"(@tid{i}, @invid{i}, @itemid{i}, 'Starplus', @spid{i}, @destpid{i}, @sku{i}, @pname{i}, @unit{i}, @qty{i}, @price{i}, @disc{i}, @vat{i}, @total{i}, NOW())");

                        itemCmd.Parameters.AddWithValue($"tid{i}", tenantId);
                        itemCmd.Parameters.AddWithValue($"invid{i}", legInvId);
                        itemCmd.Parameters.AddWithValue($"itemid{i}", item.SourceItemId);
                        itemCmd.Parameters.AddWithValue($"spid{i}", (object?)item.SourceProductId ?? DBNull.Value);
                        itemCmd.Parameters.AddWithValue($"destpid{i}", (object?)destProdId ?? DBNull.Value);
                        itemCmd.Parameters.AddWithValue($"sku{i}", (object?)item.Sku ?? DBNull.Value);
                        itemCmd.Parameters.AddWithValue($"pname{i}", item.ProductName);
                        itemCmd.Parameters.AddWithValue($"unit{i}", item.UnitType);
                        itemCmd.Parameters.AddWithValue($"qty{i}", ParseDecimal(item.Quantity));
                        itemCmd.Parameters.AddWithValue($"price{i}", ParseDecimal(item.UnitPrice));
                        itemCmd.Parameters.AddWithValue($"disc{i}", ParseDecimal(item.Discount));
                        itemCmd.Parameters.AddWithValue($"vat{i}", ParseDecimal(item.VatAmount));
                        itemCmd.Parameters.AddWithValue($"total{i}", ParseDecimal(item.LineTotal));
                    }

                    itemSql.Append(@" ON CONFLICT (""TenantId"", ""SourceSystem"", ""SourceItemId"") DO NOTHING;");
                    itemCmd.CommandText = itemSql.ToString();
                    await itemCmd.ExecuteNonQueryAsync();

                    if ((b + chunk.Count) % 3000 == 0 || (b + chunk.Count) == allItems.Count)
                    {
                        Console.WriteLine($"  -> Line items progress: {b + chunk.Count} / {allItems.Count}");
                    }
                }
                Console.WriteLine($"[STAGE 4/6] Completed: {allItems.Count} line items saved in LegacyInvoiceItems.");

                // 5. Process Payments (Batch insert)
                Console.WriteLine("\n[STAGE 5/6] Migrating 5,330 Payments...");
                var allPayments = new List<(int? legacyInvId, int? srcCustId, int? destCustId, StagingPayment pmt)>();
                foreach (var inv in allInvoices)
                {
                    invoiceIdMap.TryGetValue(inv.SourceInvoiceId, out var legInvId);
                    var destCustId = inv.SourceCustomerId.HasValue && customerIdMapping.TryGetValue(inv.SourceCustomerId.Value, out var dcId) ? (int?)dcId : null;

                    foreach (var pmt in inv.Payments)
                    {
                        allPayments.Add((legInvId > 0 ? (int?)legInvId : null, inv.SourceCustomerId, destCustId, pmt));
                    }
                }

                Console.WriteLine($"[INFO] Total payments to insert: {allPayments.Count}");
                var pmtBatchSize = 150;
                for (int b = 0; b < allPayments.Count; b += pmtBatchSize)
                {
                    var chunk = allPayments.GetRange(b, Math.Min(pmtBatchSize, allPayments.Count - b));
                    var pmtSql = new StringBuilder();
                    pmtSql.Append($@"
                        INSERT INTO ""{schemaName}"".""LegacyPayments"" (
                            ""TenantId"", ""LegacyInvoiceId"", ""SourcePaymentId"", ""SourceSystem"", ""SourceCustomerId"", ""DestinationCustomerId"",
                            ""Amount"", ""Mode"", ""Status"", ""PaymentDate"", ""Reference"", ""MigrationRunId"", ""CreatedAt""
                        ) VALUES ");

                    await using var pmtCmd = new NpgsqlCommand();
                    pmtCmd.Connection = conn;
                    pmtCmd.Transaction = tx;

                    for (int i = 0; i < chunk.Count; i++)
                    {
                        var (legInvId, srcCustId, destCustId, pmt) = chunk[i];
                        if (i > 0) pmtSql.Append(", ");
                        pmtSql.Append($"(@tid{i}, @invid{i}, @pmtid{i}, 'Starplus', @scid{i}, @destcid{i}, @amt{i}, @mode{i}, @status{i}, @pdate{i}, @ref{i}, @runid{i}, NOW())");

                        pmtCmd.Parameters.AddWithValue($"tid{i}", tenantId);
                        pmtCmd.Parameters.AddWithValue($"invid{i}", (object?)legInvId ?? DBNull.Value);
                        pmtCmd.Parameters.AddWithValue($"pmtid{i}", pmt.SourcePaymentId);
                        pmtCmd.Parameters.AddWithValue($"scid{i}", (object?)srcCustId ?? DBNull.Value);
                        pmtCmd.Parameters.AddWithValue($"destcid{i}", (object?)destCustId ?? DBNull.Value);
                        pmtCmd.Parameters.AddWithValue($"amt{i}", ParseDecimal(pmt.Amount));
                        pmtCmd.Parameters.AddWithValue($"mode{i}", pmt.Mode);
                        pmtCmd.Parameters.AddWithValue($"status{i}", pmt.Status);
                        pmtCmd.Parameters.AddWithValue($"pdate{i}", ParseDate(pmt.PaymentDate));
                        pmtCmd.Parameters.AddWithValue($"ref{i}", (object?)pmt.Reference ?? DBNull.Value);
                        pmtCmd.Parameters.AddWithValue($"runid{i}", runId);
                    }

                    pmtSql.Append(@"
                        ON CONFLICT (""TenantId"", ""SourceSystem"", ""SourcePaymentId"") DO UPDATE SET
                            ""Status"" = EXCLUDED.""Status"",
                            ""Amount"" = EXCLUDED.""Amount"";
                    ");

                    pmtCmd.CommandText = pmtSql.ToString();
                    await pmtCmd.ExecuteNonQueryAsync();

                    if ((b + chunk.Count) % 2000 == 0 || (b + chunk.Count) == allPayments.Count)
                    {
                        Console.WriteLine($"  -> Payments progress: {b + chunk.Count} / {allPayments.Count}");
                    }
                }
                Console.WriteLine($"[STAGE 5/6] Completed: {allPayments.Count} payments saved in LegacyPayments.");

                // 6. Process Approved Opening Receivables
                Console.WriteLine("\n[STAGE 6/6] Establishing Approved Opening Receivables...");
                var openingReceivablesCount = 0;
                decimal totalOpeningAR = 0m;

                foreach (var sc in data.Customers)
                {
                    var unpaid = ParseDecimal(sc.UnpaidInvoiceAmount);
                    if (unpaid > 0.005m)
                    {
                        int? destCustId = customerIdMapping.TryGetValue(sc.SourceCustomerId, out var dcId) ? dcId : null;

                        await using var cmd = new NpgsqlCommand($@"
                            INSERT INTO ""{schemaName}"".""LegacyOpeningReceivables"" (
                                ""TenantId"", ""SourceCustomerId"", ""DestinationCustomerId"", ""SourceSystem"", ""OpeningBalance"", ""ReconciledInvoicesCount"", ""CutoffDate"", ""ApprovedAt"", ""ApprovedBy"", ""Notes""
                            )
                            VALUES (
                                @tid, @scid, @dcid, 'Starplus', @balance, @count, '2026-10-31 13:45:00+00', NOW(), 34, @notes
                            )
                            ON CONFLICT (""TenantId"", ""SourceCustomerId"", ""SourceSystem"") DO UPDATE SET
                                ""DestinationCustomerId"" = EXCLUDED.""DestinationCustomerId"",
                                ""OpeningBalance"" = EXCLUDED.""OpeningBalance"",
                                ""ReconciledInvoicesCount"" = EXCLUDED.""ReconciledInvoicesCount"",
                                ""Notes"" = EXCLUDED.""Notes"";
                        ", conn, tx);

                        cmd.Parameters.AddWithValue("tid", tenantId);
                        cmd.Parameters.AddWithValue("scid", sc.SourceCustomerId);
                        cmd.Parameters.AddWithValue("dcid", (object?)destCustId ?? DBNull.Value);
                        cmd.Parameters.AddWithValue("balance", unpaid);
                        cmd.Parameters.AddWithValue("count", sc.UnpaidInvoiceCount);
                        cmd.Parameters.AddWithValue("notes", $"Reconciled opening balance from Starplus cutover. Source customer {sc.SourceCustomerId} ({sc.Name}).");

                        await cmd.ExecuteNonQueryAsync();
                        openingReceivablesCount++;
                        totalOpeningAR += unpaid;
                    }
                }
                Console.WriteLine($"[STAGE 6/6] Completed: {openingReceivablesCount} customer opening receivables registered (Total: AED {totalOpeningAR:N2}).");

                // Update MigrationRun record
                await using (var cmd = new NpgsqlCommand($@"
                    UPDATE ""{schemaName}"".""MigrationRuns"" SET
                        ""Status"" = @status,
                        ""CompletedAt"" = NOW(),
                        ""TotalCustomers"" = @tc,
                        ""TotalProducts"" = @tp,
                        ""TotalInvoices"" = @ti,
                        ""TotalItems"" = @tit,
                        ""TotalPayments"" = @tpmt,
                        ""TotalOutstanding"" = @tout,
                        ""AuditSummary"" = @audit
                    WHERE ""Id"" = @id;
                ", conn, tx))
                {
                    cmd.Parameters.AddWithValue("id", runId);
                    cmd.Parameters.AddWithValue("status", isRehearsal ? "REHEARSAL_SUCCESS" : "COMPLETED");
                    cmd.Parameters.AddWithValue("tc", custInserted);
                    cmd.Parameters.AddWithValue("tp", prodInserted);
                    cmd.Parameters.AddWithValue("ti", allInvoices.Count);
                    cmd.Parameters.AddWithValue("tit", allItems.Count);
                    cmd.Parameters.AddWithValue("tpmt", allPayments.Count);
                    cmd.Parameters.AddWithValue("tout", totalOpeningAR);
                    cmd.Parameters.AddWithValue("audit", $"Completed at {DateTime.UtcNow:O}. Schema: {schemaName}, Tenant: {tenantId}.");
                    await cmd.ExecuteNonQueryAsync();
                }

                await tx.CommitAsync();
                sw.Stop();

                Console.WriteLine($"\n[SUCCESS] Transaction committed successfully in {sw.Elapsed.TotalSeconds:N1}s!");

                return new MigrationResult
                {
                    RunId = runId,
                    CustomersInserted = custInserted,
                    ProductsInserted = prodInserted,
                    InvoicesInserted = allInvoices.Count,
                    ItemsInserted = allItems.Count,
                    PaymentsInserted = allPayments.Count,
                    TotalOutstanding = totalOpeningAR,
                    Elapsed = sw.Elapsed
                };
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                Console.WriteLine($"\n[ROLLBACK] Transaction rolled back due to error: {ex.Message}");
                throw;
            }
        }

        private static void pmmtSqlAppend(string s) { }
    }
}
