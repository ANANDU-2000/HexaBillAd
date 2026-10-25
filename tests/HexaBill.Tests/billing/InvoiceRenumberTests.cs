using System.Net;
using System.Net.Http.Json;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Sales;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace HexaBill.Tests;

/// <summary>P0-NUM-004: Owner/Admin invoice-number correction and the FrozenHub 1 renumber into the 7000 series.</summary>
public class InvoiceRenumberTests
{
    private const int TenantId = 20;
    private const int OtherTenantId = 22;
    private const int UserId = 77;
    private static readonly DateTime Day = new(2026, 10, 20, 9, 0, 0, DateTimeKind.Utc);
    private static int _nextId = 50_000;

    private static AppDbContext NewDb()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase("Renumber_" + Guid.NewGuid()).Options);
        db.SetRequestTenantScope(null, true);
        db.Tenants.AddRange(
            new Tenant { Id = TenantId, Name = "FrozenHub QA", Subdomain = "frozenhub" },
            new Tenant { Id = OtherTenantId, Name = "Other QA", Subdomain = "other" });
        db.Settings.Add(new Setting { TenantId = TenantId, OwnerId = TenantId, Key = InvoiceNumberService.SeriesStartSettingKey, Value = "7000" });
        return db;
    }

    private static Sale AddSale(AppDbContext db, int tenantId, string invoiceNo, bool deleted = false, string? externalRef = null, int dayOffset = 0)
    {
        var sale = new Sale
        {
            Id = Interlocked.Increment(ref _nextId), TenantId = tenantId, OwnerId = tenantId, CreatedBy = 1,
            InvoiceNo = invoiceNo, InvoiceDate = Day.AddDays(dayOffset), CreatedAt = Day.AddDays(dayOffset),
            Subtotal = 685.71m, VatTotal = 34.29m, GrandTotal = 720m, TotalAmount = 720m, PaidAmount = 200m,
            IsDeleted = deleted, IsFinalized = true, ExternalReference = externalRef
        };
        db.Sales.Add(sale);
        return sale;
    }

    private static InvoiceNumberService Numbers(AppDbContext db) => new(db, new ConfigurationBuilder().Build());
    private static InvoiceRenumberService Service(AppDbContext db) => new(db, Numbers(db));
    private static Task<(InvoiceNumberChangeOutcome Outcome, string? Problem, InvoiceNumberChangeResult? Result)> Change(
        AppDbContext db, int saleId, string newNo, bool dryRun = false, int tenantId = TenantId) =>
        Service(db).ChangeAsync(saleId, tenantId, UserId, new ChangeInvoiceNumberRequest { NewInvoiceNumber = newNo, Reason = "Owner asked for 7000 series" }, dryRun);

    [Fact]
    public async Task HappyPath_UpdatesSaleStockReasonAndWritesAudit_TotalsAndVatUnchanged()
    {
        await using var db = NewDb();
        var sale = AddSale(db, TenantId, "1791254852");
        db.Payments.Add(new Payment { Id = 9001, TenantId = TenantId, OwnerId = TenantId, SaleId = sale.Id, Amount = 200m, CreatedBy = 1 });
        db.InventoryTransactions.Add(new InventoryTransaction { TenantId = TenantId, OwnerId = TenantId, ProductId = 1, ChangeQty = -2, TransactionType = TransactionType.Sale, RefId = sale.Id, Reason = "Sale Updated: 1791254852" });
        db.InventoryTransactions.Add(new InventoryTransaction { TenantId = TenantId, OwnerId = TenantId, ProductId = 1, ChangeQty = -1, TransactionType = TransactionType.Sale, RefId = sale.Id, Reason = null });
        db.PaymentReceipts.Add(new PaymentReceipt { TenantId = TenantId, PaymentId = 9001, ReceiptNumber = "REC-2026-0001", SnapshotJson = "{\"invoiceNo\":\"1791254852\"}", GeneratedAt = Day, GeneratedByUserId = 1 });
        await db.SaveChangesAsync();

        var (outcome, problem, result) = await Change(db, sale.Id, "7000");

        Assert.Equal(InvoiceNumberChangeOutcome.Ok, outcome);
        Assert.Null(problem);
        Assert.True(result!.Changed);
        Assert.Equal("1791254852", result.OldInvoiceNo);
        Assert.Equal(1, result.InventoryTransactionsUpdated);
        var reloaded = await db.Sales.AsNoTracking().SingleAsync(s => s.Id == sale.Id);
        Assert.Equal("7000", reloaded.InvoiceNo);
        Assert.Equal(720m, reloaded.GrandTotal);
        Assert.Equal(34.29m, reloaded.VatTotal);
        Assert.Equal(685.71m, reloaded.Subtotal);
        Assert.Equal(200m, reloaded.PaidAmount);
        Assert.Equal(sale.Id, (await db.Payments.AsNoTracking().SingleAsync()).SaleId);
        Assert.Contains(await db.InventoryTransactions.AsNoTracking().Select(t => t.Reason).ToListAsync(), r => r == "Sale Updated: 7000");
        // Receipt snapshots are historical documents and are never rewritten.
        Assert.Contains("1791254852", (await db.PaymentReceipts.AsNoTracking().SingleAsync()).SnapshotJson);
        var audit = await db.AuditLogs.AsNoTracking().SingleAsync(a => a.Action == "InvoiceNumberChanged");
        Assert.Equal(sale.Id, audit.EntityId);
        Assert.Equal("Sale", audit.EntityType);
        Assert.Equal(UserId, audit.UserId);
        Assert.Equal(TenantId, audit.TenantId);
        Assert.Contains("1791254852", audit.OldValues);
        Assert.Contains("7000", audit.NewValues);
    }

    [Fact]
    public async Task DuplicateNumber_IsRefused()
    {
        await using var db = NewDb();
        AddSale(db, TenantId, "7000");
        var sale = AddSale(db, TenantId, "1791254853");
        await db.SaveChangesAsync();
        var (outcome, problem, _) = await Change(db, sale.Id, "7000");
        Assert.Equal(InvoiceNumberChangeOutcome.Invalid, outcome);
        Assert.NotNull(problem);
        Assert.Equal("1791254853", (await db.Sales.AsNoTracking().SingleAsync(s => s.Id == sale.Id)).InvoiceNo);
        Assert.Empty(db.AuditLogs);
    }

    [Fact]
    public async Task IssuedThenDeletedNumber_IsRefused()
    {
        await using var db = NewDb();
        AddSale(db, TenantId, "7005", deleted: true);
        var sale = AddSale(db, TenantId, "1791254853");
        await db.SaveChangesAsync();
        var (outcome, _, _) = await Change(db, sale.Id, "7005");
        Assert.Equal(InvoiceNumberChangeOutcome.Invalid, outcome);
    }

    [Theory]
    [InlineData("6999")]
    [InlineData("70A0")]
    [InlineData("700")]
    public async Task BelowSeriesStartOrMalformed_IsRefused(string newNo)
    {
        await using var db = NewDb();
        var sale = AddSale(db, TenantId, "1791254853");
        await db.SaveChangesAsync();
        var (outcome, _, _) = await Change(db, sale.Id, newNo);
        Assert.Equal(InvoiceNumberChangeOutcome.Invalid, outcome);
    }

    [Fact]
    public async Task ImportedStarplusSale_IsRefused()
    {
        await using var db = NewDb();
        var sale = AddSale(db, TenantId, "2000", externalRef: "starplus:sales:2000");
        await db.SaveChangesAsync();
        var (outcome, problem, _) = await Change(db, sale.Id, "7000");
        Assert.Equal(InvoiceNumberChangeOutcome.Invalid, outcome);
        Assert.Contains("Imported", problem);
    }

    [Fact]
    public async Task DeletedSale_IsRefused_AndSameNumberIsNoOp()
    {
        await using var db = NewDb();
        var deleted = AddSale(db, TenantId, "1791254850", deleted: true);
        var live = AddSale(db, TenantId, "7000");
        await db.SaveChangesAsync();
        Assert.Equal(InvoiceNumberChangeOutcome.Invalid, (await Change(db, deleted.Id, "7001")).Outcome);
        var same = await Change(db, live.Id, "7000");
        Assert.Equal(InvoiceNumberChangeOutcome.Ok, same.Outcome);
        Assert.False(same.Result!.Changed);
        Assert.Empty(db.AuditLogs);
    }

    [Fact]
    public async Task OtherTenantsSale_IsNotFound()
    {
        await using var db = NewDb();
        var foreign = AddSale(db, OtherTenantId, "1791254852");
        await db.SaveChangesAsync();
        var (outcome, _, _) = await Change(db, foreign.Id, "7000");
        Assert.Equal(InvoiceNumberChangeOutcome.NotFound, outcome);
        Assert.Equal("1791254852", (await db.Sales.AsNoTracking().SingleAsync(s => s.Id == foreign.Id)).InvoiceNo);
    }

    [Fact]
    public async Task DryRun_ReportsChangeButWritesNothing()
    {
        await using var db = NewDb();
        var sale = AddSale(db, TenantId, "1791254852");
        db.InventoryTransactions.Add(new InventoryTransaction { TenantId = TenantId, OwnerId = TenantId, ProductId = 1, ChangeQty = -2, TransactionType = TransactionType.Sale, RefId = sale.Id, Reason = "Sale Updated: 1791254852" });
        await db.SaveChangesAsync();

        var (outcome, _, result) = await Change(db, sale.Id, "7000", dryRun: true);

        Assert.Equal(InvoiceNumberChangeOutcome.Ok, outcome);
        Assert.True(result!.DryRun);
        Assert.False(result.Changed);
        Assert.Equal("7000", result.NewInvoiceNo);
        Assert.Equal(1, result.InventoryTransactionsUpdated);
        Assert.Equal("1791254852", (await db.Sales.AsNoTracking().SingleAsync()).InvoiceNo);
        Assert.Equal("Sale Updated: 1791254852", (await db.InventoryTransactions.AsNoTracking().SingleAsync()).Reason);
        Assert.Empty(db.AuditLogs);
    }

    [Fact]
    public async Task FrozenHubFourInvoices_RenumberedInTimeOrder_NextNumberIs7004()
    {
        await using var db = NewDb();
        AddSale(db, TenantId, "FH-SMK-1791254849");
        AddSale(db, TenantId, "1791254850", deleted: true);
        var plan = new[] { ("1791254852", "7000", 0), ("1791254853", "7001", 1), ("1791254858", "7002", 4), ("1791254859", "7003", 4) };
        var ids = plan.Select(p => AddSale(db, TenantId, p.Item1, dayOffset: p.Item3).Id).ToArray();
        // Imported Starplus range sits below the series and must not move it.
        AddSale(db, TenantId, "6895", externalRef: "starplus:sales:6895");
        await db.SaveChangesAsync();
        var totalsBefore = await db.Sales.AsNoTracking().SumAsync(s => s.GrandTotal + s.VatTotal);

        for (var i = 0; i < plan.Length; i++)
            Assert.Equal(InvoiceNumberChangeOutcome.Ok, (await Change(db, ids[i], plan[i].Item2)).Outcome);

        for (var i = 0; i < plan.Length; i++)
            Assert.Equal(plan[i].Item2, (await db.Sales.AsNoTracking().SingleAsync(s => s.Id == ids[i])).InvoiceNo);
        Assert.Equal(4, await db.AuditLogs.CountAsync(a => a.Action == "InvoiceNumberChanged"));
        Assert.Equal(totalsBefore, await db.Sales.AsNoTracking().SumAsync(s => s.GrandTotal + s.VatTotal));
        Assert.Equal("7004", await Numbers(db).GenerateNextInvoiceNumberAsync(TenantId));
        Assert.Equal("7004", await Numbers(db).GenerateNextInvoiceNumberInTransactionAsync(TenantId));
        // Old numbers can never be handed out again; they stay findable in the audit trail.
        Assert.NotNull(await Numbers(db).GetManualInvoiceNumberProblemAsync("6999", TenantId));
    }
}

[Collection("HttpIntegration")]
public class InvoiceRenumberHttpTests
{
    private readonly HexaBillWebApplicationFactory _factory;
    public InvoiceRenumberHttpTests(HexaBillWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task OtherTenantsSale_Returns404()
    {
        using var attacker = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var response = await attacker.PutAsJsonAsync("/api/sales/2/invoice-number?dryRun=true", new { newInvoiceNumber = "9999" });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task StaffRole_Returns403()
    {
        var client = _factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false, BaseAddress = new Uri("http://tenanta.hexabill.company"),
        });
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue(
            "Bearer", TestJwtFactory.CreateAuthenticatedApiToken(1, 1, "tenanta", role: "Staff"));
        var response = await client.PutAsJsonAsync("/api/sales/1/invoice-number?dryRun=true", new { newInvoiceNumber = "9999" });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task OwnerDryRun_OwnSale_Returns200AndWritesNothing()
    {
        using var owner = HttpIntegrationClient.Create(_factory, 1, "tenanta");
        var before = await owner.GetStringAsync("/api/sales/1");
        var response = await owner.PutAsJsonAsync("/api/sales/1/invoice-number?dryRun=true", new { newInvoiceNumber = "987654" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("\"dryrun\":true", new string((await response.Content.ReadAsStringAsync()).ToLowerInvariant().Where(c => !char.IsWhiteSpace(c)).ToArray()));
        Assert.Equal(before, await owner.GetStringAsync("/api/sales/1"));
    }
}
