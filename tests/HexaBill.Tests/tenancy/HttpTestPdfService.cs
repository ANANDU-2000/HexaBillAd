using HexaBill.Api.Models;
using HexaBill.Api.Modules.Sales;
using Microsoft.Extensions.DependencyInjection;

namespace HexaBill.Tests;

/// <summary>Wraps <see cref="PdfService"/> so HTTP tests can simulate invoice PDF failures without mutating sales.</summary>
internal sealed class HttpTestPdfService : IPdfService
{
    private static int _failNextInvoicePdfGenerations;
    private readonly PdfService _inner;

    public HttpTestPdfService(IServiceProvider serviceProvider)
    {
        _inner = ActivatorUtilities.CreateInstance<PdfService>(serviceProvider);
    }

    public static void SetFailNextInvoicePdfGenerations(int count) =>
        Interlocked.Exchange(ref _failNextInvoicePdfGenerations, count);

    public Task<byte[]> GenerateInvoicePdfAsync(SaleDto sale, string format = "A4", string? layout = null)
    {
        if (Volatile.Read(ref _failNextInvoicePdfGenerations) > 0)
        {
            Interlocked.Decrement(ref _failNextInvoicePdfGenerations);
            throw new InvalidOperationException("Simulated invoice PDF failure for HTTP integration test.");
        }

        return _inner.GenerateInvoicePdfAsync(sale, format, layout);
    }

    public Task<byte[]> GeneratePaymentReceiptPdfAsync(PaymentReceiptDetailDto receipt) =>
        _inner.GeneratePaymentReceiptPdfAsync(receipt);

    public Task<byte[]> GenerateDeliveryNotePdfAsync(SaleDto sale, string format = "A4", string? layout = null) =>
        _inner.GenerateDeliveryNotePdfAsync(sale, format, layout);

    public Task<byte[]> GenerateCombinedInvoicePdfAsync(List<SaleDto> sales) =>
        _inner.GenerateCombinedInvoicePdfAsync(sales);

    public Task<byte[]> GenerateSalesLedgerPdfAsync(SalesLedgerReportDto ledgerReport, DateTime fromDate, DateTime toDate, int tenantId, string? filterNote = null) =>
        _inner.GenerateSalesLedgerPdfAsync(ledgerReport, fromDate, toDate, tenantId, filterNote);

    public Task<byte[]> GeneratePendingBillsPdfAsync(List<PendingBillDto> pendingBills, DateTime fromDate, DateTime toDate, int tenantId) =>
        _inner.GeneratePendingBillsPdfAsync(pendingBills, fromDate, toDate, tenantId);

    public Task<byte[]> GenerateCustomerPendingBillsPdfAsync(List<OutstandingInvoiceDto> outstandingInvoices, CustomerDto customer, DateTime asOfDate, DateTime fromDate, DateTime toDate, int tenantId) =>
        _inner.GenerateCustomerPendingBillsPdfAsync(outstandingInvoices, customer, asOfDate, fromDate, toDate, tenantId);

    public Task<byte[]> GenerateProfitLossPdfAsync(ProfitReportDto report, DateTime fromDate, DateTime toDate, int tenantId) =>
        _inner.GenerateProfitLossPdfAsync(report, fromDate, toDate, tenantId);

    public Task<byte[]> GenerateWorksheetPdfAsync(WorksheetReportDto dto, DateTime fromDate, DateTime toDate, int tenantId) =>
        _inner.GenerateWorksheetPdfAsync(dto, fromDate, toDate, tenantId);

    public Task<byte[]> GenerateSummaryReportPdfAsync(SummaryReportDto summary, DateTime fromDate, DateTime toDate, int tenantId) =>
        _inner.GenerateSummaryReportPdfAsync(summary, fromDate, toDate, tenantId);

    public Task<QuestPDF.Infrastructure.IComponent?> CreateTenantLetterheadAsync(int tenantId) => _inner.CreateTenantLetterheadAsync(tenantId);

    public Task<byte[]> GenerateVatManagementReportPdfAsync(VatReturn201Dto report, int tenantId) =>
        _inner.GenerateVatManagementReportPdfAsync(report, tenantId);

    public Task<byte[]> GenerateExpensesRegisterPdfAsync(IReadOnlyList<ExpenseDto> expenses, DateTime fromDate, DateTime toDate, int tenantId) =>
        _inner.GenerateExpensesRegisterPdfAsync(expenses, fromDate, toDate, tenantId);

    public Task<byte[]> GenerateQuotationPdfAsync(QuotationDto quotation, int tenantId, string format = "A4", string? layout = null) =>
        _inner.GenerateQuotationPdfAsync(quotation, tenantId, format, layout);

    public Task<byte[]> GenerateAgreementPdfAsync(AgreementDto agreement, int tenantId, string format = "A4", string? layout = null) =>
        _inner.GenerateAgreementPdfAsync(agreement, tenantId, format, layout);

    public Task<byte[]> GenerateSalaryCertificatePdfAsync(SalaryCertificateDto certificate, int tenantId, string format = "A4", string? layout = null) =>
        _inner.GenerateSalaryCertificatePdfAsync(certificate, tenantId, format, layout);
}
