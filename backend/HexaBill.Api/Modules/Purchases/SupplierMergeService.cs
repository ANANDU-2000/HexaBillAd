/*
 * Supplier merge — reassign purchases/payments/credits/discounts from loser suppliers
 * to a survivor, rewrite name-keyed ledger strings, soft-delete losers. Feature-flagged; dry-run supported.
 */
using System.Text.Json;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace HexaBill.Api.Modules.Purchases
{
    public interface ISupplierMergeService
    {
        bool IsMergeEnabled();
        Task<SupplierMergeResult> MergeAsync(
            int tenantId,
            int survivorId,
            IReadOnlyList<int> loserIds,
            bool dryRun,
            int actingUserId,
            decimal? expectedCombinedNet = null,
            CancellationToken ct = default);
    }

    public class SupplierMergeResult
    {
        public bool Success { get; set; }
        public bool DryRun { get; set; }
        public string Message { get; set; } = string.Empty;
        public int TenantId { get; set; }
        public int SurvivorId { get; set; }
        public string? SurvivorName { get; set; }
        public List<int> LoserIds { get; set; } = new();
        public Dictionary<string, int> RowsMoved { get; set; } = new();
        public Dictionary<string, decimal> VariantBalancesBefore { get; set; } = new();
        public decimal? PredictedSurvivorBalance { get; set; }
        public decimal? SurvivorBalanceAfter { get; set; }
        public List<string> Warnings { get; set; } = new();
        public List<string> Errors { get; set; } = new();
    }

    public class SupplierMergeService : ISupplierMergeService
    {
        public const string FeatureFlagKey = "FeatureFlags:SupplierMerge";
        public const string ConfirmTokenValue = "MERGE";

        private readonly AppDbContext _context;
        private readonly ISupplierService _supplierService;
        private readonly IConfiguration _configuration;
        private readonly ILogger<SupplierMergeService> _logger;

        public SupplierMergeService(
            AppDbContext context,
            ISupplierService supplierService,
            IConfiguration configuration,
            ILogger<SupplierMergeService> logger)
        {
            _context = context;
            _supplierService = supplierService;
            _configuration = configuration;
            _logger = logger;
        }

        public bool IsMergeEnabled()
        {
            var env = Environment.GetEnvironmentVariable("FEATURE_FLAGS__SUPPLIER_MERGE")
                ?? Environment.GetEnvironmentVariable("FeatureFlags__SupplierMerge");
            if (!string.IsNullOrWhiteSpace(env) && bool.TryParse(env, out var fromEnv))
                return fromEnv;
            return _configuration.GetValue<bool>(FeatureFlagKey, false);
        }

        private static string NormKey(string? name)
        {
            if (string.IsNullOrWhiteSpace(name)) return string.Empty;
            return System.Text.RegularExpressions.Regex.Replace(name.Trim().ToLowerInvariant(), @"\s+", " ");
        }

        public async Task<SupplierMergeResult> MergeAsync(
            int tenantId,
            int survivorId,
            IReadOnlyList<int> loserIds,
            bool dryRun,
            int actingUserId,
            decimal? expectedCombinedNet = null,
            CancellationToken ct = default)
        {
            var result = new SupplierMergeResult
            {
                DryRun = dryRun,
                TenantId = tenantId,
                SurvivorId = survivorId,
                LoserIds = loserIds?.Distinct().Where(id => id != survivorId).ToList() ?? new List<int>()
            };

            if (!IsMergeEnabled() && !dryRun)
            {
                result.Errors.Add("Supplier merge is disabled. Set FeatureFlags:SupplierMerge=true (or FEATURE_FLAGS__SUPPLIER_MERGE=true) to execute.");
                result.Message = "Merge disabled";
                return result;
            }

            if (result.LoserIds.Count == 0)
            {
                result.Errors.Add("At least one loser supplier id is required.");
                result.Message = "Invalid request";
                return result;
            }

            var allIds = result.LoserIds.Concat(new[] { survivorId }).Distinct().ToList();
            var suppliers = await _context.Suppliers
                .Where(s => s.TenantId == tenantId && allIds.Contains(s.Id))
                .ToListAsync(ct);

            if (suppliers.Count != allIds.Count)
            {
                var found = suppliers.Select(s => s.Id).ToHashSet();
                var missing = allIds.Where(id => !found.Contains(id)).ToList();
                result.Errors.Add($"Suppliers not found for tenant {tenantId}: {string.Join(", ", missing)}");
                result.Message = "Validation failed";
                return result;
            }

            var survivor = suppliers.First(s => s.Id == survivorId);
            result.SurvivorName = survivor.Name.Trim();
            var survivorName = result.SurvivorName;

            // All exact name variants from directory rows (case/spacing normalized for matching)
            var nameVariants = suppliers
                .Select(s => s.Name.Trim())
                .Where(n => !string.IsNullOrEmpty(n))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            // Per-variant balances (name-keyed, same formula as GetSupplierBalanceAsync)
            decimal combinedNet = 0m;
            foreach (var variant in nameVariants)
            {
                var bal = await _supplierService.GetSupplierBalanceAsync(tenantId, variant);
                result.VariantBalancesBefore[variant] = bal.NetPayable;
                combinedNet += bal.NetPayable;
            }

            result.PredictedSurvivorBalance = combinedNet;

            if (expectedCombinedNet.HasValue && Math.Abs(combinedNet - expectedCombinedNet.Value) > 0.009m)
            {
                result.Errors.Add(
                    $"Balance drifted from Phase 0 snapshot. Expected combined net {expectedCombinedNet.Value:F2}, live {combinedNet:F2}.");
                result.Message = "Balance gate failed";
                return result;
            }

            // Row counts to move (avoid loading rows with null SupplierName)
            var loserIdSet = result.LoserIds.ToHashSet();
            var purchasesById = await _context.Purchases.CountAsync(
                p => p.TenantId == tenantId && p.SupplierId != null && loserIdSet.Contains(p.SupplierId.Value), ct);
            var purchasesByName = 0;
            var paymentsByName = 0;
            var creditsByName = 0;
            foreach (var variant in nameVariants)
            {
                purchasesByName += await _context.Purchases.CountAsync(
                    p => p.TenantId == tenantId && p.SupplierName == variant, ct);
                if (!string.Equals(variant, survivorName, StringComparison.Ordinal))
                {
                    paymentsByName += await _context.SupplierPayments.CountAsync(
                        sp => sp.TenantId == tenantId && sp.SupplierName == variant, ct);
                    creditsByName += await _context.SupplierLedgerCredits.CountAsync(
                        c => c.TenantId == tenantId && c.SupplierName == variant, ct);
                }
            }

            var vendorDiscountCount = await _context.VendorDiscounts.CountAsync(
                vd => vd.TenantId == tenantId && loserIdSet.Contains(vd.SupplierId), ct);
            var purchaseReturnCount = await _context.PurchaseReturns.CountAsync(
                pr => pr.SupplierId != null && loserIdSet.Contains(pr.SupplierId.Value), ct);

            result.RowsMoved = new Dictionary<string, int>
            {
                ["PurchasesBySupplierId"] = purchasesById,
                ["PurchasesMatchingVariantNames"] = purchasesByName,
                ["SupplierPayments"] = paymentsByName,
                ["SupplierLedgerCredits"] = creditsByName,
                ["VendorDiscounts"] = vendorDiscountCount,
                ["PurchaseReturns"] = purchaseReturnCount
            };

            if (dryRun)
            {
                result.Success = true;
                result.Message =
                    $"Dry-run OK: would merge losers [{string.Join(",", result.LoserIds)}] into #{survivorId} ({survivorName}). " +
                    $"Predicted net payable {result.PredictedSurvivorBalance:F2}. Reactivate survivor if inactive.";
                return result;
            }

            await using var tx = await _context.Database.BeginTransactionAsync(ct);
            try
            {
                // Ensure survivor is active and name is exact
                survivor.IsActive = true;
                survivor.Name = survivorName;
                survivor.NormalizedName = survivorName.ToLowerInvariant();
                survivor.UpdatedAt = DateTime.UtcNow;

                // Copy blank profile fields from losers
                foreach (var loserId in result.LoserIds)
                {
                    var loser = suppliers.First(s => s.Id == loserId);
                    if (string.IsNullOrWhiteSpace(survivor.Phone) && !string.IsNullOrWhiteSpace(loser.Phone))
                        survivor.Phone = loser.Phone;
                    if (string.IsNullOrWhiteSpace(survivor.Email) && !string.IsNullOrWhiteSpace(loser.Email))
                        survivor.Email = loser.Email;
                    if (string.IsNullOrWhiteSpace(survivor.Address) && !string.IsNullOrWhiteSpace(loser.Address))
                        survivor.Address = loser.Address;
                    if (survivor.CreditLimit <= 0 && loser.CreditLimit > 0)
                        survivor.CreditLimit = loser.CreditLimit;
                    if (string.IsNullOrWhiteSpace(survivor.PaymentTerms) && !string.IsNullOrWhiteSpace(loser.PaymentTerms))
                        survivor.PaymentTerms = loser.PaymentTerms;
                    if (!survivor.CategoryId.HasValue && loser.CategoryId.HasValue)
                        survivor.CategoryId = loser.CategoryId;
                }

                await _context.SaveChangesAsync(ct);

                // Move VendorDiscounts before soft-delete (RESTRICT FK)
                foreach (var loserId in result.LoserIds)
                {
                    await _context.Database.ExecuteSqlInterpolatedAsync($"""
                        UPDATE "VendorDiscounts"
                        SET "SupplierId" = {survivorId}
                        WHERE "TenantId" = {tenantId} AND "SupplierId" = {loserId}
                        """, ct);

                    await _context.Database.ExecuteSqlInterpolatedAsync($"""
                        UPDATE "PurchaseReturns"
                        SET "SupplierId" = {survivorId}
                        WHERE "SupplierId" = {loserId}
                        """, ct);

                    // Purchases: SupplierId in losers → survivor + name
                    await _context.Database.ExecuteSqlInterpolatedAsync($"""
                        UPDATE "Purchases"
                        SET "SupplierId" = {survivorId}, "SupplierName" = {survivorName}
                        WHERE "TenantId" = {tenantId} AND "SupplierId" = {loserId}
                        """, ct);
                }

                // Purchases: name matches any variant (including null SupplierId) → survivor id + name
                foreach (var variant in nameVariants)
                {
                    await _context.Database.ExecuteSqlInterpolatedAsync($"""
                        UPDATE "Purchases"
                        SET "SupplierId" = {survivorId}, "SupplierName" = {survivorName}
                        WHERE "TenantId" = {tenantId}
                          AND LOWER(TRIM("SupplierName")) = {NormKey(variant)}
                        """, ct);
                }

                foreach (var variant in nameVariants)
                {
                    var key = NormKey(variant);
                    if (string.Equals(key, NormKey(survivorName), StringComparison.Ordinal))
                        continue;

                    await _context.Database.ExecuteSqlInterpolatedAsync($"""
                        UPDATE "SupplierPayments"
                        SET "SupplierName" = {survivorName}
                        WHERE "TenantId" = {tenantId}
                          AND LOWER(TRIM("SupplierName")) = {key}
                        """, ct);

                    await _context.Database.ExecuteSqlInterpolatedAsync($"""
                        UPDATE "SupplierLedgerCredits"
                        SET "SupplierName" = {survivorName}
                        WHERE "TenantId" = {tenantId}
                          AND LOWER(TRIM("SupplierName")) = {key}
                        """, ct);
                }

                // Soft-delete losers with unique NormalizedName
                foreach (var loserId in result.LoserIds)
                {
                    var loser = suppliers.First(s => s.Id == loserId);
                    var newName = $"{loser.Name.Trim()} (#{loserId} merged into #{survivorId})";
                    if (newName.Length > 200)
                        newName = $"Supplier #{loserId} (merged into #{survivorId})";
                    loser.Name = newName;
                    loser.NormalizedName = newName.ToLowerInvariant();
                    loser.IsActive = false;
                    loser.UpdatedAt = DateTime.UtcNow;
                }

                await _context.SaveChangesAsync(ct);

                // Balance gate: survivor name must equal predicted combined net
                var afterBal = await _supplierService.GetSupplierBalanceAsync(tenantId, survivorName);
                result.SurvivorBalanceAfter = afterBal.NetPayable;

                if (Math.Abs(afterBal.NetPayable - combinedNet) > 0.009m)
                {
                    throw new InvalidOperationException(
                        $"Post-merge balance {afterBal.NetPayable:F2} != pre-merge combined {combinedNet:F2}. Rolling back.");
                }

                // Ensure loser name variants no longer hold balance
                foreach (var variant in nameVariants)
                {
                    if (string.Equals(NormKey(variant), NormKey(survivorName), StringComparison.Ordinal))
                        continue;
                    var leftover = await _supplierService.GetSupplierBalanceAsync(tenantId, variant);
                    if (Math.Abs(leftover.NetPayable) > 0.009m
                        || leftover.TotalPurchases > 0.009m
                        || leftover.TotalPayments > 0.009m
                        || leftover.TotalLedgerCredits > 0.009m)
                    {
                        throw new InvalidOperationException(
                            $"Loser variant '{variant}' still has ledger activity after merge (net {leftover.NetPayable:F2}). Rolling back.");
                    }
                }

                if (actingUserId > 0)
                {
                    _context.AuditLogs.Add(new AuditLog
                    {
                        OwnerId = tenantId,
                        TenantId = tenantId,
                        UserId = actingUserId,
                        Action = "SupplierMerge",
                        EntityType = "Supplier",
                        EntityId = survivorId,
                        Details = JsonSerializer.Serialize(new
                        {
                            survivorId,
                            survivorName,
                            loserIds = result.LoserIds,
                            nameVariants,
                            rowsMoved = result.RowsMoved,
                            variantBalancesBefore = result.VariantBalancesBefore,
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

                result.Success = true;
                result.Message =
                    $"Merged {result.LoserIds.Count} supplier(s) into #{survivorId} ({survivorName}). Net payable {result.SurvivorBalanceAfter:F2}.";
                _logger.LogInformation(
                    "SupplierMerge tenant={TenantId} survivor={SurvivorId} losers={Losers} balance={Balance}",
                    tenantId, survivorId, string.Join(",", result.LoserIds), result.SurvivorBalanceAfter);
                return result;
            }
            catch (Exception ex)
            {
                try { await tx.RollbackAsync(ct); } catch { /* ignore */ }
                _logger.LogError(ex, "SupplierMerge failed tenant={TenantId} survivor={SurvivorId}", tenantId, survivorId);
                result.Success = false;
                result.Errors.Add(ex.Message);
                result.Message = "Merge failed — transaction rolled back";
                return result;
            }
        }
    }
}
