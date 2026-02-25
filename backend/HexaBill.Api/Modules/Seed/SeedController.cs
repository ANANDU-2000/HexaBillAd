/*
 * Seed controller - Demo data for testing (100 customers, products, sales).
 * Author: Plan Build
 */
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions;

namespace HexaBill.Api.Modules.Seed
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin,Owner")]
    public class SeedController : TenantScopedController
    {
        private readonly AppDbContext _context;

        public SeedController(AppDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Seed current tenant with 100 customers, 20 products, 50 sales (for testing dashboards).
        /// POST api/seed/demo
        /// </summary>
        [HttpPost("demo")]
        public async Task<ActionResult<ApiResponse<object>>> SeedDemo()
        {
            var tenantId = CurrentTenantId;
            if (tenantId <= 0)
            {
                return BadRequest(new ApiResponse<object> { Success = false, Message = "Invalid tenant context." });
            }

            try
            {
                await using var transaction = await _context.Database.BeginTransactionAsync();
                try
                {
                    var now = DateTime.UtcNow;
                    var ownerId = tenantId;

                    // 1. Create 100 customers
                    var customers = new List<Customer>();
                    for (int i = 1; i <= 100; i++)
                    {
                        customers.Add(new Customer
                        {
                            TenantId = tenantId,
                            OwnerId = ownerId,
                            Name = $"Demo Customer {i}",
                            Phone = i <= 50 ? $"+971501234{i % 100:D2}" : null,
                            Email = i <= 30 ? $"customer{i}@demo.local" : null,
                            Address = i % 5 == 0 ? $"Address {i}, Dubai" : null,
                            CustomerType = i % 4 == 0 ? CustomerType.Cash : CustomerType.Credit,
                            CreditLimit = i % 4 == 0 ? 0 : 5000,
                            Balance = 0,
                            PendingBalance = 0,
                            TotalSales = 0,
                            TotalPayments = 0,
                            CreatedAt = now,
                            UpdatedAt = now
                        });
                    }
                    _context.Customers.AddRange(customers);
                    await _context.SaveChangesAsync();

                    // 2. Create 20 products
                    var products = new List<Product>();
                    for (int i = 1; i <= 20; i++)
                    {
                        products.Add(new Product
                        {
                            TenantId = tenantId,
                            OwnerId = ownerId,
                            Sku = $"SKU-{i:D4}",
                            NameEn = $"Product {i}",
                            UnitType = i % 3 == 0 ? "BOX" : (i % 3 == 1 ? "KG" : "PIECE"),
                            ConversionToBase = 1,
                            CostPrice = 10 + i,
                            SellPrice = 15 + i,
                            StockQty = 100 + i * 5,
                            ReorderLevel = 10,
                            CreatedAt = now,
                            UpdatedAt = now
                        });
                    }
                    _context.Products.AddRange(products);
                    await _context.SaveChangesAsync();

                    // 3. Create 50 sales (simple: one item per sale, random customer and product)
                    var rnd = new Random(42);
                    for (int i = 1; i <= 50; i++)
                    {
                        var cust = customers[rnd.Next(customers.Count)];
                        var prod = products[rnd.Next(products.Count)];
                        var qty = rnd.Next(1, 5);
                        var unitPrice = prod.SellPrice;
                        var subtotal = qty * unitPrice;
                        var vat = Math.Round(subtotal * 0.05m, 2);
                        var total = subtotal + vat;
                        var invNo = $"INV-{DateTime.UtcNow:yyyyMMdd}-{i:D4}";

                        var sale = new Sale
                        {
                            TenantId = tenantId,
                            OwnerId = ownerId,
                            InvoiceNo = invNo,
                            InvoiceDate = now.AddDays(-rnd.Next(0, 30)),
                            CustomerId = cust.Id,
                            Subtotal = subtotal,
                            VatTotal = vat,
                            Discount = 0,
                            GrandTotal = total,
                            TotalAmount = total,
                            PaidAmount = cust.CustomerType == CustomerType.Cash ? total : (rnd.Next(2) == 0 ? total : 0),
                            PaymentStatus = cust.CustomerType == CustomerType.Cash ? SalePaymentStatus.Paid : (rnd.Next(2) == 0 ? SalePaymentStatus.Paid : SalePaymentStatus.Pending),
                            IsFinalized = true,
                            CreatedBy = 1,
                            CreatedAt = now
                        };
                        _context.Sales.Add(sale);
                        await _context.SaveChangesAsync();

                        _context.SaleItems.Add(new SaleItem
                        {
                            SaleId = sale.Id,
                            ProductId = prod.Id,
                            UnitType = prod.UnitType,
                            Qty = qty,
                            UnitPrice = unitPrice,
                            Discount = 0,
                            VatAmount = vat,
                            LineTotal = total
                        });
                    }
                    await _context.SaveChangesAsync();

                    await transaction.CommitAsync();
                }
                catch
                {
                    await transaction.RollbackAsync();
                    throw;
                }

                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = "Demo data seeded: 100 customers, 20 products, 50 sales.",
                    Data = new { customers = 100, products = 20, sales = 50 }
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "Seed failed",
                    Errors = new List<string> { ex.Message }
                });
            }
        }

        /// <summary>
        /// Load test seed: 1000 customers, 100 products, 1000 sales for current tenant.
        /// POST api/seed/load-test?customers=1000&amp;products=100&amp;sales=1000
        /// </summary>
        [HttpPost("load-test")]
        public async Task<ActionResult<ApiResponse<object>>> SeedLoadTest(
            [FromQuery] int customers = 1000,
            [FromQuery] int products = 100,
            [FromQuery] int sales = 1000)
        {
            if (customers > 5000 || products > 500 || sales > 5000)
            {
                return BadRequest(new ApiResponse<object> { Success = false, Message = "Limits: customers≤5000, products≤500, sales≤5000." });
            }

            var tenantId = CurrentTenantId;
            if (tenantId <= 0)
            {
                return BadRequest(new ApiResponse<object> { Success = false, Message = "Invalid tenant context." });
            }

            try
            {
                await using var transaction = await _context.Database.BeginTransactionAsync();
                try
                {
                    var now = DateTime.UtcNow;
                    var ownerId = tenantId;
                    var owner = await _context.Users.FirstOrDefaultAsync(u => u.TenantId == tenantId && (u.Role == UserRole.Owner || u.Role == UserRole.Admin));
                    var createdBy = owner?.Id ?? 1;

                    var custList = new List<Customer>();
                    for (int i = 1; i <= customers; i++)
                    {
                        custList.Add(new Customer
                        {
                            TenantId = tenantId,
                            OwnerId = ownerId,
                            Name = $"Load Customer {i}",
                            Phone = i <= 200 ? $"+971501234{i % 1000:D3}" : null,
                            CustomerType = i % 4 == 0 ? CustomerType.Cash : CustomerType.Credit,
                            CreditLimit = i % 4 == 0 ? 0 : 5000,
                            Balance = 0,
                            PendingBalance = 0,
                            TotalSales = 0,
                            TotalPayments = 0,
                            CreatedAt = now,
                            UpdatedAt = now
                        });
                    }
                    _context.Customers.AddRange(custList);
                    await _context.SaveChangesAsync();

                    var prodList = new List<Product>();
                    for (int i = 1; i <= products; i++)
                    {
                        prodList.Add(new Product
                        {
                            TenantId = tenantId,
                            OwnerId = ownerId,
                            Sku = $"LOAD-{i:D4}",
                            NameEn = $"Load Product {i}",
                            UnitType = "PIECE",
                            ConversionToBase = 1,
                            CostPrice = 10 + (i % 50),
                            SellPrice = 15 + (i % 50),
                            StockQty = 500,
                            ReorderLevel = 10,
                            CreatedAt = now,
                            UpdatedAt = now
                        });
                    }
                    _context.Products.AddRange(prodList);
                    await _context.SaveChangesAsync();

                    var rnd = new Random(12345);
                    for (int i = 1; i <= sales; i++)
                    {
                        var cust = custList[rnd.Next(custList.Count)];
                        var prod = prodList[rnd.Next(prodList.Count)];
                        var qty = rnd.Next(1, 10);
                        var unitPrice = prod.SellPrice;
                        var subtotal = qty * unitPrice;
                        var vat = Math.Round(subtotal * 0.05m, 2);
                        var total = subtotal + vat;
                        var invNo = $"LDT-{DateTime.UtcNow:yyyyMMdd}-{i:D5}";

                        var sale = new Sale
                        {
                            TenantId = tenantId,
                            OwnerId = ownerId,
                            InvoiceNo = invNo,
                            InvoiceDate = now.AddDays(-rnd.Next(0, 90)),
                            CustomerId = cust.Id,
                            Subtotal = subtotal,
                            VatTotal = vat,
                            Discount = 0,
                            GrandTotal = total,
                            TotalAmount = total,
                            PaidAmount = cust.CustomerType == CustomerType.Cash ? total : (rnd.Next(2) == 0 ? total : 0),
                            PaymentStatus = cust.CustomerType == CustomerType.Cash ? SalePaymentStatus.Paid : (rnd.Next(2) == 0 ? SalePaymentStatus.Paid : SalePaymentStatus.Pending),
                            IsFinalized = true,
                            CreatedBy = createdBy,
                            CreatedAt = now
                        };
                        _context.Sales.Add(sale);
                        await _context.SaveChangesAsync();

                        _context.SaleItems.Add(new SaleItem
                        {
                            SaleId = sale.Id,
                            ProductId = prod.Id,
                            UnitType = prod.UnitType,
                            Qty = qty,
                            UnitPrice = unitPrice,
                            Discount = 0,
                            VatAmount = vat,
                            LineTotal = total
                        });
                        if (i % 100 == 0) await _context.SaveChangesAsync();
                    }
                    await _context.SaveChangesAsync();

                    await transaction.CommitAsync();
                }
                catch
                {
                    await transaction.RollbackAsync();
                    throw;
                }

                return Ok(new ApiResponse<object>
                {
                    Success = true,
                    Message = $"Load test data seeded: {customers} customers, {products} products, {sales} sales.",
                    Data = new { customers, products, sales }
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse<object>
                {
                    Success = false,
                    Message = "Load test seed failed",
                    Errors = new List<string> { ex.Message }
                });
            }
        }
    }
}
