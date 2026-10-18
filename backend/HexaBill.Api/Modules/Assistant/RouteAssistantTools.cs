using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Core.Infrastructure;
using HexaBill.Api.Data;
using HexaBill.Api.Modules.Branches;

namespace HexaBill.Api.Modules.Assistant;

/// <summary>
/// Read-only questions about routes ("who is overdue on route 3?"). The route list is the caller's own: owners and admins see every route
/// of the company, a manager or driver only the routes they are granted or assigned, exactly as on the Route Map. The text the model
/// supplies only picks routes by name; "all" means every route the caller may see.
/// </summary>
internal abstract class RouteToolBase : IAssistantTool
{
    private const int MaxRoutes = 5;
    private readonly AppDbContext _context;
    private readonly IRouteScopeService _scope;

    protected RouteToolBase(AppDbContext context, IRouteScopeService scope)
    {
        _context = context;
        _scope = scope;
    }

    public abstract string Name { get; }
    public abstract string Description { get; }
    public IReadOnlyList<string> Arguments { get; } = new[] { "query", "limit" };
    public bool AllowedFor(AssistantCaller caller) => caller.TenantId > 0 && caller.UserId > 0;
    public abstract Task<AssistantToolResult> RunAsync(AssistantCaller caller, JsonElement args, CancellationToken ct);

    protected static DateTime Today => DateTime.UtcNow.Date;

    protected async Task<List<(int Id, string Name)>> RoutesAsync(AssistantCaller caller, string query, CancellationToken ct)
    {
        var accessible = await _scope.GetAccessibleRouteIdsAsync(caller.UserId, caller.TenantId, caller.Role);
        var routes = await _context.Routes.AsNoTracking()
            .Where(r => r.TenantId == caller.TenantId && r.IsActive && (accessible == null || accessible.Contains(r.Id)))
            .Select(r => new { r.Id, r.Name })
            .OrderBy(r => r.Name)
            .ToListAsync(ct);
        var all = query.Equals("all", StringComparison.OrdinalIgnoreCase);
        return routes
            .Where(r => all || r.Name.Contains(query, StringComparison.OrdinalIgnoreCase))
            .Take(MaxRoutes)
            .Select(r => (r.Id, r.Name))
            .ToList();
    }

    protected static AssistantSource RouteSource(int id, string name, DateTime asOf) => new("route", id.ToString(), name, asOf);
}

/// <summary>Customers on my routes with overdue invoices, most overdue first.</summary>
internal sealed class RouteOverdueTool : RouteToolBase
{
    private readonly IRouteMapService _map;
    public RouteOverdueTool(AppDbContext context, IRouteScopeService scope, IRouteMapService map) : base(context, scope) => _map = map;

    public override string Name => "route_overdue";
    public override string Description => "Customers with overdue invoices on a route, most overdue first. Query is a route name, or \"all\" for every route you can see.";

    public override async Task<AssistantToolResult> RunAsync(AssistantCaller caller, JsonElement args, CancellationToken ct)
    {
        var query = ToolArgs.Text(args, "query", 2, 60);
        var limit = ToolArgs.Limit(args, 5, 10);
        var asOf = DateTime.UtcNow;
        var routes = await RoutesAsync(caller, query, ct);
        var rows = new List<(int RouteId, string Route, Models.RouteMapStopDto Stop)>();
        foreach (var route in routes)
            foreach (var stop in await _map.GetMapStopsAsync(route.Id, caller.TenantId, Today, false) ?? new())
                if (stop.OverdueAmount > 0) rows.Add((route.Id, route.Name, stop));
        var top = rows.OrderByDescending(r => r.Stop.OverdueDays).ThenByDescending(r => r.Stop.OverdueAmount).Take(limit).ToList();
        var data = top.Select(r => new Dictionary<string, object?>
        {
            ["customerId"] = r.Stop.CustomerId,
            ["name"] = r.Stop.CustomerName,
            ["routeId"] = r.RouteId,
            ["route"] = r.Route,
            ["overdueAmount"] = r.Stop.OverdueAmount,
            ["overdueDays"] = r.Stop.OverdueDays,
            ["balance"] = r.Stop.Balance,
        }).ToList();
        var sources = top.Select(r => new AssistantSource("customer", r.Stop.CustomerId.ToString(), r.Stop.CustomerName, asOf)).ToList();
        return new AssistantToolResult(Name, data, sources, asOf);
    }
}

/// <summary>Today's stops that have not been visited yet, in route order.</summary>
internal sealed class RouteUnvisitedTool : RouteToolBase
{
    private readonly IRouteMapService _map;
    public RouteUnvisitedTool(AppDbContext context, IRouteScopeService scope, IRouteMapService map) : base(context, scope) => _map = map;

    public override string Name => "route_unvisited";
    public override string Description => "Stops not visited yet today on a route, in route order. Query is a route name, or \"all\" for every route you can see.";

    public override async Task<AssistantToolResult> RunAsync(AssistantCaller caller, JsonElement args, CancellationToken ct)
    {
        var query = ToolArgs.Text(args, "query", 2, 60);
        var limit = ToolArgs.Limit(args, 5, 10);
        var asOf = DateTime.UtcNow;
        var rows = new List<(int RouteId, string Route, Models.RouteMapStopDto Stop)>();
        foreach (var route in await RoutesAsync(caller, query, ct))
            foreach (var stop in await _map.GetMapStopsAsync(route.Id, caller.TenantId, Today, false) ?? new())
                if (stop.MapStatus == "not_reached") rows.Add((route.Id, route.Name, stop));
        var top = rows.Take(limit).ToList();
        var data = top.Select(r => new Dictionary<string, object?>
        {
            ["customerId"] = r.Stop.CustomerId,
            ["name"] = r.Stop.CustomerName,
            ["routeId"] = r.RouteId,
            ["route"] = r.Route,
            ["position"] = r.Stop.Position,
            ["balance"] = r.Stop.Balance,
        }).ToList();
        var sources = top.Select(r => new AssistantSource("customer", r.Stop.CustomerId.ToString(), r.Stop.CustomerName, asOf)).ToList();
        return new AssistantToolResult(Name, data, sources, asOf);
    }
}

/// <summary>Customers on my routes that have no saved shop location, so they cannot appear on the map.</summary>
internal sealed class CustomersWithoutPinTool : RouteToolBase
{
    private readonly AppDbContext _context;
    public CustomersWithoutPinTool(AppDbContext context, IRouteScopeService scope) : base(context, scope) => _context = context;

    public override string Name => "customers_without_pin";
    public override string Description => "Customers on a route that have no saved shop location. Query is a route name, or \"all\" for every route you can see.";

    public override async Task<AssistantToolResult> RunAsync(AssistantCaller caller, JsonElement args, CancellationToken ct)
    {
        var query = ToolArgs.Text(args, "query", 2, 60);
        var limit = ToolArgs.Limit(args, 5, 10);
        var asOf = DateTime.UtcNow;
        var routes = await RoutesAsync(caller, query, ct);
        var routeIds = routes.Select(r => r.Id).ToList();
        var found = await _context.RouteCustomers.AsNoTracking()
            .Where(rc => routeIds.Contains(rc.RouteId) && rc.Customer.TenantId == caller.TenantId
                         && (rc.Customer.MainLatitude == null || rc.Customer.MainLongitude == null))
            .OrderBy(rc => rc.RouteId).ThenBy(rc => rc.SortOrder ?? int.MaxValue).ThenBy(rc => rc.Customer.Name)
            .Select(rc => new { rc.RouteId, CustomerId = rc.Customer.Id, rc.Customer.Name })
            .Take(limit)
            .ToListAsync(ct);
        var names = routes.ToDictionary(r => r.Id, r => r.Name);
        var data = found.Select(f => new Dictionary<string, object?>
        {
            ["customerId"] = f.CustomerId,
            ["name"] = f.Name,
            ["routeId"] = f.RouteId,
            ["route"] = names[f.RouteId],
        }).ToList();
        var sources = found.Select(f => new AssistantSource("customer", f.CustomerId.ToString(), f.Name, asOf)).ToList();
        return new AssistantToolResult(Name, data, sources, asOf);
    }
}

/// <summary>Counts and totals per route: stops, visited today, owed, overdue.</summary>
internal sealed class RouteSummaryTool : RouteToolBase
{
    private readonly IRouteMapService _map;
    public RouteSummaryTool(AppDbContext context, IRouteScopeService scope, IRouteMapService map) : base(context, scope) => _map = map;

    public override string Name => "route_summary";
    public override string Description => "Stops, visited today, amount owed and overdue for a route. Query is a route name, or \"all\" for every route you can see.";

    public override async Task<AssistantToolResult> RunAsync(AssistantCaller caller, JsonElement args, CancellationToken ct)
    {
        var query = ToolArgs.Text(args, "query", 2, 60);
        var limit = ToolArgs.Limit(args, 5, 10);
        var asOf = DateTime.UtcNow;
        var picked = (await RoutesAsync(caller, query, ct)).Select(r => r.Id).ToList();
        var overview = await _map.GetOverviewAsync(caller.TenantId, picked, Today);
        var rows = overview.Routes.Take(limit).ToList();
        var data = rows.Select(r => new Dictionary<string, object?>
        {
            ["routeId"] = r.RouteId,
            ["name"] = r.Name,
            ["stops"] = r.StopCount,
            ["visitedToday"] = r.VisitedToday,
            ["outstandingTotal"] = r.OutstandingTotal,
            ["overdueTotal"] = r.OverdueTotal,
            ["overdueCustomers"] = r.OverdueCustomers,
        }).ToList();
        return new AssistantToolResult(Name, data, rows.Select(r => RouteSource(r.RouteId, r.Name, asOf)).ToList(), asOf);
    }
}
