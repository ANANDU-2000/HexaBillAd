/*
 * Route service: CRUD routes, assign customers/staff, route expenses, route summary.
 */
using Microsoft.EntityFrameworkCore;
using Npgsql;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Services;
using System.Security.Claims;

namespace HexaBill.Api.Modules.Branches
{
    public interface IRouteService
    {
        Task<bool> CheckDatabaseConnectionAsync();
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
        Task<RouteExpenseDto?> UpdateRouteExpenseAsync(int id, CreateRouteExpenseRequest request, int tenantId);
        Task<bool> DeleteRouteExpenseAsync(int id, int tenantId);
        Task<RouteSummaryDto?> GetRouteSummaryAsync(int routeId, int tenantId, DateTime? fromDate, DateTime? toDate);
        Task<RouteCollectionSheetDto?> GetRouteCollectionSheetAsync(int routeId, int tenantId, DateTime date);
        Task<CustomerVisitDto?> UpdateCustomerVisitAsync(int routeId, int customerId, UpdateCustomerVisitRequest request, int userId, int tenantId);
        Task<List<CustomerVisitDto>> GetCustomerVisitsAsync(int routeId, int tenantId, DateTime? date);
    }

    public class RouteService : IRouteService
    {
        private readonly AppDbContext _context;
        private readonly ISalesSchemaService _salesSchema;

        public RouteService(AppDbContext context, ISalesSchemaService salesSchema)
        {
            _context = context;
            _salesSchema = salesSchema;
        }

        /// <summary>True if the exception (or inner) is PostgreSQL 42P01 undefined_table. Handles wrapped exceptions and message-based detection.</summary>
        private static bool IsRelationMissing42P01(Exception ex)
        {
            for (var e = ex; e != null; e = e.InnerException)
            {
                if (e is PostgresException pg && pg.SqlState == "42P01") return true;
                var msg = e.Message ?? "";
                if (msg.Contains("42P01", StringComparison.Ordinal) || (msg.Contains("relation", StringComparison.OrdinalIgnoreCase) && msg.Contains("does not exist", StringComparison.OrdinalIgnoreCase)))
                    return true;
            }
            return false;
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

        public async Task<List<RouteDto>> GetRoutesAsync(int tenantId, int? branchId = null)
        {
            try
            {
                // Load routes without Branch to avoid loading Branch.Address/Location (may not exist in DB).
                var query = _context.Routes
                    .AsNoTracking()
                    .Where(r => (tenantId <= 0 || r.TenantId == tenantId) && (!branchId.HasValue || r.BranchId == branchId.Value))
                    .Include(r => r.AssignedStaff)
                    .Include(r => r.RouteStaff)
                    .Include(r => r.RouteCustomers);
                var routes = await query.ToListAsync();
                var branchIds = routes.Select(r => r.BranchId).Distinct().ToList();
                var branchNames = branchIds.Count > 0
                    ? await _context.Branches.Where(b => branchIds.Contains(b.Id)).Select(b => new { b.Id, b.Name }).ToDictionaryAsync(x => x.Id, x => x.Name)
                    : new Dictionary<int, string>();
                return routes
                    .Select(r => new RouteDto
                    {
                        Id = r.Id,
                        BranchId = r.BranchId,
                        BranchName = branchNames.ContainsKey(r.BranchId) ? branchNames[r.BranchId] : "",
                        TenantId = r.TenantId,
                        Name = r.Name,
                        AssignedStaffId = r.AssignedStaffId,
                        AssignedStaffName = r.AssignedStaff != null ? r.AssignedStaff.Name : null,
                        CreatedAt = r.CreatedAt,
                        AssignedStaffIds = r.RouteStaff.Select(rs => rs.UserId).ToList(),
                        CustomerCount = r.RouteCustomers.Count,
                        StaffCount = r.RouteStaff.Count
                    })
                    .OrderBy(r => r.BranchName ?? "").ThenBy(r => r.Name)
                    .ToList();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ GetRoutesAsync Error: {ex.Message}");
                if (ex.InnerException != null) Console.WriteLine($"❌ Inner: {ex.InnerException.Message}");
                throw; // Re-throw to be handled by controller
            }
        }

        public async Task<RouteDetailDto?> GetRouteByIdAsync(int id, int tenantId)
        {
            // Load route without Branch to avoid Branch.Address/Location (may not exist in DB).
            var r = await _context.Routes
                .AsNoTracking()
                .Include(x => x.AssignedStaff)
                .Include(x => x.RouteCustomers).ThenInclude(rc => rc.Customer)
                .Include(x => x.RouteStaff).ThenInclude(rs => rs.User)
                .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);
            if (r == null) return null;

            var branchName = (await _context.Branches.Where(b => b.Id == r.BranchId).Select(b => b.Name).FirstOrDefaultAsync()) ?? "";

            var from = DateTime.UtcNow.AddYears(-1);
            var to = DateTime.UtcNow;
            decimal totalSales = 0;
            if (await _salesSchema.SalesHasBranchIdAndRouteIdAsync())
            {
                totalSales = await _context.Sales
                    .Where(s => s.RouteId == id && !s.IsDeleted && s.InvoiceDate >= from && s.InvoiceDate <= to)
                    .SumAsync(s => s.GrandTotal);
            }
            var totalExpenses = await _context.RouteExpenses
                .Where(e => e.RouteId == id && e.ExpenseDate >= from && e.ExpenseDate <= to)
                .SumAsync(e => e.Amount);

            return new RouteDetailDto
            {
                Id = r.Id,
                BranchId = r.BranchId,
                BranchName = branchName,
                TenantId = r.TenantId,
                Name = r.Name,
                AssignedStaffId = r.AssignedStaffId,
                AssignedStaffName = r.AssignedStaff?.Name,
                AssignedStaffIds = r.RouteStaff.Select(rs => rs.UserId).ToList(),
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
            // PROD-12: Validate Branch exists and belongs to tenant
            var branch = await _context.Branches.FirstOrDefaultAsync(b => b.Id == request.BranchId && b.TenantId == tenantId);
            if (branch == null) 
                throw new InvalidOperationException($"Branch with ID {request.BranchId} not found or does not belong to your tenant.");
            
            // PROD-12: Validate Route.BranchId matches Branch.TenantId (data integrity)
            if (branch.TenantId != tenantId)
                throw new InvalidOperationException($"Branch {request.BranchId} does not belong to tenant {tenantId}.");
            
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
            var result = list.First(r => r.Id == route.Id);

            if (request.AssignedStaffIds != null && request.AssignedStaffIds.Any())
            {
                foreach (var userId in request.AssignedStaffIds)
                {
                    _context.RouteStaff.Add(new RouteStaff { RouteId = route.Id, UserId = userId, AssignedAt = DateTime.UtcNow });
                }
                await _context.SaveChangesAsync();
                // Refresh result with staff
                result.AssignedStaffIds = request.AssignedStaffIds;
            }

            return result;
        }

        public async Task<RouteDto?> UpdateRouteAsync(int id, CreateRouteRequest request, int tenantId)
        {
            var route = await _context.Routes.FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tenantId);
            if (route == null) return null;
            
            // PROD-12: Validate Branch exists and belongs to tenant if BranchId is being changed
            if (request.BranchId != route.BranchId)
            {
                var branch = await _context.Branches.FirstOrDefaultAsync(b => b.Id == request.BranchId && b.TenantId == tenantId);
                if (branch == null)
                    throw new InvalidOperationException($"Branch with ID {request.BranchId} not found or does not belong to your tenant.");
                
                // PROD-12: Validate Route.BranchId matches Branch.TenantId
                if (branch.TenantId != tenantId)
                    throw new InvalidOperationException($"Branch {request.BranchId} does not belong to tenant {tenantId}.");
                
                // AUDIT-9 FIX: Prevent branch change if route has customers or sales (data consistency)
                var hasCustomers = await _context.RouteCustomers.AnyAsync(rc => rc.RouteId == id) ||
                                   await _context.Customers.AnyAsync(c => c.RouteId == id && c.TenantId == tenantId);
                
                var hasSales = await _salesSchema.SalesHasBranchIdAndRouteIdAsync()
                    && await _context.Sales.AnyAsync(s => s.RouteId == id && s.TenantId == tenantId && !s.IsDeleted);
                
                if (hasCustomers || hasSales)
                {
                    throw new InvalidOperationException(
                        $"Cannot change route branch. Route has {(hasCustomers ? "customers" : "")} " +
                        $"{(hasCustomers && hasSales ? "and " : "")}{(hasSales ? "sales records" : "")} assigned. " +
                        "Please reassign customers and sales to another route before changing branch.");
                }
            }
            
            route.Name = request.Name.Trim();
            route.AssignedStaffId = request.AssignedStaffId;
            route.BranchId = request.BranchId;
            route.UpdatedAt = DateTime.UtcNow;

            if (request.AssignedStaffIds != null)
            {
                // Remove existing
                var existing = await _context.RouteStaff.Where(rs => rs.RouteId == id).ToListAsync();
                _context.RouteStaff.RemoveRange(existing);

                // Add new
                foreach (var userId in request.AssignedStaffIds)
                {
                    _context.RouteStaff.Add(new RouteStaff { RouteId = route.Id, UserId = userId, AssignedAt = DateTime.UtcNow });
                }
            }

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
            // PROD-12: Validate Route exists and belongs to tenant
            var route = await _context.Routes.FirstOrDefaultAsync(r => r.Id == routeId && r.TenantId == tenantId);
            if (route == null) 
                throw new InvalidOperationException($"Route with ID {routeId} not found or does not belong to your tenant.");
            
            // PROD-12: Validate Customer exists and belongs to tenant
            var customer = await _context.Customers.FirstOrDefaultAsync(c => c.Id == customerId && c.TenantId == tenantId);
            if (customer == null) 
                throw new InvalidOperationException($"Customer with ID {customerId} not found or does not belong to your tenant.");
            
            // PROD-12: Validate Route.BranchId matches Customer's BranchId if Customer has a BranchId
            if (customer.BranchId.HasValue && route.BranchId != customer.BranchId.Value)
            {
                throw new InvalidOperationException(
                    $"Customer {customerId} belongs to Branch {customer.BranchId.Value}, but Route {routeId} belongs to Branch {route.BranchId}. " +
                    "Customer and Route must belong to the same Branch.");
            }
            
            // Check if already assigned
            if (await _context.RouteCustomers.AnyAsync(rc => rc.RouteId == routeId && rc.CustomerId == customerId)) 
                return true;
            
            // Update Customer.RouteId for consistency
            customer.RouteId = routeId;
            customer.UpdatedAt = DateTime.UtcNow;
            
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

        public async Task<RouteExpenseDto?> UpdateRouteExpenseAsync(int id, CreateRouteExpenseRequest request, int tenantId)
        {
            var e = await _context.RouteExpenses.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId);
            if (e == null) return null;
            var category = Enum.TryParse<RouteExpenseType>(request.Category, true, out var c) ? c : RouteExpenseType.Misc;
            e.Category = category;
            e.Amount = request.Amount;
            e.ExpenseDate = request.ExpenseDate.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(request.ExpenseDate, DateTimeKind.Utc) : request.ExpenseDate.ToUniversalTime();
            e.Description = request.Description;
            await _context.SaveChangesAsync();
            return new RouteExpenseDto
            {
                Id = e.Id,
                RouteId = e.RouteId,
                Category = e.Category.ToString(),
                Amount = e.Amount,
                ExpenseDate = e.ExpenseDate,
                Description = e.Description,
                CreatedAt = e.CreatedAt
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
                .FirstOrDefaultAsync(r => r.Id == routeId && (tenantId <= 0 || r.TenantId == tenantId));
            if (route == null) return null;
            var branchName = (await _context.Branches.Where(b => b.Id == route.BranchId).Select(b => b.Name).FirstOrDefaultAsync()) ?? "";
            var from = fromDate ?? DateTime.UtcNow.AddYears(-1);
            var to = (toDate ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1);
            decimal totalSales = 0m;
            List<int> saleIds = new List<int>();
            if (await _salesSchema.SalesHasBranchIdAndRouteIdAsync())
            {
                totalSales = await _context.Sales
                    .Where(s => s.RouteId == routeId && !s.IsDeleted && s.InvoiceDate >= from && s.InvoiceDate <= to)
                    .SumAsync(s => s.GrandTotal);
                saleIds = await _context.Sales
                    .Where(s => s.RouteId == routeId && !s.IsDeleted && s.InvoiceDate >= from && s.InvoiceDate <= to)
                    .Select(s => s.Id)
                    .ToListAsync();
            }
            var totalExpenses = await _context.RouteExpenses
                .Where(e => e.RouteId == routeId && e.ExpenseDate >= from && e.ExpenseDate <= to)
                .SumAsync(e => e.Amount);
            var invoiceCount = saleIds.Count;
            decimal costOfGoodsSold = 0m;
            if (invoiceCount > 0)
            {
                try
                {
                    // Get SaleItems with ProductId only (avoid loading entire Product entity)
                    var saleItems = await _context.SaleItems
                        .Where(si => saleIds.Contains(si.SaleId))
                        .Select(si => new { si.SaleId, si.Qty, si.ProductId })
                        .ToListAsync();
                    
                    // Get CostPrice separately for products that exist
                    var productIds = saleItems.Select(si => si.ProductId).Distinct().ToList();
                    var productCosts = await _context.Products
                        .Where(p => productIds.Contains(p.Id))
                        .Select(p => new { p.Id, p.CostPrice })
                        .ToDictionaryAsync(p => p.Id, p => p.CostPrice);
                    
                    costOfGoodsSold = saleItems
                        .Where(si => productCosts.ContainsKey(si.ProductId))
                        .Sum(si => si.Qty * productCosts[si.ProductId]);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"❌ Error calculating route COGS: {ex.Message}");
                    costOfGoodsSold = 0m;
                }
            }
            int visitCount;
            try
            {
                visitCount = await _context.CustomerVisits
                    .Where(v => v.RouteId == routeId && v.VisitDate >= from && v.VisitDate <= to && (tenantId <= 0 || v.TenantId == tenantId))
                    .CountAsync();
            }
            catch (Exception ex) when (IsRelationMissing42P01(ex))
            {
                // CustomerVisits table may not exist on production (migration not applied)
                visitCount = 0;
            }
            var totalPayments = invoiceCount > 0
                ? await _context.Payments
                    .Where(p => p.SaleId.HasValue && saleIds.Contains(p.SaleId.Value) && p.PaymentDate >= from && p.PaymentDate <= to)
                    .SumAsync(p => p.Amount)
                : 0m;
            var unpaidAmount = totalSales > totalPayments ? totalSales - totalPayments : 0m;
            return new RouteSummaryDto
            {
                RouteId = route.Id,
                RouteName = route.Name,
                BranchName = branchName,
                TotalSales = totalSales,
                TotalExpenses = totalExpenses,
                CostOfGoodsSold = costOfGoodsSold,
                Profit = totalSales - costOfGoodsSold - totalExpenses,
                InvoiceCount = invoiceCount,
                VisitCount = visitCount,
                TotalPayments = totalPayments,
                UnpaidAmount = unpaidAmount
            };
        }

        public async Task<RouteCollectionSheetDto?> GetRouteCollectionSheetAsync(int routeId, int tenantId, DateTime date)
        {
            var route = await _context.Routes
                .AsNoTracking()
                .Include(r => r.AssignedStaff)
                .Include(r => r.RouteCustomers).ThenInclude(rc => rc.Customer)
                .FirstOrDefaultAsync(r => r.Id == routeId && (tenantId <= 0 || r.TenantId == tenantId));
            if (route == null) return null;
            var branchName = (await _context.Branches.Where(b => b.Id == route.BranchId).Select(b => b.Name).FirstOrDefaultAsync()) ?? "";

            var dateStart = date.Date;
            var dateEnd = dateStart.AddDays(1).AddTicks(-1);

            var customerIds = route.RouteCustomers.Select(rc => rc.CustomerId).ToList();
            var todayInvoicesList = new List<(int? CustomerId, decimal GrandTotal)>();
            if (await _salesSchema.SalesHasBranchIdAndRouteIdAsync())
            {
                var q = await _context.Sales
                    .Where(s => s.RouteId == routeId && !s.IsDeleted && s.InvoiceDate >= dateStart && s.InvoiceDate <= dateEnd && s.CustomerId != null)
                    .Select(s => new { s.CustomerId, s.GrandTotal })
                    .ToListAsync();
                todayInvoicesList = q.Select(x => (x.CustomerId, x.GrandTotal)).ToList();
            }
            var todayByCustomer = todayInvoicesList
                .Where(x => x.CustomerId.HasValue)
                .GroupBy(x => x.CustomerId!.Value)
                .ToDictionary(g => g.Key, g => g.Sum(x => x.GrandTotal));

            // Get visit statuses for this route and date (table may not exist on production – 42P01)
            Dictionary<int, CustomerVisit> visits;
            try
            {
                visits = await _context.CustomerVisits
                    .Where(v => v.RouteId == routeId && v.VisitDate >= dateStart && v.VisitDate < dateEnd && (tenantId <= 0 || v.TenantId == tenantId))
                    .ToDictionaryAsync(v => v.CustomerId, v => v);
            }
            catch (Exception ex) when (IsRelationMissing42P01(ex))
            {
                visits = new Dictionary<int, CustomerVisit>();
            }

            var entries = new List<RouteCollectionSheetEntryDto>();
            decimal totalOutstanding = 0;
            foreach (var rc in route.RouteCustomers.OrderBy(rc => rc.Customer.Name))
            {
                var c = rc.Customer;
                var balance = c.Balance > 0.01m ? c.Balance : 0m;
                var todayAmount = todayByCustomer.ContainsKey(c.Id) ? (decimal?)todayByCustomer[c.Id] : null;
                var visit = visits.ContainsKey(c.Id) ? visits[c.Id] : null;
                totalOutstanding += balance;
                entries.Add(new RouteCollectionSheetEntryDto
                {
                    CustomerId = c.Id,
                    CustomerName = c.Name ?? "",
                    Phone = c.Phone,
                    OutstandingBalance = balance,
                    TodayInvoiceAmount = todayAmount,
                    VisitStatus = visit?.Status.ToString() ?? "NotVisited",
                    VisitNotes = visit?.Notes,
                    PaymentCollected = visit?.PaymentCollected
                });
            }

            return new RouteCollectionSheetDto
            {
                RouteName = route.Name,
                BranchName = branchName,
                Date = date.ToString("yyyy-MM-dd"),
                StaffName = route.AssignedStaff?.Name,
                Customers = entries,
                TotalOutstanding = totalOutstanding
            };
        }

        public async Task<CustomerVisitDto?> UpdateCustomerVisitAsync(int routeId, int customerId, UpdateCustomerVisitRequest request, int userId, int tenantId)
        {
            // Verify route exists and belongs to tenant
            var route = await _context.Routes
                .FirstOrDefaultAsync(r => r.Id == routeId && (tenantId <= 0 || r.TenantId == tenantId));
            if (route == null) return null;

            // Verify customer exists and belongs to tenant
            var customer = await _context.Customers
                .FirstOrDefaultAsync(c => c.Id == customerId && (tenantId <= 0 || c.TenantId == tenantId));
            if (customer == null) return null;

            var visitDate = request.VisitDate.Date;

            CustomerVisit? visit;
            try
            {
                // Find or create visit record
                visit = await _context.CustomerVisits
                    .FirstOrDefaultAsync(v => v.RouteId == routeId &&
                                             v.CustomerId == customerId &&
                                             v.VisitDate.Date == visitDate &&
                                             (tenantId <= 0 || v.TenantId == tenantId));

                if (visit == null)
                {
                    visit = new CustomerVisit
                    {
                        RouteId = routeId,
                        CustomerId = customerId,
                        TenantId = tenantId,
                        StaffId = userId,
                        VisitDate = visitDate,
                        Status = Enum.Parse<VisitStatus>(request.Status),
                        Notes = request.Notes,
                        PaymentCollected = request.PaymentCollected,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.CustomerVisits.Add(visit);
                }
                else
                {
                    visit.Status = Enum.Parse<VisitStatus>(request.Status);
                    visit.Notes = request.Notes;
                    visit.PaymentCollected = request.PaymentCollected;
                    visit.StaffId = userId;
                    visit.UpdatedAt = DateTime.UtcNow;
                }

                await _context.SaveChangesAsync();
            }
            catch (Exception ex) when (IsRelationMissing42P01(ex))
            {
                // CustomerVisits table does not exist
                return null;
            }

            return new CustomerVisitDto
            {
                Id = visit.Id,
                RouteId = visit.RouteId,
                CustomerId = visit.CustomerId,
                CustomerName = customer.Name ?? "",
                VisitDate = visit.VisitDate,
                Status = visit.Status.ToString(),
                Notes = visit.Notes,
                PaymentCollected = visit.PaymentCollected,
                StaffId = visit.StaffId,
                CreatedAt = visit.CreatedAt
            };
        }

        public async Task<List<CustomerVisitDto>> GetCustomerVisitsAsync(int routeId, int tenantId, DateTime? date)
        {
            try
            {
                var query = _context.CustomerVisits
                    .Include(v => v.Customer)
                    .Include(v => v.Staff)
                    .Where(v => v.RouteId == routeId && (tenantId <= 0 || v.TenantId == tenantId))
                    .AsQueryable();

                if (date.HasValue)
                {
                    var dateStart = date.Value.Date;
                    var dateEnd = dateStart.AddDays(1);
                    query = query.Where(v => v.VisitDate >= dateStart && v.VisitDate < dateEnd);
                }

                var visits = await query.ToListAsync();

                return visits.Select(v => new CustomerVisitDto
                {
                    Id = v.Id,
                    RouteId = v.RouteId,
                    CustomerId = v.CustomerId,
                    CustomerName = v.Customer.Name ?? "",
                    VisitDate = v.VisitDate,
                    Status = v.Status.ToString(),
                    Notes = v.Notes,
                    PaymentCollected = v.PaymentCollected,
                    StaffId = v.StaffId,
                    StaffName = v.Staff?.Name,
                    CreatedAt = v.CreatedAt
                }).ToList();
            }
            catch (Exception ex) when (IsRelationMissing42P01(ex))
            {
                return new List<CustomerVisitDto>();
            }
        }
    }
}
