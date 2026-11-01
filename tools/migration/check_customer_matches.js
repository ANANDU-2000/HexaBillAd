const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../../frozhen/Starplus_Migration/Starplus_Archive_Clean_Staging_READ_ONLY.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const existingCustomers = [
  { id: 115, name: 'FrozenHub Onboard Customer', trn: null, phone: '971555000001' },
  { id: 128, name: 'DILKUSH CAFETERIA L.L.C-S.P.C', trn: '105426040900003', phone: null },
  { id: 130, name: 'GOLDEN PLATE RESTAURANT', trn: null, phone: '056 956 4093' },
  { id: 131, name: 'ISHAKALI RESTAURANT', trn: null, phone: '056 956 5555' },
  { id: 132, name: 'GOLDEN EXPRESS RESTAURANT', trn: null, phone: '055' },
  { id: 133, name: 'SASAL NAKEL RESTAURANT', trn: null, phone: '0555' }
];

function norm(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

existingCustomers.forEach(ex => {
  console.log('\nChecking target: ' + ex.id + ' - ' + ex.name);
  const matches = data.customers.filter(sc => {
    if (ex.trn && sc.trn && ex.trn === sc.trn) return true;
    if (norm(ex.name) === norm(sc.name)) return true;
    if (norm(sc.name).includes(norm(ex.name)) || norm(ex.name).includes(norm(sc.name))) return true;
    return false;
  });
  if (matches.length === 0) {
    console.log('  No direct match in Starplus 81 customers.');
  }
  matches.forEach(m => {
    console.log(`  -> Match Starplus ID: ${m.source_customer_id} | Name: "${m.name}" | TRN: ${m.trn} | Invoices: ${m.invoice_count} | Unpaid: ${m.unpaid_invoice_amount}`);
  });
});

