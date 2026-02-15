/*
 * Branch + Route services for enterprise branch/route architecture.
 */
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;

namespace HexaBill.Api.Modules.Branches
{
    public interface IBranchService
    {
        Task<List<BranchDto>> GetBranchesAsync(int tenantId);
        Task<BranchDto?> GetBranchByIdAsync(int id, int tenantId);
        Task<BranchDto> CreateBranchAsync(CreateBranchRequest request, int tenantId);
        Task<BranchDto?> UpdateBranchAsync(int id, CreateBranchRequest request, int tenantId);
        Task<bool> DeleteBranchAsync(int id, int tenantId);
        Task<BranchSummaryDto?> GetBranchSummaryAsync(int branchId, int tenantId, DateTime? fromDate, DateTime? toDate);
    }

    public class BranchService : IBranchService
    {
        private readonly AppDbContext _context;

        public BranchService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<BranchDto>> GetBranchesAsync(int tenantId)
        {
            return await _context.Branches
                .AsNoTracking()
                .Where(b => tenantId <= 0 || b.TenantId == tenantId)
                .Select(b => new BranchDto
                {
                    Id = b.Id,
                    TenantId = b.TenantId,
                    Name = b.Name,
                    Address = b.Address,
                    CreatedAt = b.CreatedAt,
                    RouteCount = b.Routes.Count
                })
                .OrderBy(b => b.Name)
                .ToListAsync();
        }

        public async Task<BranchDto?> GetBranchByIdAsync(int id, int tenantId)
        {
            var b = await _context.Branches
                .AsNoTracking()
                .Where(x => x.Id == id && (tenantId <= 0 || x.TenantId == tenantId))
                .Select(x => new BranchDto
                {
                    Id = x.Id,
                    TenantId = x.TenantId,
                    Name = x.Name,
                    Address = x.Address,
                    CreatedAt = x.CreatedAt,
                    RouteCount = x.Routes.Count
                })
                .FirstOrDefaultAsync();
            return b;
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
            return new BranchDto
            {
                Id = branch.Id,
                TenantId = branch.TenantId,
                Name = branch.Name,
                Address = branch.Address,
                CreatedAt = branch.CreatedAt,
                RouteCount = 0
            };
        }

        public async Task<BranchDto?> UpdateBranchAsync(int id, CreateBranchRequest request, int tenantId)
        {
            var branch = await _context.Branches.FirstOrDefaultAsync(b => b.Id == id && b.TenantId == tenantId);
            if (branch == null) return null;
            branch.Name = request.Name.Trim();
            branch.Address = request.Address?.Trim();
            branch.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
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
            var branch = await _context.Branches
                .AsNoTracking()
                .FirstOrDefaultAsync(b => b.Id == branchId && (tenantId <= 0 || b.TenantId == tenantId));
            if (branch == null) return null;

            var from = fromDate ?? DateTime.UtcNow.Date.AddYears(-1);
            var to = (toDate ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1);

            var routeIds = await _context.Routes.Where(r => r.BranchId == branchId).Select(r => r.Id).ToListAsync();
            var salesByRoute = await _context.Sales
                .Where(s => s.RouteId != null && routeIds.Contains(s.RouteId!.Value) && !s.IsDeleted && s.InvoiceDate >= from && s.InvoiceDate <= to)
                .GroupBy(s => s.RouteId)
                .Select(g => new { RouteId = g.Key!.Value, Total = g.Sum(s => s.GrandTotal) })
                .ToListAsync();
            var expensesByRoute = await _context.RouteExpenses
                .Where(e => routeIds.Contains(e.RouteId) && e.ExpenseDate >= from && e.ExpenseDate <= to)
                .GroupBy(e => e.RouteId)
                .Select(g => new { RouteId = g.Key, Total = g.Sum(e => e.Amount) })
                .ToListAsync();

            var routeList = await _context.Routes
                .AsNoTracking()
                .Where(r => r.BranchId == branchId)
                .Select(r => new { r.Id, r.Name })
                .ToListAsync();

            var routes = routeList.Select(r => new RouteSummaryDto
            {
                RouteId = r.Id,
                RouteName = r.Name,
                BranchName = branch.Name,
                TotalSales = salesByRoute.FirstOrDefault(x => x.RouteId == r.Id)?.Total ?? 0,
                TotalExpenses = expensesByRoute.FirstOrDefault(x => x.RouteId == r.Id)?.Total ?? 0
            }).ToList();
            foreach (var r in routes)
                r.Profit = r.TotalSales - r.TotalExpenses;

            return new BranchSummaryDto
            {
                BranchId = branch.Id,
                BranchName = branch.Name,
                TotalSales = routes.Sum(r => r.TotalSales),
                TotalExpenses = routes.Sum(r => r.TotalExpenses),
                Profit = routes.Sum(r => r.Profit),
                Routes = routes
            };
        }
    }
}
