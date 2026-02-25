/*
Purpose: Sale validation and lock/unlock logic (extracted from SaleService for modularity)
*/
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;

namespace HexaBill.Api.Modules.Billing
{
    public interface ISaleValidationService
    {
        Task<bool> CanEditInvoiceAsync(int saleId, int userId, string userRole, int tenantId);
        Task<bool> UnlockInvoiceAsync(int saleId, int userId, string unlockReason, int tenantId);
        Task<bool> LockOldInvoicesAsync(int tenantId);
    }

    public class SaleValidationService : ISaleValidationService
    {
        private readonly AppDbContext _context;

        public SaleValidationService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<bool> CanEditInvoiceAsync(int saleId, int userId, string userRole, int tenantId)
        {
            var sale = await _context.Sales
                .Where(s => s.Id == saleId && s.TenantId == tenantId)
                .FirstOrDefaultAsync();

            if (sale == null || sale.IsDeleted)
                return false;

            if (userRole == "Admin" || userRole == "Owner")
                return true;

            if (userRole == "Staff")
            {
                if (sale.CreatedBy == userId)
                    return true;

                if (sale.BranchId.HasValue)
                {
                    var branchStaff = await _context.BranchStaff
                        .Where(bs => bs.UserId == userId)
                        .Include(bs => bs.Branch)
                        .Where(bs => bs.Branch.TenantId == tenantId && bs.BranchId == sale.BranchId.Value)
                        .AnyAsync();

                    if (branchStaff)
                        return true;

                    if (sale.RouteId.HasValue)
                    {
                        var routeStaff = await _context.RouteStaff
                            .Where(rs => rs.UserId == userId)
                            .Include(rs => rs.Route)
                            .Where(rs => rs.Route.TenantId == tenantId && rs.RouteId == sale.RouteId.Value)
                            .AnyAsync();

                        return routeStaff;
                    }
                }
            }

            return false;
        }

        public async Task<bool> UnlockInvoiceAsync(int saleId, int userId, string unlockReason, int tenantId)
        {
            var sale = await _context.Sales
                .Where(s => s.Id == saleId && s.TenantId == tenantId)
                .FirstOrDefaultAsync();

            if (sale == null)
                return false;

            sale.IsLocked = false;
            sale.LockedAt = null;

            _context.AuditLogs.Add(new AuditLog
            {
                OwnerId = tenantId,
                TenantId = tenantId,
                UserId = userId,
                Action = "Invoice Unlocked",
                Details = $"Invoice: {sale.InvoiceNo} unlocked. Reason: {unlockReason}",
                CreatedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> LockOldInvoicesAsync(int tenantId)
        {
            var cutoffTime = DateTime.UtcNow.AddHours(-8);
            var invoicesToLock = await _context.Sales
                .Where(s => s.TenantId == tenantId && !s.IsLocked && !s.IsDeleted && s.CreatedAt < cutoffTime)
                .ToListAsync();

            foreach (var invoice in invoicesToLock)
            {
                invoice.IsLocked = true;
                invoice.LockedAt = DateTime.UtcNow;
            }

            if (invoicesToLock.Any())
            {
                await _context.SaveChangesAsync();
                return true;
            }

            return false;
        }
    }
}
