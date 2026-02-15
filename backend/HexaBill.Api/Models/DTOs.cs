/*
Purpose: Data Transfer Objects for API communication
Author: AI Assistant
Date: 2024
*/
using System.ComponentModel.DataAnnotations;

namespace HexaBill.Api.Models
{
    // Auth DTOs
    public class LoginRequest
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;
        [Required]
        public string Password { get; set; } = string.Empty;
        public bool RememberMe { get; set; }
    }

    public class LoginResponse
    {
        public string Token { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public int UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string CompanyName { get; set; } = string.Empty;
        public string? DashboardPermissions { get; set; }
        public DateTime ExpiresAt { get; set; }
        /// <summary>Tenant ID (0 = Super Admin, >0 = tenant user). Used by frontend for access control.</summary>
        public int? TenantId { get; set; }
        public List<int> AssignedBranchIds { get; set; } = new();
        public List<int> AssignedRouteIds { get; set; } = new();
    }

    public class RegisterRequest
    {
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;
        [Required]
        [EmailAddress]
        [MaxLength(100)]
        public string Email { get; set; } = string.Empty;
        [Required]
        [MinLength(6)]
        public string Password { get; set; } = string.Empty;
        [Required]
        public string Role { get; set; } = "Staff";
        [MaxLength(20)]
        public string? Phone { get; set; }
    }

    public class RegisterResponse
    {
        public int UserId { get; set; }
        public string Email { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }

    public class VerifyEmailRequest
    {
        [Required]
        public string Token { get; set; } = string.Empty;
    }

    public class ResendVerificationRequest
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;
    }

    public class UserDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public int OwnerId { get; set; } // MULTI-TENANT: Owner identification
        public string? DashboardPermissions { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<int> AssignedBranchIds { get; set; } = new();
        public List<int> AssignedRouteIds { get; set; } = new();
    }

    public class CreateUserRequest
    {
        [Required]
        public string Name { get; set; } = string.Empty;
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;
        [Required]
        [MinLength(6)]
        public string Password { get; set; } = string.Empty;
        [Required]
        public string Role { get; set; } = "Staff";
        public string? Phone { get; set; }
        public string? DashboardPermissions { get; set; }
        public List<int>? AssignedBranchIds { get; set; }
        public List<int>? AssignedRouteIds { get; set; }
    }

    public class UpdateUserRequest
    {
        public string? Name { get; set; }
        public string? Phone { get; set; }
        public string? Role { get; set; }
        public string? DashboardPermissions { get; set; }
        public List<int>? AssignedBranchIds { get; set; }
        public List<int>? AssignedRouteIds { get; set; }
    }

    public class ResetPasswordRequest
    {
        [Required]
        [MinLength(6)]
        public string NewPassword { get; set; } = string.Empty;
    }

    // Product DTOs
    public class ProductDto
    {
        public int Id { get; set; }
        public string Sku { get; set; } = string.Empty;
        public string NameEn { get; set; } = string.Empty;
        public string? NameAr { get; set; }
        public string UnitType { get; set; } = string.Empty;
        public decimal ConversionToBase { get; set; }
        public decimal CostPrice { get; set; }
        public decimal SellPrice { get; set; }
        public decimal StockQty { get; set; }
        public int ReorderLevel { get; set; }
        public DateTime? ExpiryDate { get; set; } // ADDED: Track product expiry date
        public string? DescriptionEn { get; set; }
        public string? DescriptionAr { get; set; }
    }

    public class CreateProductRequest
    {
        [Required]
        public string Sku { get; set; } = string.Empty;
        [Required]
        public string NameEn { get; set; } = string.Empty;
        public string? NameAr { get; set; }
        [Required]
        public string UnitType { get; set; } = string.Empty;
        [Required]
        public decimal ConversionToBase { get; set; }
        [Required]
        public decimal CostPrice { get; set; }
        [Required]
        public decimal SellPrice { get; set; }
        // Stock quantity and reorder level - editable from product form
        public decimal StockQty { get; set; } = 0;
        public int ReorderLevel { get; set; } = 0;
        public DateTime? ExpiryDate { get; set; }
        public string? DescriptionEn { get; set; }
        public string? DescriptionAr { get; set; }
    }

    public class PriceChangeLogDto
    {
        public int Id { get; set; }
        public int ProductId { get; set; }
        public decimal OldPrice { get; set; }
        public decimal NewPrice { get; set; }
        public decimal PriceDifference { get; set; }
        public int ChangedBy { get; set; }
        public string? ChangedByName { get; set; }
        public string? Reason { get; set; }
        public DateTime ChangedAt { get; set; }
    }

    // Sale DTOs
    public class CreateSaleRequest
    {
        public int? CustomerId { get; set; }
        public int? BranchId { get; set; }
        public int? RouteId { get; set; }
        [Required]
        public List<SaleItemRequest> Items { get; set; } = new();
        public List<PaymentRequest>? Payments { get; set; }
        public string? Notes { get; set; }
        public decimal Discount { get; set; } = 0;
        public string? InvoiceNo { get; set; } // Optional: Manual invoice number (if not provided, auto-generate)
        [MaxLength(200)]
        public string? ExternalReference { get; set; } // For idempotency - unique external reference (e.g., POS terminal ID, mobile app transaction ID)
        public DateTime? InvoiceDate { get; set; } // Optional: Custom invoice date (defaults to today if not provided) - Admin and Staff can set
        public DateTime? DueDate { get; set; } // Optional: Payment due date for credit customers
    }

    public class UpdateSaleRequest
    {
        public int? CustomerId { get; set; }
        [Required]
        public List<SaleItemRequest> Items { get; set; } = new();
        public List<PaymentRequest>? Payments { get; set; }
        public string? Notes { get; set; }
        public decimal Discount { get; set; } = 0;
        public string? EditReason { get; set; } // Required for Staff users
        public string? RowVersion { get; set; } // Base64 encoded RowVersion for concurrency control
        public DateTime? InvoiceDate { get; set; } // Optional: Custom invoice date - Admin and Staff can modify
        public DateTime? DueDate { get; set; } // Optional: Payment due date for credit customers
    }

    public class UnlockInvoiceRequest
    {
        [Required]
        public string Reason { get; set; } = string.Empty; // Reason for unlocking
    }

    public class SaleItemRequest
    {
        [Required]
        public int ProductId { get; set; }
        [Required]
        public string UnitType { get; set; } = string.Empty;
        [Required]
        public decimal Qty { get; set; }
        [Required]
        public decimal UnitPrice { get; set; }
    }

    public class PaymentRequest
    {
        [Required]
        public string Method { get; set; } = string.Empty;
        [Required]
        public decimal Amount { get; set; }
        public string? Ref { get; set; }
    }

    public class ValidateInvoiceNumberRequest
    {
        [Required]
        public string InvoiceNumber { get; set; } = string.Empty;
        public int? ExcludeSaleId { get; set; }
    }

    public class SaleDto
    {
        public int Id { get; set; }
        public int OwnerId { get; set; } // MULTI-TENANT: Owner identification
        public string InvoiceNo { get; set; } = string.Empty;
        public DateTime InvoiceDate { get; set; }
        public int? CustomerId { get; set; }
        public int? BranchId { get; set; }
        public int? RouteId { get; set; }
        public string? CustomerName { get; set; }
        public decimal Subtotal { get; set; }
        public decimal VatTotal { get; set; }
        public decimal Discount { get; set; }
        public decimal GrandTotal { get; set; }
        public decimal PaidAmount { get; set; } // CRITICAL: Include for balance calculation and accurate reporting
        public string PaymentStatus { get; set; } = string.Empty;
        public DateTime? DueDate { get; set; } // Payment due date for credit customers
        public string? Notes { get; set; }
        public List<SaleItemDto> Items { get; set; } = new();
        public DateTime CreatedAt { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public int Version { get; set; } = 1; // Version number for tracking edits
        public bool IsLocked { get; set; } = false; // Locked after 48 hours
        public DateTime? LastModifiedAt { get; set; }
        public string? LastModifiedBy { get; set; }
        public string? RowVersion { get; set; } // Base64 encoded for concurrency control
        public string? DeletedBy { get; set; } // Deleted by (for audit trail)
        public DateTime? DeletedAt { get; set; } // Deleted at (for audit trail)
        public bool CreditLimitExceeded { get; set; } = false; // True if sale exceeds customer credit limit
        public string? CreditLimitWarning { get; set; } // Warning message if credit limit exceeded
    }

    public class SaleItemDto
    {
        public int Id { get; set; }
        public int ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string UnitType { get; set; } = string.Empty;
        public decimal Qty { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal Discount { get; set; }
        public decimal VatAmount { get; set; }
        public decimal LineTotal { get; set; }
    }

    // Purchase DTOs
    public class CreatePurchaseRequest
    {
        [Required]
        public string SupplierName { get; set; } = string.Empty;
        [Required]
        public string InvoiceNo { get; set; } = string.Empty;
        [Required]
        public DateTime PurchaseDate { get; set; }
        public string? ExpenseCategory { get; set; } // Optional expense category (e.g., "Inventory", "Supplies", "Equipment")
        
        // VAT HANDLING (Optional - if not provided, system will auto-calculate assuming costs include VAT)
        public bool? IncludesVat { get; set; } // True if costs include VAT, False if VAT should be added, Null for auto-detection
        public decimal? VatPercent { get; set; } // VAT percentage (default 5% for UAE)
        
        [Required]
        public List<PurchaseItemRequest> Items { get; set; } = new();
    }

    public class PurchaseItemRequest
    {
        [Required]
        public int ProductId { get; set; }
        [Required]
        public string UnitType { get; set; } = string.Empty;
        [Required]
        public decimal Qty { get; set; }
        [Required]
        public decimal UnitCost { get; set; } // Default: cost INCLUDING VAT (unless IncludesVat=false in parent)
    }

    // Customer DTOs
    public class CustomerDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public string? Trn { get; set; }
        public string? Address { get; set; }
        public decimal CreditLimit { get; set; }
        public decimal Balance { get; set; }
        
        /// <summary>
        /// Customer type: "Credit" or "Cash"
        /// Credit customers can have outstanding balance, Cash customers must pay immediately
        /// </summary>
        public string CustomerType { get; set; } = "Credit";
        
        // Real-time balance tracking fields
        public decimal TotalSales { get; set; }
        public decimal TotalPayments { get; set; }
        public decimal PendingBalance { get; set; }
        public DateTime? LastPaymentDate { get; set; }
    }

    public class CreateCustomerRequest
    {
        [Required]
        public string Name { get; set; } = string.Empty;
        public string? Phone { get; set; }
        [EmailAddress]
        public string? Email { get; set; }
        public string? Trn { get; set; }
        public string? Address { get; set; }
        public decimal CreditLimit { get; set; }
        
        /// <summary>
        /// Customer type: "Credit" or "Cash"
        /// Credit customers can have outstanding balance, Cash customers must pay immediately
        /// Default is "Credit"
        /// </summary>
        public string CustomerType { get; set; } = "Credit";
    }

    public class CustomerLedgerEntry
    {
        public DateTime Date { get; set; }
        public string Type { get; set; } = string.Empty;
        public string Reference { get; set; } = string.Empty;
        public string? PaymentMode { get; set; } // Cash, Cheque, Online, etc.
        public string? Remarks { get; set; } // Payment reference, notes, etc.
        public decimal Debit { get; set; }
        public decimal Credit { get; set; }
        public decimal Balance { get; set; }
        public int? SaleId { get; set; } // For linking to invoices
        public int? PaymentId { get; set; } // For linking to payments
        public string? Status { get; set; } // Paid, Partial, Unpaid
        public decimal PaidAmount { get; set; } // Amount paid for invoice
    }

    // Expense DTOs
    public class ExpenseDto
    {
        public int Id { get; set; }
        public int? BranchId { get; set; }
        public string? BranchName { get; set; }
        public int CategoryId { get; set; }
        public string CategoryName { get; set; } = string.Empty;
        public string CategoryColor { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public DateTime Date { get; set; }
        public string? Note { get; set; }
    }

    public class ExpenseCategoryDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string ColorCode { get; set; } = string.Empty;
    }

    public class CreateExpenseRequest
    {
        public int? BranchId { get; set; }
        [Required]
        public int CategoryId { get; set; }
        [Required]
        public decimal Amount { get; set; }
        [Required]
        public DateTime Date { get; set; }
        public string? Note { get; set; }
    }

    // Report DTOs
    public class SummaryReportDto
    {
        public decimal SalesToday { get; set; }
        public decimal PurchasesToday { get; set; }
        public decimal ExpensesToday { get; set; }
        public decimal? ProfitToday { get; set; }
        public List<ProductDto> LowStockProducts { get; set; } = new();
        public List<SaleDto> PendingInvoices { get; set; } = new();
        public int PendingBills { get; set; } // Count of pending bills
        public decimal PendingBillsAmount { get; set; } // Total amount of pending bills
        public int PaidBills { get; set; } // Count of paid bills
        public decimal PaidBillsAmount { get; set; } // Total amount of paid bills
        public int InvoicesToday { get; set; } // Count of invoices today
        public int InvoicesWeekly { get; set; } // Count of invoices this week
        public int InvoicesMonthly { get; set; } // Count of invoices this month
    }

    public class AISuggestionsDto
    {
        public List<ProductDto> TopSellers { get; set; } = new();
        public List<ProductDto> RestockCandidates { get; set; } = new();
        public List<ProductDto> LowMarginProducts { get; set; } = new();
        public List<CustomerDto> PendingCustomers { get; set; } = new();
        public List<ProductDto> PromotionCandidates { get; set; } = new();
    }

    public class PendingBillDto
    {
        public int Id { get; set; }
        public string InvoiceNo { get; set; } = string.Empty;
        public DateTime InvoiceDate { get; set; }
        public DateTime? DueDate { get; set; }
        public int? CustomerId { get; set; }
        public string? CustomerName { get; set; }
        public decimal GrandTotal { get; set; }
        public decimal PaidAmount { get; set; }
        public decimal BalanceAmount { get; set; }
        public string PaymentStatus { get; set; } = string.Empty;
        public int DaysOverdue { get; set; }
    }

    public class ExpenseAggregateDto
    {
        public string Period { get; set; } = string.Empty; // e.g., "January 2025", "Week 5, 2025", "2025"
        public DateTime PeriodStart { get; set; }
        public DateTime PeriodEnd { get; set; }
        public decimal TotalAmount { get; set; }
        public int Count { get; set; }
        public List<ExpenseCategoryTotalDto> ByCategory { get; set; } = new();
    }

    public class ExpenseCategoryTotalDto
    {
        public string CategoryName { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
        public int Count { get; set; }
    }

    public class ExpenseByCategoryDto
    {
        public int CategoryId { get; set; }
        public string CategoryName { get; set; } = string.Empty;
        public string CategoryColor { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
        public int ExpenseCount { get; set; }
    }

    public class SalesVsExpensesDto
    {
        public string Period { get; set; } = string.Empty; // "2024-01-15" or "2024-01"
        public DateTime Date { get; set; }
        public decimal Sales { get; set; }
        public decimal Purchases { get; set; }
        public decimal Expenses { get; set; }
        public decimal? Profit { get; set; }
    }

    // Branch + Route DTOs
    public class BranchDto
    {
        public int Id { get; set; }
        public int TenantId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Address { get; set; }
        public DateTime CreatedAt { get; set; }
        public int RouteCount { get; set; }
    }

    public class RouteDto
    {
        public int Id { get; set; }
        public int BranchId { get; set; }
        public string BranchName { get; set; } = string.Empty;
        public int TenantId { get; set; }
        public string Name { get; set; } = string.Empty;
        public int? AssignedStaffId { get; set; }
        public string? AssignedStaffName { get; set; }
        public DateTime CreatedAt { get; set; }
        public int CustomerCount { get; set; }
        public int StaffCount { get; set; }
    }

    public class RouteDetailDto : RouteDto
    {
        public List<RouteCustomerDto> Customers { get; set; } = new();
        public List<RouteStaffDto> Staff { get; set; } = new();
        public decimal TotalSales { get; set; }
        public decimal TotalExpenses { get; set; }
        public decimal Profit { get; set; }
    }

    public class RouteCustomerDto
    {
        public int Id { get; set; }
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public DateTime AssignedAt { get; set; }
    }

    public class RouteStaffDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public DateTime AssignedAt { get; set; }
    }

    public class RouteExpenseDto
    {
        public int Id { get; set; }
        public int RouteId { get; set; }
        public string Category { get; set; } = string.Empty; // Fuel, Staff, Delivery, Misc
        public decimal Amount { get; set; }
        public DateTime ExpenseDate { get; set; }
        public string? Description { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class CreateBranchRequest
    {
        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;
        [MaxLength(500)]
        public string? Address { get; set; }
    }

    public class CreateRouteRequest
    {
        [Required]
        public int BranchId { get; set; }
        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;
        public int? AssignedStaffId { get; set; }
    }

    public class CreateRouteExpenseRequest
    {
        public int RouteId { get; set; }
        public string Category { get; set; } = "Misc"; // Fuel, Staff, Delivery, Misc
        public decimal Amount { get; set; }
        public DateTime ExpenseDate { get; set; }
        [MaxLength(500)]
        public string? Description { get; set; }
    }

    public class RouteSummaryDto
    {
        public int RouteId { get; set; }
        public string RouteName { get; set; } = string.Empty;
        public string BranchName { get; set; } = string.Empty;
        public decimal TotalSales { get; set; }
        public decimal TotalExpenses { get; set; }
        public decimal Profit { get; set; }
    }

    public class BranchSummaryDto
    {
        public int BranchId { get; set; }
        public string BranchName { get; set; } = string.Empty;
        public decimal TotalSales { get; set; }
        public decimal TotalExpenses { get; set; }
        public decimal Profit { get; set; }
        public List<RouteSummaryDto> Routes { get; set; } = new();
    }

    // Common DTOs
    public class ApiResponse<T>
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public T? Data { get; set; }
        public List<string>? Errors { get; set; }
    }

    // Invoice Template DTOs
    public class InvoiceTemplateDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Version { get; set; } = "1.0";
        public int CreatedBy { get; set; }
        public string CreatedByName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public bool IsActive { get; set; }
        public string? Description { get; set; }
        public string? HtmlCode { get; set; } // Only included when fetching single template
        public string? CssCode { get; set; } // Only included when fetching single template
    }

    public class CreateInvoiceTemplateRequest
    {
        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;
        [MaxLength(50)]
        public string? Version { get; set; }
        [Required]
        public string HtmlCode { get; set; } = string.Empty;
        public string? CssCode { get; set; }
        public bool IsActive { get; set; } = false;
        [MaxLength(1000)]
        public string? Description { get; set; }
    }

    public class UpdateInvoiceTemplateRequest
    {
        [MaxLength(200)]
        public string? Name { get; set; }
        [MaxLength(50)]
        public string? Version { get; set; }
        public string? HtmlCode { get; set; }
        public string? CssCode { get; set; }
        public bool? IsActive { get; set; }
        [MaxLength(1000)]
        public string? Description { get; set; }
    }

    public class PagedResponse<T>
    {
        public List<T> Items { get; set; } = new();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
    }

    // Return DTOs
    public class CreateSaleReturnRequest
    {
        [Required]
        public int SaleId { get; set; }
        [Required]
        public List<SaleReturnItemRequest> Items { get; set; } = new();
        public string? Reason { get; set; }
        public bool RestoreStock { get; set; } = true;
        public bool IsBadItem { get; set; } = false;
        public decimal? Discount { get; set; }
    }

    public class SaleReturnItemRequest
    {
        [Required]
        public int SaleItemId { get; set; }
        [Required]
        public decimal Qty { get; set; }
        public string? Reason { get; set; }
    }

    public class SaleReturnDto
    {
        public int Id { get; set; }
        public int SaleId { get; set; }
        public string SaleInvoiceNo { get; set; } = string.Empty;
        public int? CustomerId { get; set; }
        public string? CustomerName { get; set; }
        public string ReturnNo { get; set; } = string.Empty;
        public DateTime ReturnDate { get; set; }
        public decimal GrandTotal { get; set; }
        public string? Reason { get; set; }
        public string Status { get; set; } = string.Empty;
        public bool IsBadItem { get; set; }
    }

    public class CreatePurchaseReturnRequest
    {
        [Required]
        public int PurchaseId { get; set; }
        [Required]
        public List<PurchaseReturnItemRequest> Items { get; set; } = new();
        public string? Reason { get; set; }
    }

    public class PurchaseReturnItemRequest
    {
        [Required]
        public int PurchaseItemId { get; set; }
        [Required]
        public decimal Qty { get; set; }
        public string? Reason { get; set; }
    }

    public class PurchaseReturnDto
    {
        public int Id { get; set; }
        public int PurchaseId { get; set; }
        public string PurchaseInvoiceNo { get; set; } = string.Empty;
        public string ReturnNo { get; set; } = string.Empty;
        public DateTime ReturnDate { get; set; }
        public decimal GrandTotal { get; set; }
        public string? Reason { get; set; }
        public string Status { get; set; } = string.Empty;
    }

    // Profit DTOs
    public class ProfitReportDto
    {
        public DateTime FromDate { get; set; }
        public DateTime ToDate { get; set; }
        public decimal TotalSales { get; set; }
        public decimal TotalSalesVat { get; set; }
        public decimal TotalSalesWithVat { get; set; }
        public decimal CostOfGoodsSold { get; set; }
        public decimal GrossProfit { get; set; }
        public decimal GrossProfitMargin { get; set; }
        public decimal TotalExpenses { get; set; }
        public decimal NetProfit { get; set; }
        public decimal NetProfitMargin { get; set; }
        public decimal TotalPurchases { get; set; }
        public List<DailyProfitDto> DailyProfit { get; set; } = new(); // CRITICAL: Daily profit breakdown
    }

    public class ProductProfitDto
    {
        public int ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public decimal QuantitySold { get; set; }
        public decimal TotalSales { get; set; }
        public decimal TotalCost { get; set; }
        public decimal Profit { get; set; }
        public decimal ProfitMargin { get; set; }
    }

    public class DailyProfitDto
    {
        public DateTime Date { get; set; }
        public decimal Sales { get; set; }
        public decimal Expenses { get; set; }
        public decimal Profit { get; set; }
    }

    // Outstanding Invoice DTO
    public class OutstandingInvoiceDto
    {
        public int Id { get; set; }
        public string InvoiceNo { get; set; } = string.Empty;
        public DateTime InvoiceDate { get; set; }
        public decimal GrandTotal { get; set; }
        public decimal PaidAmount { get; set; }
        public decimal BalanceAmount { get; set; }
        public string PaymentStatus { get; set; } = string.Empty;
        public int DaysOverdue { get; set; }
    }

    // Delete Customer Summary DTO
    public class DeleteCustomerSummary
    {
        public string CustomerName { get; set; } = string.Empty;
        public int SalesDeleted { get; set; }
        public int PaymentsDeleted { get; set; }
        public int SaleReturnsDeleted { get; set; }
        public bool StockRestored { get; set; }
    }

    // Backup DTOs
    public class PreviewImportRequest
    {
        public string? FileName { get; set; }
        public string? UploadedFilePath { get; set; }
    }

    public class ImportWithResolutionRequest
    {
        public string? FileName { get; set; }
        public string? UploadedFilePath { get; set; }
        public Dictionary<int, string>? ConflictResolutions { get; set; } // conflictId -> resolution ("merge", "skip", "overwrite", "create_new")
    }

    public class RestoreBackupRequestDto
    {
        public string FileName { get; set; } = string.Empty;
        public string? UploadedFilePath { get; set; }
    }

    // Enhanced Sales Report DTOs
    public class EnhancedSalesReportDto
    {
        public SummaryInfo Summary { get; set; } = new();
        public List<SalesSeriesDto> Series { get; set; } = new();
        public PagedResponse<SalesReportItemDto> Data { get; set; } = new();
    }

    public class SummaryInfo
    {
        public decimal TotalSales { get; set; }
        public decimal NetSales { get; set; }
        public decimal VatCollected { get; set; }
        public decimal AvgOrderValue { get; set; }
        public int TotalInvoices { get; set; }
    }

    public class SalesSeriesDto
    {
        public string Period { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public decimal Amount { get; set; }
        public int Count { get; set; }
    }

    public class SalesReportItemDto
    {
        public int InvoiceId { get; set; }
        public DateTime Date { get; set; }
        public string InvoiceNo { get; set; } = string.Empty;
        public int? CustomerId { get; set; }
        public string? CustomerName { get; set; }
        public List<ProductSummaryDto> Items { get; set; } = new();
        public decimal Qty { get; set; }
        public decimal Gross { get; set; }
        public decimal Vat { get; set; }
        public decimal Discount { get; set; }
        public decimal Net { get; set; }
        public string PaymentStatus { get; set; } = string.Empty;
    }

    public class ProductSummaryDto
    {
        public int ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public decimal Qty { get; set; }
        public decimal Price { get; set; }
    }

    // Aging Report DTOs
    public class AgingReportDto
    {
        public AgingBucket Bucket0_30 { get; set; } = new();
        public AgingBucket Bucket31_60 { get; set; } = new();
        public AgingBucket Bucket61_90 { get; set; } = new();
        public AgingBucket Bucket90Plus { get; set; } = new();
        public decimal TotalOutstanding { get; set; }
        public List<AgingInvoiceDto> Invoices { get; set; } = new();
    }

    public class AgingBucket
    {
        public decimal Total { get; set; }
        public int Count { get; set; }
        public List<AgingInvoiceDto> Invoices { get; set; } = new();
    }

    public class AgingInvoiceDto
    {
        public int Id { get; set; }
        public string InvoiceNo { get; set; } = string.Empty;
        public DateTime InvoiceDate { get; set; }
        public int? CustomerId { get; set; }
        public string? CustomerName { get; set; }
        public decimal GrandTotal { get; set; }
        public decimal PaidAmount { get; set; }
        public decimal BalanceAmount { get; set; }
        public int DaysOverdue { get; set; }
        public string AgingBucket { get; set; } = string.Empty;
    }

    // Stock Report DTOs
    public class StockReportDto
    {
        public StockSummary Summary { get; set; } = new();
        public List<StockItemDto> Items { get; set; } = new();
    }

    public class StockSummary
    {
        public int TotalSKUs { get; set; }
        public int LowStockCount { get; set; }
        public int OutOfStockCount { get; set; }
        public decimal StockValue { get; set; }
    }

    public class StockItemDto
    {
        public int ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string Sku { get; set; } = string.Empty;
        public string UnitType { get; set; } = string.Empty;
        public decimal OnHand { get; set; }
        public decimal Reserved { get; set; }
        public decimal Available { get; set; }
        public decimal ReorderLevel { get; set; }
        public decimal SafetyStock { get; set; }
        public DateTime? LastPurchaseDate { get; set; }
        public bool IsLowStock { get; set; }
        public int? PredictedDaysToStockOut { get; set; }
    }

    // Customer Report DTOs
    public class CustomerReportDto
    {
        public List<CustomerReportItemDto> Customers { get; set; } = new();
        public CustomerReportSummary Summary { get; set; } = new();
    }

    public class CustomerReportItemDto
    {
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string? Trn { get; set; }
        public decimal TotalSales { get; set; }
        public decimal TotalPayments { get; set; }
        public decimal Outstanding { get; set; }
        public decimal AvgDaysToPay { get; set; }
        public DateTime? LastPaymentDate { get; set; }
        public string? LastPaymentMode { get; set; }
    }

    public class CustomerReportSummary
    {
        public int TotalCustomers { get; set; }
        public decimal TotalSales { get; set; }
        public decimal TotalPayments { get; set; }
        public decimal TotalOutstanding { get; set; }
        public decimal AvgDaysToPay { get; set; }
    }

    // Comprehensive Sales Ledger DTOs
    public class SalesLedgerEntryDto
    {
        public DateTime Date { get; set; }
        public string Type { get; set; } = string.Empty; // "Sale" or "Payment"
        public string InvoiceNo { get; set; } = string.Empty;
        public int? CustomerId { get; set; }
        public string? CustomerName { get; set; }
        public string? PaymentMode { get; set; } // "CASH", "ONLINE", "NOT PAID", etc.
        public decimal GrandTotal { get; set; } // CRITICAL: Full invoice amount (for sales) or payment amount (for payments)
        public decimal PaidAmount { get; set; } // CRITICAL: Amount paid for this invoice (for sales) or 0 (for payments)
        public decimal RealPending { get; set; } // Real pending amount (for sales: GrandTotal - PaidAmount, for payments: 0)
        public decimal RealGotPayment { get; set; } // Real payment received (for payments: Amount, for sales: PaidAmount from invoice)
        public string Status { get; set; } = string.Empty; // "Paid", "Unpaid", "Pending", "Partial"
        public decimal CustomerBalance { get; set; } // Per-customer running balance
        public DateTime? PlanDate { get; set; } // Due date (Invoice Date + 30 days)
        public int? SaleId { get; set; }
        public int? PaymentId { get; set; }
    }

    public class SalesLedgerReportDto
    {
        public List<SalesLedgerEntryDto> Entries { get; set; } = new();
        public SalesLedgerSummary Summary { get; set; } = new();
    }

    public class SalesLedgerSummary
    {
        public decimal TotalDebit { get; set; }
        public decimal TotalCredit { get; set; }
        public decimal OutstandingBalance { get; set; }
        public decimal TotalSales { get; set; }
        public decimal TotalPayments { get; set; }
    }
}

