/*
Purpose: Enhanced security configuration and CORS policy
Author: AI Assistant
Date: 2024
*/
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using HexaBill.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HexaBill.Api.Shared.Extensions
{
    public static class SecurityConfiguration
    {
        public static IServiceCollection AddSecurityServices(this IServiceCollection services, IConfiguration configuration)
        {
            // JWT Authentication with enhanced security
            // Priority: JWT_SECRET_KEY env (production) > appsettings JwtSettings:SecretKey
            var jwtSettings = configuration.GetSection("JwtSettings");
            var secretKey = Environment.GetEnvironmentVariable("JWT_SECRET_KEY")
                ?? jwtSettings["SecretKey"]
                ?? throw new InvalidOperationException("JWT SecretKey not configured. Set JwtSettings:SecretKey in appsettings or JWT_SECRET_KEY environment variable.");

            services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
                        ValidateIssuer = true,
                        ValidIssuer = jwtSettings["Issuer"],
                        ValidateAudience = true,
                        ValidAudience = jwtSettings["Audience"],
                        ValidateLifetime = true,
                        // Allow 2 min clock skew - avoids false 401 on POST when token near expiry (server/client time drift)
                        ClockSkew = TimeSpan.FromMinutes(2),
                        RequireExpirationTime = true
                    };

                    options.Events = new JwtBearerEvents
                    {
                        // Force logout: SessionVersion checked on every JWT request (PRODUCTION_MASTER_TODO #22)
                        OnTokenValidated = async context =>
                        {
                            var principal = context.Principal;
                            var sessionVersionClaim = principal?.FindFirst("session_version")?.Value;
                            if (string.IsNullOrEmpty(sessionVersionClaim)) return; // Old tokens without claim allowed
                            if (!int.TryParse(sessionVersionClaim, out var tokenVer)) return;

                            var userIdClaim = principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                ?? principal?.FindFirst("id")?.Value
                                ?? principal?.FindFirst("sub")?.Value;
                            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
                                return;

                            var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                            var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
                            if (user != null && user.SessionVersion != tokenVer)
                            {
                                context.Response.Headers["X-Auth-Failure"] = "Session-Expired";
                                context.Fail(new UnauthorizedAccessException("Session expired. Please login again."));
                            }
                        },
                        OnAuthenticationFailed = context =>
                        {
                            if (context.Exception.GetType() == typeof(SecurityTokenExpiredException))
                            {
                                context.Response.Headers["Token-Expired"] = "true";
                                context.Response.Headers["X-Auth-Failure"] = "Token-Expired";
                            }
                            else if (context.Exception.GetType() == typeof(SecurityTokenInvalidSignatureException) ||
                                     context.Exception.GetType() == typeof(SecurityTokenInvalidIssuerException) ||
                                     context.Exception.GetType() == typeof(SecurityTokenInvalidAudienceException))
                            {
                                context.Response.Headers["X-Auth-Failure"] = "Invalid-Token";
                            }
                            else
                            {
                                context.Response.Headers["X-Auth-Failure"] = "Authentication-Failed";
                            }
                            return Task.CompletedTask;
                        },
                        OnChallenge = context =>
                        {
                            context.HandleResponse();
                            context.Response.StatusCode = 401;
                            
                            // Check if we already set X-Auth-Failure in OnAuthenticationFailed
                            string authFailureType = "Authentication-Required";
                            if (context.Response.Headers.ContainsKey("X-Auth-Failure"))
                            {
                                if (context.Response.Headers.TryGetValue("X-Auth-Failure", out var existingValue))
                                {
                                    authFailureType = existingValue.ToString();
                                }
                            }
                            else
                            {
                                context.Response.Headers["X-Auth-Failure"] = authFailureType;
                            }
                            
                            var errorMessage = authFailureType switch
                            {
                                "Token-Expired" => "Your session has expired. Please login again.",
                                "Session-Expired" => "Session expired. Please login again.",
                                "Invalid-Token" => "Invalid authentication token. Please login again.",
                                _ => "Authentication required. Please login again."
                            };
                            
                            return context.Response.WriteAsJsonAsync(new
                            {
                                success = false,
                                message = errorMessage
                            });
                        }
                    };
                });

            services.AddAuthorization(options =>
            {
                options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));
                options.AddPolicy("StaffOrAdmin", policy => policy.RequireRole("Staff", "Admin"));
                // Production-ready: case-insensitive Admin/Owner/SystemAdmin for JWT interoperability
                options.AddPolicy("AdminOrOwner", policy =>
                    policy.Requirements.Add(new HexaBill.Api.Shared.Authorization.AdminOrOwnerRequirement()));
                options.AddPolicy("AdminOrOwnerOrStaff", policy =>
                    policy.Requirements.Add(new HexaBill.Api.Shared.Authorization.AdminOrOwnerOrStaffRequirement()));
            });
            services.AddSingleton<Microsoft.AspNetCore.Authorization.IAuthorizationHandler, HexaBill.Api.Shared.Authorization.AdminOrOwnerAuthorizationHandler>();
            services.AddSingleton<Microsoft.AspNetCore.Authorization.IAuthorizationHandler, HexaBill.Api.Shared.Authorization.AdminOrOwnerOrStaffAuthorizationHandler>();

            // Enhanced CORS with environment-based configuration
            // Support both appsettings.json and ALLOWED_ORIGINS environment variable
            string[] allowedOrigins;
            var allowedOriginsEnv = Environment.GetEnvironmentVariable("ALLOWED_ORIGINS");

            if (!string.IsNullOrEmpty(allowedOriginsEnv))
            {
                // Parse comma-separated origins from environment variable
                allowedOrigins = allowedOriginsEnv
                    .Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(o => o.Trim())
                    .Where(o => !string.IsNullOrEmpty(o))
                    .ToArray();
                Console.WriteLine($"CORS: Using ALLOWED_ORIGINS env var with {allowedOrigins.Length} origins");
            }
            else
            {
                // Fallback to appsettings.json — NO hardcoded production URLs
                allowedOrigins = configuration.GetSection("AllowedOrigins").Get<string[]>() ??
                                new[]
                                {
                                    "http://localhost:3000",
                                    "https://localhost:3000",
                                    "http://localhost:5173",
                                    "https://localhost:5173",
                                    "http://localhost:5174"
                                };
                Console.WriteLine($"CORS: Using appsettings.json with {allowedOrigins.Length} origins");
            }

            // Log all allowed origins for debugging
            foreach (var origin in allowedOrigins)
            {
                Console.WriteLine($"CORS: Allowed origin: {origin}");
            }

            services.AddCors(options =>
            {
                options.AddPolicy("Production", policy =>
                {
                    policy.WithOrigins(allowedOrigins)
                          .AllowAnyMethod()
                          .AllowAnyHeader()
                          .AllowCredentials();
                });

                options.AddPolicy("Development", policy =>
                {
                    // Use explicit origins + AllowCredentials so browser accepts CORS when sending auth/cookies
                    policy.WithOrigins(
                            "http://localhost:3000",
                            "https://localhost:3000",
                            "http://localhost:5173",
                            "https://localhost:5173",
                            "http://localhost:5174",
                            "https://localhost:5174",
                            "http://127.0.0.1:3000",
                            "http://127.0.0.1:5173",
                            "http://127.0.0.1:5174"
                          )
                          .AllowAnyMethod()
                          .AllowAnyHeader()
                          .AllowCredentials();
                });
                
                // Default policy for fallback
                options.AddDefaultPolicy(policy =>
                {
                    policy.WithOrigins(
                            "http://localhost:3000",
                            "http://localhost:5173",
                            "http://localhost:5174",
                            "http://127.0.0.1:3000",
                            "http://127.0.0.1:5173",
                            "http://127.0.0.1:5174",
                            "https://localhost:3000",
                            "https://localhost:5173",
                            "https://localhost:5174"
                          )
                          .AllowAnyMethod()
                          .AllowAnyHeader()
                          .AllowCredentials();
                });
            });

            Console.WriteLine($"✅ CORS: Configuration complete. Environment: {(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Not Set")}");

            // Built-in rate limiter (replaces custom in-memory RateLimitingMiddleware) - PRODUCTION_MASTER_TODO #31
            // Increased from 100 to 300 req/min to prevent 429 when multiple pages load branches/routes
            services.AddRateLimiter(options =>
            {
                options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                {
                    var clientIp = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                    return RateLimitPartition.GetFixedWindowLimiter(clientIp, _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 300,
                        Window = TimeSpan.FromMinutes(1)
                    });
                });
                options.OnRejected = async (context, cancellationToken) =>
                {
                    context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                    context.HttpContext.Response.ContentType = "application/json";
                    await context.HttpContext.Response.WriteAsync(JsonSerializer.Serialize(new
                    {
                        success = false,
                        message = "Rate limit exceeded. Please try again later."
                    }), cancellationToken);
                };
            });

            return services;
        }

        public static IApplicationBuilder UseSecurityMiddleware(this IApplicationBuilder app, IWebHostEnvironment environment)
        {
            // Security headers - but don't interfere with CORS
            app.Use(async (context, next) =>
            {
                // Only add security headers if CORS hasn't already been processed
                context.Response.Headers["X-Content-Type-Options"] = "nosniff";
                context.Response.Headers["X-Frame-Options"] = "SAMEORIGIN"; // Changed from DENY to SAMEORIGIN for API compatibility
                context.Response.Headers["X-XSS-Protection"] = "1; mode=block";
                context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
                // Remove CSP header as it can interfere with API responses
                
                await next();
            });

            // Rate limiting (ASP.NET Core built-in; no in-memory lock contention)
            app.UseRateLimiter();

            // Note: CORS is now called in Program.cs BEFORE UseSecurityMiddleware
            // This ensures CORS headers are set before authentication checks

            return app;
        }
    }
}

