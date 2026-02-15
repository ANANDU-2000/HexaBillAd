/*
 * Route service: CRUD routes, assign customers/staff, route expenses, route summary.
 */
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;

namespace HexaBill.Api.Modules.Branches
{
    public interface IRouteService
    {
        Task<List<RouteDto>> GetRoutesAsync(int tenantId, int? branchId = null);
        Task<RouteDetailDto?> GetRouteByIdAsync(int id, int tenantId);
        Task<RouteDto> CreateRouteAsync(CreateRouteRequest request, int tenantId);
        Task<RouteDto?> UpdateRouteAsync(int id, CreateRouteRequest request, int tenantId);
        Task<bool> DeleteRouteAsync(int id, int tenantId);
        Task<bool> AssignCustomerToRouteAsync(int routeId, int customerId, int tenantId);
        Task<bool> UnassignCustomerFromRouteAsync(int routeId, int customerId, int tenantId);
        Task<bool> AssignStaffToRouteAsync(int routeId, int userId, int tenantId);
        Task<bool> UnassignStaffFromRouteAsync(int routeId, int userId, int tenantId);
        Task<List<RouteExpenseDto>> GetRouteExpensesAsync(int routeId, int tenantId, DateTime? fromDate, DateTime? toDate);
        Task<RouteExpenseDto?> CreateRouteExpenseAsync(CreateRouteExpenseRequest request, int userId, int tenantId);
        Task<bool> DeleteRouteExpenseAsync(int id, int tenantId);
        Task<RouteSummaryDto?> GetRouteSummaryAsync(int routeId, int tenantId, DateTime? fromDate, DateTime? toDate);
    }

    public class RouteService : IRouteService
    {
        private readonly AppDbContext _context;

        public RouteService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<RouteDto>> GetRoutesAsync(int tenantId, int? branchId = null)
        {
            var query = _context.Routes
                .AsNoTracking()
                .Where(r => (tenantId <= 0 || r.TenantId == tenantId) && (!branchId.HasValue || r.BranchId == branchId.Value))
                .Include(r => r.Branch)
                .Include(r => r.AssignedStaff);
            return await query
                .Select(r => new RouteDto
                {
                    Id = r.Id,
                    BranchId = r.BranchId,
                    BranchName = r.Branch.Name,
                    TenantId = r.TenantId,
                    Name = r.Name,
                    AssignedStaffId = r.AssignedStaffId,
                    AssignedStaffName = r.AssignedStaff != null ? r.AssignedStaff.Name : null,
                    CreatedAt = r.CreatedAt,
                    CustomerCount = r.RouteCustomers.Count,
                    StaffCount = r.RouteStaff.Count
                })
                .OrderBy(r => r.BranchName).ThenBy(r => r.Name)
                .ToListAsync();
        }

        public async Task<RouteDetailDto?> GetRouteByIdAsync(int id, int tenantId)
        {
            var r = await _context.Routes
                .AsNoTracking()
                .Include(x => x.Branch)
                .Include(x => x.AssignedStaff)
                .Include(x => x.RouteCustomers).ThenInclude(rc => rc.Customer)
                .Include(x => x.RouteStaff).ThenInclude(rs => rs.User)
                .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);
            if (r == null) return null;

            var from = DateTime.UtcNow.AddYears(-1);
            var to = DateTime.UtcNow;
            var totalSales = await _context.Sales
                .Where(s => s.RouteId == id && !s.IsDeleted && s.InvoiceDate >= from && s.InvoiceDate <= to)
                .SumAsync(s => s.GrandTotal);
            var totalExpenses = await _context.RouteExpenses
                .Where(e => e.RouteId == id && e.ExpenseDate >= from && e.ExpenseDate <= to)
                .SumAsync(e => e.Amount);

            return new RouteDetailDto
            {
                Id = r.Id,
                BranchId = r.BranchId,
                BranchName = r.Branch.Name,
                TenantId = r.TenantId,
                Name = r.Name,
                AssignedStaffId = r.AssignedStaffId,
                AssignedStaffName = r.AssignedStaff?.Name,
                CreatedAt = r.CreatedAt,
                CustomerCount = r.RouteCustomers.Count,
                StaffCount = r.RouteStaff.Count,
                Customers = r.RouteCustomers.Select(rc => new RouteCustomerDto
                {
                    Id = rc.Id,
                    CustomerId = rc.CustomerId,
                    CustomerName = rc.Customer.Name,
                    AssignedAt = rc.AssignedAt
                }).ToList(),
                Staff = r.RouteStaff.Select(rs => new RouteStaffDto
                {
                    Id = rs.Id,
                    UserId = rs.UserId,
                    UserName = rs.User.Name,
                    AssignedAt = rs.AssignedAt
                }).ToList(),
                TotalSales = totalSales,
                TotalExpenses = totalExpenses,
                Profit = totalSales - totalExpenses
            };
        }

        public async Task<RouteDto> CreateRouteAsync(CreateRouteRequest request, int tenantId)
        {
            var branch = await _context.Branches.FirstOrDefaultAsync(b => b.Id == request.BranchId && b.TenantId == tenantId);
            if (branch == null) throw new InvalidOperationException("Branch not found.");
            var route = new HexaBill.Api.Models.Route
            {
                BranchId = request.BranchId,
                TenantId = tenantId,
                Name = request.Name.Trim(),
                AssignedStaffId = request.AssignedStaffId,
                CreatedAt = DateTime.UtcNow
            };
            _context.Routes.Add(route);
            await _context.SaveChangesAsync();
            var list = await GetRoutesAsync(tenantId);
            return list.First(r => r.Id == route.Id);
        }

        public async Task<RouteDto?> UpdateRouteAsync(int id, CreateRouteRequest request, int tenantId)
        {
            var route = await _context.Routes.FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tenantId);
            if (route == null) return null;
            route.Name = request.Name.Trim();
            route.AssignedStaffId = request.AssignedStaffId;
            route.BranchId = request.BranchId;
            route.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return (await GetRoutesAsync(tenantId)).FirstOrDefault(r => r.Id == id);
        }

        public async Task<bool> DeleteRouteAsync(int id, int tenantId)
        {
            var route = await _context.Routes.FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tenantId);
            if (route == null) return false;
            _context.Routes.Remove(route);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> AssignCustomerToRouteAsync(int routeId, int customerId, int tenantId)
        {
            var route = await _context.Routes.FirstOrDefaultAsync(r => r.Id == routeId && r.TenantId == tenantId);
            var customer = await _context.Customers.FirstOrDefaultAsync(c => c.Id == customerId && c.TenantId == tenantId);
            if (route == null || customer == null) return false;
            if (await _context.RouteCustomers.AnyAsync(rc => rc.RouteId == routeId && rc.CustomerId == customerId)) return true;
            _context.RouteCustomers.Add(new RouteCustomer { RouteId = routeId, CustomerId = customerId, AssignedAt = DateTime.UtcNow });
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> UnassignCustomerFromRouteAsync(int routeId, int customerId, int tenantId)
        {
            var rc = await _context.RouteCustomers
                .Include(rc => rc.Route)
                .FirstOrDefaultAsync(rc => rc.RouteId == routeId && rc.CustomerId == customerId && rc.Route.TenantId == tenantId);
            if (rc == null) return false;
            _context.RouteCustomers.Remove(rc);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> AssignStaffToRouteAsync(int routeId, int userId, int tenantId)
        {
            var route = await _context.Routes.FirstOrDefaultAsync(r => r.Id == routeId && r.TenantId == tenantId);
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId && u.TenantId == tenantId);
            if (route == null || user == null) return false;
            if (await _context.RouteStaff.AnyAsync(rs => rs.RouteId == routeId && rs.UserId == userId)) return true;
            _context.RouteStaff.Add(new RouteStaff { RouteId = routeId, UserId = userId, AssignedAt = DateTime.UtcNow });
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> UnassignStaffFromRouteAsync(int routeId, int userId, int tenantId)
        {
            var rs = await _context.RouteStaff
                .Include(rs => rs.Route)
                .FirstOrDefaultAsync(rs => rs.RouteId == routeId && rs.UserId == userId && rs.Route.TenantId == tenantId);
            if (rs == null) return false;
            _context.RouteStaff.Remove(rs);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<List<RouteExpenseDto>> GetRouteExpensesAsync(int routeId, int tenantId, DateTime? fromDate, DateTime? toDate)
        {
            var query = _context.RouteExpenses
                .AsNoTracking()
                .Where(e => e.RouteId == routeId && e.TenantId == tenantId);
            if (fromDate.HasValue) query = query.Where(e => e.ExpenseDate >= fromDate.Value);
            if (toDate.HasValue) query = query.Where(e => e.ExpenseDate <= toDate.Value);
            return await query
                .OrderByDescending(e => e.ExpenseDate)
                .Select(e => new RouteExpenseDto
                {
                    Id = e.Id,
                    RouteId = e.RouteId,
                    Category = e.Category.ToString(),
                    Amount = e.Amount,
                    ExpenseDate = e.ExpenseDate,
                    Description = e.Description,
                    CreatedAt = e.CreatedAt
                })
                .ToListAsync();
        }

        public async Task<RouteExpenseDto?> CreateRouteExpenseAsync(CreateRouteExpenseRequest request, int userId, int tenantId)
        {
            var route = await _context.Routes.FirstOrDefaultAsync(r => r.Id == request.RouteId && r.TenantId == tenantId);
            if (route == null) return null;
            var category = Enum.TryParse<RouteExpenseType>(request.Category, true, out var c) ? c : RouteExpenseType.Misc;
            var entity = new RouteExpense
            {
                RouteId = request.RouteId,
                TenantId = tenantId,
                Category = category,
                Amount = request.Amount,
                ExpenseDate = request.ExpenseDate.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(request.ExpenseDate, DateTimeKind.Utc) : request.ExpenseDate.ToUniversalTime(),
                Description = request.Description,
                CreatedBy = userId,
                CreatedAt = DateTime.UtcNow
            };
            _context.RouteExpenses.Add(entity);
            await _context.SaveChangesAsync();
            return new RouteExpenseDto
            {
                Id = entity.Id,
                RouteId = entity.RouteId,
                Category = entity.Category.ToString(),
                Amount = entity.Amount,
                ExpenseDate = entity.ExpenseDate,
                Description = entity.Description,
                CreatedAt = entity.CreatedAt
            };
        }

        public async Task<bool> DeleteRouteExpenseAsync(int id, int tenantId)
        {
            var e = await _context.RouteExpenses.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);
            if (e == null) return false;
            _context.RouteExpenses.Remove(e);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<RouteSummaryDto?> GetRouteSummaryAsync(int routeId, int tenantId, DateTime? fromDate, DateTime? toDate)
        {
            var route = await _context.Routes
                .AsNoTracking()
                .Include(r => r.Branch)
                .FirstOrDefaultAsync(r => r.Id == routeId && (tenantId <= 0 || r.TenantId == tenantId));
            if (route == null) return null;
            var from = fromDate ?? DateTime.UtcNow.AddYears(-1);
            var to = (toDate ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1);
            var totalSales = await _context.Sales
                .Where(s => s.RouteId == routeId && !s.IsDeleted && s.InvoiceDate >= from && s.InvoiceDate <= to)
                .SumAsync(s => s.GrandTotal);
            var totalExpenses = await _context.RouteExpenses
                .Where(e => e.RouteId == routeId && e.ExpenseDate >= from && e.ExpenseDate <= to)
                .SumAsync(e => e.Amount);
            return new RouteSummaryDto
            {
                RouteId = route.Id,
                RouteName = route.Name,
                BranchName = route.Branch.Name,
                TotalSales = totalSales,
                TotalExpenses = totalExpenses,
                Profit = totalSales - totalExpenses
            };
        }
    }
}
