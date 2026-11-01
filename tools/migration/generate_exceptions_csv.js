const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../../frozhen/Starplus_Migration/Starplus_Archive_Clean_Staging_READ_ONLY.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const exceptions = [];
const sixResiduals = ['6040', '3639', '3664', '3704', '3726', '3756'];

// 1. Unattributed invoices
data.unattributed_invoices.forEach(inv => {
  exceptions.push({
    category: 'UNATTRIBUTED_INVOICE',
    source_record_id: inv.source_invoice_id,
    customer_id: 'NULL',
    invoice_number: inv.legacy_invoice_number,
    expected_value: inv.grand_total,
    actual_value: inv.paid_amount,
    difference: inv.outstanding_calculated,
    root_cause: 'Invoice created in Starplus without CustomerId foreign key (e.g. walk-in cash customer)',
    proposed_resolution: 'Preserve in legacy archive under Unassigned Historical Sales or map to Cash Customer',
    approval_status: 'PENDING_REVIEW'
  });
});

// 2. Scan customer invoices for residuals, overpayments, missing items, pending payments
data.customers.forEach(c => {
  (c.invoices || []).forEach(inv => {
    if (sixResiduals.includes(inv.legacy_invoice_number)) {
      exceptions.push({
        category: 'ONE_CENT_RESIDUAL',
        source_record_id: inv.source_invoice_id,
        customer_id: c.source_customer_id,
        invoice_number: inv.legacy_invoice_number,
        expected_value: inv.grand_total,
        actual_value: inv.paid_amount,
        difference: inv.outstanding_calculated,
        root_cause: 'Historical rounding difference in Starplus ledger (0.01 AED residual)',
        proposed_resolution: 'Preserve exact balance; do not silently round off',
        approval_status: 'PENDING_REVIEW'
      });
    }

    const items = inv.items || [];
    if (items.length === 0 && !inv.is_deleted) {
      exceptions.push({
        category: 'INVOICE_WITHOUT_ITEMS',
        source_record_id: inv.source_invoice_id,
        customer_id: c.source_customer_id,
        invoice_number: inv.legacy_invoice_number,
        expected_value: inv.grand_total,
        actual_value: '0 items',
        difference: inv.grand_total,
        root_cause: 'Source invoice saved without line items in SaleItems table',
        proposed_resolution: 'Preserve invoice total and metadata in legacy archive with INCOMPLETE_SOURCE_ITEMS flag; do not invent items',
        approval_status: 'PENDING_REVIEW'
      });
    }

    const total = parseFloat(inv.grand_total || inv.total_amount || 0);
    const paid = parseFloat(inv.paid_amount || 0);
    if (paid > total + 0.001) {
      exceptions.push({
        category: 'OVERPAYMENT_CREDIT',
        source_record_id: inv.source_invoice_id,
        customer_id: c.source_customer_id,
        invoice_number: inv.legacy_invoice_number,
        expected_value: total.toFixed(2),
        actual_value: paid.toFixed(2),
        difference: (paid - total).toFixed(2),
        root_cause: 'Historical overpayment recorded in Starplus',
        proposed_resolution: 'Preserve overpayment as customer ledger credit',
        approval_status: 'PENDING_REVIEW'
      });
    }

    (inv.payments || []).forEach(p => {
      if (p.status === 'PENDING') {
        exceptions.push({
          category: 'PENDING_PAYMENT',
          source_record_id: p.source_payment_id,
          customer_id: c.source_customer_id,
          invoice_number: inv.legacy_invoice_number,
          expected_value: p.amount,
          actual_value: 'PENDING',
          difference: p.amount,
          root_cause: 'Payment entered in Starplus but not cleared/settled',
          proposed_resolution: 'Do not count in cleared cash receipts or opening balance',
          approval_status: 'PENDING_REVIEW'
        });
      }
    });
  });
});

console.log('Total exceptions found:', exceptions.length);
const header = 'category,source_record_id,customer_id,invoice_number,expected_value,actual_value,difference,root_cause,proposed_resolution,approval_status\n';
const rows = exceptions.map(e => `"${e.category}","${e.source_record_id}","${e.customer_id}","${e.invoice_number}","${e.expected_value}","${e.actual_value}","${e.difference}","${e.root_cause}","${e.proposed_resolution}","${e.approval_status}"`).join('\n');
fs.writeFileSync('STARPLUS-MIGRATION-EXCEPTIONS.csv', header + rows);
console.log('Wrote STARPLUS-MIGRATION-EXCEPTIONS.csv successfully.');

