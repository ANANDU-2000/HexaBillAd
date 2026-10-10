using HexaBill.Api.Data;
using HexaBill.Api.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;

namespace HexaBill.Tests;

/// <summary>
/// Rehearses additive snapshot migrations against a minimal legacy SQLite schema (no production DB).
/// Staging/prod: run <c>dotnet ef database update</c> with flags off until FIN gates pass.
/// </summary>
public class StagingSnapshotMigrationsTests
{
    [Fact]
    public async Task VatManagementSnapshotMigration_AddsColumnsLocallyAndGeneratesPostgresDownScript()
    {
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite("Data Source=:memory:").Options);
        await db.Database.OpenConnectionAsync();
        Assert.Contains("20261010090000_AddVatManagementSnapshot", db.Database.GetMigrations());

        var migration = new AddVatManagementSnapshot();
        Assert.Equal(5, migration.UpOperations.OfType<AddColumnOperation>().Count());
        Assert.Equal(5, migration.DownOperations.OfType<DropColumnOperation>().Count());
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE VatReturnPeriods (Id INTEGER PRIMARY KEY, PeriodLabel TEXT NOT NULL);");
        var generator = db.GetService<IMigrationsSqlGenerator>();
        foreach (var command in generator.Generate(migration.UpOperations))
            await db.Database.ExecuteSqlRawAsync(command.CommandText);
        var upColumns = await db.Database.SqlQueryRaw<string>("SELECT name AS Value FROM pragma_table_info('VatReturnPeriods')")
            .ToListAsync();
        Assert.Contains("SnapshotJson", upColumns);
        Assert.Contains("SnapshotHash", upColumns);
        Assert.Contains("SnapshotHistoryJson", upColumns);
        Assert.Contains("SnapshotVersion", upColumns);
        Assert.Contains("SnapshotAt", upColumns);

        var postgresOptions = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=127.0.0.1;Database=vat_down_script_generation;Username=postgres").Options;
        await using var postgresContext = new AppDbContext(postgresOptions);
        var postgresGenerator = postgresContext.GetService<IMigrationsSqlGenerator>();
        var downSql = postgresGenerator.Generate(migration.DownOperations).Select(command => command.CommandText).ToList();
        Assert.Equal(5, downSql.Count);
        Assert.All(downSql, command => Assert.Contains("DROP COLUMN", command, StringComparison.OrdinalIgnoreCase));
        Assert.Contains("SnapshotJson", string.Join("\n", downSql));
        Assert.Contains("SnapshotHash", string.Join("\n", downSql));
        Assert.Contains("SnapshotHistoryJson", string.Join("\n", downSql));
    }

    [Fact]
    public async Task ReceiptAndCostSnapshotMigrations_AreRegisteredAndAdditiveOnly()
    {
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        await db.Database.OpenConnectionAsync();
        var migrations = db.Database.GetMigrations().ToList();
        Assert.Contains("20261003090000_AddPaymentReceiptSnapshot", migrations);
        Assert.Contains("20261003110000_AddSaleItemCostBasis", migrations);
        Assert.Contains("20261003120000_AddPurchaseItemConversionAtPurchase", migrations);
        Assert.Contains("20261003130000_AddPurchaseItemCostCapturedAt", migrations);
        Assert.Contains("20261003140000_AddPaymentSettlementAdjustmentFlag", migrations);
        Assert.Contains("20261003150000_AddDailyCashClose", migrations);
        Assert.Contains("20261003160000_AddDailyCashCloseBankSnapshot", migrations);
        Assert.Contains("20261003170000_AddExpensePaidFrom", migrations);
        Assert.Contains("20261003180000_AddCashDrawerMovement", migrations);
        Assert.Contains("20261003190000_AddPaymentParentPaymentId", migrations);

        var receipt = new AddPaymentReceiptSnapshot();
        Assert.All(receipt.UpOperations.OfType<AddColumnOperation>(), op => Assert.True(op.IsNullable));
        Assert.Throws<NotSupportedException>(() => receipt.DownOperations);

        var cost = new AddSaleItemCostBasis();
        Assert.All(cost.UpOperations.OfType<AddColumnOperation>(), op => Assert.True(op.IsNullable));
        Assert.Throws<NotSupportedException>(() => cost.DownOperations);

        var purchaseConversion = new AddPurchaseItemConversionAtPurchase();
        Assert.All(purchaseConversion.UpOperations.OfType<AddColumnOperation>(), op => Assert.True(op.IsNullable));
        Assert.Throws<NotSupportedException>(() => purchaseConversion.DownOperations);

        var purchaseCostCaptured = new AddPurchaseItemCostCapturedAt();
        Assert.All(purchaseCostCaptured.UpOperations.OfType<AddColumnOperation>(), op => Assert.True(op.IsNullable));
        Assert.Throws<NotSupportedException>(() => purchaseCostCaptured.DownOperations);

        var settlementAdj = new AddPaymentSettlementAdjustmentFlag();
        var settlementColumn = Assert.Single(settlementAdj.UpOperations.OfType<AddColumnOperation>());
        Assert.False(settlementColumn.IsNullable);
        Assert.Equal("false", settlementColumn.DefaultValue?.ToString(), ignoreCase: true);
        Assert.Throws<NotSupportedException>(() => settlementAdj.DownOperations);

        var dailyClose = new AddDailyCashClose();
        Assert.Contains(dailyClose.UpOperations, op => op is CreateTableOperation);
        Assert.Throws<NotSupportedException>(() => dailyClose.DownOperations);

        var dailyCloseBank = new AddDailyCashCloseBankSnapshot();
        Assert.All(dailyCloseBank.UpOperations.OfType<AddColumnOperation>(), op => Assert.False(op.IsNullable));
        Assert.Contains(dailyCloseBank.UpOperations, op => op is DropIndexOperation);
        Assert.Contains(
            dailyCloseBank.UpOperations.OfType<CreateIndexOperation>(),
            idx => idx.IsUnique);
        Assert.Throws<NotSupportedException>(() => dailyCloseBank.DownOperations);

        var expensePaidFrom = new AddExpensePaidFrom();
        var paidFromColumn = Assert.Single(expensePaidFrom.UpOperations.OfType<AddColumnOperation>());
        Assert.False(paidFromColumn.IsNullable);
        Assert.Equal("0", paidFromColumn.DefaultValue?.ToString());
        Assert.Throws<NotSupportedException>(() => expensePaidFrom.DownOperations);

        var cashDrawerMovement = new AddCashDrawerMovement();
        Assert.Contains(cashDrawerMovement.UpOperations, op => op is CreateTableOperation);
        Assert.Throws<NotSupportedException>(() => cashDrawerMovement.DownOperations);

        var parentPayment = new AddPaymentParentPaymentId();
        var parentColumn = Assert.Single(parentPayment.UpOperations.OfType<AddColumnOperation>());
        Assert.True(parentColumn.IsNullable);
        Assert.Throws<NotSupportedException>(() => parentPayment.DownOperations);

        await db.Database.ExecuteSqlRawAsync(
            "CREATE TABLE PaymentReceipts (Id INTEGER PRIMARY KEY); CREATE TABLE SaleItems (Id INTEGER PRIMARY KEY, Qty decimal(18,2) NOT NULL); INSERT INTO SaleItems VALUES (1, 1); CREATE TABLE PurchaseItems (Id INTEGER PRIMARY KEY, Qty decimal(18,2) NOT NULL); INSERT INTO PurchaseItems VALUES (1, 2); CREATE TABLE Payments (Id INTEGER PRIMARY KEY); CREATE TABLE Expenses (Id INTEGER PRIMARY KEY, Amount decimal(18,2) NOT NULL);");
        var generator = db.GetService<IMigrationsSqlGenerator>();
        foreach (var command in generator.Generate(receipt.UpOperations))
            await db.Database.ExecuteSqlRawAsync(command.CommandText);
        foreach (var command in generator.Generate(cost.UpOperations))
            await db.Database.ExecuteSqlRawAsync(command.CommandText);
        foreach (var command in generator.Generate(purchaseConversion.UpOperations))
            await db.Database.ExecuteSqlRawAsync(command.CommandText);
        foreach (var command in generator.Generate(purchaseCostCaptured.UpOperations))
            await db.Database.ExecuteSqlRawAsync(command.CommandText);
        foreach (var command in generator.Generate(settlementAdj.UpOperations))
            await db.Database.ExecuteSqlRawAsync(command.CommandText);
        foreach (var command in generator.Generate(dailyClose.UpOperations))
            await db.Database.ExecuteSqlRawAsync(command.CommandText);
        foreach (var command in generator.Generate(dailyCloseBank.UpOperations))
            await db.Database.ExecuteSqlRawAsync(command.CommandText);
        foreach (var command in generator.Generate(expensePaidFrom.UpOperations))
            await db.Database.ExecuteSqlRawAsync(command.CommandText);
        foreach (var command in generator.Generate(cashDrawerMovement.UpOperations))
            await db.Database.ExecuteSqlRawAsync(command.CommandText);
        foreach (var command in generator.Generate(parentPayment.UpOperations))
            await db.Database.ExecuteSqlRawAsync(command.CommandText);

        await using var check = db.Database.GetDbConnection().CreateCommand();
        check.CommandText = "SELECT COUNT(*) FROM SaleItems WHERE UnitCostAtSale IS NULL";
        Assert.Equal(1L, await check.ExecuteScalarAsync());
        check.CommandText = "SELECT COUNT(*) FROM PurchaseItems WHERE ConversionAtPurchase IS NULL";
        Assert.Equal(1L, await check.ExecuteScalarAsync());
        check.CommandText = "SELECT COUNT(*) FROM PurchaseItems WHERE CostCapturedAt IS NULL";
        Assert.Equal(1L, await check.ExecuteScalarAsync());
        check.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='DailyCashCloses'";
        Assert.Equal(1L, await check.ExecuteScalarAsync());
        check.CommandText = "SELECT COUNT(*) FROM pragma_table_info('Expenses') WHERE name='PaidFrom'";
        Assert.Equal(1L, await check.ExecuteScalarAsync());
        check.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='CashDrawerMovements'";
        Assert.Equal(1L, await check.ExecuteScalarAsync());
    }
}
