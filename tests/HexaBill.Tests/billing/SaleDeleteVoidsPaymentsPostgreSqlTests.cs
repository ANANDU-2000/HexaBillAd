using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Customers;
using HexaBill.Api.Modules.Notifications;
using HexaBill.Api.Modules.Reports;
using HexaBill.Api.Modules.Sales;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

/// <summary>
/// FrozenHub 1 test-bill clean-up must use the app's delete path. That path used to remove linked payments
/// (cascading their receipts). It must now void them, keep receipts/items/history, restore stock once,
/// recalculate only the affected customer, and leave genuine invoices of other customers untouched.
/// </summary>
public class SaleDeleteVoidsPaymentsPostgreSqlTests
{
    [SkippableFact]
    public async Task DeletingTestInvoices_VoidsPaymentsKeepsReceiptsAndLeavesGenuineCustomersUnchanged()
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(connection), PostgresIntegrationSkip.Reason);
        var t = 1_800_000 + Random.Shared.Next(1, 50_000);
        var now = DateTime.UtcNow;
        int productId, paidTestSale, legacyTestSale, pendingTestSale, genuinePending, genuinePaid, receiptPaymentId;

        await using (var seed = Open(connection!, t))
        {
            await PostgresTestSchema.EnsureCreatedAsync(seed);
            seed.Tenants.Add(new Tenant { Id = t, Name = "Void fixture", Subdomain = $"void-{t}" });
            seed.Users.Add(new User { Id = t, TenantId = t, OwnerId = t, Name = "Fixture owner", Email = $"void-{t}@example.test", PasswordHash = "x", Role = UserRole.Owner, CreatedAt = now });
            var testCustomer = new Customer { TenantId = t, OwnerId = t, Name = "Onboard test customer", CreatedAt = now, UpdatedAt = now };
            var genuine = new Customer { TenantId = t, OwnerId = t, Name = "Genuine cafeteria", CreatedAt = now, UpdatedAt = now };
            var product = new Product { TenantId = t, OwnerId = t, NameEn = "Synthetic frozen item", Sku = $"VD-{t}", StockQty = 10, CostPrice = 5, SellPrice = 10, ConversionToBase = 1, CreatedAt = now, UpdatedAt = now };
            seed.AddRange(testCustomer, genuine, product);
            await seed.SaveChangesAsync();
            productId = product.Id;

            Sale AddSale(Customer c, string no, decimal total, decimal paid) {
                var s = new Sale { TenantId = t, OwnerId = t, CreatedBy = t, CustomerId = c.Id, InvoiceNo = no, InvoiceDate = now, CreatedAt = now,
                    Subtotal = total / 1.05m, VatTotal = total - total / 1.05m, GrandTotal = total, TotalAmount = total, PaidAmount = paid,
                    PaymentStatus = paid >= total ? SalePaymentStatus.Paid : SalePaymentStatus.Pending, IsFinalized = true };
                seed.Sales.Add(s);
                return s;
            }
            var sPaid = AddSale(testCustomer, "1791254850", 10.50m, 10.50m);
            var sLegacy = AddSale(testCustomer, "FH-SMK-1791254849", 10.50m, 10.50m);
            var sPending = AddSale(testCustomer, "1791254855", 10.50m, 0m);
            var gPending = AddSale(genuine, "1791254852", 720m, 0m);
            var gPaid = AddSale(genuine, "1791254853", 281m, 281m);
            await seed.SaveChangesAsync();
            foreach (var s in new[] { sPaid, sLegacy, sPending, gPending, gPaid })
                seed.SaleItems.Add(new SaleItem { SaleId = s.Id, ProductId = productId, UnitType = "CTN", Qty = 1, UnitPrice = s.Subtotal, VatRate = 5, VatAmount = s.VatTotal, LineTotal = s.GrandTotal });
            Payment Pay(Sale s, Customer c, decimal amount, PaymentStatus status) {
                var p = new Payment { TenantId = t, OwnerId = t, CreatedBy = t, SaleId = s.Id, CustomerId = c.Id, Amount = amount, Mode = PaymentMode.CASH, Status = status, PaymentDate = now, CreatedAt = now };
                seed.Payments.Add(p);
                return p;
            }
            var receiptPayment = Pay(sPaid, testCustomer, 10.50m, PaymentStatus.CLEARED);
            Pay(sLegacy, testCustomer, 10.50m, PaymentStatus.Completed);
            Pay(sPending, testCustomer, 10.50m, PaymentStatus.VOID);
            Pay(gPaid, genuine, 281m, PaymentStatus.CLEARED);
            await seed.SaveChangesAsync();
            seed.PaymentReceipts.Add(new PaymentReceipt { TenantId = t, ReceiptNumber = $"REC-T-{t}", PaymentId = receiptPayment.Id, GeneratedAt = now, GeneratedByUserId = t });
            testCustomer.Balance = testCustomer.PendingBalance = 21m; testCustomer.TotalSales = 31.50m; testCustomer.TotalPayments = 10.50m;
            genuine.Balance = genuine.PendingBalance = 720m; genuine.TotalSales = 1001m; genuine.TotalPayments = 281m;
            await seed.SaveChangesAsync();
            (paidTestSale, legacyTestSale, pendingTestSale, genuinePending, genuinePaid, receiptPaymentId) = (sPaid.Id, sLegacy.Id, sPending.Id, gPending.Id, gPaid.Id, receiptPayment.Id);
        }

        try
        {
            foreach (var saleId in new[] { paidTestSale, legacyTestSale, pendingTestSale })
            {
                await using var db = Open(connection!, t);
                Assert.True(await Service(db).DeleteSaleAsync(saleId, t, t));
            }

            await using var verify = Open(connection!, t);
            var testIds = new[] { paidTestSale, legacyTestSale, pendingTestSale };
            var sales = await verify.Sales.IgnoreQueryFilters().Where(s => s.TenantId == t).ToListAsync();
            Assert.All(sales.Where(s => testIds.Contains(s.Id)), s => { Assert.True(s.IsDeleted); Assert.Equal(0m, s.PaidAmount); });
            // Invoice numbers, items and payment rows are preserved; payments are VOID, not removed.
            Assert.Contains(sales, s => s.InvoiceNo == "FH-SMK-1791254849");
            Assert.Equal(5, await verify.SaleItems.CountAsync(i => sales.Select(s => s.Id).Contains(i.SaleId)));
            var testPayments = await verify.Payments.IgnoreQueryFilters().Where(p => p.SaleId != null && testIds.Contains(p.SaleId.Value)).ToListAsync();
            Assert.Equal(3, testPayments.Count);
            Assert.All(testPayments, p => Assert.Equal(PaymentStatus.VOID, p.Status));
            Assert.Single(await verify.PaymentReceipts.IgnoreQueryFilters().Where(r => r.PaymentId == receiptPaymentId).ToListAsync());
            // Stock restored once per deleted line (10 seeded; this fixture never decremented, so +3).
            Assert.Equal(13m, (await verify.Products.IgnoreQueryFilters().SingleAsync(p => p.Id == productId)).StockQty);
            Assert.Equal(3, await verify.InventoryTransactions.IgnoreQueryFilters().CountAsync(x => x.TenantId == t && x.ProductId == productId && x.TransactionType == TransactionType.Adjustment));
            // Test customer recalculated to zero; genuine customer and invoices untouched.
            var customers = await verify.Customers.IgnoreQueryFilters().Where(c => c.TenantId == t).ToListAsync();
            var test = customers.Single(c => c.Name == "Onboard test customer");
            Assert.Equal((0m, 0m, 0m, 0m), (test.Balance, test.PendingBalance, test.TotalSales, test.TotalPayments));
            var genuineCustomer = customers.Single(c => c.Name == "Genuine cafeteria");
            Assert.Equal((720m, 720m, 1001m, 281m), (genuineCustomer.Balance, genuineCustomer.PendingBalance, genuineCustomer.TotalSales, genuineCustomer.TotalPayments));
            Assert.All(sales.Where(s => s.Id == genuinePending || s.Id == genuinePaid), s => Assert.False(s.IsDeleted));
            Assert.Equal(281m, sales.Single(s => s.Id == genuinePaid).PaidAmount);
            Assert.Equal(PaymentStatus.CLEARED, (await verify.Payments.IgnoreQueryFilters().SingleAsync(p => p.SaleId == genuinePaid)).Status);
            // Audit evidence per deleted invoice, naming the voided payments.
            var audits = await verify.AuditLogs.IgnoreQueryFilters().Where(a => a.TenantId == t && a.Action == "Sale Deleted").ToListAsync();
            Assert.Equal(testIds.OrderBy(x => x), audits.Select(a => a.EntityId!.Value).OrderBy(x => x));
            Assert.All(audits, a => Assert.Contains("Voided payments:", a.Details));
        }
        finally
        {
            await using var cleanup = Open(connection!, t);
            await cleanup.AuditLogs.IgnoreQueryFilters().Where(a => a.TenantId == t).ExecuteDeleteAsync();
            await cleanup.PaymentReceipts.IgnoreQueryFilters().Where(r => r.TenantId == t).ExecuteDeleteAsync();
            await cleanup.Payments.IgnoreQueryFilters().Where(p => p.TenantId == t).ExecuteDeleteAsync();
            await cleanup.InventoryTransactions.IgnoreQueryFilters().Where(x => x.TenantId == t).ExecuteDeleteAsync();
            await cleanup.Sales.IgnoreQueryFilters().Where(s => s.TenantId == t).ExecuteDeleteAsync();
            await cleanup.Products.IgnoreQueryFilters().Where(p => p.TenantId == t).ExecuteDeleteAsync();
            await cleanup.Customers.IgnoreQueryFilters().Where(c => c.TenantId == t).ExecuteDeleteAsync();
            await cleanup.Users.IgnoreQueryFilters().Where(u => u.TenantId == t).ExecuteDeleteAsync();
            await cleanup.Tenants.Where(x => x.Id == t).ExecuteDeleteAsync();
        }
    }

    private static SaleService Service(AppDbContext db) =>
        new(db, null!, null!, null!, null!, new AlertNoop(), new BalanceService(db, NullLogger<BalanceService>.Instance, new AlertNoop()),
            null!, null!, null!, null!, new VatUnlocked().Object, null!, null!, NullLogger<SaleService>.Instance);

    private static AppDbContext Open(string connection, int tenantId)
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection).Options);
        db.SetRequestTenantScope(tenantId, false);
        return db;
    }

    private sealed class VatUnlocked : InterfaceStub<IVatReturnValidationService>
    {
        public VatUnlocked() => When(nameof(IVatReturnValidationService.IsTransactionDateInLockedPeriodAsync), _ => Task.FromResult(false));
    }

    private sealed class AlertNoop : IAlertService
    {
        public Task CreateAlertAsync(AlertType type, string title, string? message = null, AlertSeverity severity = AlertSeverity.Info, Dictionary<string, object>? metadata = null, int? tenantId = null) => Task.CompletedTask;
        public Task<List<Alert>> GetAlertsAsync(bool unreadOnly = false, int limit = 50, int? tenantId = null) => Task.FromResult(new List<Alert>());
        public Task<Alert?> GetAlertByIdAsync(int id, int? tenantId = null) => Task.FromResult<Alert?>(null);
        public Task MarkAsReadAsync(int id, int? tenantId = null) => Task.CompletedTask;
        public Task MarkAsResolvedAsync(int id, int userId, int? tenantId = null) => Task.CompletedTask;
        public Task<int> GetUnreadCountAsync(int? tenantId = null) => Task.FromResult(0);
        public Task<int> MarkAllAsReadAsync(int? tenantId = null) => Task.FromResult(0);
        public Task<int> MarkAllAsResolvedAsync(int userId, int? tenantId = null) => Task.FromResult(0);
        public Task<int> ClearResolvedAlertsAsync(int? tenantId = null) => Task.FromResult(0);
        public Task CheckAndCreateAlertsAsync() => Task.CompletedTask;
        public Task DismissSimilarAlertsAsync(AlertType type, DateTime cutoffTime) => Task.CompletedTask;
    }
}
