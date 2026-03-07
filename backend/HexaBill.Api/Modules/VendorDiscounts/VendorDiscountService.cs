/*
Purpose: Vendor Discounts service – private tracking only; NOT used in ledger, balance, or reports.
Author: HexaBill
Date: 2025
*/
using Microsoft.EntityFrameworkCore;
using Npgsql;
using HexaBill.Api.Data;
using HexaBill.Api.Models;

namespace HexaBill.Api.Modules.VendorDiscounts
{
    public class VendorDiscountService : IVendorDiscountService
    {
        private readonly AppDbContext _context;

        public VendorDiscountService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<VendorDiscountListWithTotalDto> GetSupplierDiscountsWithTotalAsync(int supplierId, int tenantId)
        {
            await EnsureSupplierExistsAsync(supplierId, tenantId);

            try
            {
                return await GetSupplierDiscountsWithTotalCoreAsync(supplierId, tenantId);
            }
            catch (PostgresException ex) when (ex.SqlState == "42P01" && ex.MessageText?.Contains("VendorDiscounts", StringComparison.OrdinalIgnoreCase) == true)
            {
                await EnsureVendorDiscountsTableAsync();
                return await GetSupplierDiscountsWithTotalCoreAsync(supplierId, tenantId);
            }
        }

        private async Task<VendorDiscountListWithTotalDto> GetSupplierDiscountsWithTotalCoreAsync(int supplierId, int tenantId)
        {
            var list = await _context.VendorDiscounts
                .AsNoTracking()
                .Include(v => v.Purchase)
                .Include(v => v.CreatedByUser)
                .Where(v => v.SupplierId == supplierId && v.TenantId == tenantId && v.IsActive)
                .OrderByDescending(v => v.DiscountDate)
                .Select(v => new VendorDiscountDto
                {
                    Id = v.Id,
                    SupplierId = v.SupplierId,
                    PurchaseId = v.PurchaseId,
                    PurchaseInvoiceNo = v.Purchase != null ? v.Purchase.InvoiceNo : null,
                    Amount = v.Amount,
                    DiscountDate = v.DiscountDate,
                    DiscountType = v.DiscountType,
                    Reason = v.Reason,
                    CreatedByUserName = v.CreatedByUser != null ? v.CreatedByUser.Name : null,
                    CreatedAt = v.CreatedAt,
                    UpdatedAt = v.UpdatedAt
                })
                .ToListAsync();

            var totalSavings = list.Sum(v => v.Amount);

            return new VendorDiscountListWithTotalDto
            {
                Items = list,
                TotalSavings = totalSavings
            };
        }

        public async Task<VendorDiscountDto?> GetByIdAsync(int id, int supplierId, int tenantId)
        {
            try
            {
                return await GetByIdCoreAsync(id, supplierId, tenantId);
            }
            catch (PostgresException ex) when (ex.SqlState == "42P01" && ex.MessageText?.Contains("VendorDiscounts", StringComparison.OrdinalIgnoreCase) == true)
            {
                await EnsureVendorDiscountsTableAsync();
                return await GetByIdCoreAsync(id, supplierId, tenantId);
            }
        }

        private async Task<VendorDiscountDto?> GetByIdCoreAsync(int id, int supplierId, int tenantId)
        {
            var v = await _context.VendorDiscounts
                .AsNoTracking()
                .Include(x => x.Purchase)
                .Include(x => x.CreatedByUser)
                .FirstOrDefaultAsync(x => x.Id == id && x.SupplierId == supplierId && x.TenantId == tenantId && x.IsActive);
            if (v == null) return null;

            return new VendorDiscountDto
            {
                Id = v.Id,
                SupplierId = v.SupplierId,
                PurchaseId = v.PurchaseId,
                PurchaseInvoiceNo = v.Purchase?.InvoiceNo,
                Amount = v.Amount,
                DiscountDate = v.DiscountDate,
                DiscountType = v.DiscountType,
                Reason = v.Reason,
                CreatedByUserName = v.CreatedByUser?.Name,
                CreatedAt = v.CreatedAt,
                UpdatedAt = v.UpdatedAt
            };
        }

        public async Task<VendorDiscountDto> CreateVendorDiscountAsync(int supplierId, CreateOrUpdateVendorDiscountRequest dto, int currentUserId, int tenantId)
        {
            try
            {
                return await CreateVendorDiscountCoreAsync(supplierId, dto, currentUserId, tenantId);
            }
            catch (PostgresException ex) when (ex.SqlState == "42P01" && ex.MessageText?.Contains("VendorDiscounts", StringComparison.OrdinalIgnoreCase) == true)
            {
                await EnsureVendorDiscountsTableAsync();
                return await CreateVendorDiscountCoreAsync(supplierId, dto, currentUserId, tenantId);
            }
        }

        private async Task<VendorDiscountDto> CreateVendorDiscountCoreAsync(int supplierId, CreateOrUpdateVendorDiscountRequest dto, int currentUserId, int tenantId)
        {
            await ValidateSupplierAndPurchaseAsync(supplierId, dto.PurchaseId, tenantId);
            ValidateRequest(dto);

            var entity = new VendorDiscount
            {
                TenantId = tenantId,
                SupplierId = supplierId,
                PurchaseId = dto.PurchaseId,
                Amount = dto.Amount,
                DiscountDate = dto.DiscountDate.Kind == DateTimeKind.Utc ? dto.DiscountDate : DateTime.SpecifyKind(dto.DiscountDate, DateTimeKind.Utc),
                DiscountType = dto.DiscountType.Trim(),
                Reason = (dto.Reason ?? "").Trim(),
                IsActive = true,
                CreatedBy = currentUserId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.VendorDiscounts.Add(entity);
            await _context.SaveChangesAsync();

            await AuditAsync(tenantId, currentUserId, "VendorDiscount Created", $"Id: {entity.Id}, SupplierId: {supplierId}, Amount: {entity.Amount}, Type: {entity.DiscountType}");

            return (await GetByIdCoreAsync(entity.Id, supplierId, tenantId))!;
        }

        public async Task<VendorDiscountDto?> UpdateVendorDiscountAsync(int id, int supplierId, CreateOrUpdateVendorDiscountRequest dto, int tenantId)
        {
            try
            {
                return await UpdateVendorDiscountCoreAsync(id, supplierId, dto, tenantId);
            }
            catch (PostgresException ex) when (ex.SqlState == "42P01" && ex.MessageText?.Contains("VendorDiscounts", StringComparison.OrdinalIgnoreCase) == true)
            {
                await EnsureVendorDiscountsTableAsync();
                return await UpdateVendorDiscountCoreAsync(id, supplierId, dto, tenantId);
            }
        }

        private async Task<VendorDiscountDto?> UpdateVendorDiscountCoreAsync(int id, int supplierId, CreateOrUpdateVendorDiscountRequest dto, int tenantId)
        {
            await ValidateSupplierAndPurchaseAsync(supplierId, dto.PurchaseId, tenantId);
            ValidateRequest(dto);

            var entity = await _context.VendorDiscounts
                .FirstOrDefaultAsync(x => x.Id == id && x.SupplierId == supplierId && x.TenantId == tenantId && x.IsActive);
            if (entity == null) return null;

            entity.PurchaseId = dto.PurchaseId;
            entity.Amount = dto.Amount;
            entity.DiscountDate = dto.DiscountDate.Kind == DateTimeKind.Utc ? dto.DiscountDate : DateTime.SpecifyKind(dto.DiscountDate, DateTimeKind.Utc);
            entity.DiscountType = dto.DiscountType.Trim();
            entity.Reason = (dto.Reason ?? "").Trim();
            entity.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            var userId = entity.CreatedBy;
            await AuditAsync(tenantId, userId, "VendorDiscount Updated", $"Id: {id}, SupplierId: {supplierId}, Amount: {entity.Amount}");

            return await GetByIdCoreAsync(id, supplierId, tenantId);
        }

        public async Task<bool> DeleteVendorDiscountAsync(int id, int supplierId, int tenantId)
        {
            try
            {
                return await DeleteVendorDiscountCoreAsync(id, supplierId, tenantId);
            }
            catch (PostgresException ex) when (ex.SqlState == "42P01" && ex.MessageText?.Contains("VendorDiscounts", StringComparison.OrdinalIgnoreCase) == true)
            {
                await EnsureVendorDiscountsTableAsync();
                return await DeleteVendorDiscountCoreAsync(id, supplierId, tenantId);
            }
        }

        private async Task<bool> DeleteVendorDiscountCoreAsync(int id, int supplierId, int tenantId)
        {
            await EnsureSupplierExistsAsync(supplierId, tenantId);

            var entity = await _context.VendorDiscounts
                .FirstOrDefaultAsync(x => x.Id == id && x.SupplierId == supplierId && x.TenantId == tenantId && x.IsActive);
            if (entity == null) return false;

            entity.IsActive = false;
            entity.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            await AuditAsync(tenantId, entity.CreatedBy, "VendorDiscount Deleted", $"Id: {id}, SupplierId: {supplierId}, Amount: {entity.Amount}");
            return true;
        }

        private async Task EnsureSupplierExistsAsync(int supplierId, int tenantId)
        {
            var exists = await _context.Suppliers.AnyAsync(s => s.Id == supplierId && s.TenantId == tenantId);
            if (!exists)
                throw new ArgumentException("Supplier not found or does not belong to the current tenant.", nameof(supplierId));
        }

        private async Task ValidateSupplierAndPurchaseAsync(int supplierId, int? purchaseId, int tenantId)
        {
            var supplier = await _context.Suppliers
                .FirstOrDefaultAsync(s => s.Id == supplierId && s.TenantId == tenantId);
            if (supplier == null)
                throw new ArgumentException("Supplier not found or does not belong to the current tenant.", nameof(supplierId));

            if (purchaseId.HasValue && purchaseId.Value > 0)
            {
                var purchase = await _context.Purchases
                    .FirstOrDefaultAsync(p => p.Id == purchaseId.Value && (p.TenantId == tenantId || p.OwnerId == tenantId));
                if (purchase == null)
                    throw new ArgumentException("Purchase not found or does not belong to the current tenant.", nameof(purchaseId));
                var belongsToSupplier = purchase.SupplierId == supplierId ||
                    string.Equals(purchase.SupplierName, supplier.Name, StringComparison.OrdinalIgnoreCase);
                if (!belongsToSupplier)
                    throw new ArgumentException("Purchase does not belong to this supplier.", nameof(purchaseId));
            }
        }

        private static void ValidateRequest(CreateOrUpdateVendorDiscountRequest dto)
        {
            if (dto.Amount <= 0)
                throw new ArgumentException("Amount must be positive.", nameof(dto.Amount));
            if (dto.DiscountDate.Date > DateTime.UtcNow.Date)
                throw new ArgumentException("Discount date cannot be in the future.", nameof(dto.DiscountDate));
            if (string.IsNullOrWhiteSpace(dto.DiscountType))
                throw new ArgumentException("Discount type is required.", nameof(dto.DiscountType));
        }

        /// <summary>Create VendorDiscounts table if missing (PostgreSQL). Fixes 42P01 when startup create didn't run or failed.</summary>
        private async Task EnsureVendorDiscountsTableAsync()
        {
            if (!_context.Database.IsNpgsql()) return;

            await _context.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""VendorDiscounts"" (
                    ""Id"" serial PRIMARY KEY,
                    ""TenantId"" integer NOT NULL,
                    ""SupplierId"" integer NOT NULL,
                    ""PurchaseId"" integer NULL,
                    ""Amount"" numeric(18,2) NOT NULL,
                    ""DiscountDate"" timestamp with time zone NOT NULL,
                    ""DiscountType"" character varying(50) NOT NULL,
                    ""Reason"" character varying(500) NOT NULL DEFAULT '',
                    ""IsActive"" boolean NOT NULL DEFAULT true,
                    ""CreatedBy"" integer NOT NULL,
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
                    ""UpdatedAt"" timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
                    CONSTRAINT ""FK_VendorDiscounts_Suppliers_SupplierId"" FOREIGN KEY (""SupplierId"") REFERENCES ""Suppliers"" (""Id"") ON DELETE RESTRICT,
                    CONSTRAINT ""FK_VendorDiscounts_Purchases_PurchaseId"" FOREIGN KEY (""PurchaseId"") REFERENCES ""Purchases"" (""Id"") ON DELETE SET NULL,
                    CONSTRAINT ""FK_VendorDiscounts_Users_CreatedBy"" FOREIGN KEY (""CreatedBy"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
                );");
            await _context.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_VendorDiscounts_TenantId"" ON ""VendorDiscounts"" (""TenantId"");");
            await _context.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_VendorDiscounts_SupplierId"" ON ""VendorDiscounts"" (""SupplierId"");");
            await _context.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_VendorDiscounts_PurchaseId"" ON ""VendorDiscounts"" (""PurchaseId"");");
            await _context.Database.ExecuteSqlRawAsync(@"CREATE INDEX IF NOT EXISTS ""IX_VendorDiscounts_CreatedBy"" ON ""VendorDiscounts"" (""CreatedBy"");");
        }

        private async Task AuditAsync(int tenantId, int userId, string action, string details)
        {
            _context.AuditLogs.Add(new AuditLog
            {
                OwnerId = tenantId,
                TenantId = tenantId,
                UserId = userId,
                Action = action,
                EntityType = "VendorDiscount",
                Details = details,
                CreatedAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync();
        }
    }
}
