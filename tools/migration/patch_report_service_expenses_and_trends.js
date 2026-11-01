const fs = require('fs');
const path = require('path');

const filePath = path.resolve('backend/HexaBill.Api/Modules/Reports/ReportService.cs');
let content = fs.readFileSync(filePath, 'utf8');

// Patch 1: GetExpensesByCategoryAsync
const target1 = `                return expenses.OrderByDescending(x => x.TotalAmount).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetExpensesByCategoryAsync: {Message}", ex.Message);`;

const replacement1 = `                // Tenant 20 (FrozenHub 1) Starplus continuity: Merge legacy expenses by category
                var cutoverUtc = new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc);
                if (tenantId == 20 && fromDate < cutoverUtc && !branchId.HasValue)
                {
                    var legacyExpenses = await _context.LegacyExpenses.AsNoTracking()
                        .Where(le => le.TenantId == tenantId && le.Date >= fromDate && le.Date <= toDate)
                        .GroupBy(le => le.CategoryName ?? "Other")
                        .Select(g => new
                        {
                            CategoryName = g.Key,
                            Total = g.Sum(le => le.Amount),
                            Count = g.Count()
                        })
                        .ToListAsync();

                    foreach (var leg in legacyExpenses)
                    {
                        var existing = expenses.FirstOrDefault(e => string.Equals(e.CategoryName, leg.CategoryName, StringComparison.OrdinalIgnoreCase));
                        if (existing != null)
                        {
                            existing.TotalAmount += leg.Total;
                            existing.ExpenseCount += leg.Count;
                        }
                        else
                        {
                            expenses.Add(new ExpenseByCategoryDto
                            {
                                CategoryId = 0,
                                CategoryName = leg.CategoryName,
                                CategoryColor = leg.CategoryName == "Fuel" ? "#F59E0B" : (leg.CategoryName == "Food" ? "#10B981" : "#6366F1"),
                                TotalAmount = leg.Total,
                                ExpenseCount = leg.Count
                            });
                        }
                    }
                }

                return expenses.OrderByDescending(x => x.TotalAmount).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetExpensesByCategoryAsync: {Message}", ex.Message);`;

if (!content.includes(target1)) {
    console.error('Target 1 not found in ReportService.cs');
    process.exit(1);
}

content = content.replace(target1, replacement1);
fs.writeFileSync(filePath, content, 'utf8');
console.log('ReportService.cs successfully patched with legacy expenses breakdown!');

