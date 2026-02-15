using HexaBill.Api.Models;

namespace HexaBill.Api.Modules.Billing
{
    public interface IPdfService
    {
        Task<byte[]> GenerateInvoicePdfAsync(SaleDto sale);
        Task<byte[]> GenerateCombinedInvoicePdfAsync(List<SaleDto> sales);
        Task<byte[]> GenerateSalesLedgerPdfAsync(SalesLedgerReportDto ledgerReport, DateTime fromDate, DateTime toDate, int tenantId);
        Task<byte[]> GeneratePendingBillsPdfAsync(List<PendingBillDto> pendingBills, DateTime fromDate, DateTime toDate, int tenantId);
        Task<byte[]> GenerateCustomerPendingBillsPdfAsync(List<OutstandingInvoiceDto> outstandingInvoices, CustomerDto customer, DateTime asOfDate, DateTime fromDate, DateTime toDate, int tenantId);
    }
}
