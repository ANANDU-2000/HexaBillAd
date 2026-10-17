using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Branches;
using HexaBill.Api.Modules.Customers;
using HexaBill.Api.Modules.Payments;
using HexaBill.Api.Modules.Reports;
using HexaBill.Api.Modules.Sales;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
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

    [SkippableFact]
    public async Task SalesReportStatus_TreatsFullyReturnedPartialInvoiceAsSettled()
    {
        await using var db = await Fixture(ReturnStatus.Approved, 15.75m);
        var tenantId = (await db.Customers.SingleAsync()).TenantId!.Value;
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var service = Reports(db, cache);
        var pending = await service.GetSalesReportAsync(tenantId, Day, Day.AddDays(1), status: "Pending");
        var partial = await service.GetSalesReportAsync(tenantId, Day, Day.AddDays(1), status: "Partial");
        var paid = await service.GetSalesReportAsync(tenantId, Day, Day.AddDays(1), status: "Paid");
        Assert.Equal(0, pending.TotalCount);
        Assert.Equal(0, partial.TotalCount);
        Assert.Equal(1, paid.TotalCount);
        Assert.Equal(15.75m, Assert.Single(paid.Items).GrandTotal);
        Assert.Equal(5m, paid.Items[0].PaidAmount);
    }

    [Fact]
    public async Task SalesReportStatus_Sqlite_FullyReturnedPartialInvoiceIsSettled()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        db.SetRequestTenantScope(10, false);
        var day = new DateTime(2026, 10, 14, 0, 0, 0, DateTimeKind.Utc);
        db.Tenants.Add(new Tenant { Id = 10, Name = "Synthetic return", Subdomain = "sqlite-return" });
        db.Users.Add(new User { Id = 10, TenantId = 10, OwnerId = 10, Name = "Fixture owner", Email = "sqlite-return@example.test", PasswordHash = "fixture", Role = UserRole.Owner, CreatedAt = day });
        db.Customers.Add(new Customer { Id = 10, TenantId = 10, OwnerId = 10, Name = "Synthetic credit customer", CreatedAt = day, UpdatedAt = day });
        db.Sales.Add(new Sale { Id = 10, TenantId = 10, OwnerId = 10, CreatedBy = 10, CustomerId = 10, InvoiceNo = "RETURN-SQLITE", InvoiceDate = day, CreatedAt = day, Subtotal = 15, VatTotal = .75m, GrandTotal = 15.75m, TotalAmount = 15.75m, PaidAmount = 5, PaymentStatus = SalePaymentStatus.Partial });
        db.SaleReturns.Add(new SaleReturn { Id = 10, TenantId = 10, OwnerId = 10, CreatedBy = 10, SaleId = 10, CustomerId = 10, ReturnNo = "RET-SQLITE", ReturnDate = day.AddHours(2), CreatedAt = day.AddHours(2), Status = ReturnStatus.Approved, GrandTotal = 15.75m });
        await db.SaveChangesAsync();
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var service = Reports(db, cache);
        Assert.Equal(0, (await service.GetSalesReportAsync(10, day, day.AddDays(1), status: "Pending")).TotalCount);
        Assert.Equal(0, (await service.GetSalesReportAsync(10, day, day.AddDays(1), status: "Partial")).TotalCount);
        var paid = await service.GetSalesReportAsync(10, day, day.AddDays(1), status: "Paid");
        Assert.Equal(1, paid.TotalCount);
        Assert.Equal(5m, Assert.Single(paid.Items).PaidAmount);
        Assert.Equal(15.75m, paid.Items[0].ReturnedAmount);
    }

    [Fact]
    public async Task Sqlite_FullReturn_ClearsOutstandingAndKeepsFiveCredit()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        db.SetRequestTenantScope(10, false);
        var day = new DateTime(2026, 10, 14, 0, 0, 0, DateTimeKind.Utc);
        db.Tenants.Add(new Tenant { Id = 10, Name = "Synthetic return", Subdomain = "sqlite-outstanding" });
        db.Users.Add(new User { Id = 10, TenantId = 10, OwnerId = 10, Name = "Fixture owner", Email = "sqlite-outstanding@example.test", PasswordHash = "fixture", Role = UserRole.Owner, CreatedAt = day });
        db.Customers.Add(new Customer { Id = 10, TenantId = 10, OwnerId = 10, Name = "Synthetic credit customer", CreatedAt = day, UpdatedAt = day });
        db.Sales.Add(new Sale { Id = 10, TenantId = 10, OwnerId = 10, CreatedBy = 10, CustomerId = 10, InvoiceNo = "RETURN-SQLITE", InvoiceDate = day, CreatedAt = day, Subtotal = 15, VatTotal = .75m, GrandTotal = 15.75m, TotalAmount = 15.75m, PaidAmount = 5, PaymentStatus = SalePaymentStatus.Partial });
        db.Payments.Add(new Payment { Id = 10, TenantId = 10, OwnerId = 10, CreatedBy = 10, CustomerId = 10, SaleId = 10, Amount = 5, Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED, PaymentDate = day.AddHours(1), CreatedAt = day.AddHours(1) });
        db.SaleReturns.Add(new SaleReturn { Id = 10, TenantId = 10, OwnerId = 10, CreatedBy = 10, SaleId = 10, CustomerId = 10, ReturnNo = "RET-SQLITE", ReturnDate = day.AddHours(2), CreatedAt = day.AddHours(2), Status = ReturnStatus.Approved, GrandTotal = 15.75m });
        await db.SaveChangesAsync();

        var customers = new CustomerService(db);
        Assert.Empty(await customers.GetOutstandingInvoicesAsync(10, 10));
        var ledger = await customers.GetCustomerLedgerAsync(10, 10);
        Assert.Equal("Paid", Assert.Single(ledger, e => e.Type == "Invoice").Status);
        Assert.Equal(-5m, ledger[^1].Balance);

        var payments = new PaymentService(db, NullLogger<PaymentService>.Instance, null!, null!, null!);
        Assert.Empty(await payments.GetOutstandingInvoicesAsync(10, 10));
        Assert.Equal(0m, (await payments.GetInvoiceAmountAsync(10, 10)).OutstandingAmount);

        using var cache = new MemoryCache(new MemoryCacheOptions());
        var summary = await Reports(db, cache).GetSummaryReportAsync(10, day, day, skipCache: true);
        Assert.Equal(0, summary.PendingBills);
        Assert.Equal(0m, summary.PendingBillsAmount);
        Assert.Equal(1, summary.PaidBills);

        await customers.RecalculateCustomerBalanceAsync(10, 10);
        Assert.Equal(-5m, (await db.Customers.SingleAsync()).Balance);
        Assert.Equal(15.75m, (await db.Sales.SingleAsync()).GrandTotal);
        Assert.Equal(5m, (await db.Sales.SingleAsync()).PaidAmount);
    }

    [Fact]
    public async Task Sqlite_NullReturnRoute_BranchAndRouteUnpaidZero_VatNetsTheReturn()
    {
        SalesSchemaService.ClearColumnCheckCacheStatic();
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        await db.Database.OpenConnectionAsync();
        await db.Database.EnsureCreatedAsync();
        db.SetRequestTenantScope(10, false);
        var day = new DateTime(2026, 10, 14, 0, 0, 0, DateTimeKind.Utc);
        db.Tenants.Add(new Tenant { Id = 10, Name = "Synthetic return", Subdomain = "sqlite-route" });
        db.Users.Add(new User { Id = 10, TenantId = 10, OwnerId = 10, Name = "Fixture owner", Email = "sqlite-route@example.test", PasswordHash = "fixture", Role = UserRole.Owner, CreatedAt = day });
        db.Branches.Add(new Branch { Id = 7, TenantId = 10, Name = "Main", CreatedAt = day });
        db.Routes.Add(new HexaBill.Api.Models.Route { Id = 6, TenantId = 10, BranchId = 7, Name = "Route 6", CreatedAt = day });
        db.Customers.Add(new Customer { Id = 10, TenantId = 10, OwnerId = 10, Name = "Synthetic credit customer", CreatedAt = day, UpdatedAt = day });
        db.RouteCustomers.Add(new RouteCustomer { Id = 1, RouteId = 6, CustomerId = 10, AssignedAt = day });
        db.Sales.Add(new Sale { Id = 10, TenantId = 10, OwnerId = 10, CreatedBy = 10, CustomerId = 10, BranchId = 7, RouteId = 6, InvoiceNo = "RETURN-SQLITE", InvoiceDate = day, CreatedAt = day, Subtotal = 15, VatTotal = .75m, GrandTotal = 15.75m, TotalAmount = 15.75m, PaidAmount = 5, PaymentStatus = SalePaymentStatus.Partial, VatScenario = "Standard" });
        db.Payments.Add(new Payment { Id = 10, TenantId = 10, OwnerId = 10, CreatedBy = 10, CustomerId = 10, SaleId = 10, Amount = 5, Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED, PaymentDate = day.AddHours(1), CreatedAt = day.AddHours(1) });
        db.SaleReturns.Add(new SaleReturn { Id = 10, TenantId = 10, OwnerId = 10, CreatedBy = 10, SaleId = 10, CustomerId = 10, BranchId = null, RouteId = null, ReturnNo = "RET-SQLITE", ReturnDate = day.AddHours(2), CreatedAt = day.AddHours(2), Status = ReturnStatus.Approved, Subtotal = 15, VatTotal = .75m, GrandTotal = 15.75m });
        await db.SaveChangesAsync();
        await new CustomerService(db).RecalculateCustomerBalanceAsync(10, 10);

        var schema = new SalesSchemaService(db);
        var routes = new RouteService(db, schema, new ConfigurationBuilder().Build(), NullLogger<RouteService>.Instance);
        var route = await routes.GetRouteSummaryAsync(6, 10, day, day);
        Assert.NotNull(route);
        Assert.Equal(15.75m, route.TotalSales);
        Assert.Equal(15.75m, route.TotalReturns);
        Assert.Equal(5m, route.TotalPayments);
        Assert.Equal(0m, route.UnpaidAmount);
        var sheet = await routes.GetRouteCollectionSheetAsync(6, 10, day);
        Assert.Equal(0m, sheet!.TotalOutstanding);

        var branches = new BranchService(db, schema, null!, NullLogger<BranchService>.Instance);
        var branch = await branches.GetBranchSummaryAsync(7, 10, day, day);
        Assert.NotNull(branch);
        Assert.Equal(15.75m, branch.TotalReturns);
        Assert.Equal(0m, branch.UnpaidAmount);
        Assert.Equal(0m, Assert.Single(branch.Routes).UnpaidAmount);

        var vat = await new VatReturnReportService(db, NullLogger<VatReturnReportService>.Instance)
            .GetVatReturn201Async(10, day, day.AddDays(1));
        Assert.Equal(0m, vat.Box1a);
        Assert.Equal(0m, vat.Box1b);
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
