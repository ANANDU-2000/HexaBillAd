/*
Purpose: Recurring expense template model
Author: AI Assistant
Date: 2026
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class RecurringExpense
    {
        public int Id { get; set; }
        
        // MULTI-TENANT: Owner identification for data isolation (legacy, will be removed after migration)
        public int OwnerId { get; set; }
        
        // MULTI-TENANT: Tenant identification (new, replaces OwnerId)
        public int? TenantId { get; set; }

        /// <summary>Optional branch assignment. Null = company-level expense.</summary>
        public int? BranchId { get; set; }
        
        public int CategoryId { get; set; }
        public decimal Amount { get; set; }
        [MaxLength(500)]
        public string? Note { get; set; }
        
        /// <summary>Recurrence frequency: Daily, Weekly, Monthly, Yearly</summary>
        public RecurrenceFrequency Frequency { get; set; }
        
        /// <summary>Day of month (1-31) for monthly/yearly, or day of week (0-6, Sunday=0) for weekly</summary>
        public int? DayOfRecurrence { get; set; }
        
        /// <summary>Start date for recurring expense</summary>
        public DateTime StartDate { get; set; }
        
        /// <summary>End date (null = never ends)</summary>
        public DateTime? EndDate { get; set; }
        
        /// <summary>Is this recurring expense active?</summary>
        public bool IsActive { get; set; } = true;
        
        public int CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        
        // Navigation properties
        public virtual ExpenseCategory Category { get; set; } = null!;
        public virtual User CreatedByUser { get; set; } = null!;
        public virtual Branch? Branch { get; set; }
        public virtual ICollection<Expense> GeneratedExpenses { get; set; } = new List<Expense>();
    }
    
    public enum RecurrenceFrequency
    {
        Daily = 0,
        Weekly = 1,
        Monthly = 2,
        Yearly = 3
    }
}
