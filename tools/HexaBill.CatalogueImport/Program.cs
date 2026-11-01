// Product-master catalogue copy (names, units, SKUs only) from a source tenant into a target tenant.
//
//   plan  --target-tenant N [--source-tenant 20] --out DIR
//         Read-only (the session is forced to default_transaction_read_only=on and verified).
//         Writes the source audit, the import preview (one row per source product) and the conflict report.
//
//   apply --target-tenant N [--source-tenant 20] --manifest FILE --confirm IMPORT-CATALOGUE-TENANT-N --out DIR
//         Imports only manifest rows with Decision=IMPORT, in one transaction, scoped to the target tenant.
//         New products: stock 0, cost 0, price 0, inactive (catalogue-only). No stock movements, no history.
//         Re-running skips anything whose name or SKU already exists (idempotent).
//
// Connection string: environment variable HEXABILL_CATALOGUE_DB. Nothing is read from or written to other tenants.
using System.Globalization;
using System.Text;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Products;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using static HexaBill.Api.Modules.Products.CatalogueImportPlanner;

var opts = ParseArgs(args);
var mode = args.FirstOrDefault()?.ToLowerInvariant();
if (mode is not ("plan" or "apply") || !opts.ContainsKey("target-tenant") || !opts.ContainsKey("out"))
{
    Console.Error.WriteLine("usage: plan|apply --target-tenant N [--source-tenant 20] --out DIR [--manifest FILE --confirm IMPORT-CATALOGUE-TENANT-N]");
    return 2;
}

var conn = Environment.GetEnvironmentVariable("HEXABILL_CATALOGUE_DB");
if (string.IsNullOrWhiteSpace(conn)) { Console.Error.WriteLine("HEXABILL_CATALOGUE_DB is not set."); return 2; }

var target = int.Parse(opts["target-tenant"], CultureInfo.InvariantCulture);
var sourceTenant = int.Parse(opts.GetValueOrDefault("source-tenant", "20"), CultureInfo.InvariantCulture);
if (target <= 0 || target == sourceTenant) { Console.Error.WriteLine("Target tenant must differ from the source tenant."); return 2; }
var outDir = Directory.CreateDirectory(opts["out"]).FullName;

if (mode == "plan")
{
    var ro = new NpgsqlConnectionStringBuilder(conn) { Options = "-c default_transaction_read_only=on" }.ConnectionString;
    await using var src = await OpenAsync(ro, sourceTenant, requireReadOnly: true);
    await using var dst = await OpenAsync(ro, target, requireReadOnly: true);

    var (source, audit) = await ReadSourceAsync(src, sourceTenant);
    var destination = await ReadDestinationAsync(dst, target);
    var plan = Plan(source, destination);

    var preview = Path.Combine(outDir, $"TENANT-{target}-PRODUCT-IMPORT-PREVIEW.csv");
    var conflicts = Path.Combine(outDir, $"TENANT-{target}-PRODUCT-CONFLICT-REPORT.csv");
    await File.WriteAllTextAsync(Path.Combine(outDir, "PRODUCT-SOURCE-AUDIT.csv"), audit, Encoding.UTF8);
    await File.WriteAllTextAsync(preview, ToCsv(plan), Encoding.UTF8);
    await File.WriteAllTextAsync(conflicts, ToCsv(plan.Where(r => r.Decision == DecisionReview)), Encoding.UTF8);

    Console.WriteLine($"PLAN source tenant {sourceTenant}: {source.Count(s => s.Origin == "STARPLUS")} historical + {source.Count(s => s.Origin == "FH1")} operating = {source.Count} rows");
    Console.WriteLine($"PLAN target tenant {target}: {destination.Count} existing products (left unchanged)");
    foreach (var g in plan.GroupBy(r => (r.Decision, r.Classification)).OrderBy(g => g.Key.Decision).ThenBy(g => g.Key.Classification))
        Console.WriteLine($"  {g.Key.Decision,-8} {g.Key.Classification,-20} {g.Count(),5}");
    Console.WriteLine($"  TOTAL    {plan.Count,26}");
    Console.WriteLine($"Wrote {preview}");
    return 0;
}

// ---------------- apply ----------------
var expectedToken = $"IMPORT-CATALOGUE-TENANT-{target}";
if (opts.GetValueOrDefault("confirm") != expectedToken)
{
    Console.Error.WriteLine($"Refusing to write. Pass --confirm {expectedToken} after the manifest has been reviewed and approved.");
    return 3;
}
if (!opts.TryGetValue("manifest", out var manifestPath) || !File.Exists(manifestPath))
{
    Console.Error.WriteLine("--manifest FILE is required for apply.");
    return 2;
}

var manifest = FromCsv(await File.ReadAllTextAsync(manifestPath));
var wanted = manifest.Where(r => r.Decision == DecisionImport).ToList();

await using var source2 = await OpenAsync(conn, sourceTenant, requireReadOnly: false);
var (sourceRows, _) = await ReadSourceAsync(source2, sourceTenant);
var sourceIndex = sourceRows.ToDictionary(s => (s.Origin, s.SourceId));

await using var db = await OpenAsync(conn, target, requireReadOnly: false);
await using var tx = await db.Database.BeginTransactionAsync();
var existing = await ReadDestinationAsync(db, target);
var names = existing.Select(d => NormalizeName(d.NameEn)).ToHashSet();
var skus = existing.Select(d => NormalizeSku(d.Sku)).Where(s => s.Length > 0).ToHashSet();

var results = new StringBuilder("Origin,SourceId,NameEn,Sku,UnitType,Outcome,NewProductId\n");
var added = new List<(PlanRow Row, Product Product)>();
var now = DateTime.UtcNow;
foreach (var row in wanted)
{
    string outcome;
    if (!sourceIndex.TryGetValue((row.Origin, row.SourceId), out var src))
        outcome = "REJECTED_NOT_IN_SOURCE";
    else if (NormalizeName(src.NameEn) != NormalizeName(row.NameEn) || NormalizeUnit(src.UnitType) != NormalizeUnit(row.UnitType))
        outcome = "REJECTED_MANIFEST_DIFFERS_FROM_SOURCE";
    else if (names.Contains(NormalizeName(row.NameEn)))
        outcome = "SKIPPED_NAME_EXISTS";
    else
    {
        var sku = (row.ProposedSku ?? row.SourceSku).Trim();
        if (sku.Length == 0 || sku.Length > 50) outcome = "REJECTED_SKU_INVALID";
        else if (skus.Contains(NormalizeSku(sku))) outcome = "REJECTED_SKU_IN_USE";
        else
        {
            var product = new Product
            {
                TenantId = target,
                OwnerId = target,
                Sku = sku,
                NameEn = src.NameEn.Trim(),
                NameAr = string.IsNullOrWhiteSpace(src.NameAr) ? null : src.NameAr.Trim(),
                UnitType = src.UnitType.Trim(),
                ConversionToBase = src.ConversionToBase <= 0 ? 1 : src.ConversionToBase,
                CostPrice = 0,
                SellPrice = 0,
                StockQty = 0,
                ReorderLevel = 0,
                Barcode = null,
                IsActive = false,
                CreatedAt = now,
                UpdatedAt = now
            };
            db.Products.Add(product);
            added.Add((row, product));
            names.Add(NormalizeName(product.NameEn));
            skus.Add(NormalizeSku(sku));
            outcome = "IMPORTED";
        }
    }
    if (outcome != "IMPORTED") results.AppendLine(Csv(row.Origin, row.SourceId.ToString(CultureInfo.InvariantCulture), row.NameEn, row.ProposedSku ?? row.SourceSku, row.UnitType, outcome, ""));
}

await db.SaveChangesAsync();

// Post-conditions inside the transaction: exact count, zero stock, inactive, no stock movements.
var ids = added.Select(a => a.Product.Id).ToList();
var check = await db.Products.AsNoTracking().Where(p => p.TenantId == target && ids.Contains(p.Id))
    .Select(p => new { p.StockQty, p.SellPrice, p.CostPrice, p.IsActive }).ToListAsync();
var movements = await db.InventoryTransactions.AsNoTracking().CountAsync(t => ids.Contains(t.ProductId));
if (check.Count != ids.Count || check.Any(p => p.StockQty != 0 || p.SellPrice != 0 || p.CostPrice != 0 || p.IsActive) || movements != 0)
{
    await tx.RollbackAsync();
    Console.Error.WriteLine($"Post-condition failed (rows {check.Count}/{ids.Count}, movements {movements}); rolled back, nothing written.");
    return 4;
}
await tx.CommitAsync();

foreach (var (row, p) in added)
    results.AppendLine(Csv(row.Origin, row.SourceId.ToString(CultureInfo.InvariantCulture), p.NameEn, p.Sku, p.UnitType, "IMPORTED", p.Id.ToString(CultureInfo.InvariantCulture)));
var stamp = now.ToString("yyyyMMddTHHmmssZ", CultureInfo.InvariantCulture);
await File.WriteAllTextAsync(Path.Combine(outDir, $"TENANT-{target}-PRODUCT-IMPORT-RESULTS-{stamp}.csv"), results.ToString(), Encoding.UTF8);
await File.WriteAllTextAsync(Path.Combine(outDir, $"TENANT-{target}-PRODUCT-IMPORT-ROLLBACK-{stamp}.sql"), RollbackSql(target, ids), Encoding.UTF8);
Console.WriteLine($"APPLY tenant {target}: imported {ids.Count}, not imported {wanted.Count - ids.Count} (see results CSV). Committed.");
return 0;

// ---------------- helpers ----------------

static async Task<AppDbContext> OpenAsync(string connectionString, int tenantId, bool requireReadOnly)
{
    var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connectionString).Options);
    await db.Database.OpenConnectionAsync();
    if (requireReadOnly)
    {
        await using var cmd = db.Database.GetDbConnection().CreateCommand();
        cmd.CommandText = "SHOW default_transaction_read_only";
        if ((string?)await cmd.ExecuteScalarAsync() != "on") throw new InvalidOperationException("Plan mode requires a read-only session.");
    }
    db.SetRequestTenantScope(tenantId, isPlatformScope: false);
    return db;
}

static async Task<(List<SourceProduct> Rows, string AuditCsv)> ReadSourceAsync(AppDbContext db, int tenantId)
{
    var legacy = await db.LegacyProducts.AsNoTracking().Where(p => p.TenantId == tenantId).OrderBy(p => p.SourceProductId)
        .Select(p => new SourceProduct("STARPLUS", p.SourceProductId, p.Sku, p.NameEn, p.NameAr, p.UnitType, p.ConversionToBase, p.Barcode, true))
        .ToListAsync();
    var operating = await db.Products.AsNoTracking().Where(p => p.TenantId == tenantId).OrderBy(p => p.Id)
        .Select(p => new SourceProduct("FH1", p.Id, p.Sku, p.NameEn, p.NameAr, p.UnitType, p.ConversionToBase, p.Barcode, p.IsActive))
        .ToListAsync();
    var rows = operating.Concat(legacy).ToList();
    var audit = new StringBuilder("Origin,SourceId,Sku,NameEn,NameAr,UnitType,ConversionToBase,Barcode,IsActive,NormalizedName,LooksLikeTest\n");
    foreach (var r in rows)
        audit.AppendLine(Csv(r.Origin, r.SourceId.ToString(CultureInfo.InvariantCulture), r.Sku, r.NameEn, r.NameAr ?? "", r.UnitType,
            r.ConversionToBase.ToString(CultureInfo.InvariantCulture), r.Barcode ?? "", r.IsActive ? "true" : "false",
            NormalizeName(r.NameEn), LooksLikeTestProduct(r.NameEn) ? "true" : "false"));
    return (rows, audit.ToString());
}

static Task<List<DestinationProduct>> ReadDestinationAsync(AppDbContext db, int tenantId) =>
    db.Products.AsNoTracking().Where(p => p.TenantId == tenantId).OrderBy(p => p.Id)
        .Select(p => new DestinationProduct(p.Id, p.Sku, p.NameEn, p.UnitType, p.Barcode, p.IsActive)).ToListAsync();

static string RollbackSql(int tenantId, IReadOnlyCollection<int> ids)
{
    if (ids.Count == 0) return "-- nothing was imported\n";
    var list = string.Join(",", ids);
    return $@"-- Rolls back exactly the catalogue rows created by this import, only if nothing references them yet.
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM ""SaleItems"" WHERE ""ProductId"" IN ({list}))
     OR EXISTS (SELECT 1 FROM ""PurchaseItems"" WHERE ""ProductId"" IN ({list}))
     OR EXISTS (SELECT 1 FROM ""InventoryTransactions"" WHERE ""ProductId"" IN ({list})) THEN
    RAISE EXCEPTION 'Imported products are already used; do not delete them.';
  END IF;
END $$;
DELETE FROM ""Products"" WHERE ""TenantId"" = {tenantId} AND ""Id"" IN ({list}) AND ""StockQty"" = 0;
COMMIT;
";
}

static string Csv(params string[] values) => string.Join(",", values.Select(v =>
    v.IndexOfAny(new[] { ',', '"', '\r', '\n' }) >= 0 ? "\"" + v.Replace("\"", "\"\"") + "\"" : v));

static Dictionary<string, string> ParseArgs(string[] a)
{
    var d = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    for (var i = 1; i < a.Length; i++)
        if (a[i].StartsWith("--", StringComparison.Ordinal) && i + 1 < a.Length) d[a[i][2..]] = a[++i];
    return d;
}
