/*
Purpose: Expense model for expense tracking
Author: AI Assistant
Date: 2024
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    public class Expense
    {
        public int Id { get; set; }
        
        // MULTI-TENANT: Owner identification for data isolation (legacy, will be removed after migration)
        public int OwnerId { get; set; }
        
        // MULTI-TENANT: Tenant identification (new, replaces OwnerId)
        public int? TenantId { get; set; }

        /// <summary>Optional branch assignment. Null = company-level expense.</summary>
        public int? BranchId { get; set; }

        /// <summary>Optional route assignment (for route expense reports). Must belong to BranchId when set.</summary>
        public int? RouteId { get; set; }
        
        public int CategoryId { get; set; }
        public decimal Amount { get; set; }
        public DateTime Date { get; set; }
        [MaxLength(500)]
        public string? Note { get; set; }
        public int CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; }
        
        // NEW FEATURES: Attachment, Approval, Recurring
        /// <summary>Receipt/attachment file path (relative to uploads folder)</summary>
        public string? AttachmentUrl { get; set; }
        
        /// <summary>Expense approval status: Pending, Approved, Rejected</summary>
        public ExpenseStatus Status { get; set; } = ExpenseStatus.Approved; // Default approved for owners, pending for staff
        
        /// <summary>ID of recurring expense template that generated this expense</summary>
        public int? RecurringExpenseId { get; set; }
        
        /// <summary>Approved/Rejected by user ID</summary>
        public int? ApprovedBy { get; set; }
        
        /// <summary>Approval date</summary>
        public DateTime? ApprovedAt { get; set; }
        
        /// <summary>Rejection reason if status is Rejected</summary>
        [MaxLength(500)]
        public string? RejectionReason { get; set; }
        
        // Navigation properties
        public virtual ExpenseCategory Category { get; set; } = null!;
        public virtual User CreatedByUser { get; set; } = null!;
        public virtual Branch? Branch { get; set; }
        public virtual HexaBill.Api.Models.Route? Route { get; set; }
        public virtual RecurringExpense? RecurringExpense { get; set; }
        public virtual User? ApprovedByUser { get; set; }
    }
    
    public enum ExpenseStatus
    {
        Pending = 0,
        Approved = 1,
        Rejected = 2
    }
}

