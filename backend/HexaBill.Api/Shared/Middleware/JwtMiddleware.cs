/*
Purpose: Authentication middleware for JWT validation and role-based access control
Author: AI Assistant
Date: 2025
*/

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
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
                await AttachUserToContextAsync(context, token);
            }

            await _next(context);
        }

        private async Task AttachUserToContextAsync(HttpContext context, string token)
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
                var userId = int.Parse(jwtToken.Claims.First(x => x.Type == "id").Value);

                // Attach user to context
                var user = await _context.Users
                    .AsNoTracking()
                    .FirstOrDefaultAsync(u => u.Id == userId);

                if (user != null)
                {
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
