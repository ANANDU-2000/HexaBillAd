/*
Purpose: Authentication middleware for JWT validation and role-based access control
Author: AI Assistant
Date: 2025
*/

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using HexaBill.Api.Models;
using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Shared.Middleware
{
    public class JwtMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly IConfiguration _configuration;
        private readonly AppDbContext _context;

        public JwtMiddleware(RequestDelegate next, IConfiguration configuration, AppDbContext context)
        {
            _next = next;
            _configuration = configuration;
            _context = context;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var token = context.Request.Headers["Authorization"].FirstOrDefault()?.Split(" ").Last();

            if (token != null)
            {
                var attached = await AttachUserToContextAsync(context, token);
                if (!attached)
                    return; // Session expired, response already sent
            }

            await _next(context);
        }

        private async Task<bool> AttachUserToContextAsync(HttpContext context, string token)
        {
            try
            {
                var tokenHandler = new JwtSecurityTokenHandler();
                var secretKey = _configuration["JwtSettings:SecretKey"] ?? throw new InvalidOperationException("JWT SecretKey not configured");
                var key = Encoding.ASCII.GetBytes(secretKey);
                
                tokenHandler.ValidateToken(token, new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(key),
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ClockSkew = TimeSpan.Zero
                }, out SecurityToken validatedToken);

                var jwtToken = (JwtSecurityToken)validatedToken;
                var userIdClaim = jwtToken.Claims.FirstOrDefault(x => x.Type == "id" || x.Type == ClaimTypes.NameIdentifier || x.Type == "sub");
                if (userIdClaim == null) return true;
                var userId = int.Parse(userIdClaim.Value);

                // Attach user to context
                var user = await _context.Users
                    .AsNoTracking()
                    .FirstOrDefaultAsync(u => u.Id == userId);

                if (user != null)
                {
                    // Force Logout: session_version must match. Primary enforcement is in JWT Bearer OnTokenValidated (SecurityConfiguration.cs); this middleware is optional if used.
                    var tokenSessionVersion = jwtToken.Claims.FirstOrDefault(x => x.Type == "session_version")?.Value;
                    if (tokenSessionVersion != null && int.TryParse(tokenSessionVersion, out var tokVer) && tokVer != user.SessionVersion)
                    {
                        context.Response.StatusCode = 401;
                        await context.Response.WriteAsJsonAsync(new { success = false, message = "Session expired. Please login again.", code = "SESSION_EXPIRED" });
                        return false;
                    }
                    // Determine tenant ID: prefer TenantId, fallback to OwnerId during migration
                    var tenantId = user.TenantId?.ToString() ?? user.OwnerId?.ToString() ?? "0";
                    
                    var claims = new[]
                    {
                        new Claim("id", user.Id.ToString()),
                        new Claim("email", user.Email),
                        new Claim("role", user.Role.ToString()),
                        new Claim("name", user.Name),
                        // MIGRATION: Include both claims during transition
                        new Claim("owner_id", user.OwnerId?.ToString() ?? "0"), // Legacy, will be removed
                        new Claim("tenant_id", tenantId) // NEW: Primary tenant claim
                    };

                    var identity = new ClaimsIdentity(claims, "Bearer");
                    context.User = new ClaimsPrincipal(identity);
                }
            }
            catch
            {
                // Do nothing if token validation fails
                // The request will continue without a user being attached
            }
            return true;
        }
    }

    public static class JwtMiddlewareExtensions
    {
        public static IApplicationBuilder UseJwtMiddleware(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<JwtMiddleware>();
        }
    }

    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public class AuthorizeRolesAttribute : AuthorizeAttribute
    {
        public AuthorizeRolesAttribute(params string[] roles) : base()
        {
            Roles = string.Join(",", roles);
        }
    }
}
