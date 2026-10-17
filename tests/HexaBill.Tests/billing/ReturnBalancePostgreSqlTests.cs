using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Customers;
using HexaBill.Api.Modules.Reports;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

public class ReturnBalancePostgreSqlTests
{
    private static readonly DateTime Day = new(2026, 10, 14, 0, 0, 0, DateTimeKind.Utc);

    [SkippableTheory]
    [InlineData(ReturnStatus.Approved, 15.75, 0, -5)]
    [InlineData(ReturnStatus.Approved, 3, 7.75, 7.75)]
    [InlineData(ReturnStatus.Pending, 15.75, 10.75, 10.75)]
    [InlineData(ReturnStatus.Rejected, 15.75, 10.75, 10.75)]
    [InlineData(ReturnStatus.Reversed, 15.75, 10.75, 10.75)]
    public async Task Aging_NetsOnlyApprovedTenantReturns_WithoutLosingCustomerCredit(
        ReturnStatus status, decimal returned, decimal outstanding, decimal customerBalance)
    {
        await using var db = await Fixture(status, returned);
        var tenantId = (await db.Customers.SingleAsync()).TenantId!.Value;
        var customer = await db.Customers.SingleAsync();
        await new CustomerService(db).RecalculateCustomerBalanceAsync(customer.Id, tenantId);
        Assert.Equal(customerBalance, (await db.Customers.SingleAsync()).Balance);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var aging = await Reports(db, cache).GetAgingReportAsync(tenantId, Day.AddDays(10), customer.Id);
        Assert.Equal(outstanding, aging.TotalOutstanding);
        Assert.Equal(outstanding == 0 ? 0 : 1, aging.Invoices.Count);
        // Report reads must preserve the finalized invoice and actual receipt.
        Assert.Equal(15.75m, (await db.Sales.SingleAsync()).GrandTotal);
        Assert.Equal(5m, (await db.Sales.SingleAsync()).PaidAmount);
        Assert.Equal(5m, (await db.Payments.SingleAsync()).Amount);
    }

    [SkippableTheory]
    [InlineData(ReturnStatus.Approved, 15.75, 0, -5)]
    [InlineData(ReturnStatus.Approved, 3, 7.75, 7.75)]
    [InlineData(ReturnStatus.Pending, 15.75, 10.75, 10.75)]
    [InlineData(ReturnStatus.Rejected, 15.75, 10.75, 10.75)]
    [InlineData(ReturnStatus.Reversed, 15.75, 10.75, 10.75)]
    public async Task Ledger_NetsApprovedReturns_SeparatelyFromActualReceipts(
        ReturnStatus status, decimal returned, decimal outstanding, decimal customerBalance)
    {
        await using var db = await Fixture(status, returned);
        var tenantId = (await db.Customers.SingleAsync()).TenantId!.Value;
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var ledger = await Reports(db, cache).GetComprehensiveSalesLedgerAsync(tenantId, Day, Day);
        Assert.Equal(outstanding, Assert.Single(ledger.Entries, e => e.Type == "Sale").RealPending);
        Assert.Equal(outstanding, ledger.Summary.TotalDebit);
        Assert.Equal(customerBalance, ledger.Summary.OutstandingBalance);
        Assert.Equal(5m, ledger.Summary.TotalPayments);
        Assert.Equal(status == ReturnStatus.Approved ? returned : 0, ledger.Summary.TotalReturns);
        Assert.All(ledger.Entries.Where(e => e.Type == "Return"), e => Assert.Equal(0, e.RealGotPayment));
    }

    [SkippableTheory]
    [InlineData(ReturnStatus.Approved, 15.75, 0)]
    [InlineData(ReturnStatus.Approved, 3, 7.75)]
    [InlineData(ReturnStatus.Pending, 15.75, 10.75)]
    [InlineData(ReturnStatus.Rejected, 15.75, 10.75)]
    [InlineData(ReturnStatus.Reversed, 15.75, 10.75)]
    public async Task PendingBills_NetsApprovedReturnsBeforePagination(ReturnStatus status, decimal returned, decimal outstanding)
    {
        await using var db = await Fixture(status, returned);
        var customer = await db.Customers.SingleAsync();
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var pending = await Reports(db, cache).GetPendingBillsAsync(customer.TenantId!.Value, customerId: customer.Id, pageSize: 1);
        Assert.Equal(outstanding == 0 ? 0 : 1, pending.TotalCount);
        if (outstanding == 0) Assert.Empty(pending.Items);
        else
        {
            var row = Assert.Single(pending.Items);
            Assert.Equal(outstanding, row.BalanceAmount);
            Assert.Equal(5m, row.PaidAmount);
            Assert.Equal(15.75m, row.GrandTotal);
        }
    }

    [SkippableTheory]
    [InlineData(ReturnStatus.Approved, 15.75, 0)]
    [InlineData(ReturnStatus.Approved, 3, 7.75)]
    [InlineData(ReturnStatus.Pending, 15.75, 10.75)]
    [InlineData(ReturnStatus.Rejected, 15.75, 10.75)]
    [InlineData(ReturnStatus.Reversed, 15.75, 10.75)]
    public async Task DashboardAndWorksheet_UseNetInvoiceOutstanding(ReturnStatus status, decimal returned, decimal outstanding)
    {
        await using var db = await Fixture(status, returned);
        (await db.Sales.SingleAsync()).InvoiceDate = Day.AddDays(-40);
        await db.SaveChangesAsync();
        var tenantId = (await db.Customers.SingleAsync()).TenantId!.Value;
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var service = Reports(db, cache);
        var summary = await service.GetSummaryReportAsync(tenantId, Day, Day, skipCache: true);
        Assert.Equal(outstanding, summary.PendingBillsAmount);
        Assert.Equal(outstanding == 0 ? 0 : 1, summary.PendingBills);
        Assert.Equal(outstanding == 0 ? 0 : 1, summary.PendingInvoices.Count);
        Assert.Equal(outstanding, summary.OverdueAmountTotal);
        Assert.Equal(outstanding == 0 ? 0 : 1, summary.OverdueCustomersCount);
        var worksheet = await service.GetWorksheetReportAsync(tenantId, Day, Day);
        Assert.Equal(outstanding, worksheet.PendingAmount);
        Assert.Equal(5m, worksheet.TotalReceived);
    }

    private static ReportService Reports(AppDbContext db, IMemoryCache cache) =>
        new(db, null!, new SettingsService(db), null!, new SalesSchemaService(db), cache,
            NullLogger<ReportService>.Instance, new TimeZoneService(), new VatReturnReportService(db, NullLogger<VatReturnReportService>.Instance));

    private static async Task<AppDbContext> Fixture(ReturnStatus status, decimal returned)
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(connection), PostgresIntegrationSkip.Reason);
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection).Options);
        db.SetRequestTenantScope(null, true);
        await PostgresTestSchema.EnsureCreatedAsync(db);
        var tenantId = 2_000_000 + Random.Shared.Next(1, 100_000_000);
        db.Tenants.AddRange(
            new Tenant { Id = tenantId, Name = "Synthetic return reconciliation", Subdomain = $"return-{tenantId}" },
            new Tenant { Id = tenantId + 1, Name = "Other synthetic tenant", Subdomain = $"return-other-{tenantId}" });
        db.Users.Add(new User { Id = tenantId, TenantId = tenantId, OwnerId = tenantId, Name = "Fixture owner",
            Email = $"return-{tenantId}@example.test", PasswordHash = "fixture", Role = UserRole.Owner, CreatedAt = Day });
        var customer = new Customer { TenantId = tenantId, OwnerId = tenantId, Name = "Synthetic credit customer", CreatedAt = Day, UpdatedAt = Day };
        db.Customers.Add(customer);
        await db.SaveChangesAsync();
        var sale = new Sale { TenantId = tenantId, OwnerId = tenantId, CreatedBy = tenantId, CustomerId = customer.Id,
            InvoiceNo = $"RETURN-{tenantId}", InvoiceDate = Day, CreatedAt = Day, Subtotal = 15, VatTotal = .75m,
            GrandTotal = 15.75m, TotalAmount = 15.75m, PaidAmount = 5, PaymentStatus = SalePaymentStatus.Partial };
        db.Sales.Add(sale);
        await db.SaveChangesAsync();
        db.Payments.Add(new Payment { TenantId = tenantId, OwnerId = tenantId, CreatedBy = tenantId, CustomerId = customer.Id,
            SaleId = sale.Id, Amount = 5, Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED,
            PaymentDate = Day.AddHours(1), CreatedAt = Day.AddHours(1) });
        db.SaleReturns.AddRange(
            new SaleReturn { TenantId = tenantId, OwnerId = tenantId, CreatedBy = tenantId, SaleId = sale.Id,
                CustomerId = customer.Id, ReturnNo = $"RET-{tenantId}", ReturnDate = Day.AddHours(2), CreatedAt = Day.AddHours(2),
                Status = status, GrandTotal = returned },
            // Corrupt cross-tenant reference must never reduce this tenant's invoice.
            new SaleReturn { TenantId = tenantId + 1, OwnerId = tenantId + 1, CreatedBy = tenantId, SaleId = sale.Id,
                CustomerId = customer.Id, ReturnNo = $"FOREIGN-{tenantId}", ReturnDate = Day, CreatedAt = Day,
                Status = ReturnStatus.Approved, GrandTotal = 999 });
        await db.SaveChangesAsync();
        db.SetRequestTenantScope(tenantId, false);
        return db;
    }
}
