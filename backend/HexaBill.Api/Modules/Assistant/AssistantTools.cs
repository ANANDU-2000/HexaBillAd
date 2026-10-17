using System.Text.Json;
using HexaBill.Api.Models;
using HexaBill.Api.Modules.Customers;
using HexaBill.Api.Modules.Products;

namespace HexaBill.Api.Modules.Assistant;

/// <summary>Who is asking. Always derived from the authenticated token on the server, never from the request body.</summary>
public sealed record AssistantCaller(int TenantId, int UserId, bool IsOwnerOrAdmin);

/// <summary>A record the answer was read from, so a person can check it.</summary>
public sealed record AssistantSource(string Type, string Id, string Label, DateTime AsOf);

public sealed record AssistantToolResult(string Tool, object Data, IReadOnlyList<AssistantSource> Sources, DateTime AsOf);

public sealed class AssistantToolException : Exception
{
    public int StatusCode { get; }
    public AssistantToolException(int statusCode, string message) : base(message) => StatusCode = statusCode;
}

public interface IAssistantTool
{
    string Name { get; }
    string Description { get; }
    /// <summary>Input fields the tool accepts. Anything else is rejected, so a caller cannot smuggle parameters in.</summary>
    IReadOnlyList<string> Arguments { get; }
    bool AllowedFor(AssistantCaller caller);
    Task<AssistantToolResult> RunAsync(AssistantCaller caller, JsonElement args, CancellationToken ct);
}

/// <summary>
/// Fixed list of read-only tools. There is no SQL, HTTP, file or free-form tool, and no write tool.
/// Every tool receives the server-verified caller and goes through the existing domain services.
/// </summary>
public sealed class AssistantToolRegistry
{
    private readonly Dictionary<string, IAssistantTool> _tools;

    public AssistantToolRegistry(IEnumerable<IAssistantTool> tools) =>
        _tools = tools.ToDictionary(t => t.Name, StringComparer.Ordinal);

    public IReadOnlyList<IAssistantTool> ToolsFor(AssistantCaller caller) =>
        _tools.Values.Where(t => t.AllowedFor(caller)).OrderBy(t => t.Name, StringComparer.Ordinal).ToList();

    public async Task<AssistantToolResult> RunAsync(AssistantCaller caller, string name, JsonElement args, CancellationToken ct)
    {
        if (caller.TenantId <= 0) throw new AssistantToolException(403, "No company scope.");
        // Unknown and not-allowed look the same, so the list of hidden tools is not discoverable.
        if (!_tools.TryGetValue(name ?? string.Empty, out var tool) || !tool.AllowedFor(caller))
            throw new AssistantToolException(404, "Unknown tool.");
        if (args.ValueKind == JsonValueKind.Object)
        {
            var allowed = tool.Arguments.ToHashSet(StringComparer.OrdinalIgnoreCase);
            foreach (var property in args.EnumerateObject())
                if (!allowed.Contains(property.Name))
                    throw new AssistantToolException(400, $"Unexpected argument '{property.Name}'.");
        }
        else if (args.ValueKind != JsonValueKind.Undefined && args.ValueKind != JsonValueKind.Null)
        {
            throw new AssistantToolException(400, "Arguments must be an object.");
        }
        return await tool.RunAsync(caller, args, ct);
    }
}

internal static class ToolArgs
{
    public static string Text(JsonElement args, string name, int min, int max)
    {
        if (args.ValueKind != JsonValueKind.Object || !args.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String)
            throw new AssistantToolException(400, $"'{name}' is required.");
        var text = value.GetString()?.Trim() ?? string.Empty;
        if (text.Length < min || text.Length > max)
            throw new AssistantToolException(400, $"'{name}' must be {min} to {max} characters.");
        return text;
    }

    public static int Limit(JsonElement args, int fallback, int max)
    {
        if (args.ValueKind != JsonValueKind.Object || !args.TryGetProperty("limit", out var value)) return fallback;
        if (value.ValueKind != JsonValueKind.Number || !value.TryGetInt32(out var n) || n < 1)
            throw new AssistantToolException(400, "'limit' must be a positive whole number.");
        return Math.Min(n, max);
    }
}

/// <summary>Find customers by name, phone, email or TRN. Balances are shown to owners and admins only.</summary>
public sealed class FindCustomersTool : IAssistantTool
{
    private readonly ICustomerService _customers;
    public FindCustomersTool(ICustomerService customers) => _customers = customers;

    public string Name => "find_customers";
    public string Description => "Find customers by name, phone, email or TRN. Owners and admins also see the balance.";
    public IReadOnlyList<string> Arguments { get; } = new[] { "query", "limit" };
    public bool AllowedFor(AssistantCaller caller) => caller.TenantId > 0;

    public async Task<AssistantToolResult> RunAsync(AssistantCaller caller, JsonElement args, CancellationToken ct)
    {
        var query = ToolArgs.Text(args, "query", 2, 60);
        var limit = ToolArgs.Limit(args, 5, 10);
        var asOf = DateTime.UtcNow;
        var found = await _customers.SearchCustomersAsync(query, caller.TenantId, limit);
        var rows = found.Take(limit).Select(c => new Dictionary<string, object?>
        {
            ["id"] = c.Id,
            ["name"] = c.Name,
            ["phone"] = c.Phone,
            ["balance"] = caller.IsOwnerOrAdmin ? c.Balance : null,
        }).ToList();
        var sources = found.Take(limit).Select(c => new AssistantSource("customer", c.Id.ToString(), c.Name, asOf)).ToList();
        return new AssistantToolResult(Name, rows, sources, asOf);
    }
}

/// <summary>Find products and their stock. Cost price is shown to owners and admins only.</summary>
public sealed class ProductStockTool : IAssistantTool
{
    private readonly IProductService _products;
    public ProductStockTool(IProductService products) => _products = products;

    public string Name => "product_stock";
    public string Description => "Find products by name, SKU or barcode and show stock on hand. Owners and admins also see cost price.";
    public IReadOnlyList<string> Arguments { get; } = new[] { "query", "limit" };
    public bool AllowedFor(AssistantCaller caller) => caller.TenantId > 0;

    public async Task<AssistantToolResult> RunAsync(AssistantCaller caller, JsonElement args, CancellationToken ct)
    {
        var query = ToolArgs.Text(args, "query", 2, 60);
        var limit = ToolArgs.Limit(args, 5, 10);
        var asOf = DateTime.UtcNow;
        var found = await _products.SearchProductsAsync(query, caller.TenantId, limit);
        var rows = found.Take(limit).Select(p => new Dictionary<string, object?>
        {
            ["id"] = p.Id,
            ["sku"] = p.Sku,
            ["name"] = p.NameEn,
            ["unit"] = p.UnitType,
            ["stockQty"] = p.StockQty,
            ["reorderLevel"] = p.ReorderLevel,
            ["lowStock"] = p.StockQty <= p.ReorderLevel,
            ["costPrice"] = caller.IsOwnerOrAdmin ? p.CostPrice : null,
            ["sellPrice"] = p.SellPrice,
        }).ToList();
        var sources = found.Take(limit).Select(p => new AssistantSource("product", p.Id.ToString(), $"{p.Sku} {p.NameEn}", asOf)).ToList();
        return new AssistantToolResult(Name, rows, sources, asOf);
    }
}
