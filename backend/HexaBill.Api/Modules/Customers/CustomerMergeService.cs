/*
 * SuperAdmin customer merge — reassign all FK rows from loser customers to a survivor,
 * recalc balance, then delete empty losers. Feature-flagged; dry-run supported.
 */
using System.Text.Json;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace HexaBill.Api.Modules.Customers
{
    public interface ICustomerMergeService
    {
        bool IsMergeEnabled();
        Task<CustomerMergeResult> MergeAsync(int tenantId, int survivorId, IReadOnlyList<int> loserIds, bool dryRun, int actingUserId, CancellationToken ct = default);
    }

    public class CustomerMergeRequest
    {
        public int SurvivorId { get; set; }
        public List<int> LoserIds { get; set; } = new();
        public bool DryRun { get; set; } = true;
        /// <summary>Must equal MERGE when DryRun=false.</summary>
        public string? ConfirmToken { get; set; }
    }

    public class CustomerMergeResult
    {
        public bool Success { get; set; }
        public bool DryRun { get; set; }
        public string Message { get; set; } = string.Empty;
        public int TenantId { get; set; }
        public int SurvivorId { get; set; }
        public string? SurvivorName { get; set; }
        public List<int> LoserIds { get; set; } = new();
        public Dictionary<string, int> RowsMoved { get; set; } = new();
        public decimal? PredictedSurvivorBalance { get; set; }
        public decimal? SurvivorBalanceAfter { get; set; }
        public List<string> Warnings { get; set; } = new();
        public List<string> Errors { get; set; } = new();
    }

    public class CustomerMergeService : ICustomerMergeService
    {
        public const string FeatureFlagKey = "FeatureFlags:CustomerMerge";
        public const string ConfirmTokenValue = "MERGE";

        private readonly AppDbContext _context;
        private readonly ICustomerService _customerService;
        private readonly IConfiguration _configuration;
        private readonly ILogger<CustomerMergeService> _logger;

        public CustomerMergeService(
            AppDbContext context,
            ICustomerService customerService,
            IConfiguration configuration,
            ILogger<CustomerMergeService> logger)
        {
            _context = context;
            _customerService = customerService;
            _configuration = configuration;
            _logger = logger;
        }

        public bool IsMergeEnabled()
        {
            var env = Environment.GetEnvironmentVariable("FEATURE_FLAGS__CUSTOMER_MERGE")
                ?? Environment.GetEnvironmentVariable("FeatureFlags__CustomerMerge");
            if (!string.IsNullOrWhiteSpace(env) && bool.TryParse(env, out var fromEnv))
                return fromEnv;
            return _configuration.GetValue<bool>(FeatureFlagKey, false);
        }

        public static string NormalizeRootName(string? name)
        {
            if (string.IsNullOrWhiteSpace(name)) return string.Empty;
            var n = name.Trim().ToUpperInvariant();
            n = System.Text.RegularExpressions.Regex.Replace(n, @"\s+(CUSTOMER(\s+NAME)?)$", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            n = System.Text.RegularExpressions.Regex.Replace(n, @"\s+", " ").Trim();
            return n;
        }

        public async Task<CustomerMergeResult> MergeAsync(
            int tenantId,
            int survivorId,
            IReadOnlyList<int> loserIds,
            bool dryRun,
            int actingUserId,
            CancellationToken ct = default)
        {
            var result = new CustomerMergeResult
            {
                DryRun = dryRun,
                TenantId = tenantId,
                SurvivorId = survivorId,
                LoserIds = loserIds?.Distinct().Where(id => id != survivorId).ToList() ?? new List<int>()
            };

            if (!IsMergeEnabled() && !dryRun)
            {
                result.Errors.Add("Customer merge is disabled. Set FeatureFlags:CustomerMerge=true (or FEATURE_FLAGS__CUSTOMER_MERGE=true) to execute.");
                result.Message = "Merge disabled";
                return result;
            }

            if (result.LoserIds.Count == 0)
            {
                result.Errors.Add("At least one loser customer id is required.");
                result.Message = "Invalid request";
                return result;
            }

            var allIds = result.LoserIds.Concat(new[] { survivorId }).Distinct().ToList();
            var customers = await _context.Customers
                .Where(c => c.TenantId == tenantId && allIds.Contains(c.Id))
                .ToListAsync(ct);

            if (customers.Count != allIds.Count)
            {
                var found = customers.Select(c => c.Id).ToHashSet();
                var missing = allIds.Where(id => !found.Contains(id)).ToList();
                result.Errors.Add($"Customers not found for tenant {tenantId}: {string.Join(", ", missing)}");
                result.Message = "Validation failed";
                return result;
            }

            var survivor = customers.First(c => c.Id == survivorId);
            result.SurvivorName = survivor.Name;

            // InvoiceNo collision check across survivor + losers
            var invoiceGroups = await _context.Sales
                .Where(s => s.TenantId == tenantId && !s.IsDeleted && s.CustomerId != null && allIds.Contains(s.CustomerId.Value))
                .GroupBy(s => s.InvoiceNo)
                .Where(g => g.Select(x => x.CustomerId).Distinct().Count() > 1)
                .Select(g => g.Key)
                .Take(20)
                .ToListAsync(ct);
            if (invoiceGroups.Count > 0)
            {
                result.Errors.Add($"Invoice number collision across customers: {string.Join(", ", invoiceGroups)}");
                result.Message = "Cannot merge — invoice uniqueness conflict";
                return result;
            }

            async Task<int> CountSales(int cid) => await _context.Sales.CountAsync(s => s.TenantId == tenantId && s.CustomerId == cid && !s.IsDeleted, ct);
            async Task<int> CountPayments(int cid) => await _context.Payments.CountAsync(p => p.TenantId == tenantId && p.CustomerId == cid, ct);
            async Task<int> CountReturns(int cid) => await _context.SaleReturns.CountAsync(r => r.TenantId == tenantId && r.CustomerId == cid, ct);
            async Task<int> CountQuotes(int cid) => await _context.Quotations.CountAsync(q => q.TenantId == tenantId && q.CustomerId == cid, ct);
            async Task<int> CountCreditNotes(int cid) =>
                await _context.Database.SqlQuery<int>(
                    $"""SELECT COUNT(*)::int AS "Value" FROM "CreditNotes" WHERE "TenantId" = {tenantId} AND "CustomerId" = {cid}""")
                    .FirstAsync(ct);
            async Task<int> CountRecurring(int cid) => await _context.RecurringInvoices.CountAsync(r => r.TenantId == tenantId && r.CustomerId == cid, ct);
            async Task<int> CountRoutes(int cid) => await _context.RouteCustomers.CountAsync(r => r.CustomerId == cid, ct);
            async Task<int> CountVisits(int cid) => await _context.CustomerVisits.CountAsync(v => v.CustomerId == cid, ct);

            var moveSales = 0;
            var movePays = 0;
            var moveReturns = 0;
            var moveQuotes = 0;
            var moveCn = 0;
            var moveRecur = 0;
            var moveRoutes = 0;
            var moveVisits = 0;
            var skipRoutes = 0;

            foreach (var lid in result.LoserIds)
            {
                moveSales += await CountSales(lid);
                movePays += await CountPayments(lid);
                moveReturns += await CountReturns(lid);
                moveQuotes += await CountQuotes(lid);
                moveCn += await CountCreditNotes(lid);
                moveRecur += await CountRecurring(lid);
                moveRoutes += await CountRoutes(lid);
                moveVisits += await CountVisits(lid);
            }

            // Predicted balance = formula over combined ids
            var salesSum = await _context.Sales
                .Where(s => s.TenantId == tenantId && !s.IsDeleted && s.CustomerId != null && allIds.Contains(s.CustomerId.Value))
                .SumAsync(s => (decimal?)s.GrandTotal, ct) ?? 0m;
            var paySum = await _context.Payments
                .Where(p => p.TenantId == tenantId && p.CustomerId != null && allIds.Contains(p.CustomerId.Value)
                    && p.Status == PaymentStatus.CLEARED && p.SaleReturnId == null)
                .SumAsync(p => (decimal?)p.Amount, ct) ?? 0m;
            var retSum = await _context.SaleReturns
                .Where(r => r.TenantId == tenantId && r.CustomerId != null && allIds.Contains(r.CustomerId.Value)
                    && r.Status == ReturnStatus.Approved)
                .SumAsync(r => (decimal?)r.GrandTotal, ct) ?? 0m;
            var refunds = await _context.Payments
                .Where(p => p.TenantId == tenantId && p.CustomerId != null && allIds.Contains(p.CustomerId.Value)
                    && p.SaleReturnId != null && p.Status != PaymentStatus.VOID)
                .SumAsync(p => (decimal?)p.Amount, ct) ?? 0m;
            result.PredictedSurvivorBalance = salesSum - paySum - retSum + refunds;

            result.RowsMoved = new Dictionary<string, int>
            {
                ["Sales"] = moveSales,
                ["Payments"] = movePays,
                ["SaleReturns"] = moveReturns,
                ["Quotations"] = moveQuotes,
                ["CreditNotes"] = moveCn,
                ["RecurringInvoices"] = moveRecur,
                ["RouteCustomers"] = moveRoutes,
                ["CustomerVisits"] = moveVisits
            };

            if (dryRun)
            {
                result.Success = true;
                result.Message = $"Dry-run OK: would merge {result.LoserIds.Count} customer(s) into #{survivorId} ({survivor.Name}). Predicted balance {result.PredictedSurvivorBalance:F2}.";
                return result;
            }

            await using var tx = await _context.Database.BeginTransactionAsync(ct);
            try
            {
                foreach (var loserId in result.LoserIds)
                {
                    var loser = customers.First(c => c.Id == loserId);

                    // Copy blank profile fields from loser
                    if (string.IsNullOrWhiteSpace(survivor.Phone) && !string.IsNullOrWhiteSpace(loser.Phone))
                        survivor.Phone = loser.Phone;
                    if (string.IsNullOrWhiteSpace(survivor.Email) && !string.IsNullOrWhiteSpace(loser.Email))
                        survivor.Email = loser.Email;
                    if (string.IsNullOrWhiteSpace(survivor.Trn) && !string.IsNullOrWhiteSpace(loser.Trn))
                        survivor.Trn = loser.Trn;
                    if (string.IsNullOrWhiteSpace(survivor.Address) && !string.IsNullOrWhiteSpace(loser.Address))
                        survivor.Address = loser.Address;
                    if (survivor.CreditLimit <= 0 && loser.CreditLimit > 0)
                        survivor.CreditLimit = loser.CreditLimit;
                    if (!survivor.BranchId.HasValue && loser.BranchId.HasValue)
                        survivor.BranchId = loser.BranchId;
                    if (!survivor.RouteId.HasValue && loser.RouteId.HasValue)
                        survivor.RouteId = loser.RouteId;

                    // Raw SQL avoids EF model/schema drift (e.g. CreditNotes columns)
                    await _context.Database.ExecuteSqlInterpolatedAsync(
                        $"""UPDATE "Sales" SET "CustomerId" = {survivorId} WHERE "TenantId" = {tenantId} AND "CustomerId" = {loserId}""", ct);
                    await _context.Database.ExecuteSqlInterpolatedAsync(
                        $"""UPDATE "Payments" SET "CustomerId" = {survivorId} WHERE "TenantId" = {tenantId} AND "CustomerId" = {loserId}""", ct);
                    await _context.Database.ExecuteSqlInterpolatedAsync(
                        $"""UPDATE "SaleReturns" SET "CustomerId" = {survivorId} WHERE "TenantId" = {tenantId} AND "CustomerId" = {loserId}""", ct);
                    await _context.Database.ExecuteSqlInterpolatedAsync(
                        $"""UPDATE "Quotations" SET "CustomerId" = {survivorId} WHERE "TenantId" = {tenantId} AND "CustomerId" = {loserId}""", ct);
                    await _context.Database.ExecuteSqlInterpolatedAsync(
                        $"""UPDATE "CreditNotes" SET "CustomerId" = {survivorId} WHERE "TenantId" = {tenantId} AND "CustomerId" = {loserId}""", ct);
                    await _context.Database.ExecuteSqlInterpolatedAsync(
                        $"""UPDATE "RecurringInvoices" SET "CustomerId" = {survivorId} WHERE "TenantId" = {tenantId} AND "CustomerId" = {loserId}""", ct);

                    // RouteCustomers / CustomerVisits via SQL (avoid EF mapping quirks)
                    await _context.Database.ExecuteSqlInterpolatedAsync($"""
                        DELETE FROM "RouteCustomers" rc
                        WHERE rc."CustomerId" = {loserId}
                          AND EXISTS (
                            SELECT 1 FROM "RouteCustomers" s
                            WHERE s."CustomerId" = {survivorId} AND s."RouteId" = rc."RouteId"
                          )
                        """, ct);
                    await _context.Database.ExecuteSqlInterpolatedAsync(
                        $"""UPDATE "RouteCustomers" SET "CustomerId" = {survivorId} WHERE "CustomerId" = {loserId}""", ct);

                    await _context.Database.ExecuteSqlInterpolatedAsync($"""
                        DELETE FROM "CustomerVisits" v
                        WHERE v."CustomerId" = {loserId}
                          AND EXISTS (
                            SELECT 1 FROM "CustomerVisits" s
                            WHERE s."CustomerId" = {survivorId}
                              AND s."RouteId" = v."RouteId"
                              AND s."VisitDate" = v."VisitDate"
                          )
                        """, ct);
                    await _context.Database.ExecuteSqlInterpolatedAsync(
                        $"""UPDATE "CustomerVisits" SET "CustomerId" = {survivorId} WHERE "CustomerId" = {loserId}""", ct);

                    // Verify no remaining FKs (counts only — avoid loading broken entity shapes)
                    var remaining = await CountSales(loserId) + await CountPayments(loserId) + await CountReturns(loserId)
                        + await CountQuotes(loserId) + await CountRecurring(loserId)
                        + await CountRoutes(loserId) + await CountVisits(loserId);
                    var cnLeft = await CountCreditNotes(loserId);
                    remaining += cnLeft;

                    if (remaining > 0)
                        throw new InvalidOperationException($"Loser {loserId} still has {remaining} linked row(s) after reassignment.");

                    _context.Customers.Remove(loser);
                    await _context.SaveChangesAsync(ct);
                }

                survivor.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(ct);

                await _customerService.RecalculateCustomerBalanceAsync(survivorId, tenantId);

                var after = await _context.Customers.AsNoTracking().FirstAsync(c => c.Id == survivorId, ct);
                result.SurvivorBalanceAfter = after.Balance;

                if (actingUserId > 0)
                {
                    _context.AuditLogs.Add(new AuditLog
                    {
                        OwnerId = tenantId,
                        TenantId = tenantId,
                        UserId = actingUserId,
                        Action = "CustomerMerge",
                        EntityType = "Customer",
                        EntityId = survivorId,
                        Details = JsonSerializer.Serialize(new
                        {
                            survivorId,
                            loserIds = result.LoserIds,
                            rowsMoved = result.RowsMoved,
                            skipRoutes,
                            predictedBalance = result.PredictedSurvivorBalance,
                            balanceAfter = result.SurvivorBalanceAfter
                        }),
                        CreatedAt = DateTime.UtcNow
                    });
                    await _context.SaveChangesAsync(ct);
                }
                else
                {
                    result.Warnings.Add("Audit log skipped (no acting user id).");
                }

                await tx.CommitAsync(ct);

                if (skipRoutes > 0)
                    result.Warnings.Add($"Removed {skipRoutes} duplicate RouteCustomer row(s) already on survivor.");

                result.Success = true;
                result.Message = $"Merged {result.LoserIds.Count} customer(s) into #{survivorId}. Balance now {result.SurvivorBalanceAfter:F2}.";
                _logger.LogInformation("CustomerMerge tenant={TenantId} survivor={SurvivorId} losers={Losers} balance={Balance}",
                    tenantId, survivorId, string.Join(",", result.LoserIds), result.SurvivorBalanceAfter);
                return result;
            }
            catch (Exception ex)
            {
                try { await tx.RollbackAsync(ct); } catch { /* ignore */ }
                _logger.LogError(ex, "CustomerMerge failed tenant={TenantId} survivor={SurvivorId}", tenantId, survivorId);
                result.Success = false;
                result.Errors.Add(ex.Message);
                result.Message = "Merge failed — transaction rolled back";
                return result;
            }
        }
    }
}
