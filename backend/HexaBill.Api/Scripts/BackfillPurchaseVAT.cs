/*
Purpose: Backfill VAT data for existing purchases (OPTIONAL - Run only if needed)
Author: AI Assistant  
Date: 2025-11-21
CRITICAL: This script estimates VAT for existing purchases where VAT data is missing
*/
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;

namespace HexaBill.Api.Scripts
{
    public class BackfillPurchaseVAT
    {
        private readonly AppDbContext _context;
        private readonly decimal _vatPercent = 5m; // UAE VAT rate

        public BackfillPurchaseVAT(AppDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Backfill VAT data for existing purchases
        /// ASSUMPTION: Existing purchase costs INCLUDE 5% VAT
        /// </summary>
        public async Task<BackfillResult> BackfillExistingPurchasesAsync()
        {
            var result = new BackfillResult();
            
            Console.WriteLine("🔄 BACKFILLING VAT DATA FOR EXISTING PURCHASES");
            Console.WriteLine("================================================");
            Console.WriteLine($"VAT Rate: {_vatPercent}%");
            Console.WriteLine($"Assumption: Existing costs INCLUDE VAT");
            Console.WriteLine();

            // Find purchases without VAT data
            var purchasesNeedingBackfill = await _context.Purchases
                .Include(p => p.Items)
                    .ThenInclude(i => i.Product)
                .Where(p => p.Subtotal == null || p.VatTotal == null)
                .ToListAsync();

            result.TotalPurchases = purchasesNeedingBackfill.Count;
            Console.WriteLine($"📦 Found {result.TotalPurchases} purchases needing backfill");

            if (result.TotalPurchases == 0)
            {
                Console.WriteLine("✅ No purchases need backfilling!");
                return result;
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                foreach (var purchase in purchasesNeedingBackfill)
                {
                    decimal subtotal = 0;
                    decimal vatTotal = 0;

                    foreach (var item in purchase.Items)
                    {
                        // Extract VAT from existing costs
                        // Formula: UnitCostExclVat = UnitCost / (1 + VatPercent/100)
                        var unitCostInclVat = item.UnitCost;
                        var unitCostExclVat = unitCostInclVat / (1 + (_vatPercent / 100));
                        var itemVatAmount = unitCostInclVat - unitCostExclVat;

                        var lineSubtotal = item.Qty * unitCostExclVat;
                        var lineVat = item.Qty * itemVatAmount;

                        subtotal += lineSubtotal;
                        vatTotal += lineVat;

                        // Update item VAT fields
                        item.UnitCostExclVat = unitCostExclVat;
                        item.VatAmount = itemVatAmount;

                        // CRITICAL: Update product CostPrice to exclude VAT
                        var product = item.Product;
                        if (product != null && unitCostExclVat > 0)
                        {
                            var costPerBaseUnit = unitCostExclVat / product.ConversionToBase;
                            product.CostPrice = costPerBaseUnit;
                            product.UpdatedAt = DateTime.UtcNow;
                            
                            result.ProductsUpdated++;
                        }

                        result.ItemsBackfilled++;
                    }

                    // Update purchase VAT fields
                    purchase.Subtotal = subtotal;
                    purchase.VatTotal = vatTotal;
                    // TotalAmount remains the same (already includes VAT)

                    result.PurchasesBackfilled++;
                    Console.WriteLine($"✅ Backfilled: {purchase.InvoiceNo} - Subtotal: {subtotal:C}, VAT: {vatTotal:C}, Total: {purchase.TotalAmount:C}");
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                Console.WriteLine();
                Console.WriteLine("✅ BACKFILL COMPLETED SUCCESSFULLY");
                Console.WriteLine($"Purchases backfilled: {result.PurchasesBackfilled}");
                Console.WriteLine($"Items backfilled: {result.ItemsBackfilled}");
                Console.WriteLine($"Products updated: {result.ProductsUpdated}");
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                result.Error = ex.Message;
                Console.WriteLine($"❌ BACKFILL FAILED: {ex.Message}");
                throw;
            }

            return result;
        }

        /// <summary>
        /// Preview backfill changes without committing
        /// </summary>
        public async Task<List<BackfillPreview>> PreviewBackfillAsync()
        {
            var previews = new List<BackfillPreview>();

            var purchasesNeedingBackfill = await _context.Purchases
                .Include(p => p.Items)
                    .ThenInclude(i => i.Product)
                .Where(p => p.Subtotal == null || p.VatTotal == null)
                .ToListAsync();

            foreach (var purchase in purchasesNeedingBackfill)
            {
                decimal subtotal = 0;
                decimal vatTotal = 0;

                foreach (var item in purchase.Items)
                {
                    var unitCostExclVat = item.UnitCost / (1 + (_vatPercent / 100));
                    var itemVatAmount = item.UnitCost - unitCostExclVat;

                    subtotal += item.Qty * unitCostExclVat;
                    vatTotal += item.Qty * itemVatAmount;
                }

                previews.Add(new BackfillPreview
                {
                    PurchaseId = purchase.Id,
                    InvoiceNo = purchase.InvoiceNo,
                    SupplierName = purchase.SupplierName,
                    CurrentTotal = purchase.TotalAmount,
                    EstimatedSubtotal = subtotal,
                    EstimatedVat = vatTotal,
                    ItemCount = purchase.Items.Count
                });
            }

            return previews;
        }
    }

    public class BackfillResult
    {
        public int TotalPurchases { get; set; }
        public int PurchasesBackfilled { get; set; }
        public int ItemsBackfilled { get; set; }
        public int ProductsUpdated { get; set; }
        public string? Error { get; set; }
    }

    public class BackfillPreview
    {
        public int PurchaseId { get; set; }
        public string InvoiceNo { get; set; } = string.Empty;
        public string SupplierName { get; set; } = string.Empty;
        public decimal CurrentTotal { get; set; }
        public decimal EstimatedSubtotal { get; set; }
        public decimal EstimatedVat { get; set; }
        public int ItemCount { get; set; }
    }
}
