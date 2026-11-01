using System;
using System.Data;
using System.Threading.Tasks;
using Npgsql;

namespace StarplusMigrationRunner
{
    public class AuditReport
    {
        public bool Passed { get; set; }
        public int CustomersCount { get; set; }
        public int ProductsCount { get; set; }
        public int InvoicesTotalCount { get; set; }
        public int InvoicesActiveCount { get; set; }
        public int InvoicesDeletedCount { get; set; }
        public int ItemsCount { get; set; }
        public int PaymentsCount { get; set; }
        public int PaymentsClearedCount { get; set; }
        public int PaymentsPendingCount { get; set; }
        public decimal ActiveInvoiceTotal { get; set; }
        public decimal ActivePaidTotal { get; set; }
        public decimal PositiveOutstandingSum { get; set; }
        public int PositiveOutstandingCount { get; set; }
        public int PendingReportCount { get; set; }
        public decimal PendingReportTotal { get; set; }
        public bool TenantIsolationPassed { get; set; }
        public bool PublicDataProtectionPassed { get; set; }
        public int OpeningReceivablesCount { get; set; }
        public decimal OpeningReceivablesSum { get; set; }
    }

    public static class ReconciliationAuditor
    {
        public static async Task<AuditReport> AuditAsync(NpgsqlConnection conn, string schemaName, int tenantId)
        {
            Console.WriteLine($"\n=======================================================");
            Console.WriteLine($"[AUDIT] Running Comprehensive Verification on '{schemaName}' (Tenant: {tenantId})");
            Console.WriteLine($"=======================================================");

            var report = new AuditReport { Passed = true };

            // 1. Customers Count
            report.CustomersCount = Convert.ToInt32(await ExecuteScalarAsync(conn,
                $@"SELECT COUNT(*) FROM ""{schemaName}"".""LegacyCustomers"" WHERE ""TenantId"" = {tenantId};"));
            Console.WriteLine($"[CHECK] LegacyCustomers: {report.CustomersCount} (Expected: 81) -> {(report.CustomersCount == 81 ? "PASS" : "FAIL")}");
            if (report.CustomersCount != 81) report.Passed = false;

            // 2. Products Count
            report.ProductsCount = Convert.ToInt32(await ExecuteScalarAsync(conn,
                $@"SELECT COUNT(*) FROM ""{schemaName}"".""LegacyProducts"" WHERE ""TenantId"" = {tenantId};"));
            Console.WriteLine($"[CHECK] LegacyProducts: {report.ProductsCount} (Expected: 283) -> {(report.ProductsCount == 283 ? "PASS" : "FAIL")}");
            if (report.ProductsCount != 283) report.Passed = false;

            // 3. Invoices Counts
            report.InvoicesTotalCount = Convert.ToInt32(await ExecuteScalarAsync(conn,
                $@"SELECT COUNT(*) FROM ""{schemaName}"".""LegacyInvoices"" WHERE ""TenantId"" = {tenantId};"));
            report.InvoicesActiveCount = Convert.ToInt32(await ExecuteScalarAsync(conn,
                $@"SELECT COUNT(*) FROM ""{schemaName}"".""LegacyInvoices"" WHERE ""TenantId"" = {tenantId} AND ""IsDeleted"" = false;"));
            report.InvoicesDeletedCount = Convert.ToInt32(await ExecuteScalarAsync(conn,
                $@"SELECT COUNT(*) FROM ""{schemaName}"".""LegacyInvoices"" WHERE ""TenantId"" = {tenantId} AND ""IsDeleted"" = true;"));

            Console.WriteLine($"[CHECK] LegacyInvoices Total: {report.InvoicesTotalCount} (Expected: 5,109) -> {(report.InvoicesTotalCount == 5109 ? "PASS" : "FAIL")}");
            Console.WriteLine($"[CHECK] LegacyInvoices Active: {report.InvoicesActiveCount} (Expected: 4,916) -> {(report.InvoicesActiveCount == 4916 ? "PASS" : "FAIL")}");
            Console.WriteLine($"[CHECK] LegacyInvoices Deleted: {report.InvoicesDeletedCount} (Expected: 193) -> {(report.InvoicesDeletedCount == 193 ? "PASS" : "FAIL")}");
            if (report.InvoicesTotalCount != 5109 || report.InvoicesActiveCount != 4916 || report.InvoicesDeletedCount != 193)
                report.Passed = false;

            // 4. Line Items Count
            report.ItemsCount = Convert.ToInt32(await ExecuteScalarAsync(conn,
                $@"SELECT COUNT(*) FROM ""{schemaName}"".""LegacyInvoiceItems"" WHERE ""TenantId"" = {tenantId};"));
            Console.WriteLine($"[CHECK] LegacyInvoiceItems: {report.ItemsCount} (Expected: 10,627) -> {(report.ItemsCount == 10627 ? "PASS" : "FAIL")}");
            if (report.ItemsCount != 10627) report.Passed = false;

            // 5. Payments Counts & Statuses
            report.PaymentsCount = Convert.ToInt32(await ExecuteScalarAsync(conn,
                $@"SELECT COUNT(*) FROM ""{schemaName}"".""LegacyPayments"" WHERE ""TenantId"" = {tenantId};"));
            report.PaymentsClearedCount = Convert.ToInt32(await ExecuteScalarAsync(conn,
                $@"SELECT COUNT(*) FROM ""{schemaName}"".""LegacyPayments"" WHERE ""TenantId"" = {tenantId} AND UPPER(""Status"") = 'CLEARED';"));
            report.PaymentsPendingCount = Convert.ToInt32(await ExecuteScalarAsync(conn,
                $@"SELECT COUNT(*) FROM ""{schemaName}"".""LegacyPayments"" WHERE ""TenantId"" = {tenantId} AND UPPER(""Status"") = 'PENDING';"));

            Console.WriteLine($"[CHECK] LegacyPayments Total: {report.PaymentsCount} (Expected: 5,330) -> {(report.PaymentsCount == 5330 ? "PASS" : "FAIL")}");
            Console.WriteLine($"[CHECK] LegacyPayments Cleared: {report.PaymentsClearedCount} (Expected: 5,325) -> {(report.PaymentsClearedCount == 5325 ? "PASS" : "FAIL")}");
            Console.WriteLine($"[CHECK] LegacyPayments Pending: {report.PaymentsPendingCount} (Expected: 5) -> {(report.PaymentsPendingCount == 5 ? "PASS" : "FAIL")}");
            if (report.PaymentsCount != 5330 || report.PaymentsClearedCount != 5325 || report.PaymentsPendingCount != 5)
                report.Passed = false;

            // 6. Active Invoices Financial Totals
            report.ActiveInvoiceTotal = Convert.ToDecimal(await ExecuteScalarAsync(conn,
                $@"SELECT COALESCE(SUM(""GrandTotal""), 0) FROM ""{schemaName}"".""LegacyInvoices"" WHERE ""TenantId"" = {tenantId} AND ""IsDeleted"" = false;"));
            report.ActivePaidTotal = Convert.ToDecimal(await ExecuteScalarAsync(conn,
                $@"SELECT COALESCE(SUM(""PaidAmount""), 0) FROM ""{schemaName}"".""LegacyInvoices"" WHERE ""TenantId"" = {tenantId} AND ""IsDeleted"" = false;"));

            Console.WriteLine($"[CHECK] Active Invoice GrandTotal: AED {report.ActiveInvoiceTotal:N2} (Expected: AED 3,817,356.88) -> {(Math.Abs(report.ActiveInvoiceTotal - 3817356.88m) < 0.01m ? "PASS" : "FAIL")}");
            Console.WriteLine($"[CHECK] Active Invoice PaidAmount: AED {report.ActivePaidTotal:N2} (Expected: AED 3,747,182.98) -> {(Math.Abs(report.ActivePaidTotal - 3747182.98m) < 0.01m ? "PASS" : "FAIL")}");
            if (Math.Abs(report.ActiveInvoiceTotal - 3817356.88m) >= 0.01m || Math.Abs(report.ActivePaidTotal - 3747182.98m) >= 0.01m)
                report.Passed = false;

            // 7. Positive Outstanding Invoices & Sum
            report.PositiveOutstandingSum = Convert.ToDecimal(await ExecuteScalarAsync(conn,
                $@"SELECT COALESCE(SUM(""OutstandingCalculated""), 0) FROM ""{schemaName}"".""LegacyInvoices"" WHERE ""TenantId"" = {tenantId} AND ""IsDeleted"" = false AND ""OutstandingCalculated"" > 0.005;"));
            report.PositiveOutstandingCount = Convert.ToInt32(await ExecuteScalarAsync(conn,
                $@"SELECT COUNT(*) FROM ""{schemaName}"".""LegacyInvoices"" WHERE ""TenantId"" = {tenantId} AND ""IsDeleted"" = false AND ""OutstandingCalculated"" > 0.005;"));

            Console.WriteLine($"[CHECK] Positive Outstanding Sum: AED {report.PositiveOutstandingSum:N2} (Expected: AED 70,178.09 across 93 invoices) -> {(Math.Abs(report.PositiveOutstandingSum - 70178.09m) < 0.01m && report.PositiveOutstandingCount == 93 ? "PASS" : "FAIL")}");
            if (Math.Abs(report.PositiveOutstandingSum - 70178.09m) >= 0.01m || report.PositiveOutstandingCount != 93)
                report.Passed = false;

            // 8. Pending Report 87 Invoices Check
            report.PendingReportCount = Convert.ToInt32(await ExecuteScalarAsync(conn,
                $@"SELECT COUNT(*) FROM ""{schemaName}"".""LegacyInvoices"" WHERE ""TenantId"" = {tenantId} AND ""ReportedAsPending"" = true;"));
            report.PendingReportTotal = Convert.ToDecimal(await ExecuteScalarAsync(conn,
                $@"SELECT COALESCE(SUM(""OutstandingCalculated""), 0) FROM ""{schemaName}"".""LegacyInvoices"" WHERE ""TenantId"" = {tenantId} AND ""ReportedAsPending"" = true;"));

            Console.WriteLine($"[CHECK] Pending Report 87 Invoices: {report.PendingReportCount} invoices, Total: AED {report.PendingReportTotal:N2} (Expected: 87 invoices, AED 70,178.03) -> {(report.PendingReportCount == 87 && Math.Abs(report.PendingReportTotal - 70178.03m) < 0.01m ? "PASS" : "FAIL")}");
            if (report.PendingReportCount != 87 || Math.Abs(report.PendingReportTotal - 70178.03m) >= 0.01m)
                report.Passed = false;

            // 9. Six Residual 1-Cent Invoices Check
            var residualSum = Convert.ToDecimal(await ExecuteScalarAsync(conn, $@"
                SELECT COALESCE(SUM(""OutstandingCalculated""), 0) FROM ""{schemaName}"".""LegacyInvoices"" 
                WHERE ""TenantId"" = {tenantId} AND ""LegacyInvoiceNumber"" IN ('6040', '3639', '3664', '3704', '3726', '3756');
            "));
            Console.WriteLine($"[CHECK] 6 One-Cent Residual Invoices Sum: AED {residualSum:N2} (Expected: AED 0.06) -> {(Math.Abs(residualSum - 0.06m) < 0.001m ? "PASS" : "FAIL")}");
            if (Math.Abs(residualSum - 0.06m) >= 0.001m) report.Passed = false;

            // 10. Tenant Isolation Check
            var tenant22Count = Convert.ToInt32(await ExecuteScalarAsync(conn,
                $@"SELECT COUNT(*) FROM ""{schemaName}"".""LegacyInvoices"" WHERE ""TenantId"" = 22;"));
            var tenant23Count = Convert.ToInt32(await ExecuteScalarAsync(conn,
                $@"SELECT COUNT(*) FROM ""{schemaName}"".""LegacyInvoices"" WHERE ""TenantId"" = 23;"));
            report.TenantIsolationPassed = (tenant22Count == 0 && tenant23Count == 0);
            Console.WriteLine($"[CHECK] Tenant Isolation (Tenant 22 has {tenant22Count}, Tenant 23 has {tenant23Count}) -> {(report.TenantIsolationPassed ? "PASS" : "FAIL")}");
            if (!report.TenantIsolationPassed) report.Passed = false;

            // 11. Existing FrozenHub Production Data Protection Check
            var publicSalesCount = Convert.ToInt32(await ExecuteScalarAsync(conn,
                @"SELECT COUNT(*) FROM ""public"".""Sales"" WHERE ""TenantId"" = 20;"));
            var publicInvoices7000 = Convert.ToInt32(await ExecuteScalarAsync(conn,
                @"SELECT COUNT(*) FROM ""public"".""Sales"" WHERE ""TenantId"" = 20 AND ""InvoiceNo"" ~ '^[0-9]+$' AND CAST(""InvoiceNo"" AS INTEGER) >= 7000;"));
            report.PublicDataProtectionPassed = (publicSalesCount == 26 && publicInvoices7000 == 24);
            Console.WriteLine($"[CHECK] Public Data Protection (Tenant 20 public Sales={publicSalesCount}, 7000+ invoices={publicInvoices7000}) -> {(report.PublicDataProtectionPassed ? "PASS" : "FAIL")}");
            if (!report.PublicDataProtectionPassed) report.Passed = false;

            // 12. Approved Customer Opening Receivables Verification
            report.OpeningReceivablesCount = Convert.ToInt32(await ExecuteScalarAsync(conn,
                $@"SELECT COUNT(*) FROM ""{schemaName}"".""LegacyOpeningReceivables"" WHERE ""TenantId"" = {tenantId};"));
            report.OpeningReceivablesSum = Convert.ToDecimal(await ExecuteScalarAsync(conn,
                $@"SELECT COALESCE(SUM(""OpeningBalance""), 0) FROM ""{schemaName}"".""LegacyOpeningReceivables"" WHERE ""TenantId"" = {tenantId};"));
            var openingArPassed = (report.OpeningReceivablesCount == 21 && Math.Abs(report.OpeningReceivablesSum - 70077.29m) < 0.01m);
            Console.WriteLine($"[CHECK] Opening Receivables ({report.OpeningReceivablesCount} customers, Sum: AED {report.OpeningReceivablesSum:N2}) [Expected: 21 customers, AED 70,077.29 + AED 100.80 unattributed Inv 2158 = AED 70,178.09] -> {(openingArPassed ? "PASS" : "FAIL")}");
            if (!openingArPassed) report.Passed = false;

            // 13. Customer Mappings Check
            var mappingsCount = Convert.ToInt32(await ExecuteScalarAsync(conn,
                $@"SELECT COUNT(*) FROM ""{schemaName}"".""LegacyCustomerMappings"" WHERE ""TenantId"" = {tenantId};"));
            Console.WriteLine($"[CHECK] LegacyCustomerMappings: {mappingsCount} (Expected: 81) -> {(mappingsCount == 81 ? "PASS" : "FAIL")}");
            if (mappingsCount != 81) report.Passed = false;

            Console.WriteLine($"=======================================================");
            Console.WriteLine($"[AUDIT RESULT] >>> {(report.Passed ? "ALL AUDIT CHECKS PASSED PERFECTLY!" : "AUDIT FAILED WITH DISCREPANCIES!")} <<<");
            Console.WriteLine($"=======================================================\n");

            return report;
        }

        private static async Task<object?> ExecuteScalarAsync(NpgsqlConnection conn, string sql)
        {
            await using var cmd = new NpgsqlCommand(sql, conn);
            return await cmd.ExecuteScalarAsync();
        }
    }
}

