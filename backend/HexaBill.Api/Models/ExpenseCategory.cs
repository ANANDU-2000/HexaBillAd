/*
Purpose: Expense Category model for categorizing expenses
Author: AI Assistant
Date: 2024
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class ExpenseCategory
    {
        public int Id { get; set; }
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;
        [MaxLength(7)]
        public string ColorCode { get; set; } = "#3B82F6"; // Default blue
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        // Navigation properties
        public virtual ICollection<Expense> Expenses { get; set; } = new List<Expense>();
    }
}

