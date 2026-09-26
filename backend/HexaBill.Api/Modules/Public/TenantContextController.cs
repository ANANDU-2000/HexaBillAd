using HexaBill.Api.Data;
using HexaBill.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace HexaBill.Api.Modules.Public;

[ApiController]
[Route("api/public/tenant-context")]
public sealed class TenantContextController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly HostingOptions _hosting;

    public TenantContextController(AppDbContext db, IOptions<HostingOptions> hosting)
    {
        _db = db;
        _hosting = hosting.Value;
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> Get()
    {
        var resolution = HttpContext.Items[TenantHostMiddleware.ResolutionItemKey] as TenantHostResolution;
        if (resolution?.Kind != TenantHostKind.Tenant || !resolution.TenantId.HasValue)
            return NotFound(new { success = false, message = "Company not found" });

        var tenant = await _db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == resolution.TenantId.Value);
        if (tenant == null || !string.Equals(tenant.Subdomain, resolution.Slug, StringComparison.OrdinalIgnoreCase))
            return NotFound(new { success = false, message = "Company not found" });

        return Ok(new
        {
            success = true,
            data = new
            {
                tenantName = tenant.Name ?? tenant.CompanyNameEn,
                subdomain = tenant.Subdomain,
                loginUrl = $"https://{tenant.Subdomain}.{_hosting.BaseDomain}/login",
                logoUrl = tenant.LogoPath,
                status = tenant.Status.ToString(),
                currency = tenant.Currency,
                timeZone = "Asia/Dubai"
            }
        });
    }
}
