using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Notifications;
using HexaBill.Api.Modules.SuperAdmin;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Modules.DailyClose;

public interface IDailyCloseService
{
    Task EnsureFeatureEnabledAsync(int tenantId);
    Task<DailyClosePreviewDto> GetPreviewAsync(int tenantId, DateTime businessDate, decimal openingCash, int? branchId = null);
    Task<DailyCashCloseDto> SaveCloseAsync(SaveDailyCloseRequest request, int tenantId, int userId, bool canSubmitClose);
    Task<DailyCashCloseDto> ReopenAsync(ReopenDailyCloseRequest request, int tenantId, int userId, bool canReopen);
    Task<List<DailyCashCloseDto>> GetHistoryAsync(int tenantId, DateTime? from, DateTime? to, int? branchId = null);
    Task<DailyCloseStatusDto> GetStatusAsync(int tenantId, DateTime businessDate, int? branchId = null);
    Task<List<CashDrawerMovementDto>> GetMovementsAsync(int tenantId, DateTime businessDate, int? branchId = null);
    Task<CashDrawerMovementDto> CreateMovementAsync(CreateCashDrawerMovementRequest request, int tenantId, int userId, bool canManage);
    Task DeleteMovementAsync(int movementId, int tenantId, int userId, bool canManage);
}

public class DailyCloseService : IDailyCloseService
{
    private readonly AppDbContext _context;
    private readonly ITimeZoneService _timeZone;
    private readonly IAuditService _audit;
    private readonly IAlertService _alerts;
    private readonly ISalesSchemaService _salesSchema;

    public DailyCloseService(AppDbContext context, ITimeZoneService timeZone, IAuditService audit, IAlertService alerts, ISalesSchemaService salesSchema)
    {
        _context = context;
        _timeZone = timeZone;
        _audit = audit;
        _alerts = alerts;
        _salesSchema = salesSchema;
    }

    public async Task EnsureFeatureEnabledAsync(int tenantId)
    {
        var json = await _context.Tenants.AsNoTracking()
            .Where(t => t.Id == tenantId)
            .Select(t => t.FeaturesJson)
            .FirstOrDefaultAsync();
        if (!TenantFeatureFlags.IsEnabled(json, TenantFeatureFlags.DailyClose))
            throw new InvalidOperationException("Daily close is not enabled for this workspace.");
    }

    public async Task<DailyClosePreviewDto> GetPreviewAsync(int tenantId, DateTime businessDate, decimal openingCash, int? branchId = null)
    {
        await EnsureFeatureEnabledAsync(tenantId);
        await ValidateBranchAsync(tenantId, branchId);
        var (start, end) = GstDayRange(businessDate);
        var movements = await ComputeMovementsAsync(tenantId, start, end, branchId);
        var expected = Math.Round(openingCash + movements.CashReceived - movements.CashPaidOut, 2, MidpointRounding.AwayFromZero);
        return new DailyClosePreviewDto
        {
            BusinessDate = NormalizeBusinessDate(businessDate),
            BranchId = branchId,
            OpeningCash = openingCash,
            CashReceived = movements.CashReceived,
            CollectionsCashReceived = movements.CollectionsCashReceived,
            CashPaidOut = movements.CashPaidOut,
            CollectionsCashPaidOut = movements.CollectionsCashPaidOut,
            ExpectedCash = expected,
            CashReceiptCount = movements.CashReceiptCount,
            ExpenseCount = movements.ExpenseCount,
            SupplierCashPaymentCount = movements.SupplierCashPaymentCount,
            BankReceived = movements.BankReceived,
            BankPaidOut = movements.BankPaidOut,
            BankReceiptCount = movements.BankReceiptCount,
            SupplierBankPaymentCount = movements.SupplierBankPaymentCount,
            OwnerCapitalIn = movements.OwnerCapitalIn,
            OwnerDrawing = movements.OwnerDrawing,
            BankToDrawer = movements.BankToDrawer,
            DrawerToBank = movements.DrawerToBank,
            DrawerMovementCount = movements.DrawerMovementCount
        };
    }

    public async Task<List<CashDrawerMovementDto>> GetMovementsAsync(int tenantId, DateTime businessDate, int? branchId = null)
    {
        await EnsureFeatureEnabledAsync(tenantId);
        await ValidateBranchAsync(tenantId, branchId);
        var (start, end) = GstDayRange(businessDate);
        var q = _context.CashDrawerMovements.AsNoTracking()
            .Where(m => m.TenantId == tenantId && m.MovementDate >= start && m.MovementDate < end);
        if (branchId.HasValue)
            q = q.Where(m => m.BranchId == branchId);
        var rows = await q.OrderByDescending(m => m.CreatedAt).ToListAsync();
        return rows.Select(MapMovement).ToList();
    }

    public async Task<CashDrawerMovementDto> CreateMovementAsync(CreateCashDrawerMovementRequest request, int tenantId, int userId, bool canManage)
    {
        await EnsureFeatureEnabledAsync(tenantId);
        if (!canManage)
            throw new UnauthorizedAccessException("Only an owner or admin can record capital or transfer movements.");
        await ValidateBranchAsync(tenantId, request.BranchId);
        if (request.Amount <= 0)
            throw new ArgumentException("Amount must be greater than zero.");
        var businessDate = NormalizeBusinessDate(request.BusinessDate);

        var kind = ParseMovementKind(request.Kind);
        var (start, end) = GstDayRange(businessDate);
        var movementAt = request.MovementDate.HasValue
            ? (request.MovementDate.Value.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(request.MovementDate.Value, DateTimeKind.Utc)
                : request.MovementDate.Value.ToUniversalTime())
            : start.AddHours(12);
        if (movementAt < start || movementAt >= end)
            throw new ArgumentException("Movement time must fall on the selected business date (GST).");

        var row = new CashDrawerMovement
        {
            TenantId = tenantId,
            OwnerId = tenantId,
            BranchId = request.BranchId,
            MovementDate = movementAt,
            Kind = kind,
            Amount = Math.Round(request.Amount, 2, MidpointRounding.AwayFromZero),
            Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };
        await _context.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                await DailyClosePostingGuard.EnsureOpenAsync(_context, tenantId, movementAt, request.BranchId);
                _context.CashDrawerMovements.Add(row);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        });
        await _audit.LogAsync("Cash drawer movement recorded", "CashDrawerMovement", row.Id,
            details: $"{kind} {row.Amount:F2} AED", actingUserId: userId);
        return MapMovement(row);
    }

    public async Task DeleteMovementAsync(int movementId, int tenantId, int userId, bool canManage)
    {
        await EnsureFeatureEnabledAsync(tenantId);
        if (!canManage)
            throw new UnauthorizedAccessException("Only an owner or admin can delete capital or transfer movements.");
        await _context.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var row = await _context.CashDrawerMovements.FirstOrDefaultAsync(m => m.Id == movementId && m.TenantId == tenantId);
                if (row == null)
                    throw new InvalidOperationException("Movement not found.");
                await DailyClosePostingGuard.EnsureOpenAsync(_context, tenantId, row.MovementDate, row.BranchId);
                _context.CashDrawerMovements.Remove(row);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        });
        await _audit.LogAsync("Cash drawer movement deleted", "CashDrawerMovement", movementId, actingUserId: userId);
    }

    public async Task<DailyCashCloseDto> SaveCloseAsync(SaveDailyCloseRequest request, int tenantId, int userId, bool canSubmitClose)
    {
        await EnsureFeatureEnabledAsync(tenantId);
        await ValidateBranchAsync(tenantId, request.BranchId);
        if (request.CountedCash < 0)
            throw new ArgumentException("Counted cash cannot be negative.");
        if (request.SubmitClose && !canSubmitClose)
            throw new UnauthorizedAccessException("Only an owner or admin can submit a daily close.");

        var strategy = _context.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();
            DailyCashClose row;
            DailyClosePreviewDto preview;
            decimal variance;
            DateTime businessDate;
            try
            {
                // Serialize the business-day scope, including the first close when
                // there is no row to lock. PostgreSQL unique indexes treat NULL
                // BranchId values as distinct, so the index alone is insufficient.
                await DailyClosePostingGuard.AcquireBusinessDayLockAsync(
                    _context, tenantId, NormalizeBusinessDate(request.BusinessDate), request.BranchId);
                (row, preview, variance, businessDate) = await PersistCloseAsync(request, tenantId, userId);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch (DbUpdateException ex) when (IsDailyCloseVersionConflict(ex))
            {
                await transaction.RollbackAsync();
                throw new InvalidOperationException("This daily close was updated by another session. Refresh and try again.");
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }

            if (request.SubmitClose)
            {
                await _audit.LogAsync("Daily close submitted", "DailyCashClose", row.Id,
                    details: $"BusinessDate={businessDate:yyyy-MM-dd}; Expected={preview.ExpectedCash:F2}; Counted={request.CountedCash:F2}; Variance={variance:F2}",
                    actingUserId: userId);
                if (Math.Abs(variance) > 0.01m)
                {
                    var branchLabel = request.BranchId.HasValue ? $" branch {request.BranchId}" : "";
                    await _alerts.CreateAlertAsync(
                        AlertType.DailyCloseVariance,
                        "Daily close cash variance",
                        $"Business date {businessDate:yyyy-MM-dd}{branchLabel}: expected {preview.ExpectedCash:F2} AED, counted {request.CountedCash:F2} AED (variance {variance:F2}). Reason: {request.VarianceReason ?? "—"}",
                        Math.Abs(variance) >= 50m ? AlertSeverity.Warning : AlertSeverity.Info,
                        new Dictionary<string, object>
                        {
                            ["dailyCloseId"] = row.Id,
                            ["businessDate"] = businessDate.ToString("yyyy-MM-dd"),
                            ["expectedCash"] = preview.ExpectedCash,
                            ["countedCash"] = request.CountedCash,
                            ["variance"] = variance
                        },
                        tenantId);
                }
            }
            return Map(row);
        });
    }

    private async Task<(DailyCashClose row, DailyClosePreviewDto preview, decimal variance, DateTime businessDate)> PersistCloseAsync(
        SaveDailyCloseRequest request, int tenantId, int userId)
    {
        var businessDate = NormalizeBusinessDate(request.BusinessDate);
        var preview = await GetPreviewAsync(tenantId, businessDate, request.OpeningCash, request.BranchId);
        var variance = Math.Round(request.CountedCash - preview.ExpectedCash, 2, MidpointRounding.AwayFromZero);
        if (request.SubmitClose && Math.Abs(variance) > 0.01m && string.IsNullOrWhiteSpace(request.VarianceReason))
            throw new ArgumentException("Variance reason is required when counted cash does not match expected cash.");

        var existing = await _context.DailyCashCloses
            .Where(c => c.TenantId == tenantId && c.BusinessDate == businessDate && c.BranchId == request.BranchId)
            .OrderByDescending(c => c.Version)
            .FirstOrDefaultAsync();

        if (existing?.Status == DailyCashCloseStatus.Closed)
            throw new InvalidOperationException("This business day is closed. Reopen with a reason before making changes.");

        var now = DateTime.UtcNow;
        DailyCashClose row;
        if (existing?.Status == DailyCashCloseStatus.Draft)
        {
            row = existing;
            row.OpeningCash = request.OpeningCash;
            row.CashReceived = preview.CashReceived;
            row.CashPaidOut = preview.CashPaidOut;
            row.BankReceived = preview.BankReceived;
            row.BankPaidOut = preview.BankPaidOut;
            row.ExpectedCash = preview.ExpectedCash;
            row.CountedCash = request.CountedCash;
            row.Variance = variance;
            row.VarianceReason = request.VarianceReason?.Trim();
            row.Comment = request.Comment?.Trim();
            row.UpdatedAt = now;
            if (request.SubmitClose)
            {
                row.Status = DailyCashCloseStatus.Closed;
                row.ClosedAt = now;
                row.ClosedByUserId = userId;
            }
        }
        else
        {
            var version = existing == null ? 1 : existing.Version + 1;
            row = new DailyCashClose
            {
                TenantId = tenantId,
                OwnerId = tenantId,
                BranchId = request.BranchId,
                BusinessDate = businessDate,
                Version = version,
                Status = request.SubmitClose ? DailyCashCloseStatus.Closed : DailyCashCloseStatus.Draft,
                OpeningCash = request.OpeningCash,
                CashReceived = preview.CashReceived,
                CashPaidOut = preview.CashPaidOut,
                BankReceived = preview.BankReceived,
                BankPaidOut = preview.BankPaidOut,
                ExpectedCash = preview.ExpectedCash,
                CountedCash = request.CountedCash,
                Variance = variance,
                VarianceReason = request.VarianceReason?.Trim(),
                Comment = request.Comment?.Trim(),
                ClosedAt = request.SubmitClose ? now : null,
                ClosedByUserId = request.SubmitClose ? userId : null,
                CreatedByUserId = userId,
                CreatedAt = now,
                UpdatedAt = now
            };
            _context.DailyCashCloses.Add(row);
        }

        return (row, preview, variance, businessDate);
    }

    public async Task<DailyCashCloseDto> ReopenAsync(ReopenDailyCloseRequest request, int tenantId, int userId, bool canReopen)
    {
        await EnsureFeatureEnabledAsync(tenantId);
        await ValidateBranchAsync(tenantId, request.BranchId);
        if (!canReopen)
            throw new UnauthorizedAccessException("Only an owner or admin can reopen a daily close.");
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length < 3)
            throw new ArgumentException("A reopen reason is required (at least 3 characters).");

        var businessDate = NormalizeBusinessDate(request.BusinessDate);
        var closed = await _context.DailyCashCloses
            .Where(c => c.TenantId == tenantId && c.BusinessDate == businessDate && c.BranchId == request.BranchId && c.Status == DailyCashCloseStatus.Closed)
            .OrderByDescending(c => c.Version)
            .FirstOrDefaultAsync();
        if (closed == null)
            throw new InvalidOperationException("No closed record found for this business day.");

        var now = DateTime.UtcNow;
        closed.Status = DailyCashCloseStatus.Reopened;
        closed.ReopenedAt = now;
        closed.ReopenReason = request.Reason.Trim();
        closed.UpdatedAt = now;
        await _context.SaveChangesAsync();
        await _audit.LogAsync("Daily close reopened", "DailyCashClose", closed.Id,
            details: request.Reason.Trim(), actingUserId: userId);
        return Map(closed);
    }

    public async Task<DailyCloseStatusDto> GetStatusAsync(int tenantId, DateTime businessDate, int? branchId = null)
    {
        await EnsureFeatureEnabledAsync(tenantId);
        await ValidateBranchAsync(tenantId, branchId);
        var normalized = NormalizeBusinessDate(businessDate);
        var latest = await _context.DailyCashCloses.AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.BusinessDate == normalized && c.BranchId == branchId)
            .OrderByDescending(c => c.Version)
            .FirstOrDefaultAsync();
        if (latest == null)
            return new DailyCloseStatusDto { BusinessDate = normalized, BranchId = branchId, IsLocked = false, CanEdit = true };
        var dto = Map(latest);
        var locked = latest.Status == DailyCashCloseStatus.Closed;
        return new DailyCloseStatusDto
        {
            BusinessDate = normalized,
            BranchId = branchId,
            Current = dto,
            IsLocked = locked,
            CanEdit = !locked
        };
    }

    public async Task<List<DailyCashCloseDto>> GetHistoryAsync(int tenantId, DateTime? from, DateTime? to, int? branchId = null)
    {
        await EnsureFeatureEnabledAsync(tenantId);
        var q = _context.DailyCashCloses.AsNoTracking().Where(c => c.TenantId == tenantId);
        if (branchId.HasValue) q = q.Where(c => c.BranchId == branchId);
        if (from.HasValue) q = q.Where(c => c.BusinessDate >= NormalizeBusinessDate(from.Value));
        if (to.HasValue) q = q.Where(c => c.BusinessDate <= NormalizeBusinessDate(to.Value));
        var rows = await q.OrderByDescending(c => c.BusinessDate).ThenByDescending(c => c.Version).Take(100).ToListAsync();
        return rows.Select(Map).ToList();
    }

    private async Task ValidateBranchAsync(int tenantId, int? branchId)
    {
        if (!branchId.HasValue) return;
        var exists = await _context.Branches.AsNoTracking()
            .AnyAsync(b => b.Id == branchId.Value && b.TenantId == tenantId);
        if (!exists)
            throw new ArgumentException("Branch not found for this workspace.");
    }

    private async Task<IQueryable<Payment>> ApplySaleBranchFilterAsync(IQueryable<Payment> payments, int tenantId, int? branchId)
    {
        if (!branchId.HasValue || !await _salesSchema.SalesHasBranchIdAndRouteIdAsync())
            return payments;
        var branchFilter = branchId.Value;
        var saleIdsForBranch = await _context.Sales.AsNoTracking()
            .Where(s => s.TenantId == tenantId && s.BranchId == branchFilter)
            .Select(s => s.Id)
            .ToListAsync();
        return payments.Where(p => p.SaleId != null && saleIdsForBranch.Contains(p.SaleId.Value));
    }

    private async Task<CashMovementTotals> ComputeMovementsAsync(int tenantId, DateTime startUtc, DateTime endUtc, int? branchId)
    {
        IQueryable<Payment> payments = _context.Payments.AsNoTracking()
            .Where(p => p.TenantId == tenantId
                && p.Status == PaymentStatus.CLEARED
                && p.Mode == PaymentMode.CASH
                && !p.IsSettlementAdjustment
                && p.PaymentDate >= startUtc
                && p.PaymentDate < endUtc);

        payments = await ApplySaleBranchFilterAsync(payments, tenantId, branchId);

        var cashReceived = await payments.Where(p => p.Amount > 0 && p.SaleReturnId == null).SumAsync(p => (decimal?)p.Amount) ?? 0m;
        var cashRefunds = await payments.Where(p => p.Amount > 0 && p.SaleReturnId != null).SumAsync(p => (decimal?)p.Amount) ?? 0m;
        var cashReceiptCount = await payments.CountAsync(p => p.Amount > 0 && p.SaleReturnId == null);

        IQueryable<Payment> bankPayments = _context.Payments.AsNoTracking()
            .Where(p => p.TenantId == tenantId
                && p.Status == PaymentStatus.CLEARED
                && !p.IsSettlementAdjustment
                && (p.Mode == PaymentMode.ONLINE || p.Mode == PaymentMode.DEBIT || p.Mode == PaymentMode.CHEQUE)
                && p.PaymentDate >= startUtc
                && p.PaymentDate < endUtc);
        bankPayments = await ApplySaleBranchFilterAsync(bankPayments, tenantId, branchId);
        var bankReceived = await bankPayments.Where(p => p.Amount > 0 && p.SaleReturnId == null).SumAsync(p => (decimal?)p.Amount) ?? 0m;
        var bankRefunds = await bankPayments.Where(p => p.Amount > 0 && p.SaleReturnId != null).SumAsync(p => (decimal?)p.Amount) ?? 0m;
        var bankReceiptCount = await bankPayments.CountAsync(p => p.Amount > 0 && p.SaleReturnId == null);

        var expenses = _context.Expenses.AsNoTracking()
            .Where(e => e.TenantId == tenantId
                && e.Status == ExpenseStatus.Approved
                && e.Date >= startUtc
                && e.Date < endUtc);
        if (branchId.HasValue) expenses = expenses.Where(e => e.BranchId == branchId.Value);

        var cashExpenseTotal = await expenses
            .Where(e => e.PaidFrom == ExpensePaidFrom.Cash)
            .SumAsync(e => (decimal?)(e.TotalAmount ?? e.Amount)) ?? 0m;
        var bankExpenseTotal = await expenses
            .Where(e => e.PaidFrom == ExpensePaidFrom.Bank)
            .SumAsync(e => (decimal?)(e.TotalAmount ?? e.Amount)) ?? 0m;
        var expenseCount = await expenses.CountAsync();

        decimal supplierTotal = 0m;
        var supplierCount = 0;
        decimal supplierBankTotal = 0m;
        var supplierBankCount = 0;
        if (!branchId.HasValue)
        {
            var supplierCash = _context.SupplierPayments.AsNoTracking()
                .Where(sp => sp.TenantId == tenantId
                    && sp.Mode == SupplierPaymentMode.Cash
                    && sp.PaymentDate >= startUtc
                    && sp.PaymentDate < endUtc);
            supplierTotal = await supplierCash.SumAsync(sp => (decimal?)sp.Amount) ?? 0m;
            supplierCount = await supplierCash.CountAsync();

            var supplierBank = _context.SupplierPayments.AsNoTracking()
                .Where(sp => sp.TenantId == tenantId
                    && (sp.Mode == SupplierPaymentMode.Bank || sp.Mode == SupplierPaymentMode.Cheque)
                    && sp.PaymentDate >= startUtc
                    && sp.PaymentDate < endUtc);
            supplierBankTotal = await supplierBank.SumAsync(sp => (decimal?)sp.Amount) ?? 0m;
            supplierBankCount = await supplierBank.CountAsync();
        }

        var drawerQuery = _context.CashDrawerMovements.AsNoTracking()
            .Where(m => m.TenantId == tenantId && m.MovementDate >= startUtc && m.MovementDate < endUtc);
        if (branchId.HasValue)
            drawerQuery = drawerQuery.Where(m => m.BranchId == branchId);
        var drawerRows = await drawerQuery.ToListAsync();
        decimal ownerCapitalIn = 0m, ownerDrawing = 0m, bankToDrawer = 0m, drawerToBank = 0m;
        foreach (var m in drawerRows)
        {
            switch (m.Kind)
            {
                case CashDrawerMovementKind.OwnerCapitalIn: ownerCapitalIn += m.Amount; break;
                case CashDrawerMovementKind.OwnerDrawing: ownerDrawing += m.Amount; break;
                case CashDrawerMovementKind.BankToDrawer: bankToDrawer += m.Amount; break;
                case CashDrawerMovementKind.DrawerToBank: drawerToBank += m.Amount; break;
            }
        }

        var collectionsReceived = Math.Round(cashReceived, 2, MidpointRounding.AwayFromZero);
        var collectionsPaidOut = Math.Round(cashExpenseTotal + supplierTotal + cashRefunds, 2, MidpointRounding.AwayFromZero);
        var paidOut = Math.Round(collectionsPaidOut + ownerDrawing + drawerToBank, 2, MidpointRounding.AwayFromZero);
        var received = Math.Round(collectionsReceived + ownerCapitalIn + bankToDrawer, 2, MidpointRounding.AwayFromZero);
        var bankPaidOut = Math.Round(supplierBankTotal + bankExpenseTotal + bankRefunds + bankToDrawer, 2, MidpointRounding.AwayFromZero);
        var bankReceivedRounded = Math.Round(bankReceived + drawerToBank, 2, MidpointRounding.AwayFromZero);
        return new CashMovementTotals(
            received,
            paidOut,
            collectionsReceived,
            collectionsPaidOut,
            cashReceiptCount,
            expenseCount,
            supplierCount,
            bankReceivedRounded,
            bankPaidOut,
            bankReceiptCount,
            supplierBankCount,
            ownerCapitalIn,
            ownerDrawing,
            bankToDrawer,
            drawerToBank,
            drawerRows.Count);
    }

    private static CashDrawerMovementKind ParseMovementKind(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException("Movement kind is required.");
        if (Enum.TryParse<CashDrawerMovementKind>(value, true, out var parsed))
            return parsed;
        return value.Trim().ToLowerInvariant() switch
        {
            "capitalin" or "owner_capital_in" => CashDrawerMovementKind.OwnerCapitalIn,
            "drawing" or "owner_drawing" => CashDrawerMovementKind.OwnerDrawing,
            "bank_to_drawer" => CashDrawerMovementKind.BankToDrawer,
            "drawer_to_bank" => CashDrawerMovementKind.DrawerToBank,
            _ => throw new ArgumentException("Unknown movement kind.")
        };
    }

    private static CashDrawerMovementDto MapMovement(CashDrawerMovement m) => new()
    {
        Id = m.Id,
        BranchId = m.BranchId,
        MovementDate = m.MovementDate,
        Kind = m.Kind.ToString(),
        Amount = m.Amount,
        Note = m.Note,
        CreatedAt = m.CreatedAt
    };

    private (DateTime startUtc, DateTime endUtc) GstDayRange(DateTime businessDate)
    {
        var d = NormalizeBusinessDate(businessDate);
        var gstStart = new DateTime(d.Year, d.Month, d.Day, 0, 0, 0, DateTimeKind.Unspecified);
        var startUtc = _timeZone.ConvertToUtc(gstStart);
        return (startUtc, startUtc.AddDays(1));
    }

    private static DateTime NormalizeBusinessDate(DateTime value)
    {
        return new DateTime(value.Year, value.Month, value.Day, 0, 0, 0, DateTimeKind.Utc);
    }

    private static bool IsDailyCloseVersionConflict(DbUpdateException ex)
    {
        var message = ex.InnerException?.Message ?? ex.Message;
        if (message.Contains("IX_DailyCashCloses_TenantId_BusinessDate_BranchId_Version", StringComparison.OrdinalIgnoreCase))
            return true;
        if (message.Contains("UNIQUE constraint failed", StringComparison.OrdinalIgnoreCase)
            && message.Contains("DailyCashCloses", StringComparison.OrdinalIgnoreCase))
            return true;
        return message.Contains("23505", StringComparison.Ordinal) && message.Contains("DailyCashCloses", StringComparison.OrdinalIgnoreCase);
    }

    private static DailyCashCloseDto Map(DailyCashClose c) => new()
    {
        Id = c.Id,
        BusinessDate = c.BusinessDate,
        BranchId = c.BranchId,
        Version = c.Version,
        Status = c.Status.ToString(),
        OpeningCash = c.OpeningCash,
        CashReceived = c.CashReceived,
        CashPaidOut = c.CashPaidOut,
        BankReceived = c.BankReceived,
        BankPaidOut = c.BankPaidOut,
        ExpectedCash = c.ExpectedCash,
        CountedCash = c.CountedCash,
        Variance = c.Variance,
        VarianceReason = c.VarianceReason,
        Comment = c.Comment,
        ClosedAt = c.ClosedAt,
        ClosedByUserId = c.ClosedByUserId,
        ReopenedAt = c.ReopenedAt,
        ReopenReason = c.ReopenReason
    };

    private readonly record struct CashMovementTotals(
        decimal CashReceived,
        decimal CashPaidOut,
        decimal CollectionsCashReceived,
        decimal CollectionsCashPaidOut,
        int CashReceiptCount,
        int ExpenseCount,
        int SupplierCashPaymentCount,
        decimal BankReceived,
        decimal BankPaidOut,
        int BankReceiptCount,
        int SupplierBankPaymentCount,
        decimal OwnerCapitalIn,
        decimal OwnerDrawing,
        decimal BankToDrawer,
        decimal DrawerToBank,
        int DrawerMovementCount);
}

public class DailyClosePreviewDto
{
    public DateTime BusinessDate { get; set; }
    public int? BranchId { get; set; }
    public decimal OpeningCash { get; set; }
    /// <summary>Cleared customer cash collections (excludes settlement adjustments).</summary>
    public decimal CollectionsCashReceived { get; set; }
    /// <summary>Approved cash expenses, supplier cash and cash refunds (excludes owner drawings and drawer→bank).</summary>
    public decimal CollectionsCashPaidOut { get; set; }
    /// <summary>Total drawer cash inflows including capital and bank→drawer.</summary>
    public decimal CashReceived { get; set; }
    /// <summary>Total drawer cash outflows including drawings and drawer→bank.</summary>
    public decimal CashPaidOut { get; set; }
    public decimal ExpectedCash { get; set; }
    public int CashReceiptCount { get; set; }
    public int ExpenseCount { get; set; }
    public int SupplierCashPaymentCount { get; set; }
    public decimal BankReceived { get; set; }
    public decimal BankPaidOut { get; set; }
    public int BankReceiptCount { get; set; }
    public int SupplierBankPaymentCount { get; set; }
    public decimal OwnerCapitalIn { get; set; }
    public decimal OwnerDrawing { get; set; }
    public decimal BankToDrawer { get; set; }
    public decimal DrawerToBank { get; set; }
    public int DrawerMovementCount { get; set; }
}

public class CashDrawerMovementDto
{
    public int Id { get; set; }
    public int? BranchId { get; set; }
    public DateTime MovementDate { get; set; }
    public string Kind { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateCashDrawerMovementRequest
{
    public DateTime BusinessDate { get; set; }
    public int? BranchId { get; set; }
    public string Kind { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string? Note { get; set; }
    public DateTime? MovementDate { get; set; }
}

public class ReopenDailyCloseRequest
{
    public DateTime BusinessDate { get; set; }
    public int? BranchId { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public class SaveDailyCloseRequest
{
    public DateTime BusinessDate { get; set; }
    public int? BranchId { get; set; }
    public decimal OpeningCash { get; set; }
    public decimal CountedCash { get; set; }
    public string? VarianceReason { get; set; }
    public string? Comment { get; set; }
    public bool SubmitClose { get; set; }
}

public class DailyCloseStatusDto
{
    public DateTime BusinessDate { get; set; }
    public int? BranchId { get; set; }
    public DailyCashCloseDto? Current { get; set; }
    public bool IsLocked { get; set; }
    public bool CanEdit { get; set; }
}

public class DailyCashCloseDto
{
    public int Id { get; set; }
    public DateTime BusinessDate { get; set; }
    public int? BranchId { get; set; }
    public int Version { get; set; }
    public string Status { get; set; } = string.Empty;
    public decimal OpeningCash { get; set; }
    public decimal CashReceived { get; set; }
    public decimal CashPaidOut { get; set; }
    public decimal BankReceived { get; set; }
    public decimal BankPaidOut { get; set; }
    public decimal ExpectedCash { get; set; }
    public decimal CountedCash { get; set; }
    public decimal Variance { get; set; }
    public string? VarianceReason { get; set; }
    public string? Comment { get; set; }
    public DateTime? ClosedAt { get; set; }
    public int? ClosedByUserId { get; set; }
    public DateTime? ReopenedAt { get; set; }
    public string? ReopenReason { get; set; }
}
