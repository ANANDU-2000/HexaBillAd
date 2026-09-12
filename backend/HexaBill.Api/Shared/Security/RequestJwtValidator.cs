using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace HexaBill.Api.Shared.Security;

/// <summary>
/// Validates a Bearer or query-string JWT with the same issuer/audience/secret as the API.
/// Used for static /uploads paths that run before UseAuthentication.
/// </summary>
public static class RequestJwtValidator
{
    public static bool IsValid(HttpContext context, IConfiguration configuration)
    {
        string? token = null;
        var header = context.Request.Headers.Authorization.ToString();
        if (header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            token = header["Bearer ".Length..].Trim();
        if (string.IsNullOrWhiteSpace(token))
            token = context.Request.Query["token"].ToString();
        if (string.IsNullOrWhiteSpace(token) || token.Length < 20)
            return false;

        var secret = Environment.GetEnvironmentVariable("JWT_SECRET_KEY")
            ?? configuration["JwtSettings:SecretKey"];
        if (string.IsNullOrWhiteSpace(secret))
            return false;

        try
        {
            var handler = new JwtSecurityTokenHandler();
            handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),
                ValidateIssuer = true,
                ValidIssuer = configuration["JwtSettings:Issuer"],
                ValidateAudience = true,
                ValidAudience = configuration["JwtSettings:Audience"],
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromMinutes(2)
            }, out _);
            return true;
        }
        catch
        {
            return false;
        }
    }
}
