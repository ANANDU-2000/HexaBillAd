using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Npgsql;

namespace StarplusMigrationRunner
{
    public static class AllDomainAuditor
    {
        public static async Task<int> RunAllDomainAuditAsync(NpgsqlConnection conn, string outputDir)
        {
            Directory.CreateDirectory(outputDir);
            Console.WriteLine("================================================================================");
            Console.WriteLine("[ALL-DOMAIN AUDITOR] Starting Comprehensive End-to-End Audit & Reconciliation");
            Console.WriteLine($"Output Directory: {outputDir}");
            Console.WriteLine("================================================================================\n");

            // -------------------------------------------------------------------------
            // DOMAIN 1: BASELINE QUERY VERIFICATION
            // -------------------------------------------------------------------------
            Console.WriteLine("[DOMAIN 1] Querying Live Database Baselines (Tenant 20 - FrozenHub 1)...");

            int legCustCount = await QueryIntAsync(conn, "SELECT COUNT(*) FROM \"public\".\"LegacyCustomers\" WHERE \"TenantId\" = 20;");
            int legProdCount = await QueryIntAsync(conn, "SELECT COUNT(*) FROM \"public\".\"LegacyProducts\" WHERE \"TenantId\" = 20;");
            int legInvTotal = await QueryIntAsync(conn, "SELECT COUNT(*) FROM \"public\".\"LegacyInvoices\" WHERE \"TenantId\" = 20;");
            int legInvActive = await QueryIntAsync(conn, "SELECT COUNT(*) FROM \"public\".\"LegacyInvoices\" WHERE \"TenantId\" = 20 AND \"IsDeleted\" = false;");
            int legInvDeleted = await QueryIntAsync(conn, "SELECT COUNT(*) FROM \"public\".\"LegacyInvoices\" WHERE \"TenantId\" = 20 AND \"IsDeleted\" = true;");
            int legItemsCount = await QueryIntAsync(conn, "SELECT COUNT(*) FROM \"public\".\"LegacyInvoiceItems\" WHERE \"TenantId\" = 20;");
            int legPayTotal = await QueryIntAsync(conn, "SELECT COUNT(*) FROM \"public\".\"LegacyPayments\" WHERE \"TenantId\" = 20;");
            int legPayCleared = await QueryIntAsync(conn, "SELECT COUNT(*) FROM \"public\".\"LegacyPayments\" WHERE \"TenantId\" = 20 AND LOWER(\"Status\") = 'cleared';");
            int legPayPending = await QueryIntAsync(conn, "SELECT COUNT(*) FROM \"public\".\"LegacyPayments\" WHERE \"TenantId\" = 20 AND LOWER(\"Status\") = 'pending';");
            int legPurCount = await QueryIntAsync(conn, "SELECT COUNT(*) FROM \"public\".\"LegacyPurchases\" WHERE \"TenantId\" = 20;");
            int legPurItemsCount = await QueryIntAsync(conn, "SELECT COUNT(*) FROM \"public\".\"LegacyPurchaseItems\" WHERE \"TenantId\" = 20;");
            int legExpCatsCount = await QueryIntAsync(conn, "SELECT COUNT(*) FROM \"public\".\"LegacyExpenseCategories\" WHERE \"TenantId\" = 20;");
            int legExpCount = await QueryIntAsync(conn, "SELECT COUNT(*) FROM \"public\".\"LegacyExpenses\" WHERE \"TenantId\" = 20;");
            int legInvTxCount = await QueryIntAsync(conn, "SELECT COUNT(*) FROM \"public\".\"LegacyInventoryTransactions\" WHERE \"TenantId\" = 20;");

            decimal legInvGrandTotal = await QueryDecimalAsync(conn, "SELECT COALESCE(SUM(\"GrandTotal\"), 0) FROM \"public\".\"LegacyInvoices\" WHERE \"TenantId\" = 20 AND \"IsDeleted\" = false;");
            decimal legInvPaidAmount = await QueryDecimalAsync(conn, "SELECT COALESCE(SUM(\"PaidAmount\"), 0) FROM \"public\".\"LegacyInvoices\" WHERE \"TenantId\" = 20 AND \"IsDeleted\" = false;");
            decimal legPurTotal = await QueryDecimalAsync(conn, "SELECT COALESCE(SUM(\"TotalAmount\"), 0) FROM \"public\".\"LegacyPurchases\" WHERE \"TenantId\" = 20;");
            decimal legPurVat = await QueryDecimalAsync(conn, "SELECT COALESCE(SUM(\"VatTotal\"), 0) FROM \"public\".\"LegacyPurchases\" WHERE \"TenantId\" = 20;");
            decimal legPurSubtotal = await QueryDecimalAsync(conn, "SELECT COALESCE(SUM(\"Subtotal\"), 0) FROM \"public\".\"LegacyPurchases\" WHERE \"TenantId\" = 20;");

            decimal legExpAmount = await QueryDecimalAsync(conn, "SELECT COALESCE(SUM(\"Amount\"), 0) FROM \"public\".\"LegacyExpenses\" WHERE \"TenantId\" = 20;");
            decimal legExpVat = await QueryDecimalAsync(conn, "SELECT COALESCE(SUM(\"VatAmount\"), 0) FROM \"public\".\"LegacyExpenses\" WHERE \"TenantId\" = 20;");
            int legExpNullTotal = await QueryIntAsync(conn, "SELECT COUNT(*) FROM \"public\".\"LegacyExpenses\" WHERE \"TenantId\" = 20 AND \"TotalAmount\" IS NULL;");

            Console.WriteLine($"  LegacyCustomers:               {legCustCount,6} (Expected: 81)   -> {(legCustCount == 81 ? "PASS" : "FAIL")}");
            Console.WriteLine($"  LegacyProducts:                {legProdCount,6} (Expected: 283)  -> {(legProdCount == 283 ? "PASS" : "FAIL")}");
            Console.WriteLine($"  LegacyInvoices Total:          {legInvTotal,6} (Expected: 5109) -> {(legInvTotal == 5109 ? "PASS" : "FAIL")}");
            Console.WriteLine($"    Active:                      {legInvActive,6} (Expected: 4916) -> {(legInvActive == 4916 ? "PASS" : "FAIL")}");
            Console.WriteLine($"    Deleted:                     {legInvDeleted,6} (Expected: 193)  -> {(legInvDeleted == 193 ? "PASS" : "FAIL")}");
            Console.WriteLine($"  LegacyInvoiceItems:            {legItemsCount,6} (Expected: 10627)-> {(legItemsCount == 10627 ? "PASS" : "FAIL")}");
            Console.WriteLine($"  LegacyPayments Total:          {legPayTotal,6} (Expected: 5330) -> {(legPayTotal == 5330 ? "PASS" : "FAIL")}");
            Console.WriteLine($"    Cleared:                     {legPayCleared,6} (Expected: 5325) -> {(legPayCleared == 5325 ? "PASS" : "FAIL")}");
            Console.WriteLine($"    Pending:                     {legPayPending,6} (Expected: 5)    -> {(legPayPending == 5 ? "PASS" : "FAIL")}");
            Console.WriteLine($"  LegacyPurchases:               {legPurCount,6} (Expected: 1563) -> {(legPurCount == 1563 ? "PASS" : "FAIL")}");
            Console.WriteLine($"  LegacyPurchaseItems:           {legPurItemsCount,6} (Expected: 7217) -> {(legPurItemsCount == 7217 ? "PASS" : "FAIL")}");
            Console.WriteLine($"  LegacyExpenseCategories:       {legExpCatsCount,6} (Expected: 10)   -> {(legExpCatsCount == 10 ? "PASS" : "FAIL")}");
            Console.WriteLine($"  LegacyExpenses:                {legExpCount,6} (Expected: 242)  -> {(legExpCount == 242 ? "PASS" : "FAIL")}");
            Console.WriteLine($"  LegacyInventoryTransactions:   {legInvTxCount,6} (Expected: 23237)-> {(legInvTxCount == 23237 ? "PASS" : "FAIL")}");
            Console.WriteLine($"  Active Invoices GrandTotal:    AED {legInvGrandTotal,12:N2} (Expected: AED 3,817,356.88)");
            Console.WriteLine($"  Active Invoices PaidAmount:    AED {legInvPaidAmount,12:N2} (Expected: AED 3,747,182.98)");
            Console.WriteLine($"  Purchases Total:               AED {legPurTotal,12:N2} (Expected: AED 3,520,385.92)");
            Console.WriteLine($"  Purchases Subtotal:            AED {legPurSubtotal,12:N2}");
            Console.WriteLine($"  Purchases VAT:                 AED {legPurVat,12:N2}");
            Console.WriteLine($"  Expenses Base Amount:          AED {legExpAmount,12:N2} (Expected: AED 14,239.00)");
            Console.WriteLine($"  Expenses Recorded VAT:         AED {legExpVat,12:N2} (Expected: AED 7.50)");
            Console.WriteLine($"  Expenses Null TotalAmount:     {legExpNullTotal,6} (Expected: 232)");

            // -------------------------------------------------------------------------
            // OPERATING DATA BASELINES (TENANT 20 & TENANT 23)
            // -------------------------------------------------------------------------
            Console.WriteLine("\n[DOMAIN 1b] Querying Operating Baselines...");
            int opSalesCount = await QueryIntAsync(conn, "SELECT COUNT(*) FROM \"public\".\"Sales\" WHERE \"TenantId\" = 20;");
            int opPurchasesCount = await QueryIntAsync(conn, "SELECT COUNT(*) FROM \"public\".\"Purchases\" WHERE \"TenantId\" = 20;");
            decimal opPurchasesTotal = await QueryDecimalAsync(conn, "SELECT COALESCE(SUM(\"TotalAmount\"), 0) FROM \"public\".\"Purchases\" WHERE \"TenantId\" = 20;");
            int opSuppPaymentsCount = await QueryIntAsync(conn, "SELECT COUNT(*) FROM \"public\".\"SupplierPayments\" WHERE \"TenantId\" = 20;");
            decimal opSuppPaymentsTotal = await QueryDecimalAsync(conn, "SELECT COALESCE(SUM(\"Amount\"), 0) FROM \"public\".\"SupplierPayments\" WHERE \"TenantId\" = 20;");
            int opExpensesCount = await QueryIntAsync(conn, "SELECT COUNT(*) FROM \"public\".\"Expenses\" WHERE \"TenantId\" = 20;");
            int t20ProdCount = await QueryIntAsync(conn, "SELECT COUNT(*) FROM \"public\".\"Products\" WHERE \"TenantId\" = 20;");
            int t23ProdCount = await QueryIntAsync(conn, "SELECT COUNT(*) FROM \"public\".\"Products\" WHERE \"TenantId\" = 23;");

            Console.WriteLine($"  Tenant 20 Operating Sales:             {opSalesCount}");
            Console.WriteLine($"  Tenant 20 Operating Purchases:         {opPurchasesCount} (Total: AED {opPurchasesTotal:N2})");
            Console.WriteLine($"  Tenant 20 Operating Supplier Payments: {opSuppPaymentsCount} (Total: AED {opSuppPaymentsTotal:N2})");
            Console.WriteLine($"  Tenant 20 Operating Expenses:          {opExpensesCount}");
            Console.WriteLine($"  Tenant 20 Operating Products:          {t20ProdCount}");
            Console.WriteLine($"  Tenant 23 Operating Products:          {t23ProdCount}");

            // -------------------------------------------------------------------------
            // DOMAIN 2 & 3: EXPENSE AUDIT & CSVS
            // -------------------------------------------------------------------------
            Console.WriteLine("\n[DOMAIN 2 & 3] Auditing All 242 Historical Expenses & Generating CSVs...");
            await AuditExpensesAsync(conn, outputDir);

            // -------------------------------------------------------------------------
            // DOMAIN 4: PURCHASES AUDIT & CSVS
            // -------------------------------------------------------------------------
            Console.WriteLine("\n[DOMAIN 4] Auditing All 1,563 Historical Purchases & 7,217 Items...");
            await AuditPurchasesAsync(conn, outputDir);

            // -------------------------------------------------------------------------
            // DOMAIN 5: SUPPLIER PAYMENTS & FIFO AS-OF CUTOFF
            // -------------------------------------------------------------------------
            Console.WriteLine("\n[DOMAIN 5] Auditing Operating Supplier Payments & FIFO Allocation...");
            await AuditSupplierPaymentsAsync(conn, outputDir);

            // -------------------------------------------------------------------------
            // DOMAIN 6: FROZENHUB 2 PRODUCT CATALOGUE PREVIEW
            // -------------------------------------------------------------------------
            Console.WriteLine("\n[DOMAIN 6] Analyzing Product Catalogues for FrozenHub 2 (Tenant 23)...");
            await AuditProductsForTenant23Async(conn, outputDir);

            Console.WriteLine("\n================================================================================");
            Console.WriteLine("[ALL-DOMAIN AUDITOR] Audit Completed Successfully!");
            Console.WriteLine("================================================================================\n");
            return 0;
        }

        private static async Task AuditExpensesAsync(NpgsqlConnection conn, string outputDir)
        {
            var reconCsv = new StringBuilder();
            reconCsv.AppendLine("SourceExpenseId,SourceCategoryId,CategoryName,DateUtc,DateDubai,Amount,VatRate,VatAmount,TotalAmountDerived,TaxType,IsClaimable,IsEntertainment,Note,AuditStatus,AuditNotes");

            var dateCsv = new StringBuilder();
            dateCsv.AppendLine("Month,ExpenseCount,BaseAmountSum,VatAmountSum,TotalAmountSum");

            var catCsv = new StringBuilder();
            catCsv.AppendLine("SourceCategoryId,CategoryName,ExpenseCount,BaseAmountSum,VatAmountSum");

            var monthlyStats = new SortedDictionary<string, (int Count, decimal Base, decimal Vat)>();
            var catStats = new Dictionary<string, (int CatId, int Count, decimal Base, decimal Vat)>();

            var dubaiTz = TimeZoneInfo.FindSystemTimeZoneById("Asia/Dubai");

            await using (var cmd = new NpgsqlCommand(@"
                SELECT ""SourceExpenseId"", ""SourceCategoryId"", ""CategoryName"", ""Date"", ""Amount"", ""VatRate"", ""VatAmount"", ""TotalAmount"", ""TaxType"", ""IsTaxClaimable"", ""IsEntertainment"", ""Note"", ""CreatedAt""
                FROM ""public"".""LegacyExpenses""
                WHERE ""TenantId"" = 20
                ORDER BY ""Date"" ASC, ""SourceExpenseId"" ASC;
            ", conn))
            {
                await using var r = await cmd.ExecuteReaderAsync();
                int audited = 0;
                while (await r.ReadAsync())
                {
                    audited++;
                    var srcExpId = Convert.ToInt32(r["SourceExpenseId"]);
                    var srcCatId = Convert.ToInt32(r["SourceCategoryId"]);
                    var catName = r["CategoryName"]?.ToString() ?? "Uncategorized";
                    var dateUtc = Convert.ToDateTime(r["Date"]);
                    var dateDubai = TimeZoneInfo.ConvertTimeFromUtc(dateUtc, dubaiTz);
                    var amount = Convert.ToDecimal(r["Amount"]);
                    var vatRate = r["VatRate"] == DBNull.Value ? 0m : Convert.ToDecimal(r["VatRate"]);
                    var vatAmount = r["VatAmount"] == DBNull.Value ? 0m : Convert.ToDecimal(r["VatAmount"]);
                    var rawTotal = r["TotalAmount"] == DBNull.Value ? (decimal?)null : Convert.ToDecimal(r["TotalAmount"]);
                    var totalDerived = rawTotal ?? (amount + vatAmount);
                    var taxType = r["TaxType"]?.ToString() ?? "Standard";
                    var isClaimable = r["IsTaxClaimable"] != DBNull.Value && Convert.ToBoolean(r["IsTaxClaimable"]);
                    var isEnt = r["IsEntertainment"] != DBNull.Value && Convert.ToBoolean(r["IsEntertainment"]);
                    var note = r["Note"]?.ToString() ?? "";

                    var status = "PASS";
                    var auditNotes = new List<string>();
                    if (rawTotal == null)
                    {
                        auditNotes.Add("Source TotalAmount null - derived as Amount + VatAmount");
                    }
                    if (amount <= 0)
                    {
                        status = "REVIEW_REQUIRED";
                        auditNotes.Add("Non-positive amount");
                    }

                    reconCsv.AppendLine($"{srcExpId},{srcCatId},\"{EscapeCsv(catName)}\",{dateUtc:yyyy-MM-dd HH:mm:ss},{dateDubai:yyyy-MM-dd HH:mm:ss},{amount:F2},{vatRate:F4},{vatAmount:F2},{totalDerived:F2},{taxType},{isClaimable},{isEnt},\"{EscapeCsv(note)}\",{status},\"{string.Join("; ", auditNotes)}\"");

                    var monthKey = dateDubai.ToString("yyyy-MM");
                    if (!monthlyStats.ContainsKey(monthKey)) monthlyStats[monthKey] = (0, 0m, 0m);
                    var m = monthlyStats[monthKey];
                    monthlyStats[monthKey] = (m.Count + 1, m.Base + amount, m.Vat + vatAmount);

                    if (!catStats.ContainsKey(catName)) catStats[catName] = (srcCatId, 0, 0m, 0m);
                    var c = catStats[catName];
                    catStats[catName] = (srcCatId, c.Count + 1, c.Base + amount, c.Vat + vatAmount);
                }
                Console.WriteLine($"  Audited {audited} Expense records.");
            }

            foreach (var kvp in monthlyStats)
            {
                dateCsv.AppendLine($"{kvp.Key},{kvp.Value.Count},{kvp.Value.Base:F2},{kvp.Value.Vat:F2},{(kvp.Value.Base + kvp.Value.Vat):F2}");
                Console.WriteLine($"    Month {kvp.Key}: {kvp.Value.Count,3} expenses, Base: AED {kvp.Value.Base,10:N2}, VAT: AED {kvp.Value.Vat,6:N2}");
            }

            foreach (var kvp in catStats.OrderByDescending(x => x.Value.Base))
            {
                catCsv.AppendLine($"{kvp.Value.CatId},\"{EscapeCsv(kvp.Key)}\",{kvp.Value.Count},{kvp.Value.Base:F2},{kvp.Value.Vat:F2}");
            }

            File.WriteAllText(Path.Combine(outputDir, "EXPENSE-RECONCILIATION.csv"), reconCsv.ToString());
            File.WriteAllText(Path.Combine(outputDir, "EXPENSE-DATE-AUDIT.csv"), dateCsv.ToString());
            File.WriteAllText(Path.Combine(outputDir, "EXPENSE-CATEGORY-AUDIT.csv"), catCsv.ToString());
            Console.WriteLine($"  Saved EXPENSE-RECONCILIATION.csv, EXPENSE-DATE-AUDIT.csv, EXPENSE-CATEGORY-AUDIT.csv in {outputDir}");
        }

        private static async Task AuditPurchasesAsync(NpgsqlConnection conn, string outputDir)
        {
            var purCsv = new StringBuilder();
            purCsv.AppendLine("SourcePurchaseId,InvoiceNo,SupplierName,PurchaseDateDubai,SubTotal,VatAmount,TotalAmount,ExpenseCategory,SourceStatus,DerivedStatus");

            var itemsCsv = new StringBuilder();
            itemsCsv.AppendLine("SourcePurchaseItemId,SourcePurchaseId,ProductName,Quantity,UnitCost,Subtotal,VatAmount,Total");

            var monthlyPurchases = new SortedDictionary<string, (int Count, decimal Subtotal, decimal Vat, decimal Total)>();
            var dubaiTz = TimeZoneInfo.FindSystemTimeZoneById("Asia/Dubai");

            await using (var cmd = new NpgsqlCommand(@"
                SELECT ""SourcePurchaseId"", ""InvoiceNo"", ""SupplierName"", ""PurchaseDate"", ""Subtotal"", ""VatTotal"", ""TotalAmount"", ""ExpenseCategory""
                FROM ""public"".""LegacyPurchases""
                WHERE ""TenantId"" = 20
                ORDER BY ""PurchaseDate"" ASC, ""SourcePurchaseId"" ASC;
            ", conn))
            {
                await using var r = await cmd.ExecuteReaderAsync();
                int count = 0;
                while (await r.ReadAsync())
                {
                    count++;
                    var srcPurId = Convert.ToInt32(r["SourcePurchaseId"]);
                    var invNo = r["InvoiceNo"]?.ToString() ?? "";
                    var supp = r["SupplierName"]?.ToString() ?? "";
                    var dtUtc = Convert.ToDateTime(r["PurchaseDate"]);
                    var dtDubai = TimeZoneInfo.ConvertTimeFromUtc(dtUtc, dubaiTz);
                    var sub = r["Subtotal"] == DBNull.Value ? 0m : Convert.ToDecimal(r["Subtotal"]);
                    var vat = r["VatTotal"] == DBNull.Value ? 0m : Convert.ToDecimal(r["VatTotal"]);
                    var tot = Convert.ToDecimal(r["TotalAmount"]);
                    var cat = r["ExpenseCategory"]?.ToString() ?? "";

                    purCsv.AppendLine($"{srcPurId},\"{EscapeCsv(invNo)}\",\"{EscapeCsv(supp)}\",{dtDubai:yyyy-MM-dd HH:mm:ss},{sub:F2},{vat:F2},{tot:F2},\"{EscapeCsv(cat)}\",\"Unspecified\",\"Historical Status Unavailable\"");

                    var mKey = dtDubai.ToString("yyyy-MM");
                    if (!monthlyPurchases.ContainsKey(mKey)) monthlyPurchases[mKey] = (0, 0m, 0m, 0m);
                    var mp = monthlyPurchases[mKey];
                    monthlyPurchases[mKey] = (mp.Count + 1, mp.Subtotal + sub, mp.Vat + vat, mp.Total + tot);
                }
                Console.WriteLine($"  Audited {count} LegacyPurchases records.");
            }

            foreach (var kvp in monthlyPurchases)
            {
                Console.WriteLine($"    Month {kvp.Key}: {kvp.Value.Count,4} purchases, Subtotal: AED {kvp.Value.Subtotal,12:N2}, VAT: AED {kvp.Value.Vat,10:N2}, Total: AED {kvp.Value.Total,12:N2}");
            }

            await using (var cmd = new NpgsqlCommand(@"
                SELECT pi.""SourceItemId"", pi.""SourcePurchaseId"", COALESCE(lp.""NameEn"", 'Product #' || pi.""SourceProductId"") as ProductName, pi.""Qty"", pi.""UnitCost"", pi.""LineTotal"", pi.""VatAmount"", pi.""UnitType""
                FROM ""public"".""LegacyPurchaseItems"" pi
                LEFT JOIN ""public"".""LegacyProducts"" lp ON pi.""SourceProductId"" = lp.""SourceProductId"" AND pi.""TenantId"" = lp.""TenantId""
                WHERE pi.""TenantId"" = 20
                ORDER BY pi.""SourcePurchaseId"" ASC, pi.""SourceItemId"" ASC;
            ", conn))
            {
                await using var r = await cmd.ExecuteReaderAsync();
                int itemCount = 0;
                while (await r.ReadAsync())
                {
                    itemCount++;
                    var srcItemId = Convert.ToInt32(r["SourceItemId"]);
                    var srcPurId = Convert.ToInt32(r["SourcePurchaseId"]);
                    var pName = r["ProductName"]?.ToString() ?? "";
                    var qty = Convert.ToDecimal(r["Qty"]);
                    var cost = Convert.ToDecimal(r["UnitCost"]);
                    var lineTot = Convert.ToDecimal(r["LineTotal"]);
                    var vat = r["VatAmount"] == DBNull.Value ? 0m : Convert.ToDecimal(r["VatAmount"]);
                    var sub = lineTot - vat;

                    itemsCsv.AppendLine($"{srcItemId},{srcPurId},\"{EscapeCsv(pName)}\",{qty:F3},{cost:F4},{sub:F2},{vat:F2},{lineTot:F2}");
                }
                Console.WriteLine($"  Audited {itemCount} LegacyPurchaseItems records.");
            }

            File.WriteAllText(Path.Combine(outputDir, "PURCHASE-RECONCILIATION.csv"), purCsv.ToString());
            File.WriteAllText(Path.Combine(outputDir, "PURCHASE-ITEM-RECONCILIATION.csv"), itemsCsv.ToString());
            Console.WriteLine($"  Saved PURCHASE-RECONCILIATION.csv, PURCHASE-ITEM-RECONCILIATION.csv in {outputDir}");
        }

        private static async Task AuditSupplierPaymentsAsync(NpgsqlConnection conn, string outputDir)
        {
            var csv = new StringBuilder();
            csv.AppendLine("PaymentId,SupplierId,SupplierName,PaymentDateDubai,Amount,PaymentMethod,Reference,PurchaseId,EligibleAsOf31Oct2026,EligibleAsOf01Nov2026");

            var dubaiTz = TimeZoneInfo.FindSystemTimeZoneById("Asia/Dubai");
            var cutoff31Oct = new DateTime(2026, 10, 31, 23, 59, 59, DateTimeKind.Utc);
            var cutoff01Nov = new DateTime(2026, 11, 1, 23, 59, 59, DateTimeKind.Utc);

            decimal sumAll = 0m;
            decimal sumOct31 = 0m;
            decimal sumNov01 = 0m;
            int countNov01 = 0;

            await using (var cmd = new NpgsqlCommand(@"
                SELECT sp.""Id"", sp.""SupplierId"", s.""Name"" as SupplierName, sp.""PaymentDate"", sp.""Amount"", sp.""PaymentMethod"", sp.""Reference"", sp.""PurchaseId""
                FROM ""public"".""SupplierPayments"" sp
                LEFT JOIN ""public"".""Suppliers"" s ON sp.""SupplierId"" = s.""Id""
                WHERE sp.""TenantId"" = 20
                ORDER BY sp.""PaymentDate"" ASC, sp.""Id"" ASC;
            ", conn))
            {
                await using var r = await cmd.ExecuteReaderAsync();
                int count = 0;
                while (await r.ReadAsync())
                {
                    count++;
                    var id = Convert.ToInt32(r["Id"]);
                    var suppId = Convert.ToInt32(r["SupplierId"]);
                    var suppName = r["SupplierName"]?.ToString() ?? "";
                    var dtUtc = Convert.ToDateTime(r["PaymentDate"]);
                    var dtDubai = TimeZoneInfo.ConvertTimeFromUtc(dtUtc, dubaiTz);
                    var amount = Convert.ToDecimal(r["Amount"]);
                    var method = r["PaymentMethod"]?.ToString() ?? "";
                    var reference = r["Reference"]?.ToString() ?? "";
                    var purchaseId = r["PurchaseId"] == DBNull.Value ? "null" : r["PurchaseId"].ToString();

                    bool elOct31 = dtUtc <= cutoff31Oct;
                    bool elNov01 = dtUtc <= cutoff01Nov;

                    sumAll += amount;
                    if (elOct31) sumOct31 += amount;
                    if (dtUtc > cutoff31Oct && elNov01)
                    {
                        sumNov01 += amount;
                        countNov01++;
                    }

                    csv.AppendLine($"{id},{suppId},\"{EscapeCsv(suppName)}\",{dtDubai:yyyy-MM-dd HH:mm:ss},{amount:F2},\"{EscapeCsv(method)}\",\"{EscapeCsv(reference)}\",{purchaseId},{elOct31},{elNov01}");
                }
                Console.WriteLine($"  Audited {count} Operating Supplier Payments. Total: AED {sumAll:N2}");
                Console.WriteLine($"    Eligible as of 31-Oct-2026: AED {sumOct31:N2}");
                Console.WriteLine($"    Dated 01-Nov-2026:          AED {sumNov01:N2} across {countNov01} payments (Expected: AED 1,651.13)");
            }

            File.WriteAllText(Path.Combine(outputDir, "SUPPLIER-PAYMENT-STATUS-AUDIT.csv"), csv.ToString());
            Console.WriteLine($"  Saved SUPPLIER-PAYMENT-STATUS-AUDIT.csv in {outputDir}");
        }

        private static async Task AuditProductsForTenant23Async(NpgsqlConnection conn, string outputDir)
        {
            var previewCsv = new StringBuilder();
            previewCsv.AppendLine("CandidateId,SourceSystem,SourceId,NameEn,NameAr,SKU,Barcode,UnitType,ConversionToBase,ActiveStatus,Classification,Action,Reason");

            var dupCsv = new StringBuilder();
            dupCsv.AppendLine("ConflictType,Identifier,Occurrences,CandidateIds,Names,SKUs,Units");

            // 1. Read Starplus products (Tenant 20 LegacyProducts)
            var candidates = new List<ProductCandidate>();
            await using (var cmd = new NpgsqlCommand(@"
                SELECT ""Id"", ""SourceProductId"", ""NameEn"", ""NameAr"", ""Sku"", ""Barcode"", ""UnitType"", ""ConversionToBase"", ""IsActive""
                FROM ""public"".""LegacyProducts""
                WHERE ""TenantId"" = 20
                ORDER BY ""Id"" ASC;
            ", conn))
            {
                await using var r = await cmd.ExecuteReaderAsync();
                while (await r.ReadAsync())
                {
                    candidates.Add(new ProductCandidate
                    {
                        CandidateId = "STARPLUS-" + r["SourceProductId"],
                        SourceSystem = "Starplus",
                        SourceId = Convert.ToInt32(r["SourceProductId"]),
                        NameEn = r["NameEn"]?.ToString() ?? "",
                        NameAr = r["NameAr"]?.ToString(),
                        SKU = r["Sku"]?.ToString() ?? "",
                        Barcode = r["Barcode"]?.ToString(),
                        UnitType = r["UnitType"]?.ToString() ?? "PCS",
                        ConversionToBase = r["ConversionToBase"] == DBNull.Value ? 1.0m : Convert.ToDecimal(r["ConversionToBase"]),
                        IsActive = Convert.ToBoolean(r["IsActive"])
                    });
                }
            }
            Console.WriteLine($"  Loaded {candidates.Count} candidate products from LegacyProducts (Starplus).");

            // 2. Read FrozenHub 1 operating products (Tenant 20 Products)
            int fh1Count = 0;
            await using (var cmd = new NpgsqlCommand(@"
                SELECT ""Id"", ""NameEn"", ""NameAr"", ""SKU"", ""Barcode"", ""UnitType"", ""ConversionToBase"", ""IsActive""
                FROM ""public"".""Products""
                WHERE ""TenantId"" = 20
                ORDER BY ""Id"" ASC;
            ", conn))
            {
                await using var r = await cmd.ExecuteReaderAsync();
                while (await r.ReadAsync())
                {
                    fh1Count++;
                    candidates.Add(new ProductCandidate
                    {
                        CandidateId = "FH1-" + r["Id"],
                        SourceSystem = "FrozenHub1-Operating",
                        SourceId = Convert.ToInt32(r["Id"]),
                        NameEn = r["NameEn"]?.ToString() ?? "",
                        NameAr = r["NameAr"]?.ToString(),
                        SKU = r["SKU"]?.ToString() ?? "",
                        Barcode = r["Barcode"]?.ToString(),
                        UnitType = r["UnitType"]?.ToString() ?? "PCS",
                        ConversionToBase = r["ConversionToBase"] == DBNull.Value ? 1.0m : Convert.ToDecimal(r["ConversionToBase"]),
                        IsActive = Convert.ToBoolean(r["IsActive"])
                    });
                }
            }
            Console.WriteLine($"  Loaded {fh1Count} candidate products from FrozenHub 1 Products table.");
            Console.WriteLine($"  Total Candidate Rows: {candidates.Count}");

            // 3. Read Tenant 23 existing products
            var existingT23 = new List<string>();
            await using (var cmd = new NpgsqlCommand(@"
                SELECT ""Id"", ""NameEn"", ""SKU""
                FROM ""public"".""Products""
                WHERE ""TenantId"" = 23;
            ", conn))
            {
                await using var r = await cmd.ExecuteReaderAsync();
                while (await r.ReadAsync())
                {
                    existingT23.Add($"Id: {r["Id"]}, Name: '{r["NameEn"]}', SKU: '{r["SKU"]}'");
                }
            }
            Console.WriteLine($"  Existing Tenant 23 Products ({existingT23.Count}): {string.Join("; ", existingT23)}");

            // 4. Analyze Duplicates and Conflicts
            var byName = candidates.GroupBy(c => NormalizeName(c.NameEn)).ToList();
            var bySku = candidates.Where(c => !string.IsNullOrWhiteSpace(c.SKU)).GroupBy(c => c.SKU.Trim().ToUpperInvariant()).ToList();

            var dupNameGroups = byName.Where(g => g.Count() > 1).ToList();
            var dupSkuGroups = bySku.Where(g => g.Count() > 1).ToList();

            Console.WriteLine($"  Distinct Normalized Product Names: {byName.Count}");
            Console.WriteLine($"  Distinct Non-Empty SKUs:           {bySku.Count}");
            Console.WriteLine($"  Duplicate Name Groups:             {dupNameGroups.Count}");
            Console.WriteLine($"  Duplicate SKU Groups:              {dupSkuGroups.Count}");

            foreach (var g in dupNameGroups)
            {
                dupCsv.AppendLine($"NAME_DUPLICATE,\"{EscapeCsv(g.Key)}\",{g.Count()},\"{string.Join(";", g.Select(x => x.CandidateId))}\",\"{EscapeCsv(string.Join(" | ", g.Select(x => x.NameEn)))}\",\"{EscapeCsv(string.Join(" | ", g.Select(x => x.SKU)))}\",\"{EscapeCsv(string.Join(" | ", g.Select(x => x.UnitType)))}\"");
            }

            foreach (var g in dupSkuGroups)
            {
                dupCsv.AppendLine($"SKU_DUPLICATE,\"{EscapeCsv(g.Key)}\",{g.Count()},\"{string.Join(";", g.Select(x => x.CandidateId))}\",\"{EscapeCsv(string.Join(" | ", g.Select(x => x.NameEn)))}\",\"{EscapeCsv(string.Join(" | ", g.Select(x => x.SKU)))}\",\"{EscapeCsv(string.Join(" | ", g.Select(x => x.UnitType)))}\"");
            }

            // Deduplication decision matrix
            var processedKeys = new HashSet<string>();
            foreach (var c in candidates)
            {
                var normName = NormalizeName(c.NameEn);
                var normSku = c.SKU.Trim().ToUpperInvariant();

                string classification;
                string action;
                string reason;

                if (!c.IsActive)
                {
                    classification = "INACTIVE_SOURCE";
                    action = "SKIP";
                    reason = "Product is inactive in source system";
                }
                else if (processedKeys.Contains(normName) || (!string.IsNullOrEmpty(normSku) && processedKeys.Contains("SKU:" + normSku)))
                {
                    classification = "DUPLICATE_CANDIDATE";
                    action = "SKIP_AS_DUPLICATE";
                    reason = "Duplicate of previously processed candidate product";
                }
                else
                {
                    classification = "NEW_PRODUCT";
                    action = "CREATE_MASTER";
                    reason = "Unique active product master for Tenant 23";
                    processedKeys.Add(normName);
                    if (!string.IsNullOrEmpty(normSku)) processedKeys.Add("SKU:" + normSku);
                }

                previewCsv.AppendLine($"{c.CandidateId},{c.SourceSystem},{c.SourceId},\"{EscapeCsv(c.NameEn)}\",\"{EscapeCsv(c.NameAr ?? "")}\",\"{EscapeCsv(c.SKU)}\",\"{EscapeCsv(c.Barcode ?? "")}\",\"{EscapeCsv(c.UnitType)}\",{c.ConversionToBase:F4},{c.IsActive},{classification},{action},\"{EscapeCsv(reason)}\"");
            }

            File.WriteAllText(Path.Combine(outputDir, "FROZENHUB2-PRODUCT-IMPORT-PREVIEW.csv"), previewCsv.ToString());
            File.WriteAllText(Path.Combine(outputDir, "FROZENHUB2-PRODUCT-DUPLICATES.csv"), dupCsv.ToString());
            Console.WriteLine($"  Saved FROZENHUB2-PRODUCT-IMPORT-PREVIEW.csv, FROZENHUB2-PRODUCT-DUPLICATES.csv in {outputDir}");
        }

        private static string NormalizeName(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return "";
            var s = name.Trim().ToLowerInvariant();
            // remove multiple spaces
            return string.Join(" ", s.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries));
        }

        private static string EscapeCsv(string s) => s.Replace("\"", "\"\"");

        private static async Task<int> QueryIntAsync(NpgsqlConnection conn, string sql)
        {
            await using var cmd = new NpgsqlCommand(sql, conn);
            var res = await cmd.ExecuteScalarAsync();
            return res == null || res == DBNull.Value ? 0 : Convert.ToInt32(res);
        }

        private static async Task<decimal> QueryDecimalAsync(NpgsqlConnection conn, string sql)
        {
            await using var cmd = new NpgsqlCommand(sql, conn);
            var res = await cmd.ExecuteScalarAsync();
            return res == null || res == DBNull.Value ? 0m : Convert.ToDecimal(res);
        }

        private class ProductCandidate
        {
            public string CandidateId { get; set; } = "";
            public string SourceSystem { get; set; } = "";
            public int SourceId { get; set; }
            public string NameEn { get; set; } = "";
            public string? NameAr { get; set; }
            public string SKU { get; set; } = "";
            public string? Barcode { get; set; }
            public string UnitType { get; set; } = "PCS";
            public decimal ConversionToBase { get; set; } = 1.0m;
            public bool IsActive { get; set; }
        }
    }
}
