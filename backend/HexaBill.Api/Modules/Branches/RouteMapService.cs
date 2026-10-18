/*
 * Route Map data: stops with balance / overdue and a per-route summary, in a fixed number of grouped queries.
 * Route access is decided by the caller (RouteScopedController / IRouteScopeService); this service only reads one company.
 */
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Sales;

namespace HexaBill.Api.Modules.Branches
{
    public interface IRouteMapService
    {
        /// <summary>Null when the route does not exist in the company.</summary>
        Task<List<RouteMapStopDto>?> GetMapStopsAsync(int routeId, int tenantId, DateTime date, bool includeCreditLimit);

        /// <summary>One summary per route; <paramref name="accessibleRouteIds"/> null means every route of the company.</summary>
        Task<RouteMapOverviewDto> GetOverviewAsync(int tenantId, IReadOnlyCollection<int>? accessibleRouteIds, DateTime date);
    }

    public class RouteMapService : IRouteMapService
    {
        private readonly AppDbContext _context;
        private readonly IRouteService _routes;

        public RouteMapService(AppDbContext context, IRouteService routes)
        {
            _context = context;
            _routes = routes;
        }

        private sealed record Overdue(decimal Amount, int Days);

        public async Task<List<RouteMapStopDto>?> GetMapStopsAsync(int routeId, int tenantId, DateTime date, bool includeCreditLimit)
        {
            var stops = await _routes.GetRouteStopsMapAsync(routeId, tenantId, date);
            if (stops == null) return null;

            var ids = stops.Select(s => s.CustomerId).Distinct().ToList();
            var customers = await _context.Customers.AsNoTracking()
                .Where(c => c.TenantId == tenantId && ids.Contains(c.Id))
                .Select(c => new { c.Id, c.Phone, c.Balance, c.CreditLimit, c.LastPaymentDate })
                .ToDictionaryAsync(c => c.Id);
            var overdue = await OverdueByCustomerAsync(tenantId, ids);
            var lastVisit = await LastVisitByCustomerAsync(routeId, tenantId, ids);

            return stops.Select(s =>
            {
                customers.TryGetValue(s.CustomerId, out var c);
                overdue.TryGetValue(s.CustomerId, out var od);
                lastVisit.TryGetValue(s.CustomerId, out var visitedAt);
                return new RouteMapStopDto
                {
                    Position = s.Position, Address = s.Address, NeedsLocation = s.NeedsLocation, CustomerId = s.CustomerId,
                    CustomerName = s.CustomerName, SortOrder = s.SortOrder, MainLatitude = s.MainLatitude, MainLongitude = s.MainLongitude,
                    VisitStatus = s.VisitStatus, VisitLatitude = s.VisitLatitude, VisitLongitude = s.VisitLongitude,
                    ReachedAt = s.ReachedAt, MapStatus = s.MapStatus,
                    Phone = c?.Phone,
                    Balance = c != null && c.Balance > 0.01m ? c.Balance : 0m,
                    OverdueAmount = od?.Amount ?? 0m,
                    OverdueDays = od?.Days ?? 0,
                    LastPaymentDate = c?.LastPaymentDate,
                    LastVisitAt = visitedAt,
                    CreditLimit = includeCreditLimit ? c?.CreditLimit : null,
                };
            }).ToList();
        }

        public async Task<RouteMapOverviewDto> GetOverviewAsync(int tenantId, IReadOnlyCollection<int>? accessibleRouteIds, DateTime date)
        {
            var overview = new RouteMapOverviewDto { Date = date.ToString("yyyy-MM-dd") };
            var routes = await _context.Routes.AsNoTracking()
                .Where(r => r.TenantId == tenantId && r.IsActive && (accessibleRouteIds == null || accessibleRouteIds.Contains(r.Id)))
                .Select(r => new { r.Id, r.Name, BranchName = r.Branch != null ? r.Branch.Name : null })
                .OrderBy(r => r.Name)
                .ToListAsync();
            if (routes.Count == 0) return overview;

            var routeIds = routes.Select(r => r.Id).ToList();
            var links = await _context.RouteCustomers.AsNoTracking()
                .Where(rc => routeIds.Contains(rc.RouteId))
                .Select(rc => new { rc.RouteId, rc.CustomerId })
                .ToListAsync();
            var customerIds = links.Select(l => l.CustomerId).Distinct().ToList();
            var balances = await _context.Customers.AsNoTracking()
                .Where(c => c.TenantId == tenantId && customerIds.Contains(c.Id))
                .Select(c => new { c.Id, c.Balance })
                .ToDictionaryAsync(c => c.Id, c => c.Balance > 0.01m ? c.Balance : 0m);
            var overdue = await OverdueByCustomerAsync(tenantId, customerIds);
            var visitedToday = await VisitedTodayAsync(tenantId, routeIds, date);

            foreach (var r in routes)
            {
                var customers = links.Where(l => l.RouteId == r.Id).Select(l => l.CustomerId).Distinct().ToList();
                overview.Routes.Add(new RouteMapRouteSummaryDto
                {
                    RouteId = r.Id,
                    Name = r.Name,
                    BranchName = r.BranchName,
                    StopCount = customers.Count,
                    VisitedToday = visitedToday.TryGetValue(r.Id, out var v) ? v : 0,
                    OutstandingTotal = customers.Sum(c => balances.GetValueOrDefault(c)),
                    OverdueTotal = customers.Sum(c => overdue.TryGetValue(c, out var od) ? od.Amount : 0m),
                    OverdueCustomers = customers.Count(c => overdue.ContainsKey(c)),
                });
            }
            return overview;
        }

        /// <summary>Open invoices past their due date, summed per customer, with the oldest one's age. Same rule as the outstanding-invoices list (due date, else 30 days after the invoice).</summary>
        private async Task<Dictionary<int, Overdue>> OverdueByCustomerAsync(int tenantId, List<int> customerIds)
        {
            var result = new Dictionary<int, Overdue>();
            if (customerIds.Count == 0) return result;
            var today = DateTime.Today;
            var sales = await _context.Sales.AsNoTracking()
                .Where(s => s.TenantId == tenantId && s.CustomerId != null && customerIds.Contains(s.CustomerId.Value) && !s.IsDeleted
                            && (s.PaymentStatus == SalePaymentStatus.Pending || s.PaymentStatus == SalePaymentStatus.Partial))
                .Select(s => new { s.Id, CustomerId = s.CustomerId!.Value, s.GrandTotal, s.PaidAmount, s.InvoiceDate, s.DueDate })
                .ToListAsync();
            if (sales.Count == 0) return result;

            var saleIds = sales.Select(s => s.Id).ToList();
            var returns = await InvoiceReceivables.ApprovedReturns(_context, tenantId)
                .Where(r => saleIds.Contains(r.SaleId))
                .GroupBy(r => r.SaleId)
                .Select(g => new { SaleId = g.Key, Total = g.Sum(r => r.GrandTotal) })
                .ToDictionaryAsync(x => x.SaleId, x => x.Total);

            foreach (var s in sales)
            {
                var outstanding = InvoiceReceivables.Outstanding(s.GrandTotal, s.PaidAmount, returns.GetValueOrDefault(s.Id, 0m));
                if (outstanding <= SalePaymentHelpers.SettlementToleranceAed) continue;
                var due = s.DueDate ?? s.InvoiceDate.AddDays(30);
                if (due >= today) continue;
                var days = (today - due).Days;
                result[s.CustomerId] = result.TryGetValue(s.CustomerId, out var prev)
                    ? new Overdue(prev.Amount + outstanding, Math.Max(prev.Days, days))
                    : new Overdue(outstanding, days);
            }
            return result;
        }

        private async Task<Dictionary<int, DateTime>> LastVisitByCustomerAsync(int routeId, int tenantId, List<int> customerIds)
        {
            try
            {
                var rows = await _context.CustomerVisits.AsNoTracking()
                    .Where(v => v.RouteId == routeId && v.TenantId == tenantId && customerIds.Contains(v.CustomerId) && v.Status != VisitStatus.NotVisited)
                    .GroupBy(v => v.CustomerId)
                    .Select(g => new { CustomerId = g.Key, At = g.Max(v => v.VisitDate) })
                    .ToListAsync();
                return rows.ToDictionary(r => r.CustomerId, r => r.At);
            }
            catch (Exception ex) when (RouteService.IsRelationMissing42P01(ex))
            {
                return new Dictionary<int, DateTime>();
            }
        }

        private async Task<Dictionary<int, int>> VisitedTodayAsync(int tenantId, List<int> routeIds, DateTime date)
        {
            var start = DateTime.SpecifyKind(date.Date, DateTimeKind.Utc);
            var end = start.AddDays(1);
            try
            {
                var rows = await _context.CustomerVisits.AsNoTracking()
                    .Where(v => routeIds.Contains(v.RouteId) && v.TenantId == tenantId && v.VisitDate >= start && v.VisitDate < end && v.Status != VisitStatus.NotVisited)
                    .GroupBy(v => v.RouteId)
                    .Select(g => new { RouteId = g.Key, N = g.Select(v => v.CustomerId).Distinct().Count() })
                    .ToListAsync();
                return rows.ToDictionary(r => r.RouteId, r => r.N);
            }
            catch (Exception ex) when (RouteService.IsRelationMissing42P01(ex))
            {
                return new Dictionary<int, int>();
            }
        }
    }
}
