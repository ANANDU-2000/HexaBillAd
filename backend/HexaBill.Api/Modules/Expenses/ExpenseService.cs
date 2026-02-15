/*
Purpose: Expense service for expense tracking
Author: AI Assistant
Date: 2024
*/
using Microsoft.EntityFrameworkCore;
using HexaBill.Api.Data;
using HexaBill.Api.Models;
using HexaBill.Api.Shared.Extensions;

namespace HexaBill.Api.Modules.Expenses
{
    public interface IExpenseService
    {
        Task<PagedResponse<ExpenseDto>> GetExpensesAsync(int tenantId, int page = 1, int pageSize = 10, string? category = null, DateTime? fromDate = null, DateTime? toDate = null, string? groupBy = null, int? branchId = null);
        Task<List<ExpenseAggregateDto>> GetExpensesAggregatedAsync(int tenantId, DateTime fromDate, DateTime toDate, string groupBy = "monthly"); // weekly, monthly, yearly
        Task<ExpenseDto?> GetExpenseByIdAsync(int id, int tenantId);
        Task<ExpenseDto> CreateExpenseAsync(CreateExpenseRequest request, int userId, int tenantId);
        Task<ExpenseDto?> UpdateExpenseAsync(int id, CreateExpenseRequest request, int userId, int tenantId);
        Task<bool> DeleteExpenseAsync(int id, int userId, int tenantId);
        Task<List<string>> GetExpenseCategoriesAsync();
    }

    public class ExpenseService : IExpenseService
    {
        private readonly AppDbContext _context;

        public ExpenseService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<PagedResponse<ExpenseDto>> GetExpensesAsync(int tenantId, int page = 1, int pageSize = 10, string? category = null, DateTime? fromDate = null, DateTime? toDate = null, string? groupBy = null, int? branchId = null)
        {
            // OPTIMIZATION: Use AsNoTracking and limit page size
            pageSize = Math.Min(pageSize, 100); // Max 100 items per page
            
            var query = _context.Expenses
                .AsNoTracking() // Performance: No change tracking needed
                .Where(e => e.TenantId == tenantId) // CRITICAL: Multi-tenant filter
                .Include(e => e.Category)
                .Include(e => e.Branch)
                .AsQueryable();

            if (branchId.HasValue)
            {
                query = query.Where(e => e.BranchId == branchId.Value);
            }

            if (!string.IsNullOrEmpty(category))
            {
                query = query.Where(e => e.Category.Name == category);
            }

            if (fromDate.HasValue)
            {
                query = query.Where(e => e.Date >= fromDate.Value);
            }

            if (toDate.HasValue)
            {
                query = query.Where(e => e.Date <= toDate.Value);
            }

            var totalCount = await query.CountAsync();
            var expenses = await query
                .OrderByDescending(e => e.Date)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(e => new ExpenseDto
                {
                    Id = e.Id,
                    BranchId = e.BranchId,
                    BranchName = e.Branch != null ? e.Branch.Name : null,
                    CategoryId = e.CategoryId,
                    CategoryName = e.Category.Name,
                    CategoryColor = e.Category.ColorCode,
                    Amount = e.Amount,
                    Date = e.Date,
                    Note = e.Note
                })
                .ToListAsync();

            return new PagedResponse<ExpenseDto>
            {
                Items = expenses,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            };
        }

        public async Task<List<ExpenseAggregateDto>> GetExpensesAggregatedAsync(int tenantId, DateTime fromDate, DateTime toDate, string groupBy = "monthly")
        {
            try
            {
                // Ensure dates are properly set (start of day to end of day)
                // CRITICAL FIX: Never use .Date property, it creates Unspecified
                var from = new DateTime(fromDate.Year, fromDate.Month, fromDate.Day, 0, 0, 0, DateTimeKind.Utc);
                var to = toDate.AddDays(1).AddTicks(-1).ToUtcKind(); // End of day - FIX: Don't use .Date
                
                Console.WriteLine($"?? GetExpensesAggregatedAsync: tenantId={tenantId}, fromDate={from:yyyy-MM-dd}, toDate={to:yyyy-MM-dd}, groupBy={groupBy}");
                
                var query = _context.Expenses
                    .Include(e => e.Category)
                    .Where(e => e.TenantId == tenantId && e.Date >= from && e.Date <= to) // CRITICAL: Multi-tenant filter
                    .AsQueryable();

                // Check if there are any expenses
                var expenseCount = await query.CountAsync();
                Console.WriteLine($"?? Found {expenseCount} expenses in date range");
                
                if (expenseCount == 0)
                {
                    Console.WriteLine("?? No expenses found in date range, returning empty list");
                    return new List<ExpenseAggregateDto>();
                }

                List<ExpenseAggregateDto> aggregates;

                if (groupBy?.ToLower() == "weekly")
                {
                    // Group by week - load all data first to avoid nested GroupBy issues
                    var allExpenses = await query.ToListAsync();
                    aggregates = allExpenses
                        .GroupBy(e => {
                            var date = e.Date;
                            var startOfYear = new DateTime(date.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc);
                            var daysSinceStart = (date - startOfYear).Days;
                            var weekNumber = (daysSinceStart / 7) + 1;
                            return new { Year = date.Year, Week = weekNumber };
                        })
                        .Select(g => {
                            var expensesInGroup = g.ToList();
                            var categoryGroups = expensesInGroup
                                .GroupBy(e => e.Category?.Name ?? "Uncategorized")
                                .ToList();
                            
                            return new ExpenseAggregateDto
                            {
                                Period = $"Week {g.Key.Week}, {g.Key.Year}",
                                PeriodStart = expensesInGroup.Min(e => e.Date),
                                PeriodEnd = expensesInGroup.Max(e => e.Date),
                                TotalAmount = expensesInGroup.Sum(e => e.Amount),
                                Count = expensesInGroup.Count,
                                ByCategory = categoryGroups.Select(cg => new ExpenseCategoryTotalDto
                                {
                                    CategoryName = cg.Key,
                                    TotalAmount = cg.Sum(e => e.Amount),
                                    Count = cg.Count()
                                }).ToList()
                            };
                        })
                        .OrderBy(a => a.PeriodStart)
                        .ToList();
                }
                else if (groupBy?.ToLower() == "yearly")
                {
                    // Group by year - load all data first
                    var allExpenses = await query.ToListAsync();
                    aggregates = allExpenses
                        .GroupBy(e => e.Date.Year)
                        .Select(g => {
                            var expensesInGroup = g.ToList();
                            var categoryGroups = expensesInGroup
                                .GroupBy(e => e.Category?.Name ?? "Uncategorized")
                                .ToList();
                            
                            return new ExpenseAggregateDto
                            {
                                Period = g.Key.ToString(),
                                PeriodStart = new DateTime(g.Key, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                                PeriodEnd = new DateTime(g.Key, 12, 31, 23, 59, 59, DateTimeKind.Utc),
                                TotalAmount = expensesInGroup.Sum(e => e.Amount),
                                Count = expensesInGroup.Count,
                                ByCategory = categoryGroups.Select(cg => new ExpenseCategoryTotalDto
                                {
                                    CategoryName = cg.Key,
                                    TotalAmount = cg.Sum(e => e.Amount),
                                    Count = cg.Count()
                                }).ToList()
                            };
                        })
                        .OrderBy(a => a.PeriodStart)
                        .ToList();
                }
                else
                {
                    // Default: Group by month - load all data first
                    var allExpenses = await query.ToListAsync();
                    aggregates = allExpenses
                        .GroupBy(e => new { e.Date.Year, e.Date.Month })
                        .Select(g => {
                            var expensesInGroup = g.ToList();
                            var categoryGroups = expensesInGroup
                                .GroupBy(e => e.Category?.Name ?? "Uncategorized")
                                .ToList();
                            
                            return new ExpenseAggregateDto
                            {
                                Period = $"{new DateTime(g.Key.Year, g.Key.Month, 1, 0, 0, 0, DateTimeKind.Utc):MMMM yyyy}",
                                PeriodStart = new DateTime(g.Key.Year, g.Key.Month, 1, 0, 0, 0, DateTimeKind.Utc),
                                PeriodEnd = new DateTime(g.Key.Year, g.Key.Month, DateTime.DaysInMonth(g.Key.Year, g.Key.Month), 23, 59, 59, DateTimeKind.Utc),
                                TotalAmount = expensesInGroup.Sum(e => e.Amount),
                                Count = expensesInGroup.Count,
                                ByCategory = categoryGroups.Select(cg => new ExpenseCategoryTotalDto
                                {
                                    CategoryName = cg.Key,
                                    TotalAmount = cg.Sum(e => e.Amount),
                                    Count = cg.Count()
                                }).ToList()
                            };
                        })
                        .OrderBy(a => a.PeriodStart)
                        .ToList();
                }

                return aggregates;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in GetExpensesAggregatedAsync: {ex.Message}");
                Console.WriteLine($"Stack trace: {ex.StackTrace}");
                throw;
            }
        }

        public async Task<ExpenseDto?> GetExpenseByIdAsync(int id, int tenantId)
        {
            var expense = await _context.Expenses
                .Where(e => e.Id == id && e.TenantId == tenantId) // CRITICAL: Multi-tenant filter
                .Include(e => e.Category)
                .Include(e => e.Branch)
                .FirstOrDefaultAsync();
            if (expense == null) return null;

            return new ExpenseDto
            {
                Id = expense.Id,
                BranchId = expense.BranchId,
                BranchName = expense.Branch?.Name,
                CategoryId = expense.CategoryId,
                CategoryName = expense.Category.Name,
                CategoryColor = expense.Category.ColorCode,
                Amount = expense.Amount,
                Date = expense.Date,
                Note = expense.Note
            };
        }

        public async Task<ExpenseDto> CreateExpenseAsync(CreateExpenseRequest request, int userId, int tenantId)
        {
            var category = await _context.ExpenseCategories.FindAsync(request.CategoryId);
            if (category == null)
            {
                throw new InvalidOperationException($"Category with ID {request.CategoryId} not found");
            }

            var expense = new Expense
            {
                OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                TenantId = tenantId, // CRITICAL: Set new TenantId
                BranchId = request.BranchId,
                CategoryId = request.CategoryId,
                Amount = request.Amount,
                Date = request.Date.ToUtcKind(), // Ensure UTC for PostgreSQL
                Note = request.Note,
                CreatedBy = userId,
                CreatedAt = DateTime.UtcNow
            };

            _context.Expenses.Add(expense);
            await _context.SaveChangesAsync();

            // Create audit log
            var auditLog = new AuditLog
            {
                OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                TenantId = tenantId, // CRITICAL: Set new TenantId
                UserId = userId,
                Action = "Expense Created",
                Details = $"Category: {category.Name}, Amount: {request.Amount:C}",
                CreatedAt = DateTime.UtcNow
            };

            _context.AuditLogs.Add(auditLog);
            await _context.SaveChangesAsync();

            await _context.Entry(expense).Reference(e => e.Category).LoadAsync();

            return new ExpenseDto
            {
                Id = expense.Id,
                BranchId = expense.BranchId,
                BranchName = null,
                CategoryId = expense.CategoryId,
                CategoryName = expense.Category.Name,
                CategoryColor = expense.Category.ColorCode,
                Amount = expense.Amount,
                Date = expense.Date,
                Note = expense.Note
            };
        }

        public async Task<ExpenseDto?> UpdateExpenseAsync(int id, CreateExpenseRequest request, int userId, int tenantId)
        {
            var expense = await _context.Expenses
                .Where(e => e.Id == id && e.TenantId == tenantId) // CRITICAL: Multi-tenant filter
                .Include(e => e.Category)
                .Include(e => e.Branch)
                .FirstOrDefaultAsync();
            if (expense == null) return null;

            var category = await _context.ExpenseCategories.FindAsync(request.CategoryId);
            if (category == null)
            {
                throw new InvalidOperationException($"Category with ID {request.CategoryId} not found");
            }

            expense.BranchId = request.BranchId;
            expense.CategoryId = request.CategoryId;
            expense.Amount = request.Amount;
            expense.Date = request.Date.ToUtcKind(); // Ensure UTC for PostgreSQL
            expense.Note = request.Note;

            await _context.SaveChangesAsync();

            // Create audit log
            var auditLog = new AuditLog
            {
                OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                TenantId = tenantId, // CRITICAL: Set new TenantId
                UserId = userId,
                Action = "Expense Updated",
                Details = $"Expense ID: {id}, Category: {category.Name}, Amount: {request.Amount:C}",
                CreatedAt = DateTime.UtcNow
            };

            _context.AuditLogs.Add(auditLog);
            await _context.SaveChangesAsync();

            await _context.Entry(expense).Reference(e => e.Category).LoadAsync();
            await _context.Entry(expense).Reference(e => e.Branch).LoadAsync();

            return new ExpenseDto
            {
                Id = expense.Id,
                BranchId = expense.BranchId,
                BranchName = expense.Branch?.Name,
                CategoryId = expense.CategoryId,
                CategoryName = expense.Category.Name,
                CategoryColor = expense.Category.ColorCode,
                Amount = expense.Amount,
                Date = expense.Date,
                Note = expense.Note
            };
        }

        public async Task<bool> DeleteExpenseAsync(int id, int userId, int tenantId)
        {
            var expense = await _context.Expenses
                .Where(e => e.Id == id && e.TenantId == tenantId) // CRITICAL: Multi-tenant filter
                .Include(e => e.Category)
                .FirstOrDefaultAsync();
            if (expense == null) return false;

            var categoryName = expense.Category.Name;
            var amount = expense.Amount;

            _context.Expenses.Remove(expense);
            await _context.SaveChangesAsync();

            // Create audit log
            var auditLog = new AuditLog
            {
                OwnerId = tenantId, // CRITICAL: Set legacy OwnerId
                TenantId = tenantId, // CRITICAL: Set new TenantId
                UserId = userId,
                Action = "Expense Deleted",
                Details = $"Expense ID: {id}, Category: {categoryName}, Amount: {amount:C}",
                CreatedAt = DateTime.UtcNow
            };

            _context.AuditLogs.Add(auditLog);
            await _context.SaveChangesAsync();

            return true;
        }

        public async Task<List<string>> GetExpenseCategoriesAsync()
        {
            return await _context.ExpenseCategories
                .Where(c => c.IsActive)
                .OrderBy(c => c.Name)
                .Select(c => c.Name)
                .ToListAsync();
        }
    }
}

