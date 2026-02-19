/*
Purpose: Tenant context middleware for multi-tenant SaaS isolation
Author: AI Assistant
Date: 2026
*/
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Shared.Middleware
{
    /// <summary>
    /// Middleware that validates tenant and sets context for every request
    /// MUST be registered AFTER authentication, BEFORE authorization
    /// </summary>
    public class TenantContextMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<TenantContextMiddleware> _logger;
        private readonly IWebHostEnvironment _env;

        public TenantContextMiddleware(RequestDelegate next, ILogger<TenantContextMiddleware> logger, IWebHostEnvironment env)
        {
            _next = next;
            _logger = logger;
            _env = env;
        }

        public async Task InvokeAsync(HttpContext context, AppDbContext dbContext)
        {
            // Skip for public endpoints
            var path = context.Request.Path.Value?.ToLowerInvariant() ?? "";
            if (path.StartsWith("/api/auth") ||
                path.StartsWith("/health") ||
                path == "/" ||
                path.StartsWith("/swagger"))
            {
                await _next(context);
                return;
            }

            // Skip if not authenticated
            if (!context.User.Identity?.IsAuthenticated ?? true)
            {
                await _next(context);
                return;
            }

            try
            {
                // Extract tenant_id from JWT claim - check multiple claim type formats (JWT serialization may vary)
                var tenantIdClaim = context.User.FindFirst("tenant_id")?.Value
                    ?? context.User.FindFirst("owner_id")?.Value
                    ?? context.User.Claims.FirstOrDefault(c => c.Type.EndsWith("tenant_id", StringComparison.OrdinalIgnoreCase))?.Value
                    ?? context.User.Claims.FirstOrDefault(c => c.Type.EndsWith("owner_id", StringComparison.OrdinalIgnoreCase))?.Value;

                if (string.IsNullOrEmpty(tenantIdClaim))
                {
                    _logger.LogWarning("No tenant_id or owner_id claim found in token for user {UserId}",
                        context.User.FindFirst("id")?.Value);
                    
                    // SystemAdmin may not have tenant_id - allow to proceed
                    context.Items["TenantId"] = 0; // 0 = SystemAdmin
                    await _next(context);
                    return;
                }

                if (!int.TryParse(tenantIdClaim, out int tenantId))
                {
                    _logger.LogError("Invalid tenant_id format in token: {TenantIdClaim}", tenantIdClaim);
                    context.Response.StatusCode = 401;
                    await context.Response.WriteAsync("Invalid tenant context");
                    return;
                }

                // SystemAdmin has TenantId = 0 (or null in database)
                if (tenantId == 0)
                {
                    context.Items["TenantId"] = 0;
                    await _next(context);
                    return;
                }

                // Validate tenant exists and is active
                // TEMPORARY FIX: Handle missing FeaturesJson column until migration runs
                Tenant? tenant = null;
                try
                {
                    tenant = await dbContext.Tenants
                        .AsNoTracking()
                        .FirstOrDefaultAsync(t => t.Id == tenantId);
                }
                catch (Exception ex)
                {
                    // Check if this is a PostgresException about missing FeaturesJson column
                    // EF Core may wrap it, so check both the exception itself and inner exceptions
                    var pgEx = ex as Npgsql.PostgresException 
                        ?? ex.InnerException as Npgsql.PostgresException
                        ?? (ex.InnerException?.InnerException as Npgsql.PostgresException);
                    
                    if (pgEx != null && pgEx.SqlState == "42703" && pgEx.MessageText.Contains("FeaturesJson"))
                    {
                        // FeaturesJson column doesn't exist yet - try to add it, then retry query
                        _logger.LogWarning("FeaturesJson column not found - attempting to add column and retry query.");
                        var connection = dbContext.Database.GetDbConnection();
                        var wasOpen = connection.State == System.Data.ConnectionState.Open;
                        if (!wasOpen) await connection.OpenAsync();
                        
                        try
                        {
                            // Try to add the column if it doesn't exist
                            using var addColumnCmd = connection.CreateCommand();
                            addColumnCmd.CommandText = @"ALTER TABLE ""Tenants"" ADD COLUMN IF NOT EXISTS ""FeaturesJson"" character varying(2000) NULL;";
                            try
                            {
                                await addColumnCmd.ExecuteNonQueryAsync();
                                _logger.LogInformation("Successfully added FeaturesJson column to Tenants table");
                                // Now retry the original EF Core query
                                tenant = await dbContext.Tenants
                                    .AsNoTracking()
                                    .FirstOrDefaultAsync(t => t.Id == tenantId);
                            }
                            catch (Exception addColumnEx)
                            {
                                _logger.LogWarning(addColumnEx, "Failed to add FeaturesJson column - using fallback query");
                                // Fallback: query without FeaturesJson using raw SQL
                                using var command = connection.CreateCommand();
                                command.CommandText = @"
                                    SELECT ""Id"", ""Name"", ""Subdomain"", ""Domain"", ""Country"", ""Currency"", 
                                           ""VatNumber"", ""CompanyNameEn"", ""CompanyNameAr"", ""Address"", 
                                           ""Phone"", ""Email"", ""LogoPath"", ""Status"", ""CreatedAt"", 
                                           ""TrialEndDate"", ""SuspendedAt"", ""SuspensionReason""
                                    FROM ""Tenants""
                                    WHERE ""Id"" = @tenantId";
                                var param = command.CreateParameter();
                                param.ParameterName = "@tenantId";
                                param.Value = tenantId;
                                command.Parameters.Add(param);
                                
                                using var reader = await command.ExecuteReaderAsync();
                                if (await reader.ReadAsync())
                                {
                                    tenant = new Tenant
                                    {
                                        Id = reader.GetInt32(0),
                                        Name = reader.GetString(1),
                                        Subdomain = reader.IsDBNull(2) ? null : reader.GetString(2),
                                        Domain = reader.IsDBNull(3) ? null : reader.GetString(3),
                                        Country = reader.GetString(4),
                                        Currency = reader.GetString(5),
                                        VatNumber = reader.IsDBNull(6) ? null : reader.GetString(6),
                                        CompanyNameEn = reader.IsDBNull(7) ? null : reader.GetString(7),
                                        CompanyNameAr = reader.IsDBNull(8) ? null : reader.GetString(8),
                                        Address = reader.IsDBNull(9) ? null : reader.GetString(9),
                                        Phone = reader.IsDBNull(10) ? null : reader.GetString(10),
                                        Email = reader.IsDBNull(11) ? null : reader.GetString(11),
                                        LogoPath = reader.IsDBNull(12) ? null : reader.GetString(12),
                                        Status = (TenantStatus)reader.GetInt32(13),
                                        CreatedAt = reader.GetDateTime(14),
                                        TrialEndDate = reader.IsDBNull(15) ? null : reader.GetDateTime(15),
                                        SuspendedAt = reader.IsDBNull(16) ? null : reader.GetDateTime(16),
                                        SuspensionReason = reader.IsDBNull(17) ? null : reader.GetString(17),
                                        FeaturesJson = null // Column doesn't exist yet
                                    };
                                }
                            }
                        }
                        finally
                        {
                            if (!wasOpen && connection.State == System.Data.ConnectionState.Open)
                                await connection.CloseAsync();
                        }
                    }
                    else
                    {
                        // Re-throw if it's not the FeaturesJson column error
                        throw;
                    }
                }

                if (tenant == null)
                {
                    // Development: use first active tenant as fallback so app keeps working
                    if (_env.IsDevelopment())
                    {
                        try
                        {
                            var fallbackTenant = await dbContext.Tenants.AsNoTracking()
                                .Where(t => t.Status == TenantStatus.Active)
                                .OrderBy(t => t.Id)
                                .FirstOrDefaultAsync();
                            if (fallbackTenant != null)
                            {
                                _logger.LogWarning("Development: Tenant {TenantId} not found - using fallback tenant {FallbackId} ({Name})", tenantId, fallbackTenant.Id, fallbackTenant.Name);
                                tenant = fallbackTenant;
                                tenantId = fallbackTenant.Id;
                            }
                        }
                        catch (Exception fallbackEx)
                        {
                            // If FeaturesJson column is missing, skip fallback
                            var pgEx = fallbackEx as Npgsql.PostgresException 
                                ?? fallbackEx.InnerException as Npgsql.PostgresException
                                ?? (fallbackEx.InnerException?.InnerException as Npgsql.PostgresException);
                            if (pgEx != null && pgEx.SqlState == "42703" && pgEx.MessageText.Contains("FeaturesJson"))
                            {
                                _logger.LogWarning("Skipping development fallback due to missing FeaturesJson column");
                            }
                            else
                            {
                                throw;
                            }
                        }
                    }
                    if (tenant == null)
                    {
                        _logger.LogWarning("Tenant {TenantId} not found in database", tenantId);
                        context.Response.StatusCode = 403;
                        await context.Response.WriteAsync("Tenant not found");
                        return;
                    }
                }

                // Check tenant status - in Development, auto-activate suspended/expired tenants
                var wouldBlock = tenant.Status == TenantStatus.Suspended ||
                    tenant.Status == TenantStatus.Expired ||
                    (tenant.Status == TenantStatus.Trial && tenant.TrialEndDate.HasValue && tenant.TrialEndDate.Value < DateTime.UtcNow);

                if (wouldBlock && _env.IsDevelopment())
                {
                    _logger.LogInformation("Development: Auto-activating tenant {TenantId} ({Name}) - was {Status}", tenant.Id, tenant.Name, tenant.Status);
                    try
                    {
                        var dbTenant = await dbContext.Tenants.FindAsync(tenantId);
                        if (dbTenant != null)
                        {
                            dbTenant.Status = TenantStatus.Active;
                            dbTenant.TrialEndDate = null;
                            await dbContext.SaveChangesAsync();
                        }
                    }
                    catch (Exception activateEx)
                    {
                        // If FeaturesJson column is missing, skip activation (non-critical)
                        var pgEx = activateEx as Npgsql.PostgresException 
                            ?? activateEx.InnerException as Npgsql.PostgresException
                            ?? (activateEx.InnerException?.InnerException as Npgsql.PostgresException);
                        if (pgEx != null && pgEx.SqlState == "42703" && pgEx.MessageText.Contains("FeaturesJson"))
                        {
                            _logger.LogWarning("Skipping tenant activation due to missing FeaturesJson column");
                        }
                        else
                        {
                            throw;
                        }
                    }
                    // CRITICAL: Must not fall through to 403 - continue to set tenant context
                }
                else if (wouldBlock)
                {
                    // Production: block suspended/expired tenants
                    var reason = tenant.Status == TenantStatus.Suspended ? "Tenant account is suspended"
                        : tenant.Status == TenantStatus.Expired ? "Tenant trial has expired"
                        : "Tenant trial has expired";
                    _logger.LogWarning("Tenant {TenantId} blocked: {Status}", tenantId, tenant.Status);
                    context.Response.StatusCode = 403;
                    await context.Response.WriteAsync(reason);
                    return;
                }

                // Set tenant context
                context.Items["TenantId"] = tenantId;

                // Set PostgreSQL session variable for RLS only when using PostgreSQL (SQLite does not support SET)
                var connString = (dbContext.Database.GetConnectionString() ?? "").Trim();
                var isSqlite = connString.StartsWith("Data Source=", StringComparison.OrdinalIgnoreCase) ||
                              connString.Contains(".db", StringComparison.OrdinalIgnoreCase);
                var isPostgres = connString.StartsWith("Host=", StringComparison.OrdinalIgnoreCase) ||
                                connString.StartsWith("Server=", StringComparison.OrdinalIgnoreCase);
                if (!isSqlite && isPostgres)
                {
                    try
                    {
                        // PostgreSQL SET does not accept parameterized $1; use set_config which does
                        await dbContext.Database.ExecuteSqlRawAsync(
                            "SELECT set_config('app.tenant_id', {0}, true)",
                            tenantId.ToString());
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to set PostgreSQL session variable app.tenant_id");
                    }
                }

                await _next(context);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in TenantContextMiddleware");
                context.Response.StatusCode = 500;
                await context.Response.WriteAsync("Internal server error");
            }
        }
    }

    public static class TenantContextMiddlewareExtensions
    {
        public static IApplicationBuilder UseTenantContext(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<TenantContextMiddleware>();
        }
    }
}
