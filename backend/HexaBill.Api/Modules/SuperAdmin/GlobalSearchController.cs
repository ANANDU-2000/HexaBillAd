/*
 * Global search across all tenants (Super Admin only). PRODUCTION_MASTER_TODO #44.
 * Read-only: search invoices by number and customers by name/phone/email.
 */
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions;

namespace HexaBill.Api.Modules.SuperAdmin
{
    [ApiController]
    [Route("api/superadmin/[controller]")]
    [Authorize]
    public class GlobalSearchController : TenantScopedController
    {
        private readonly AppDbContext _context;

        public GlobalSearchController(AppDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Search invoices and customers across all tenants. SystemAdmin only. Minimum 2 characters.
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<ApiResponse<GlobalSearchResultDto>>> Search([FromQuery] string? q, [FromQuery] int limit = 25)
        {
            if (!IsSystemAdmin)
                return Forbid();

            var term = (q ?? "").Trim();
            if (term.Length < 2)
            {
                return Ok(new ApiResponse<GlobalSearchResultDto>
                {
                    Success = true,
                    Message = "Enter at least 2 characters to search",
                    Data = new GlobalSearchResultDto { Invoices = new List<GlobalSearchInvoiceDto>(), Customers = new List<GlobalSearchCustomerDto>() }
                });
            }

            limit = Math.Clamp(limit, 1, 50);
            var search = $"%{term}%";

            var tenantNames = await _context.Tenants.AsNoTracking().ToDictionaryAsync(t => t.Id, t => t.Name ?? $"Tenant {t.Id}");

            // Invoices: by InvoiceNo or customer name, non-deleted, any tenant (Like works on both SQLite and PostgreSQL)
            var invoices = await _context.Sales
                .AsNoTracking()
                .Include(s => s.Customer)
                .Where(s => !s.IsDeleted && s.TenantId != null &&
                    (EF.Functions.Like(s.InvoiceNo, search) ||
                     (s.Customer != null && (
                         EF.Functions.Like(s.Customer.Name, search) ||
                         (s.Customer.Phone != null && EF.Functions.Like(s.Customer.Phone, search)) ||
                         (s.Customer.Email != null && EF.Functions.Like(s.Customer.Email, search))))))
                .OrderByDescending(s => s.InvoiceDate)
                .Take(limit)
                .Select(s => new GlobalSearchInvoiceDto
                {
                    SaleId = s.Id,
                    TenantId = s.TenantId ?? 0,
                    TenantName = "",
                    InvoiceNo = s.InvoiceNo,
                    CustomerName = s.Customer != null ? s.Customer.Name : null,
                    InvoiceDate = s.InvoiceDate,
                    GrandTotal = s.GrandTotal
                })
                .ToListAsync();

            foreach (var inv in invoices)
                inv.TenantName = tenantNames.TryGetValue(inv.TenantId, out var tn) ? tn : $"Tenant {inv.TenantId}";

            // Customers: by name, phone, or email, any tenant
            var customers = await _context.Customers
                .AsNoTracking()
                .Where(c => c.TenantId != null &&
                    (EF.Functions.Like(c.Name, search) ||
                     (c.Phone != null && EF.Functions.Like(c.Phone, search)) ||
                     (c.Email != null && EF.Functions.Like(c.Email, search))))
                .OrderBy(c => c.Name)
                .Take(limit)
                .Select(c => new GlobalSearchCustomerDto
                {
                    CustomerId = c.Id,
                    TenantId = c.TenantId ?? 0,
                    TenantName = "",
                    Name = c.Name,
                    Phone = c.Phone,
                    Email = c.Email
                })
                .ToListAsync();

            foreach (var cust in customers)
                cust.TenantName = tenantNames.TryGetValue(cust.TenantId, out var tn2) ? tn2 : $"Tenant {cust.TenantId}";

            return Ok(new ApiResponse<GlobalSearchResultDto>
            {
                Success = true,
                Message = "Search completed",
                Data = new GlobalSearchResultDto { Invoices = invoices, Customers = customers }
            });
        }
    }

    public class GlobalSearchResultDto
    {
        public List<GlobalSearchInvoiceDto> Invoices { get; set; } = new();
        public List<GlobalSearchCustomerDto> Customers { get; set; } = new();
    }

    public class GlobalSearchInvoiceDto
    {
        public int SaleId { get; set; }
        public int TenantId { get; set; }
        public string TenantName { get; set; } = string.Empty;
        public string InvoiceNo { get; set; } = string.Empty;
        public string? CustomerName { get; set; }
        public DateTime InvoiceDate { get; set; }
        public decimal GrandTotal { get; set; }
    }

    public class GlobalSearchCustomerDto
    {
        public int CustomerId { get; set; }
        public int TenantId { get; set; }
        public string TenantName { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? Email { get; set; }
    }
}
