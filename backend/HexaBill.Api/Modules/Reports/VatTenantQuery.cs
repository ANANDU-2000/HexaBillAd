using System.Linq.Expressions;

namespace HexaBill.Api.Modules.Reports;

/// <summary>Applies the canonical tenant boundary to VAT queries, including legacy nullable TenantId columns.</summary>
internal static class VatTenantQuery
{
    public static IQueryable<T> ForTenant<T>(this IQueryable<T> query, int tenantId)
    {
        var tenantProperty = typeof(T).GetProperty("TenantId")
            ?? throw new InvalidOperationException($"{typeof(T).Name} has no TenantId property.");
        var row = Expression.Parameter(typeof(T), "row");
        var tenant = Expression.Property(row, tenantProperty);
        Expression tenantValue = tenantProperty.PropertyType == typeof(int?)
            ? Expression.Convert(Expression.Constant(tenantId), typeof(int?))
            : Expression.Constant(tenantId);
        var predicate = Expression.Lambda<Func<T, bool>>(Expression.Equal(tenant, tenantValue), row);
        return query.Where(predicate);
    }
}
