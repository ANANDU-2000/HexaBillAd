/*
 * Branch + Route services for enterprise branch/route architecture.
 */
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Services;

namespace HexaBill.Api.Modules.Branches
{
    public interface IBranchService
    {
        Task<bool> CheckDatabaseConnectionAsync();
        Task<List<BranchDto>> GetBranchesAsync(int tenantId);
        Task<BranchDto?> GetBranchByIdAsync(int id, int tenantId);
        Task<BranchDto> CreateBranchAsync(CreateBranchRequest request, int tenantId);
        Task<BranchDto?> UpdateBranchAsync(int id, CreateBranchRequest request, int tenantId);
        Task<bool> DeleteBranchAsync(int id, int tenantId);
        Task<BranchSummaryDto?> GetBranchSummaryAsync(int branchId, int tenantId, DateTime? fromDate, DateTime? toDate);
        /// <summary>Get summary for sales with BranchId==null and RouteId==null (unassigned/legacy).</summary>
        /// <param name="toEnd">Exclusive end date (e.g. to.AddDays(1)).</param>
        Task<BranchSummaryDto?> GetUnassignedSalesSummaryAsync(int tenantId, DateTime from, DateTime toEnd);
    }

    public class BranchService : IBranchService
    {
        private readonly AppDbContext _context;
        private readonly ISalesSchemaService _salesSchema;
        private readonly IServiceScopeFactory _scopeFactory;

        public BranchService(AppDbContext context, ISalesSchemaService salesSchema, IServiceScopeFactory scopeFactory)
        {
            _context = context;
            _salesSchema = salesSchema;
            _scopeFactory = scopeFactory;
        }

        public async Task<bool> CheckDatabaseConnectionAsync()
        {
            try
            {
                return await _context.Database.CanConnectAsync();
            }
            catch
            {
                return false;
            }
        }

        public async Task<List<BranchDto>> GetBranchesAsync(int tenantId)
        {
            try
            {
                // Schema-safe: do not select Address/Location (production DB may not have those columns → 42703).
                return await _context.Branches
                    .AsNoTracking()
                    .Where(b => tenantId <= 0 || b.TenantId == tenantId)
                    .Select(b => new BranchDto
                    {
                        Id = b.Id,
                        TenantId = b.TenantId,
                        Name = b.Name,
                        Address = null,
                        CreatedAt = b.CreatedAt,
                        RouteCount = b.Routes.Count,
                        AssignedStaffIds = b.BranchStaff.Select(bs => bs.UserId).ToList()
                    })
                    .OrderBy(b => b.Name)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ GetBranchesAsync Error: {ex.Message}");
                if (ex.InnerException != null) Console.WriteLine($"❌ Inner: {ex.InnerException.Message}");
                throw; // Re-throw to be handled by controller
            }
        }

        public async Task<BranchDto?> GetBranchByIdAsync(int id, int tenantId)
        {
            // Schema-safe: project only Id, Name, TenantId, CreatedAt (omit Address/Location so production DB without those columns does not 500)
            var b = await _context.Branches
                .AsNoTracking()
                .Where(x => x.Id == id && (tenantId <= 0 || x.TenantId == tenantId))
                .Select(x => new { x.Id, x.TenantId, x.Name, x.CreatedAt, RouteCount = x.Routes.Count, StaffIds = x.BranchStaff.Select(bs => bs.UserId).ToList() })
                .FirstOrDefaultAsync();
            if (b == null) return null;
            return new BranchDto
            {
                Id = b.Id,
                TenantId = b.TenantId,
                Name = b.Name,
                Address = null,
                CreatedAt = b.CreatedAt,
                RouteCount = b.RouteCount,
                AssignedStaffIds = b.StaffIds ?? new List<int>()
            };
        }

        public async Task<BranchDto> CreateBranchAsync(CreateBranchRequest request, int tenantId)
        {
            var branch = new Branch
            {
                TenantId = tenantId,
                Name = request.Name.Trim(),
                Address = request.Address?.Trim(),
                CreatedAt = DateTime.UtcNow
            };
            _context.Branches.Add(branch);
            await _context.SaveChangesAsync();

            // Assign staff to branch if provided
            if (request.AssignedStaffIds != null && request.AssignedStaffIds.Any())
            {
                foreach (var staffId in request.AssignedStaffIds)
                {
                    _context.BranchStaff.Add(new BranchStaff { BranchId = branch.Id, UserId = staffId, AssignedAt = DateTime.UtcNow });
                }
                await _context.SaveChangesAsync();
            }

            return new BranchDto
            {
                Id = branch.Id,
                TenantId = branch.TenantId,
                Name = branch.Name,
                Address = branch.Address,
                CreatedAt = branch.CreatedAt,
                RouteCount = 0,
                AssignedStaffIds = request.AssignedStaffIds ?? new List<int>()
            };
        }

        public async Task<BranchDto?> UpdateBranchAsync(int id, CreateBranchRequest request, int tenantId)
        {
            // Schema-safe: avoid loading full Branch entity (Address/Location may not exist). Check existence by Id only, then update only Name/UpdatedAt.
            var exists = await _context.Branches.Where(b => b.Id == id && b.TenantId == tenantId).Select(b => b.Id).AnyAsync();
            if (!exists) return null;

            await _context.Branches
                .Where(b => b.Id == id && b.TenantId == tenantId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(b => b.Name, request.Name.Trim())
                    .SetProperty(b => b.UpdatedAt, DateTime.UtcNow));

            if (request.AssignedStaffIds != null)
            {
                var existing = await _context.BranchStaff.Where(bs => bs.BranchId == id).ToListAsync();
                _context.BranchStaff.RemoveRange(existing);
                foreach (var staffId in request.AssignedStaffIds)
                {
                    _context.BranchStaff.Add(new BranchStaff { BranchId = id, UserId = staffId, AssignedAt = DateTime.UtcNow });
                }
                await _context.SaveChangesAsync();
            }

            return await GetBranchByIdAsync(id, tenantId);
        }

        public async Task<bool> DeleteBranchAsync(int id, int tenantId)
        {
            var branch = await _context.Branches.FirstOrDefaultAsync(b => b.Id == id && b.TenantId == tenantId);
            if (branch == null) return false;
            _context.Branches.Remove(branch);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<BranchSummaryDto?> GetBranchSummaryAsync(int branchId, int tenantId, DateTime? fromDate, DateTime? toDate)
        {
            // Project only Id, Name so we never select Location/Address (may not exist on production Branches table)
            var branchData = await _context.Branches
                .AsNoTracking()
                .Where(b => b.Id == branchId && (tenantId <= 0 || b.TenantId == tenantId))
                .Select(b => new { b.Id, b.Name })
                .FirstOrDefaultAsync();
            if (branchData == null) return null;

            var from = fromDate ?? DateTime.UtcNow.Date.AddYears(-1);
            var to = (toDate ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1);

            // When Sales.BranchId/RouteId columns don't exist (e.g. production before migration), return safe summary with zeros
            if (!await _salesSchema.SalesHasBranchIdAndRouteIdAsync())
            {
                var safeRouteList = await _context.Routes
                    .AsNoTracking()
                    .Where(r => r.BranchId == branchId && (tenantId <= 0 || r.TenantId == tenantId))
                    .Select(r => new { r.Id, r.Name })
                    .ToListAsync();
                var safeRoutes = safeRouteList.Select(r => new RouteSummaryDto
                {
                    RouteId = r.Id,
                    RouteName = r.Name,
                    BranchName = branchData.Name,
                    TotalSales = 0,
                    TotalExpenses = 0,
                    CostOfGoodsSold = 0,
                    Profit = 0
                }).ToList();
                return new BranchSummaryDto
                {
                    BranchId = branchData.Id,
                    BranchName = branchData.Name,
                    TotalSales = 0,
                    TotalExpenses = 0,
                    CostOfGoodsSold = 0,
                    Profit = 0,
                    Routes = safeRoutes,
                    GrowthPercent = null,
                    CollectionsRatio = null,
                    AverageInvoiceSize = 0,
                    InvoiceCount = 0,
                    TotalPayments = 0,
                    UnpaidAmount = 0
                };
            }

            var routeIds = await _context.Routes.Where(r => r.BranchId == branchId && (tenantId <= 0 || r.TenantId == tenantId)).Select(r => r.Id).ToListAsync();
            // Include sales by BranchId match OR by RouteId in branch. Legacy: include null BranchId when RouteId matches.
            var salesInBranchFilter = (tenantId <= 0 ? _context.Sales.Where(s => true) : _context.Sales.Where(s => s.TenantId == tenantId))
                .Where(s => !s.IsDeleted && s.InvoiceDate >= from && s.InvoiceDate <= to
                    && (s.BranchId == branchId || (s.RouteId != null && routeIds.Contains(s.RouteId.Value))));
            var salesByRoute = await salesInBranchFilter
                .Where(s => s.RouteId != null && routeIds.Contains(s.RouteId!.Value))
                .GroupBy(s => s.RouteId)
                .Select(g => new { RouteId = g.Key!.Value, Total = g.Sum(s => s.GrandTotal), Count = g.Count() })
                .ToListAsync();

            var saleIdsInBranch = await salesInBranchFilter.Select(s => s.Id).ToListAsync();

            var cogsByRouteList = new List<(int RouteId, decimal Cogs)>();
            if (saleIdsInBranch.Count > 0)
            {
                try
                {
                    // Use explicit Select to only get CostPrice (avoid loading entire Product entity with missing columns)
                    var cogsQuery = await (from si in _context.SaleItems
                        join s in _context.Sales on si.SaleId equals s.Id
                        where saleIdsInBranch.Contains(si.SaleId) && s.RouteId != null
                        select new { si.SaleId, si.Qty, si.ProductId, s.RouteId })
                        .ToListAsync();
                    
                    // Get CostPrice separately to avoid loading entire Product entity
                    var productIds = cogsQuery.Select(x => x.ProductId).Distinct().ToList();
                    var productCosts = await _context.Products
                        .Where(p => productIds.Contains(p.Id))
                        .Select(p => new { p.Id, p.CostPrice })
                        .ToDictionaryAsync(p => p.Id, p => p.CostPrice);
                    
                    var cogsByRoute = cogsQuery
                        .Where(x => x.RouteId.HasValue && productCosts.ContainsKey(x.ProductId))
                        .GroupBy(x => x.RouteId!.Value)
                        .Select(g => new { RouteId = g.Key, Cogs = g.Sum(x => x.Qty * productCosts[x.ProductId]) })
                        .ToList();
                    
                    cogsByRouteList = cogsByRoute.Select(x => (x.RouteId, x.Cogs)).ToList();
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"❌ Error calculating branch COGS: {ex.Message}");
                    // Return empty list - COGS will be 0 for all routes
                    cogsByRouteList = new List<(int RouteId, decimal Cogs)>();
                }
            }
            List<(int RouteId, decimal Total)> expensesByRouteList;
            decimal branchExpensesTotal;
            try
            {
                var er = await _context.RouteExpenses
                    .Where(e => routeIds.Contains(e.RouteId) && (tenantId <= 0 || e.TenantId == tenantId) && e.ExpenseDate >= from && e.ExpenseDate <= to)
                    .GroupBy(e => e.RouteId)
                    .Select(g => new { RouteId = g.Key, Total = g.Sum(e => e.Amount) })
                    .ToListAsync();
                expensesByRouteList = er.Select(x => (x.RouteId, x.Total)).ToList();
                branchExpensesTotal = await _context.Expenses
                    .Where(e => e.BranchId == branchId && (tenantId <= 0 || e.TenantId == tenantId) && e.Date >= from && e.Date <= to)
                    .SumAsync(e => e.Amount);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️ BranchService RouteExpenses/Expenses: {ex.Message}");
                expensesByRouteList = new List<(int RouteId, decimal Total)>();
                branchExpensesTotal = 0m;
            }
            var expensesByRoute = expensesByRouteList;

            // Branch-level returns: include returns tagged with this branch or with routes in this branch
            decimal branchReturnsTotal = 0m;
            try
            {
                var returnsQuery = _context.SaleReturns.AsQueryable();
                returnsQuery = returnsQuery.Where(r =>
                    r.ReturnDate >= from && r.ReturnDate <= to &&
                    (tenantId <= 0 || r.TenantId == tenantId) &&
                    (r.BranchId == branchId || (r.RouteId != null && routeIds.Contains(r.RouteId.Value))));
                branchReturnsTotal = await returnsQuery.SumAsync(r => (decimal?)r.GrandTotal) ?? 0m;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️ BranchService SaleReturns: {ex.Message}");
                branchReturnsTotal = 0m;
            }

            var routeList = await _context.Routes
                .AsNoTracking()
                .Where(r => r.BranchId == branchId && (tenantId <= 0 || r.TenantId == tenantId))
                .Select(r => new { r.Id, r.Name })
                .ToListAsync();

            // Payments for this branch's sales, grouped by route (and branch-only)
            var paymentsBySaleWithRoute = new List<(int? RouteId, decimal Amount)>();
            decimal totalPayments = 0m;
            if (saleIdsInBranch.Count > 0)
            {
                try
                {
                    var paymentsQuery = _context.Payments
                        .Where(p => p.SaleId.HasValue
                                    && saleIdsInBranch.Contains(p.SaleId.Value)
                                    && p.SaleReturnId == null
                                    && (tenantId <= 0 || p.TenantId == tenantId)
                                    && p.PaymentDate >= from && p.PaymentDate <= to);

                    var paymentsWithRoute = await (from p in paymentsQuery
                                                   join s in _context.Sales on p.SaleId equals s.Id
                                                   select new { p.Amount, s.RouteId }).ToListAsync();

                    paymentsBySaleWithRoute = paymentsWithRoute
                        .Select(x => (x.RouteId, x.Amount))
                        .ToList();

                    totalPayments = paymentsBySaleWithRoute.Sum(x => x.Amount);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"⚠️ BranchService Payments: {ex.Message}");
                    paymentsBySaleWithRoute = new List<(int? RouteId, decimal Amount)>();
                    totalPayments = 0m;
                }
            }

            var paymentsByRoute = paymentsBySaleWithRoute
                .Where(x => x.RouteId.HasValue && routeIds.Contains(x.RouteId.Value))
                .GroupBy(x => x.RouteId!.Value)
                .Select(g => new { RouteId = g.Key, Total = g.Sum(x => x.Amount) })
                .ToList();

            var routes = routeList.Select(r =>
            {
                var routeSales = salesByRoute.FirstOrDefault(x => x.RouteId == r.Id);
                var sales = routeSales?.Total ?? 0;
                var routeReturns = 0m; // Route-level returns can be added later; currently only branch aggregate is used
                var expEntry = expensesByRoute.FirstOrDefault(x => x.RouteId == r.Id);
                var expenses = expEntry.RouteId == r.Id ? expEntry.Total : 0m;
                var cogsEntry = cogsByRouteList.FirstOrDefault(x => x.RouteId == r.Id);
                var cogs = cogsEntry.RouteId == r.Id ? cogsEntry.Cogs : 0m;
                var routePayments = paymentsByRoute.FirstOrDefault(x => x.RouteId == r.Id)?.Total ?? 0m;
                var routeNetSales = sales - routeReturns;
                var routeUnpaid = routeNetSales > routePayments ? routeNetSales - routePayments : 0m;
                return new RouteSummaryDto
                {
                    RouteId = r.Id,
                    RouteName = r.Name,
                    BranchName = branchData.Name,
                    TotalSales = sales,
                    TotalReturns = routeReturns,
                    NetSales = routeNetSales,
                    TotalExpenses = expenses,
                    CostOfGoodsSold = cogs,
                    Profit = routeNetSales - cogs - expenses,
                    InvoiceCount = routeSales?.Count ?? 0,
                    TotalPayments = routePayments,
                    UnpaidAmount = routeUnpaid
                };
            }).ToList();

            var routeExpensesTotal = routes.Sum(r => r.TotalExpenses);
            var totalExpenses = routeExpensesTotal + branchExpensesTotal;
            // Use full branch sales total (includes sales with BranchId but no RouteId)
            var totalSales = saleIdsInBranch.Count > 0
                ? await _context.Sales.Where(s => saleIdsInBranch.Contains(s.Id)).SumAsync(s => s.GrandTotal)
                : routes.Sum(r => r.TotalSales);
            var totalCogs = routes.Sum(r => r.CostOfGoodsSold);
            var netSales = totalSales - branchReturnsTotal;

            // Performance metrics
            var invoiceCount = saleIdsInBranch.Count;
            var averageInvoiceSize = invoiceCount > 0 ? totalSales / invoiceCount : 0m;

            // totalPayments already computed using payments linked to this branch's sales

            // Collections ratio: Payments / Net Sales (for credit customers)
            var collectionsRatio = netSales > 0 ? (totalPayments / netSales * 100) : (decimal?)null;

            // Calculate growth percent (compare with previous period of same duration)
            decimal? growthPercent = null;
            var periodDays = (int)(to - from).TotalDays;
            // CRITICAL FIX: Prevent infinite recursion and limit depth
            // Only calculate growth if period is reasonable (not too large) and not recursive
            // Limit to max 1 year period to prevent excessive recursion and memory issues
            if (periodDays > 0 && periodDays < 366) // Max 1 year to prevent excessive recursion
            {
                try
                {
                    var prevTo = from.AddDays(-1);
                    var prevFrom = prevTo.AddDays(-periodDays);
                    // Use a new scope so the inner call has its own DbContext (avoids "second operation started" / ObjectDisposedException)
                    using (var scope = _scopeFactory.CreateScope())
                    {
                        var branchService = scope.ServiceProvider.GetRequiredService<IBranchService>();
                        var prevSummary = await branchService.GetBranchSummaryAsync(branchData.Id, tenantId, prevFrom, prevTo.AddDays(1));
                        if (prevSummary != null && prevSummary.TotalSales > 0)
                        {
                            growthPercent = ((totalSales - prevSummary.TotalSales) / prevSummary.TotalSales * 100);
                        }
                        else if (prevSummary != null && totalSales > 0)
                        {
                            growthPercent = 100; // 100% growth if no previous sales
                        }
                    }
                }
                catch (Exception ex)
                {
                    // CRITICAL: Don't let growth calculation crash the entire summary
                    // Log but continue - growth percent will remain null
                    Console.WriteLine($"⚠️ Error calculating growth percent: {ex.Message}");
                    growthPercent = null;
                }
            }

            return new BranchSummaryDto
            {
                BranchId = branchData.Id,
                BranchName = branchData.Name,
                TotalSales = totalSales,
                TotalReturns = branchReturnsTotal,
                NetSales = netSales,
                TotalExpenses = totalExpenses,
                CostOfGoodsSold = totalCogs,
                Profit = netSales - totalCogs - totalExpenses,
                Routes = routes,
                GrowthPercent = growthPercent,
                CollectionsRatio = collectionsRatio,
                AverageInvoiceSize = averageInvoiceSize,
                InvoiceCount = invoiceCount,
                TotalPayments = totalPayments,
                UnpaidAmount = netSales > totalPayments ? netSales - totalPayments : 0
            };
        }

        /// <summary>
        /// Get summary for sales with BranchId==null and RouteId==null (unassigned/legacy).
        /// Used in Branch Comparison report so unassigned sales are visible.
        /// </summary>
        /// <param name="toEnd">Exclusive end (e.g. to.AddDays(1) from controller). Use InvoiceDate &lt; toEnd.</param>
        public async Task<BranchSummaryDto?> GetUnassignedSalesSummaryAsync(int tenantId, DateTime from, DateTime toEnd)
        {
            if (!await _salesSchema.SalesHasBranchIdAndRouteIdAsync())
                return null;

            var salesQuery = (tenantId <= 0 ? _context.Sales : _context.Sales.Where(s => s.TenantId == tenantId))
                .Where(s => !s.IsDeleted && s.BranchId == null && s.RouteId == null
                    && s.InvoiceDate >= from && s.InvoiceDate < toEnd);

            var saleIds = await salesQuery.Select(s => s.Id).ToListAsync();
            if (saleIds.Count == 0) return null;

            var totalSales = await _context.Sales.Where(s => saleIds.Contains(s.Id)).SumAsync(s => s.GrandTotal);
            var invoiceCount = saleIds.Count;
            var averageInvoiceSize = invoiceCount > 0 ? totalSales / invoiceCount : 0m;

            return new BranchSummaryDto
            {
                BranchId = 0,
                BranchName = "Unassigned",
                TotalSales = totalSales,
                TotalExpenses = 0,
                CostOfGoodsSold = 0,
                Profit = totalSales,
                Routes = new List<RouteSummaryDto>(),
                GrowthPercent = null,
                CollectionsRatio = null,
                AverageInvoiceSize = averageInvoiceSize,
                InvoiceCount = invoiceCount,
                TotalPayments = 0,
                UnpaidAmount = totalSales
            };
        }
    }
}
