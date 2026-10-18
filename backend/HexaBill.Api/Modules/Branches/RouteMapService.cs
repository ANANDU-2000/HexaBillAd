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
        Task<List<RouteMapStopDto>?> GetMapStopsAsync(int routeId, int tenantId, DateTime date, bool includeCreditLimit, bool includePendingFix = false);

        /// <summary>One summary per route; <paramref name="accessibleRouteIds"/> null means every route of the company.</summary>
        Task<RouteMapOverviewDto> GetOverviewAsync(int tenantId, IReadOnlyCollection<int>? accessibleRouteIds, DateTime date, bool canManage = false);

        /// <summary>Saves a driver's visit fix as the customer's shop pin. The caller must already have Manage access to the route.</summary>
        Task<PinConfirmResult> ConfirmPinFromVisitAsync(int routeId, int customerId, int visitId, bool overwrite, int userId, int tenantId);
    }

    public enum PinConfirmStatus { Saved, NotOnRoute, InvalidVisit, NeedsOverwrite }

    public sealed record PinConfirmResult(PinConfirmStatus Status, string Message);

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

        /// <summary>Fixes closer than this to the saved pin are not worth confirming.</summary>
        private const double PinDifferenceMeters = 150;

        private static double MetersBetween(double lat1, double lng1, double lat2, double lng2)
        {
            static double Rad(double d) => d * Math.PI / 180;
            var dLat = Rad(lat2 - lat1);
            var dLng = Rad(lng2 - lng1);
            var h = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) + Math.Cos(Rad(lat1)) * Math.Cos(Rad(lat2)) * Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
            return 2 * 6371000 * Math.Asin(Math.Min(1, Math.Sqrt(h)));
        }

        public async Task<List<RouteMapStopDto>?> GetMapStopsAsync(int routeId, int tenantId, DateTime date, bool includeCreditLimit, bool includePendingFix = false)
        {
            var stops = await _routes.GetRouteStopsMapAsync(routeId, tenantId, date);
            if (stops == null) return null;

            var ids = stops.Select(s => s.CustomerId).Distinct().ToList();
            var customers = await _context.Customers.AsNoTracking()
                .Where(c => c.TenantId == tenantId && ids.Contains(c.Id))
                .Select(c => new { c.Id, c.Phone, c.Balance, c.CreditLimit, c.LastPaymentDate, c.MainLatitude, c.MainLongitude })
                .ToDictionaryAsync(c => c.Id);
            var overdue = await OverdueByCustomerAsync(tenantId, ids);
            var lastVisit = await LastVisitByCustomerAsync(routeId, tenantId, ids);
            var pending = includePendingFix
                ? await PendingFixesAsync(routeId, tenantId, ids, customers.ToDictionary(c => c.Key, c => (c.Value.MainLatitude, c.Value.MainLongitude)))
                : new Dictionary<int, RoutePendingFixDto>();

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
                    PendingFix = pending.TryGetValue(s.CustomerId, out var fix) ? fix : null,
                };
            }).ToList();
        }

        public async Task<RouteMapOverviewDto> GetOverviewAsync(int tenantId, IReadOnlyCollection<int>? accessibleRouteIds, DateTime date, bool canManage = false)
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
                    CanManage = canManage,
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

        /// <summary>The latest visit fix per customer that fills in a missing pin or lies far from the saved one.</summary>
        private async Task<Dictionary<int, RoutePendingFixDto>> PendingFixesAsync(
            int routeId, int tenantId, List<int> customerIds, Dictionary<int, (decimal? Lat, decimal? Lng)> pins)
        {
            var result = new Dictionary<int, RoutePendingFixDto>();
            try
            {
                var visits = await _context.CustomerVisits.AsNoTracking()
                    .Where(v => v.RouteId == routeId && v.TenantId == tenantId && customerIds.Contains(v.CustomerId) && v.Latitude != null && v.Longitude != null)
                    .OrderByDescending(v => v.VisitDate).ThenByDescending(v => v.Id)
                    .Select(v => new { v.Id, v.CustomerId, Lat = v.Latitude!.Value, Lng = v.Longitude!.Value, v.ReachedAt, v.VisitDate, v.StaffId })
                    .ToListAsync();
                var latest = visits.GroupBy(v => v.CustomerId).Select(g => g.First()).ToList();
                var staffIds = latest.Where(v => v.StaffId != null).Select(v => v.StaffId!.Value).Distinct().ToList();
                var names = staffIds.Count == 0
                    ? new Dictionary<int, string>()
                    : await _context.Users.AsNoTracking().Where(u => u.TenantId == tenantId && staffIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Name);
                foreach (var v in latest)
                {
                    pins.TryGetValue(v.CustomerId, out var pin);
                    var hasPin = pin.Lat.HasValue && pin.Lng.HasValue;
                    if (hasPin && MetersBetween((double)pin.Lat!.Value, (double)pin.Lng!.Value, (double)v.Lat, (double)v.Lng) <= PinDifferenceMeters) continue;
                    result[v.CustomerId] = new RoutePendingFixDto
                    {
                        VisitId = v.Id, Latitude = v.Lat, Longitude = v.Lng, ReachedAt = v.ReachedAt, VisitDate = v.VisitDate,
                        StaffName = v.StaffId != null && names.TryGetValue(v.StaffId.Value, out var n) ? n : null,
                    };
                }
            }
            catch (Exception ex) when (RouteService.IsRelationMissing42P01(ex))
            {
                // visits table not present yet: nothing is pending
            }
            return result;
        }

        public async Task<PinConfirmResult> ConfirmPinFromVisitAsync(int routeId, int customerId, int visitId, bool overwrite, int userId, int tenantId)
        {
            var onRoute = await _context.Routes.AsNoTracking().AnyAsync(r => r.Id == routeId && r.TenantId == tenantId)
                && await _context.RouteCustomers.AsNoTracking().AnyAsync(rc => rc.RouteId == routeId && rc.CustomerId == customerId);
            var customer = onRoute ? await _context.Customers.FirstOrDefaultAsync(c => c.Id == customerId && c.TenantId == tenantId) : null;
            if (customer == null) return new PinConfirmResult(PinConfirmStatus.NotOnRoute, "Route or customer not found.");

            var visit = await _context.CustomerVisits.AsNoTracking()
                .Where(v => v.Id == visitId && v.RouteId == routeId && v.CustomerId == customerId && v.TenantId == tenantId)
                .Select(v => new { v.Latitude, v.Longitude })
                .FirstOrDefaultAsync();
            if (visit == null) return new PinConfirmResult(PinConfirmStatus.InvalidVisit, "That visit does not belong to this stop.");
            if (!visit.Latitude.HasValue || !visit.Longitude.HasValue
                || Math.Abs(visit.Latitude.Value) > 90 || Math.Abs(visit.Longitude.Value) > 180 || (visit.Latitude.Value == 0 && visit.Longitude.Value == 0))
                return new PinConfirmResult(PinConfirmStatus.InvalidVisit, "That visit has no usable location.");

            var hasPin = customer.MainLatitude.HasValue && customer.MainLongitude.HasValue;
            var changes = !hasPin || MetersBetween((double)customer.MainLatitude!.Value, (double)customer.MainLongitude!.Value, (double)visit.Latitude.Value, (double)visit.Longitude.Value) > 1;
            if (hasPin && changes && !overwrite)
                return new PinConfirmResult(PinConfirmStatus.NeedsOverwrite, "This customer already has a saved location. Confirm again to replace it.");

            var old = hasPin ? $"{customer.MainLatitude},{customer.MainLongitude}" : null;
            customer.MainLatitude = visit.Latitude;
            customer.MainLongitude = visit.Longitude;
            customer.LocationUpdatedAt = DateTime.UtcNow;
            customer.LocationUpdatedBy = userId;
            customer.UpdatedAt = DateTime.UtcNow;
            _context.AuditLogs.Add(new AuditLog
            {
                TenantId = tenantId, OwnerId = tenantId, UserId = userId, Action = "CustomerPinConfirmedFromVisit", EntityType = "Customer", EntityId = customerId,
                OldValues = old, NewValues = $"{visit.Latitude},{visit.Longitude}", Details = $"Route {routeId}, visit {visitId}", CreatedAt = DateTime.UtcNow,
            });
            await _context.SaveChangesAsync();
            return new PinConfirmResult(PinConfirmStatus.Saved, "Shop location saved.");
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
