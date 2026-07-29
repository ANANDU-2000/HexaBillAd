using System.Collections.Generic;
using HexaBill.Api.Models;

namespace HexaBill.Api.Modules.Billing
{
    public interface IPdfService
    {
        Task<byte[]> GenerateInvoicePdfAsync(SaleDto sale, string format = "A4", string? layout = null);
        /// <summary>Packing-list delivery note from sale (no prices/VAT/totals).</summary>
        Task<byte[]> GenerateDeliveryNotePdfAsync(SaleDto sale, string format = "A4", string? layout = null);
        Task<byte[]> GenerateCombinedInvoicePdfAsync(List<SaleDto> sales);
        Task<byte[]> GenerateSalesLedgerPdfAsync(SalesLedgerReportDto ledgerReport, DateTime fromDate, DateTime toDate, int tenantId);
        Task<byte[]> GeneratePendingBillsPdfAsync(List<PendingBillDto> pendingBills, DateTime fromDate, DateTime toDate, int tenantId);
        Task<byte[]> GenerateCustomerPendingBillsPdfAsync(List<OutstandingInvoiceDto> outstandingInvoices, CustomerDto customer, DateTime asOfDate, DateTime fromDate, DateTime toDate, int tenantId);
        /// <summary>Monthly P&amp;L export for accountant (#58).</summary>
        Task<byte[]> GenerateProfitLossPdfAsync(ProfitReportDto report, DateTime fromDate, DateTime toDate, int tenantId);
        /// <summary>Owner-only worksheet PDF: period and totals (sales, purchases, expenses, received, pending).</summary>
        Task<byte[]> GenerateWorksheetPdfAsync(WorksheetReportDto dto, DateTime fromDate, DateTime toDate, int tenantId);
        /// <summary>Expenses register for a date range (filters match Expenses list / CSV export).</summary>
        Task<byte[]> GenerateExpensesRegisterPdfAsync(IReadOnlyList<ExpenseDto> expenses, DateTime fromDate, DateTime toDate, int tenantId);
        /// <summary>Quotation PDF (A4 or A5).</summary>
        Task<byte[]> GenerateQuotationPdfAsync(QuotationDto quotation, int tenantId, string format = "A4");
        /// <summary>Business Development Agreement PDF (A4 or A5). layout=body for letterhead paper; layout=full for digital header/footer.</summary>
        Task<byte[]> GenerateAgreementPdfAsync(AgreementDto agreement, int tenantId, string format = "A4", string? layout = null);
        /// <summary>Salary Certificate PDF (A4 or A5). layout=body for letterhead paper; layout=full for digital header/footer.</summary>
        Task<byte[]> GenerateSalaryCertificatePdfAsync(SalaryCertificateDto certificate, int tenantId, string format = "A4", string? layout = null);
    }
}
