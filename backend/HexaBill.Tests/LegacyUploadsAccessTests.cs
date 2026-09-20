using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using HexaBill.Api.Shared.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace HexaBill.Tests;

public class LegacyUploadsAccessTests
{
    private const string Secret = "YourSuperSecretKeyThatIsAtLeast32CharactersLong!";

    public LegacyUploadsAccessTests()
    {
        Environment.SetEnvironmentVariable("JWT_SECRET_KEY", Secret);
    }

    [Theory]
    [InlineData("/uploads/1/logo.png", 1)]
    [InlineData("/uploads/42/products/product_1.jpg", 42)]
    [InlineData("uploads/7/invoice_3.pdf", 7)]
    public void TryGetPathTenantId_ParsesTenantSegment(string path, int expectedTenantId)
    {
        Assert.True(LegacyUploadsAccess.TryGetPathTenantId(path, out var tenantId));
        Assert.Equal(expectedTenantId, tenantId);
    }

    [Theory]
    [InlineData("/uploads/logo.png")]
    [InlineData("/uploads/expenses/receipt.jpg")]
    public void TryGetPathTenantId_RejectsPathsWithoutTenantSegment(string path)
    {
        Assert.False(LegacyUploadsAccess.TryGetPathTenantId(path, out _));
    }

    [Fact]
    public void TenantA_OwnFile_Allowed()
    {
        var context = CreateUploadContext("/uploads/1/logo.png", CreateToken(tenantId: 1));
        var config = CreateConfig();
        Assert.True(RequestJwtValidator.TryValidate(context, config, out var principal));
        Assert.NotNull(principal);
        Assert.True(LegacyUploadsAccess.CanAccess(context, config));
    }

    [Fact]
    public void TenantA_RequestingTenantBFile_Denied()
    {
        var context = CreateUploadContext("/uploads/2/logo.png", CreateToken(tenantId: 1));
        Assert.False(LegacyUploadsAccess.CanAccess(context, CreateConfig()));
    }

    [Fact]
    public void TenantB_RequestingTenantAFile_Denied()
    {
        var context = CreateUploadContext("/uploads/1/logo.png", CreateToken(tenantId: 2));
        Assert.False(LegacyUploadsAccess.CanAccess(context, CreateConfig()));
    }

    [Fact]
    public void UnauthenticatedRequest_Rejected()
    {
        var context = CreateUploadContext("/uploads/1/logo.png", token: null);
        Assert.False(LegacyUploadsAccess.CanAccess(context, CreateConfig()));
    }

    [Fact]
    public void PlatformAdmin_CanAccessAnyTenantFile()
    {
        var context = CreateUploadContext("/uploads/2/logo.png", CreatePlatformToken());
        Assert.True(LegacyUploadsAccess.CanAccess(context, CreateConfig()));
    }

    private static IConfiguration CreateConfig() =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JwtSettings:SecretKey"] = Secret,
                ["JwtSettings:Issuer"] = "HexaBill.Api",
                ["JwtSettings:Audience"] = "HexaBill.Api",
            })
            .Build();

    private static HttpContext CreateUploadContext(string path, string? token)
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        if (!string.IsNullOrEmpty(token))
            context.Request.Headers.Authorization = $"Bearer {token}";
        return context;
    }

    private static string CreateToken(int tenantId)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: "HexaBill.Api",
            audience: "HexaBill.Api",
            claims: new[] { new Claim("tid", tenantId.ToString()) },
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string CreatePlatformToken()
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: "HexaBill.Api",
            audience: "HexaBill.Api",
            claims: new[] { new Claim("plat", "true") },
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
