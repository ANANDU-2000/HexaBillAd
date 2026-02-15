/*
Purpose: Enhanced security configuration and CORS policy
Author: AI Assistant
Date: 2024
*/
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System;
using System.Linq;
using HexaBill.Api.Shared.Middleware;

namespace HexaBill.Api.Shared.Extensions
{
    public static class SecurityConfiguration
    {
        public static IServiceCollection AddSecurityServices(this IServiceCollection services, IConfiguration configuration)
        {
            // JWT Authentication with enhanced security
            var jwtSettings = configuration.GetSection("JwtSettings");
            var secretKey = jwtSettings["SecretKey"] ?? throw new InvalidOperationException("JWT SecretKey not configured");

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
                        ClockSkew = TimeSpan.Zero,
                        RequireExpirationTime = true
                    };

                    options.Events = new JwtBearerEvents
                    {
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
            });

            // Enhanced CORS with environment-based configuration
            // Support both appsettings.json and ALLOWED_ORIGINS environment variable
            string[] allowedOrigins;
            var allowedOriginsEnv = Environment.GetEnvironmentVariable("ALLOWED_ORIGINS");
            
            if (!string.IsNullOrEmpty(allowedOriginsEnv))
            {
                // Parse comma-separated origins from environment variable
                var envOrigins = allowedOriginsEnv.Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(o => o.Trim())
                    .Where(o => !string.IsNullOrEmpty(o))
                    .ToList();
                
                // Always ensure known frontend origins are included
                var knownOrigins = new[] { "https://hexabill.netlify.app", "https://hexabill.company", "https://www.hexabill.company" };
                foreach (var origin in knownOrigins)
                {
                    if (!envOrigins.Contains(origin))
                    {
                        envOrigins.Add(origin);
                        Console.WriteLine($"CORS: Auto-added origin: {origin}");
                    }
                }
                
                allowedOrigins = envOrigins.ToArray();
                Console.WriteLine($"CORS: Using ALLOWED_ORIGINS environment variable with {allowedOrigins.Length} origins");
            }
            else
            {
                // Fallback to appsettings.json configuration with default frontend URLs
                allowedOrigins = configuration.GetSection("AllowedOrigins").Get<string[]>() ?? 
                                new[] { 
                                    "http://localhost:3000", 
                                    "https://localhost:3000",
                                    "https://hexabill.netlify.app",
                                    "https://hexabill.company",
                                    "https://www.hexabill.company"
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
                    policy.AllowAnyOrigin() // Allow ALL origins in development
                          .AllowAnyMethod()
                          .AllowAnyHeader();
                    // Note: AllowAnyOrigin() and AllowCredentials() are mutually exclusive
                    // For development, we allow any origin without credentials
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

            // Rate limiting
            app.UseRateLimiting();

            // Note: CORS is now called in Program.cs BEFORE UseSecurityMiddleware
            // This ensures CORS headers are set before authentication checks

            return app;
        }
    }
}

