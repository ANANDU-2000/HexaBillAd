using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Branches;
using HexaBill.Api.Modules.Customers;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace HexaBill.Tests;

/// <summary>
/// Branch and route summaries must agree on approved returns, collections and tenant scope
/// for the same synthetic branch/route invoice. Skips without HEXABILL_TEST_POSTGRES.
/// </summary>
public class BranchRouteReturnParityPostgreSqlTests
{
    // ReturnService stamps ReturnDate with UtcNow, so the fixture pins it inside today's window.
    private static readonly DateTime Today = DateTime.UtcNow.Date;
    private static readonly DateTime DayEnd = Today.AddDays(1).AddTicks(-1);

    [SkippableFact]
    public async Task ReturnFromBranchRouteInvoice_InheritsRouteFromInvoice()
    {
        await using var db = await Fixture();
        var sale = await db.Sales.AsNoTracking().SingleAsync();
        var saved = await CreateApprovedReturnAsync(db, qty: 3);
        Assert.Equal(sale.BranchId, saved.BranchId);
        Assert.Equal(sale.RouteId, saved.RouteId);
    }

    [SkippableTheory]
    [InlineData(3)] // full return of the 15.75 invoice
    [InlineData(1)] // partial return of one of three units
    public async Task ApprovedReturn_BranchAndRouteSummariesAgree(int qty)
    {
        await using var db = await Fixture();
        var sale = await db.Sales.AsNoTracking().SingleAsync();
        var saved = await CreateApprovedReturnAsync(db, qty);
        if (qty == 3) Assert.Equal(15.75m, saved.GrandTotal);
        var returned = saved.GrandTotal;
        var net = 15.75m - returned;
        var unpaid = Math.Max(0m, net - 5m);

        var branch = await BranchSummary(db, sale.TenantId!.Value, sale.BranchId!.Value);
        var route = await RouteSummary(db, sale.TenantId.Value, sale.RouteId!.Value);

        Assert.Equal(15.75m, branch.TotalSales);
        Assert.Equal(15.75m, route.TotalSales);
        Assert.Equal(returned, branch.TotalReturns);
        Assert.Equal(returned, route.TotalReturns);
        Assert.Equal(net, branch.NetSales);
        Assert.Equal(net, route.NetSales);
        Assert.Equal(5m, branch.TotalPayments);
        Assert.Equal(5m, route.TotalPayments);
        Assert.Equal(unpaid, branch.UnpaidAmount);
        Assert.Equal(unpaid, route.UnpaidAmount);

        // The branch's own route row must show the same route figures as the route summary.
        var branchRoute = Assert.Single(branch.Routes);
        Assert.Equal(route.TotalReturns, branchRoute.TotalReturns);
        Assert.Equal(route.NetSales, branchRoute.NetSales);
        Assert.Equal(route.UnpaidAmount, branchRoute.UnpaidAmount);
    }

    [SkippableTheory]
    [InlineData(ReturnStatus.Pending)]
    [InlineData(ReturnStatus.Rejected)]
    [InlineData(ReturnStatus.Reversed)]
    public async Task NonApprovedReturn_DoesNotReduceBranchOrRouteSummaries(ReturnStatus status)
    {
        await using var db = await Fixture();
        var sale = await db.Sales.AsNoTracking().SingleAsync();
        var saved = await CreateApprovedReturnAsync(db, qty: 3);
        saved.Status = status;
        await db.SaveChangesAsync();

        var branch = await BranchSummary(db, sale.TenantId!.Value, sale.BranchId!.Value);
        var route = await RouteSummary(db, sale.TenantId.Value, sale.RouteId!.Value);

        Assert.Equal(0m, branch.TotalReturns);
        Assert.Equal(0m, route.TotalReturns);
        Assert.Equal(15.75m, branch.NetSales);
        Assert.Equal(15.75m, route.NetSales);
        Assert.Equal(10.75m, branch.UnpaidAmount);
        Assert.Equal(10.75m, route.UnpaidAmount);
    }

    [SkippableFact]
    public async Task RefundsAndVoidedPayments_AreNotCollections_ForBranchOrRoute()
    {
        await using var db = await Fixture();
        var sale = await db.Sales.AsNoTracking().SingleAsync();
        var tenantId = sale.TenantId!.Value;
        var saved = await CreateApprovedReturnAsync(db, qty: 3);
        db.Payments.AddRange(
            new Payment { TenantId = tenantId, OwnerId = tenantId, CreatedBy = tenantId, CustomerId = sale.CustomerId,
                SaleId = sale.Id, SaleReturnId = saved.Id, Amount = 5m, Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED,
                PaymentDate = Today.AddHours(13), CreatedAt = Today.AddHours(13) },
            new Payment { TenantId = tenantId, OwnerId = tenantId, CreatedBy = tenantId, CustomerId = sale.CustomerId,
                SaleId = sale.Id, Amount = 2m, Mode = PaymentMode.CASH, Status = PaymentStatus.VOID,
                PaymentDate = Today.AddHours(13), CreatedAt = Today.AddHours(13) });
        await db.SaveChangesAsync();

        var branch = await BranchSummary(db, tenantId, sale.BranchId!.Value);
        var route = await RouteSummary(db, tenantId, sale.RouteId!.Value);

        Assert.Equal(5m, branch.TotalPayments);
        Assert.Equal(5m, route.TotalPayments);
    }

    [SkippableFact]
    public async Task ForeignTenantInvoiceOnSameRoute_IsIgnoredByBranchAndRouteSummaries()
    {
        await using var db = await Fixture(includeForeignSale: true);
        var sale = await db.Sales.AsNoTracking().SingleAsync(s => s.TenantId != null && s.InvoiceNo.StartsWith("ROUTE-"));
        var tenantId = sale.TenantId!.Value;

        var branch = await BranchSummary(db, tenantId, sale.BranchId!.Value);
        var route = await RouteSummary(db, tenantId, sale.RouteId!.Value);

        Assert.Equal(15.75m, branch.TotalSales);
        Assert.Equal(15.75m, route.TotalSales);
        Assert.Equal(1, branch.InvoiceCount);
        Assert.Equal(1, route.InvoiceCount);
    }

    private static ReturnService Returns(AppDbContext db) =>
        new(db, new CustomerService(db, NullLogger<CustomerService>.Instance), new SettingsService(db), new SalesSchemaService(db));

    private static async Task<BranchSummaryDto> BranchSummary(AppDbContext db, int tenantId, int branchId) =>
        (await new BranchService(db, new SalesSchemaService(db), null!, NullLogger<BranchService>.Instance)
            .GetBranchSummaryAsync(branchId, tenantId, Today, DayEnd))!;

    private static async Task<RouteSummaryDto> RouteSummary(AppDbContext db, int tenantId, int routeId) =>
        (await new RouteService(db, new SalesSchemaService(db), new ConfigurationBuilder().Build(), NullLogger<RouteService>.Instance)
            .GetRouteSummaryAsync(routeId, tenantId, Today, Today))!;

    private static async Task<SaleReturn> CreateApprovedReturnAsync(AppDbContext db, int qty)
    {
        var sale = await db.Sales.AsNoTracking().SingleAsync(s => s.InvoiceNo.StartsWith("ROUTE-"));
        var line = await db.SaleItems.AsNoTracking().SingleAsync(si => si.SaleId == sale.Id);
        var tenantId = sale.TenantId!.Value;
        var request = new CreateSaleReturnRequest
        {
            SaleId = sale.Id,
            ReturnType = qty == 3 ? "Full" : "Partial",
            Items = new List<SaleReturnItemRequest> { new() { SaleItemId = line.Id, Qty = qty } }
        };
        await Returns(db).CreateSaleReturnAsync(request, tenantId, tenantId);
        db.ChangeTracker.Clear();
        var saved = await db.SaleReturns.SingleAsync(r => r.TenantId == tenantId);
        saved.ReturnDate = Today.AddHours(12);
        await db.SaveChangesAsync();
        return saved;
    }

    private static async Task<AppDbContext> Fixture(bool includeForeignSale = false)
    {
        var connection = Environment.GetEnvironmentVariable("HEXABILL_TEST_POSTGRES");
        Skip.If(string.IsNullOrWhiteSpace(connection), PostgresIntegrationSkip.Reason);
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection).Options);
        db.SetRequestTenantScope(null, true);
        await PostgresTestSchema.EnsureCreatedAsync(db);
        var tenantId = 2_000_000 + Random.Shared.Next(1, 100_000_000);
        db.Tenants.AddRange(
            new Tenant { Id = tenantId, Name = "Synthetic branch route parity", Subdomain = $"route-parity-{tenantId}" },
            new Tenant { Id = tenantId + 1, Name = "Other synthetic tenant", Subdomain = $"route-parity-other-{tenantId}" });
        db.Users.Add(new User { Id = tenantId, TenantId = tenantId, OwnerId = tenantId, Name = "Fixture owner",
            Email = $"route-parity-{tenantId}@example.test", PasswordHash = "fixture", Role = UserRole.Owner, CreatedAt = Today });
        var customer = new Customer { TenantId = tenantId, OwnerId = tenantId, Name = "Synthetic route customer", CreatedAt = Today, UpdatedAt = Today };
        var branch = new Branch { TenantId = tenantId, Name = "Synthetic branch", CreatedAt = Today };
        db.Customers.Add(customer);
        db.Branches.Add(branch);
        await db.SaveChangesAsync();
        var route = new Route { TenantId = tenantId, BranchId = branch.Id, Name = "Synthetic route", CreatedAt = Today };
        var product = new Product { TenantId = tenantId, OwnerId = tenantId, NameEn = "Synthetic route product", Sku = $"RP-{tenantId}",
            StockQty = 10, CostPrice = 3, SellPrice = 5, ConversionToBase = 1, CreatedAt = Today, UpdatedAt = Today };
        db.Routes.Add(route);
        db.Products.Add(product);
        await db.SaveChangesAsync();
        var sale = new Sale { TenantId = tenantId, OwnerId = tenantId, CreatedBy = tenantId, CustomerId = customer.Id,
            BranchId = branch.Id, RouteId = route.Id, InvoiceNo = $"ROUTE-{tenantId}", InvoiceDate = Today.AddHours(1),
            CreatedAt = Today.AddHours(1), Subtotal = 15, VatTotal = .75m, GrandTotal = 15.75m, TotalAmount = 15.75m,
            PaidAmount = 5, PaymentStatus = SalePaymentStatus.Partial };
        db.Sales.Add(sale);
        await db.SaveChangesAsync();
        db.SaleItems.Add(new SaleItem { SaleId = sale.Id, ProductId = product.Id, UnitType = "PIECE", Qty = 3, UnitPrice = 5,
            VatRate = 5, VatAmount = .75m, LineTotal = 15.75m });
        db.Payments.Add(new Payment { TenantId = tenantId, OwnerId = tenantId, CreatedBy = tenantId, CustomerId = customer.Id,
            SaleId = sale.Id, Amount = 5, Mode = PaymentMode.CASH, Status = PaymentStatus.CLEARED,
            PaymentDate = Today.AddHours(1), CreatedAt = Today.AddHours(1) });
        if (includeForeignSale)
        {
            // Corrupt cross-tenant reference: same route id, different tenant. Must never count for this tenant.
            db.Sales.Add(new Sale { TenantId = tenantId + 1, OwnerId = tenantId + 1, CreatedBy = tenantId,
                BranchId = branch.Id, RouteId = route.Id, InvoiceNo = $"FOREIGN-{tenantId}", InvoiceDate = Today.AddHours(1),
                CreatedAt = Today.AddHours(1), Subtotal = 100, VatTotal = 0, GrandTotal = 100, TotalAmount = 100 });
        }
        await db.SaveChangesAsync();
        db.SetRequestTenantScope(tenantId, false);
        return db;
    }
}
