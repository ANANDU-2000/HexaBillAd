const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../../frozhen/Starplus_Migration/Starplus_Archive_Clean_Staging_READ_ONLY.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log('Unattributed invoices:');
data.unattributed_invoices.forEach(inv => {
  const outstanding = parseFloat(inv.outstanding_calculated);
  console.log(`Inv ${inv.legacy_invoice_number} (ID ${inv.source_invoice_id}): total=${inv.grand_total}, paid=${inv.paid_amount}, outstanding=${outstanding}, is_deleted=${inv.is_deleted}`);
});

console.log('\nCustomer invoice open balances vs customer cached unpaid:');
let totalCustCached = 0;
let totalInvDerived = 0;
data.customers.forEach(c => {
  const cachedUnpaid = parseFloat(c.unpaid_invoice_amount);
  totalCustCached += cachedUnpaid;

  let custInvsOutstanding = 0;
  let countOpen = 0;
  (c.invoices || []).forEach(inv => {
    if (!inv.is_deleted) {
      const out = parseFloat(inv.outstanding_calculated);
      if (out > 0.005) {
        custInvsOutstanding += out;
        countOpen++;
      }
    }
  });
  totalInvDerived += custInvsOutstanding;

  if (Math.abs(cachedUnpaid - custInvsOutstanding) > 0.005) {
    console.log(`Cust ${c.source_customer_id} (${c.name}): Cached=${cachedUnpaid.toFixed(2)}, InvDerived=${custInvsOutstanding.toFixed(2)}, Diff=${(cachedUnpaid - custInvsOutstanding).toFixed(2)}, OpenInvs=${countOpen}`);
  }
});

console.log(`\nTotal Cust Cached: ${totalCustCached.toFixed(2)}`);
console.log(`Total Invoices Derived: ${totalInvDerived.toFixed(2)}`);
